const Claim = require('../models/Claim');
const Beneficiary = require('../models/Beneficiary');
const { Member } = require('../../../shared/models');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const REQUIREMENT_KEYS = [
  'claimApplicationForm',
  'deathCertificate',
  'memberCooperativeId',
  'beneficiaryValidId',
];

// Register New Claim
const createClaim = async (req, res) => {
  try {
    const { memberId, beneficiaryId, dateOfDeath, causeOfDeath, remarks } = req.body;
    const createdBy = req.body.createdBy || req.user?.username || 'admin';

    if (!memberId || !beneficiaryId || !dateOfDeath) {
      return res.status(400).json({
        success: false,
        message: 'Member, beneficiary, and date of death are required',
      });
    }

    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const beneficiary = await Beneficiary.findOne({ beneficiaryId, memberId });
    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: 'Beneficiary not found for this member',
      });
    }

    const claim = new Claim({
      claimId: uuidv4(),
      memberId,
      memberName: member.memberName,
      beneficiaryId,
      beneficiaryName: beneficiary.beneficiaryName,
      beneficiaryRelationship: beneficiary.relationship,
      beneficiaryContact: beneficiary.contactNumber,
      dateOfDeath: new Date(dateOfDeath),
      dateFiled: new Date(),
      causeOfDeath,
      remarks,
      status: 'pending_requirements',
      statusHistory: [
        {
          status: 'pending_requirements',
          changedBy: createdBy,
          changedAt: new Date(),
          notes: 'Claim filed',
        },
      ],
      createdBy,
    });

    await claim.save();

    // A claim being filed means the member has passed away — flip their
    // status so they're naturally excluded from the death-assessment
    // deduction their own claim will trigger (Treasurer only charges
    // {status:'active'} members).
    member.status = 'deceased';
    await member.save();

    await createAuditLog({
      userId: req.user?.id,
      userName: createdBy,
      userRole: req.user?.role || 'admin',
      action: 'claim_created',
      module: 'mortuary',
      entityType: 'claim',
      entityId: claim.claimId,
      entityName: claim.memberName,
      description: `Claim filed for ${claim.memberName}, beneficiary ${claim.beneficiaryName}`,
      changes: { before: null, after: claim.toObject() },
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({
      success: true,
      message: 'Claim registered successfully',
      data: claim,
    });
  } catch (error) {
    console.error('Error creating claim:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating claim',
      error: error.message,
    });
  }
};

// View Claims — search + filter + pagination
const getAllClaims = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { status, search } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { claimId: searchRegex },
        { memberName: searchRegex },
        { beneficiaryName: searchRegex },
      ];
    }

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query)
      .sort({ dateFiled: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json(buildPaginatedResponse(claims, total, page, limit));
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching claims',
      error: error.message,
    });
  }
};

// Claim Details — member info, beneficiary info, claim details, checklist,
// verification info, status history
const getClaimById = async (req, res) => {
  try {
    const { claimId } = req.params;

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    const [member, beneficiary] = await Promise.all([
      Member.findOne({ memberId: claim.memberId }),
      Beneficiary.findOne({ beneficiaryId: claim.beneficiaryId }),
    ]);

    res.status(200).json({
      success: true,
      data: { claim, member, beneficiary },
    });
  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching claim',
      error: error.message,
    });
  }
};

// Physical Requirements Checklist — the documents themselves are submitted
// in person at the cooperative office; this only records whether each has
// been received/verified.
const updateRequirements = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { requirements } = req.body;

    if (!requirements || typeof requirements !== 'object') {
      return res.status(400).json({ success: false, message: 'Requirements payload is required' });
    }

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    REQUIREMENT_KEYS.forEach((key) => {
      if (requirements[key] && typeof requirements[key] === 'object') {
        claim.requirements[key] = {
          ...claim.requirements[key].toObject(),
          ...requirements[key],
        };
      }
    });

    await claim.save();

    res.status(200).json({
      success: true,
      message: 'Requirements checklist updated',
      data: claim,
    });
  } catch (error) {
    console.error('Error updating requirements checklist:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating requirements checklist',
      error: error.message,
    });
  }
};

