const { parseCsvDate } = require('../utils/csvDate');
const { Member } = require('../models');
const Beneficiary = require('../../modules/mortuary/models/Beneficiary');
const { v4: uuidv4 } = require('uuid');
const { safeErrorMessage } = require('../../middleware/errorHandler');

/* PH mobile numbers: 11 digits, nagsisimula sa 09 (e.g. 09171234567). Mirrors
yung client's utils/validation.js at beneficiaryController.js - hindi sapat
yung client-side check lang bilang real enforcement dahil puwede namang
direktang tawagin ang endpoint na ito. */
const PH_PHONE_REGEX = /^09\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeContact = value => typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
const contactError = (email, phoneNumber) => {
  if (email && !EMAIL_REGEX.test(email)) return 'Enter a valid email address.';
  if (phoneNumber && !PH_PHONE_REGEX.test(phoneNumber)) return 'Phone number must be an 11-digit PH mobile number starting with 09 (e.g. 09171234567)';
  return '';
};

/* Auto-register ng structured Beneficiary record pag member-creation time.
Required ng Beneficiary model yung contact number na dati hindi kinukolekta
ng member-creation forms, kaya mag-fire lang ito kapag may binigay talaga -
kung wala, makukuha pa rin ng member yung free-text
beneficiaries/beneficiaryRelationship fields gaya ng dati, at ipapakita yung
"Not Registered" sa admin Beneficiaries screen hanggang hindi nacomplete
manually dun. Hindi ito nagthrow: hindi dapat maapektuhan ng problema sa
beneficiary-registration yung successful na member creation. */
const maybeRegisterBeneficiary = async ({ memberId, memberName, beneficiaryName, relationship, contactNumber, address }) => {
  if (!beneficiaryName || !relationship || !contactNumber) return null;
  const trimmedContact = String(contactNumber).trim();
  if (!PH_PHONE_REGEX.test(trimmedContact)) return null;

  try {
    const beneficiary = new Beneficiary({
      beneficiaryId: uuidv4(),
      memberId,
      memberName,
      beneficiaryName: String(beneficiaryName).trim(),
      relationship: String(relationship).trim(),
      contactNumber: trimmedContact,
      address,
      updatedBy: 'system (auto-registered at member creation)',
    });
    await beneficiary.save();
    return beneficiary;
  } catch (error) {
    console.error(`Error auto-registering beneficiary for ${memberId}:`, error.message);
    return null;
  }
};

// Create a member record for staff-managed attendance and mortuary services.
const createMember = async (req, res) => {
  try {
    const {
      memberName,
      email: rawEmail,
      phoneNumber: rawPhoneNumber,
      barangay,
      address,
      beneficiaries,
      beneficiaryRelationship,
      beneficiaryContactNumber,
      dateOfBirth,
      gender,
      emergencyContact,
    } = req.body;

    const email = normalizeContact(rawEmail);
    const phoneNumber = normalizeContact(rawPhoneNumber);
    // Contact details are optional; validate them only when supplied.
    if (!memberName || !barangay || !address) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const invalidContact = contactError(email, phoneNumber);
    if (invalidContact) return res.status(400).json({ message: invalidContact });

    // Check if email already exists
    const existingMember = email ? await Member.findOne({ email }) : null;
    if (existingMember) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Keep the shared memberId key so attendance and mortuary links stay compatible.
    const passbookNo = normalizeContact(req.body.passbookNo ?? req.body.memberId);
    const memberId = passbookNo || `MEM-${uuidv4()}`;
    if (passbookNo && await Member.findOne({ memberId })) {
      return res.status(400).json({ message: 'Passbook No. already exists' });
    }

    // Create member
    const member = new Member({
      memberId,
      memberName,
      email,
      phoneNumber,
      barangay,
      address,
      beneficiaries,
      beneficiaryRelationship,
      dateOfBirth,
      gender,
      emergencyContact,
      modules: ['attendance', 'mortuary'],
      status: 'active',
    });

    await member.save();

    await maybeRegisterBeneficiary({
      memberId,
      memberName,
      beneficiaryName: beneficiaries,
      relationship: beneficiaryRelationship,
      contactNumber: beneficiaryContactNumber,
      address,
    });

    res.status(201).json({
      message: 'Member created successfully',
      member: {
        memberId: member.memberId,
        memberName: member.memberName,
        email: member.email,
        phoneNumber: member.phoneNumber,
        status: member.status,
      },
    });
  } catch (error) {
    console.error('Error creating member:', error);
    if (error.code === 11000) {
      if (error.keyPattern?.memberId || error.keyValue?.memberId) {
        return res.status(400).json({ message: 'Passbook No. already exists' });
      }
      /* Yung findOne check sa taas ay friendly first pass lang, hindi yun
      ang real guard - puwedeng pumasa yung dalawang concurrent requests para
      sa parehong email bago man magsave ang isa. Yung Member.email's partial
      unique index ang talagang humihinto sa pangalawa; ito lang
      ginagawang parehong clean message imbes na raw 500. */
      if (error.keyPattern?.email || error.keyValue?.email) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }
    res.status(500).json({ message: 'Error creating member', error: safeErrorMessage(error) });
  }
};

