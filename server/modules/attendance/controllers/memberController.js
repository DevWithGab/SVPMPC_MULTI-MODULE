const { processMemberBatches } = require('../../../shared/utils/memberImportBatches');
const { Member } = require('../../../shared/models');
const { parseCSV, validateMemberData } = require('../services/csvParserService');
const { generateQRCode, buildQRCodeMatrix } = require('../services/qrCodeService');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { getPaginationParams, buildPaginationMeta } = require('../../../shared/utils/pagination');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

// Upload members from CSV
const uploadMembers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Parse CSV file
    const members = await parseCSV(req.file.path);

    // Validate member data
    const validation = validateMemberData(members);
    if (!validation.isValid) {
      fs.unlinkSync(req.file.path);

      // Log failed validation
      await createAuditLog({
        userId: req.user?.userId || req.user?.id,
        userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
        userRole: req.user?.role || 'secretary',
        action: 'member_imported',
        module: 'attendance',
        entityType: 'member',
        description: `CSV import failed validation`,
        status: 'failed',
        errorMessage: `Validation failed: ${JSON.stringify(validation.errors)}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(400).json({
        message: 'CSV validation failed',
        errors: validation.errors,
      });
    }

    // Save members to database
    const savedMembers = [];
    const errors = [];

    const rowResults = await processMemberBatches(members, async memberData => {
      try {
        const newMember = new Member({
          memberId: memberData.memberId.trim(),
          memberName: memberData.memberName.trim(),
          email: memberData.email.trim(),
          phoneNumber: memberData.phoneNumber.trim(),
          barangay: memberData.barangay.trim(),
          address: memberData.address.trim(),
          modules: ['attendance', 'mortuary'],
        });

        const saved = await newMember.save();
        return { saved };
      } catch (error) {
        return { error: {
          memberId: memberData.memberId,
          error: safeErrorMessage(error),
        } };
      }
    });
    for (const result of rowResults) {
      if (result.saved) savedMembers.push(result.saved);
      else errors.push(result.error);
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Log successful import
    await createAuditLog({
      userId: req.user?.userId || req.user?.id,
      userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
      userRole: req.user?.role || 'secretary',
      action: 'member_imported',
      module: 'attendance',
      entityType: 'member',
      description: `Bulk imported ${savedMembers.length} members from CSV`,
      status: savedMembers.length === members.length ? 'success' : 'partial',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        totalRecords: members.length,
        successCount: savedMembers.length,
        errorCount: errors.length,
        fileName: req.file.originalname,
      },
    });

    res.status(201).json({
      message: 'Members uploaded successfully',
      savedCount: savedMembers.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      members: savedMembers,
    });
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }

    // Log failed import
    await createAuditLog({
      userId: req.user?.userId || req.user?.id,
      userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
      userRole: req.user?.role || 'secretary',
      action: 'member_imported',
      module: 'attendance',
      entityType: 'member',
      description: `CSV import failed`,
      status: 'failed',
      errorMessage: error.message,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(500).json({ message: 'Error uploading members', error: safeErrorMessage(error) });
  }
};

// Preserve response order while overlapping independent database saves.
const issueMemberQRCodes = async members => {
  const rows = await processMemberBatches(members, async member => {
    try {
      if (member.status === 'deceased' || member.status === 'inactive') {
        return { error: { memberId: member.memberId, error: member.status === 'deceased' ? 'Member is recorded as deceased' : 'Member is inactive' } };
      }
      const issued = await generateQRCode(member);
      if (!issued.success) return { error: { memberId: member.memberId, error: issued.error } };
      member.qrCode = issued.qrCode;
      member.qrCodeUrl = issued.qrCodeUrl;
      member.qrCodeGenerated = true;
      member.qrCodeActive = true;
      await member.save();
      return { result: { memberId: member.memberId, memberName: member.memberName, qrCodeUrl: member.qrCodeUrl } };
    } catch (error) {
      return { error: { memberId: member.memberId, error: safeErrorMessage(error) } };
    }
  });
  return {
    results: rows.filter(row => row.result).map(row => row.result),
    errors: rows.filter(row => row.error).map(row => row.error),
  };
};

// Generate QR codes for members
const generateQRCodes = async (req, res) => {
  try {
    const { memberIds } = req.body;

    /* Array.isArray + every-element-is-string ang ginamit, hindi lang basta
    truthy/.length check: pumapasa yung plain truthy check sa kahit anong
    value na may .length property (e.g. bare string), at kung hindi
    vinalidate ang bawat element, puwedeng makasingit sa $in list sa baba
    yung non-string entry (object, number, etc.). Nag-match ang $in by
    equality imbes na basahin ang element bilang operator, kaya hindi ito
    naging full injection gaya ng req.body/req.query fields na naguguardahan
    na sa ibang parte - pero unvalidated input pa rin na umaabot sa query,
    at nagresulta ng confusing 500 imbes na malinis na 400 ang malformed
    shape dito. */
    if (
      !Array.isArray(memberIds) || memberIds.length === 0 ||
      !memberIds.every((id) => typeof id === 'string')
    ) {
      return res.status(400).json({ message: 'No passbook numbers provided' });
    }

    const members = await Member.find({ memberId: { $in: memberIds } });

    if (members.length === 0) {
      return res.status(404).json({ message: 'No members found' });
    }

    const { results, errors } = await issueMemberQRCodes(members);

    // Log audit event
    await createAuditLog({
      userId: req.user?.userId || req.user?.id,
      userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
      userRole: req.user?.role || 'secretary',
      action: 'qr_code_generated',
      module: 'attendance',
      entityType: 'member',
      description: `Generated QR codes for ${results.length} members`,
      status: results.length === memberIds.length ? 'success' : 'partial',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        requestedCount: memberIds.length,
        successCount: results.length,
        errorCount: errors.length,
      },
    });

    res.status(200).json({
      message: 'QR codes generated successfully',
      generatedCount: results.length,
      errorCount: errors.length,
      results: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    // Log failed attempt
    await createAuditLog({
      userId: req.user?.userId || req.user?.id,
      userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
      userRole: req.user?.role || 'secretary',
      action: 'qr_code_generated',
      module: 'attendance',
      entityType: 'member',
      description: `Failed to generate QR codes`,
      status: 'failed',
      errorMessage: error.message,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(500).json({ message: 'Error generating QR codes', error: safeErrorMessage(error) });
  }
};

// Generate QR codes for all members without QR codes
const generateAllQRCodes = async (req, res) => {
  try {
    /* Shared sa Mortuary module ang Member.status - hindi dapat bigyan ng
    fresh QR para sa attendance ang member na naging 'deceased' doon. */
    const members = await Member.find({ qrCodeGenerated: false, status: { $nin: ['deceased', 'inactive'] } });

    if (members.length === 0) {
      return res.status(200).json({ message: 'All members already have QR codes' });
    }

    const { results, errors } = await issueMemberQRCodes(members);

    res.status(200).json({
      message: 'QR codes generated for all members',
      generatedCount: results.length,
      errorCount: errors.length,
      results: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating QR codes', error: safeErrorMessage(error) });
  }
};

/* Nililimitahan ang data na nakikita ng Scanner Operator batay sa role niya, 
habang pinananatili ang kumpletong impormasyon para sa Admin at Secretary. 
Ito ay security measure para hindi mag-access ng hindi kailangang personal information
ang mga user na may mas mababang permissions.*/
const SCANNER_OPERATOR_PROJECTION = 'memberId memberName barangay qrCode -_id';
const memberReadProjection = (req) => req.user?.role === 'scanner_operator'
  ? SCANNER_OPERATOR_PROJECTION
  : null;

/* Get all members - bounded ito gamit ang parehong pagination utility na
ginagamit sa ibang parte (shared/utils/pagination), kaya hindi na puwedeng
ibalik ulit ng isang request yung entire, ever-growing collection. Walang
screen dito na humihingi ng specific page - nagpapage lang ang
memberAPI.getAllMembers() sa client through this at pinagsasama-sama, kaya
hindi nagbabago yung "give me the whole roster" contract na inaasahan ng
mga callers na ito. */
const getAllMembers = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    // All cooperative members are shared; only staff access is module-scoped.
    const filter = {};
    const projection = memberReadProjection(req);
    const [members, total] = await Promise.all([
      Member.find(filter, projection).skip(skip).limit(limit),
      Member.countDocuments(filter),
    ]);
    res.status(200).json({
      count: members.length,
      members: members,
      pagination: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching members', error: safeErrorMessage(error) });
  }
};

// Get member by ID
const getMemberById = async (req, res) => {
  try {
    const { memberId } = req.params;
    const member = await Member.findOne(
      { memberId },
      memberReadProjection(req),
    );

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    res.status(200).json(member);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching member', error: safeErrorMessage(error) });
  }
};

/* Force-regenerate ng QR code ng isang member - ininvalidate yung old
image (new file, new embedded qrId) at ang bagong isa ang naiiwang active. */
const regenerateQRCode = async (req, res) => {
  try {
    const { memberId } = req.params;
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }
    if (member.status === 'deceased') {
      return res.status(400).json({ message: 'This member is recorded as deceased — QR management is disabled' });
    }
    if (member.status === 'inactive') {
      return res.status(400).json({ message: 'This member is inactive — activate the member before turning their QR code on' });
    }

    const qrResult = await generateQRCode(member);
    if (!qrResult.success) {
      return res.status(500).json({ message: 'Error regenerating QR code', error: safeErrorMessage(qrResult.error) });
    }

    member.qrCode = qrResult.qrCode;
    member.qrCodeUrl = qrResult.qrCodeUrl;
    member.qrCodeGenerated = true;
    member.qrCodeActive = true;
    await member.save();

    await createAuditLog({
      userId: req.user?.userId || req.user?.id,
      userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
      userRole: req.user?.role || 'admin',
      action: 'qr_code_regenerated',
      module: 'attendance',
      entityType: 'member',
      entityId: member.memberId,
      entityName: member.memberName,
      description: `QR code regenerated for member "${member.memberName}"`,
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({ message: 'QR code regenerated successfully', member });
  } catch (error) {
    res.status(500).json({ message: 'Error regenerating QR code', error: safeErrorMessage(error) });
  }
};

/* I-deactivate yung QR ng member - nananatili yung image at file, pero
hindi na ito tatanggapin para sa scan-based attendance until reactivated. */
const deactivateQRCode = async (req, res) => {
  try {
    const { memberId } = req.params;
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }
    if (!member.qrCodeGenerated) {
      return res.status(400).json({ message: 'This member has no QR code to deactivate' });
    }
    if (!member.qrCodeActive) {
      return res.status(400).json({ message: 'This member\'s QR code is already inactive' });
    }

    member.qrCodeActive = false;
    await member.save();

    await createAuditLog({
      userId: req.user?.userId || req.user?.id,
      userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
      userRole: req.user?.role || 'admin',
      action: 'qr_code_deactivated',
      module: 'attendance',
      entityType: 'member',
      entityId: member.memberId,
      entityName: member.memberName,
      description: `QR code deactivated for member "${member.memberName}"`,
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({ message: 'QR code deactivated successfully', member });
  } catch (error) {
    res.status(500).json({ message: 'Error deactivating QR code', error: safeErrorMessage(error) });
  }
};

const reactivateQRCode = async (req, res) => {
  try {
    const { memberId } = req.params;
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }
    if (member.status === 'deceased') {
      return res.status(400).json({ message: 'This member is recorded as deceased — QR management is disabled' });
    }
    if (member.status === 'inactive') {
      return res.status(400).json({ message: 'This member is inactive — activate the member before turning their QR code on' });
    }
    if (!member.qrCodeGenerated) {
      return res.status(400).json({ message: 'This member has no QR code to reactivate' });
    }
    if (member.qrCodeActive) {
      return res.status(400).json({ message: 'This member\'s QR code is already active' });
    }

    member.qrCodeActive = true;
    await member.save();

    await createAuditLog({
      userId: req.user?.userId || req.user?.id,
      userName: req.user?.fullName || req.user?.name || req.user?.username || 'Unknown',
      userRole: req.user?.role || 'admin',
      action: 'qr_code_reactivated',
      module: 'attendance',
      entityType: 'member',
      entityId: member.memberId,
      entityName: member.memberName,
      description: `QR code reactivated for member "${member.memberName}"`,
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({ message: 'QR code reactivated successfully', member });
  } catch (error) {
    res.status(500).json({ message: 'Error reactivating QR code', error: safeErrorMessage(error) });
  }
};

/* Check QR status - lightweight single-member lookup para ma-confirm ng
admin yung current generated/active state without pulling the whole
roster. */
const getQRStatus = async (req, res) => {
  try {
    const { memberId } = req.params;
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    res.status(200).json({
      memberId: member.memberId,
      memberName: member.memberName,
      qrCodeGenerated: member.qrCodeGenerated,
      qrCodeActive: member.qrCodeActive,
      qrCodeUrl: member.qrCodeUrl,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error checking QR status', error: safeErrorMessage(error) });
  }
};

// Fetch current, eligible issued QR data in one bounded database query.
const getQRCodeCards = async (req, res) => {
  const { memberIds } = req.body;
  if (!Array.isArray(memberIds) || !memberIds.length || memberIds.length > 100 ||
      !memberIds.every(id => typeof id === 'string' && id.trim())) {
    return res.status(400).json({ message: 'Provide between 1 and 100 passbook numbers.' });
  }
  try {
    const members = await Member.find({ memberId: { $in: memberIds } })
      .select('memberId memberName barangay status joinDate qrCode qrCodeUrl qrCodeGenerated qrCodeActive').lean();
    const byId = new Map(members.map(member => [member.memberId, member]));
    const cards = [];
    for (const id of memberIds) {
      const member = byId.get(id);
      if (!member || ['inactive', 'deceased'].includes(member.status) || !member.qrCodeGenerated ||
          member.qrCodeActive === false || !member.qrCode) {
        return res.status(409).json({ message: 'Some members no longer have an active QR code. Refresh the directory before printing.' });
      }
      cards.push({ memberId: id, memberName: member.memberName, barangay: member.barangay,
        status: member.status, joinDate: member.joinDate, qrCodeUrl: member.qrCodeUrl,
        rows: buildQRCodeMatrix(member) });
    }
    res.set('Cache-Control', 'no-store');
    return res.json({ cards });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to prepare QR cards', error: safeErrorMessage(error) });
  }
};

module.exports = {
  getQRCodeCards,
  uploadMembers,
  generateQRCodes,
  generateAllQRCodes,
  regenerateQRCode,
  deactivateQRCode,
  reactivateQRCode,
  getQRStatus,
  getAllMembers,
  getMemberById,
};
