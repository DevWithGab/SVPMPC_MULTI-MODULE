const { Member } = require('../models');
const Beneficiary = require('../../modules/mortuary/models/Beneficiary');
const { v4: uuidv4 } = require('uuid');
const { safeErrorMessage } = require('../../middleware/errorHandler');

// PH mobile numbers: 11 digits, starting with 09 (e.g. 09171234567). Mirrors
// the client's utils/validation.js and beneficiaryController.js — the
// client-side check alone isn't real enforcement since this endpoint can be
// called directly.
const PH_PHONE_REGEX = /^09\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeContact = value => typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
const contactError = (email, phoneNumber) => {
  if (email && !EMAIL_REGEX.test(email)) return 'Enter a valid email address.';
  if (phoneNumber && !PH_PHONE_REGEX.test(phoneNumber)) return 'Phone number must be an 11-digit PH mobile number starting with 09 (e.g. 09171234567)';
  return '';
};

// Auto-registers a structured Beneficiary record at member-creation time.
// The Beneficiary model requires a contact number that member-creation forms
// didn't previously collect, so this only fires when one is actually
// supplied — otherwise the member still gets the free-text
// beneficiaries/beneficiaryRelationship fields as before, and shows "Not
// Registered" in the admin Beneficiaries screen until completed manually
// there. Never throws: a beneficiary-registration problem must not roll
// back an otherwise-successful member creation.
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
      modules = ['attendance', 'mortuary'],
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
      modules,
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
      // The findOne check above is a friendly first pass, not the real
      // guard — two concurrent requests for the same email can both pass it
      // before either saves. Member.email's partial unique index is what
      // actually stops the second one; this just turns that into the same
      // clean message instead of a raw 500.
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

    for (const memberData of members) {
      try {
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
          modules: memberData.modules || ['attendance', 'mortuary'],
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
        // Same findOne-isn't-the-real-guard situation as createMember above
        // — two rows (in this upload or a concurrent one) racing on the same
        // email both pass the check above before either saves; the partial
        // unique index on Member.email is what actually catches the loser.
        let reason = error.message;
        if (error.code === 11000) {
          if (error.keyPattern?.memberId || error.keyValue?.memberId) reason = 'Passbook No. already exists';
          else if (error.keyPattern?.email || error.keyValue?.email) reason = 'Email already exists';
        }
        results.failed.push({
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
      // Member.js's text index (member_search_text) — whole-token match
      // across memberName/memberId/email/phoneNumber/address/beneficiaries,
      // replacing an unanchored $regex $or that was a full collection scan
      // regardless of the single-field indexes on this model (confirmed via
      // explain(): COLLSCAN, 10,000 docs examined to return 20 at 10k
      // members). Matches whole tokens, not substrings — "mar" no longer
      // matches "Maria"; a partial memberId/phone fragment no longer
      // matches either.
      query.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const members = await Member.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Member.countDocuments(query);

    res.status(200).json({
      members,
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

// Fields an Admin editing a member record may actually change. Anything else
// in the request body — qrCode/qrCodeUrl/qrCodeGenerated/qrCodeActive (owned
// exclusively by the generate/regenerate/deactivate/reactivate endpoints in
// memberController.js, which apply their own rules, e.g. refusing QR changes
// for a deceased member), Mongoose internals like _id/__v/createdAt, or any
// other schema field — is silently dropped instead of being passed straight
// into the update.
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
      { status: 'inactive' },
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