// Verification Information
const updateVerification = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { verifiedBy, verificationDate, remarks } = req.body;

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    claim.verification = {
      verifiedBy: verifiedBy || req.user?.username || claim.verification?.verifiedBy,
      verificationDate: verificationDate ? new Date(verificationDate) : new Date(),
      remarks,
    };

    await claim.save();

    res.status(200).json({
      success: true,
      message: 'Verification information saved',
      data: claim,
    });
  } catch (error) {
    console.error('Error updating verification information:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating verification information',
      error: error.message,
    });
  }
};

// Approve Claim — only legal once every requirement item is submitted.
// Moves straight from approved to pending_deduction so the Treasurer's
// "notification" (a live query for pending_deduction claims) picks it up
// immediately.
const approveClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const approvedBy = req.body.approvedBy || req.user?.username || 'admin';

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    if (claim.status !== 'pending_requirements') {
      return res.status(400).json({
        success: false,
        message: `Claim cannot be approved from status "${claim.status}"`,
      });
    }

    const missing = REQUIREMENT_KEYS.filter((key) => !claim.requirements[key]?.submitted);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'All requirement items must be submitted before a claim can be approved',
        missingRequirements: missing,
      });
    }

    const before = claim.toObject();
    const now = new Date();
    claim.status = 'pending_deduction';
    claim.approval = { approvedBy, approvedAt: now };
    claim.statusHistory.push(
      { status: 'approved', changedBy: approvedBy, changedAt: now, notes: 'Requirements verified and approved' },
      { status: 'pending_deduction', changedBy: approvedBy, changedAt: now, notes: 'Ready for Treasurer month-end processing' },
    );

    await claim.save();

    await createAuditLog({
      userId: req.user?.id,
      userName: approvedBy,
      userRole: req.user?.role || 'admin',
      action: 'claim_approved',
      module: 'mortuary',
      entityType: 'claim',
      entityId: claim.claimId,
      entityName: claim.memberName,
      description: `Claim for ${claim.memberName} approved — moved to Pending Deduction`,
      changes: { before, after: claim.toObject() },
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      success: true,
      message: 'Claim approved and moved to Pending Monthly Deduction',
      data: claim,
    });
  } catch (error) {
    console.error('Error approving claim:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving claim',
      error: error.message,
    });
  }
};

// Reject Claim
const rejectClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { reason } = req.body;
    const rejectedBy = req.body.rejectedBy || req.user?.username || 'admin';

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'A rejection reason is required' });
    }

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    if (claim.status !== 'pending_requirements') {
      return res.status(400).json({
        success: false,
        message: `Claim cannot be rejected from status "${claim.status}"`,
      });
    }

    const before = claim.toObject();
    const now = new Date();
    claim.status = 'rejected';
    claim.rejection = { rejectedBy, rejectedAt: now, reason: reason.trim() };
    claim.statusHistory.push({ status: 'rejected', changedBy: rejectedBy, changedAt: now, notes: reason.trim() });

    await claim.save();

    await createAuditLog({
      userId: req.user?.id,
      userName: rejectedBy,
      userRole: req.user?.role || 'admin',
      action: 'claim_rejected',
      module: 'mortuary',
      entityType: 'claim',
      entityId: claim.claimId,
      entityName: claim.memberName,
      description: `Claim for ${claim.memberName} rejected: ${reason.trim()}`,
      changes: { before, after: claim.toObject() },
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      success: true,
      message: 'Claim rejected',
      data: claim,
    });
  } catch (error) {
    console.error('Error rejecting claim:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting claim',
      error: error.message,
    });
  }
};

module.exports = {
  REQUIREMENT_KEYS,
  createClaim,
  getAllClaims,
  getClaimById,
  updateRequirements,
  updateVerification,
  approveClaim,
  rejectClaim,
};