// Bulk create members from CSV
const bulkCreateMembers = async (req, res) => {
  try {
    const { members } = req.body;

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ message: 'Invalid members data' });
    }

    const results = {
      success: [],
      failed: [],
    };

    for (const [index, memberData] of members.entries()) {
      try {
        if (memberData.dateOfBirth) {
          const parsed = parseCsvDate(memberData.dateOfBirth, req.body.dateOrder);
          if (parsed.error) throw new Error('Date of birth: ' + parsed.error);
          memberData.dateOfBirth = parsed.value;
        }
        memberData.email = normalizeContact(memberData.email);
        memberData.phoneNumber = normalizeContact(memberData.phoneNumber);
        const invalidContact = contactError(memberData.email, memberData.phoneNumber);
        if (invalidContact) throw new Error(invalidContact);
        console.log(`📝 Processing member: ${memberData.memberName} (${memberData.email})`);
        
        // Check if email already exists
        const existingMember = memberData.email ? await Member.findOne({ email: memberData.email }) : null;
        if (existingMember) {
          console.log(`❌ Email already exists: ${memberData.email}`);
          results.failed.push({
            row: index + 2,
            email: memberData.email,
            memberName: memberData.memberName,
            reason: 'Email already exists',
          });
          continue;
        }

        // Use provided memberId or generate unique one
        const memberId = normalizeContact(memberData.passbookNo ?? memberData.memberId) || `MEM-${uuidv4()}`;
        console.log(`🆔 Using memberId: ${memberId}`);

        // Check if memberId already exists
        const existingMemberId = await Member.findOne({ memberId });
        if (existingMemberId) {
          console.log(`❌ MemberId already exists: ${memberId}`);
          results.failed.push({
            row: index + 2,
            email: memberData.email,
            memberName: memberData.memberName,
            reason: `Passbook No. ${memberId} already exists`,
          });
          continue;
        }

        // Create member
        const member = new Member({
          memberId,
          memberName: memberData.memberName,
          email: memberData.email,
          phoneNumber: memberData.phoneNumber,
          barangay: memberData.barangay,
          address: memberData.address,
          beneficiaries: memberData.beneficiaries || '',
          beneficiaryRelationship: memberData.beneficiaryRelationship || '',
          dateOfBirth: memberData.dateOfBirth,
          gender: memberData.gender,
          modules: ['attendance', 'mortuary'],
          status: 'active',
        });

        await member.save();
        console.log(`✅ Member saved: ${member.memberId}`);

        await maybeRegisterBeneficiary({
          memberId,
          memberName: memberData.memberName,
          beneficiaryName: memberData.beneficiaries,
          relationship: memberData.beneficiaryRelationship,
          contactNumber: memberData.beneficiaryContactNumber,
          address: memberData.address,
        });

        results.success.push({
          memberId: member.memberId,
          memberName: member.memberName,
          email: member.email,
        });
      } catch (error) {
        console.error(`❌ Error processing ${memberData.email}:`, error.message);
        /* Parehong findOne-isn't-the-real-guard situation gaya ng createMember
        sa taas - dalawang rows (sa upload na ito o sa concurrent one) na
        nagrarace sa parehong email, pumapasa pareho sa check sa taas bago
        man magsave ang isa; yung partial unique index sa Member.email ang
        talagang huhuli sa loser. */
        let reason = error.message;
        if (error.code === 11000) {
          if (error.keyPattern?.memberId || error.keyValue?.memberId) reason = 'Passbook No. already exists';
          else if (error.keyPattern?.email || error.keyValue?.email) reason = 'Email already exists';
        }
        results.failed.push({
          row: index + 2,
          email: memberData.email,
          memberName: memberData.memberName || 'Unknown',
          reason,
        });
      }
    }

    res.status(200).json({
      message: 'Bulk member creation completed',
      summary: {
        total: members.length,
        successful: results.success.length,
        failed: results.failed.length,
      },
      results,
    });
  } catch (error) {
    console.error('Error in bulk member creation:', error);
    res.status(500).json({ message: 'Error creating members', error: safeErrorMessage(error) });
  }
};

// Get all members (for super admin)
const getAllMembers = async (req, res) => {
  try {
    const { status, module, search, limit = 100, page = 1 } = req.query;

    let query = {};

    if (status) {
      query.status = status;
    }

    if (module) {
      query.modules = module;
    }

    if (search) {
      /* Gamit yung Member.js's text index (member_search_text) - whole-token
      match sa buong memberName/memberId/email/phoneNumber/address/beneficiaries,
      kapalit ng unanchored $regex $or na full collection scan dati kahit may
      single-field indexes na yung model na ito (nakumpirma via explain():
      COLLSCAN, 10,000 docs na-examine para makabalik ng 20 sa 10k members).
      Whole tokens lang ang tugma, hindi substrings - hindi na matugma ng
      "mar" yung "Maria"; hindi na rin matutugma yung partial memberId/phone
      fragment. */
      query.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const members = await Member.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Member.countDocuments(query);

    // Dashboard stats cover every member, regardless of the page, search or status filter.
    const [statusCounts, barangays] = await Promise.all([
      Member.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Member.distinct('barangay'),
    ]);
    const byStatus = Object.fromEntries(statusCounts.map(({ _id, count }) => [_id, count]));
    const counts = {
      total: statusCounts.reduce((sum, { count }) => sum + count, 0),
      active: byStatus.active || 0,
      inactive: byStatus.inactive || 0,
      deceased: byStatus.deceased || 0,
    };

    res.status(200).json({
      members,
      counts,
      barangays: barangays.filter(Boolean).sort(),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ message: 'Error fetching members', error: safeErrorMessage(error) });
  }
};

/* Yung fields na puwedeng baguhin ng Admin kapag nag-edit ng member record.
Kung ano pa man sa request body - qrCode/qrCodeUrl/qrCodeGenerated/qrCodeActive
(exclusive na pag-aari ng generate/regenerate/deactivate/reactivate endpoints
sa memberController.js, na may sariling rules, e.g. tumatanggi ng QR changes
para sa deceased member), Mongoose internals gaya ng _id/__v/createdAt, o
kahit anong ibang schema field - tahimik na dinrop imbes na direktang
ipasa sa update. */
const MEMBER_UPDATE_FIELDS = [
  'memberName',
  'email',
  'phoneNumber',
  'barangay',
  'address',
  'beneficiaries',
  'beneficiaryRelationship',
  'dateOfBirth',
  'gender',
  'emergencyContact',
  'status',
  'modules',
];

// Update member
const updateMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const updateData = {};
    for (const field of MEMBER_UPDATE_FIELDS) {
      if (Object.hasOwn(req.body, field)) updateData[field] = req.body[field];
    }

    // Same "validate only when supplied" rule as createMember above.
    if (Object.hasOwn(updateData, 'email')) updateData.email = normalizeContact(updateData.email);
    if (Object.hasOwn(updateData, 'phoneNumber')) updateData.phoneNumber = normalizeContact(updateData.phoneNumber);
    const invalidContact = contactError(updateData.email, updateData.phoneNumber);
    if (invalidContact) return res.status(400).json({ message: invalidContact });

    if (['inactive', 'deceased'].includes(updateData.status)) updateData.qrCodeActive = false;

    const member = await Member.findOneAndUpdate(
      { memberId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    res.status(200).json({
      message: 'Member updated successfully',
      member,
    });
  } catch (error) {
    // Member.email's partial unique index is the real guard against reusing another member's email.
    if (error.code === 11000 && (error.keyPattern?.email || error.keyValue?.email)) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    console.error('Error updating member:', error);
    res.status(500).json({ message: 'Error updating member', error: safeErrorMessage(error) });
  }
};

// Delete member (soft delete - set status to inactive)
const deleteMember = async (req, res) => {
  try {
    const { memberId } = req.params;

    const member = await Member.findOneAndUpdate(
      { memberId },
      { status: 'inactive', qrCodeActive: false },
      { new: true }
    );

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    res.status(200).json({
      message: 'Member deactivated successfully',
      member,
    });
  } catch (error) {
    console.error('Error deleting member:', error);
    res.status(500).json({ message: 'Error deleting member', error: safeErrorMessage(error) });
  }
};

// Toggle the member record only; staff accounts have their own lifecycle.
const toggleMemberStatus = async (req, res) => {
  try {
    const { memberId } = req.params;

    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    if (!['active', 'inactive'].includes(member.status)) {
      return res.status(400).json({
        message: `Cannot toggle active/inactive for a member with status "${member.status}"`,
      });
    }

    const nextStatus = member.status === 'active' ? 'inactive' : 'active';
    member.status = nextStatus;
    // An inactive member's QR stops scanning. It stays off after reactivation
    // until attendance staff deliberately reactivate or regenerate it.
    if (nextStatus === 'inactive' && member.qrCodeGenerated) member.qrCodeActive = false;
    await member.save();


    res.status(200).json({
      message: `Member ${nextStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      member,
    });
  } catch (error) {
    console.error('Error toggling member status:', error);
    res.status(500).json({ message: 'Error toggling member status', error: safeErrorMessage(error) });
  }
};

module.exports = {
  createMember,
  bulkCreateMembers,
  getAllMembers,
  updateMember,
  deleteMember,
  toggleMemberStatus,
};
