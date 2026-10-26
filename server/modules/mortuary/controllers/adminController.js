const { Member } = require('../../../shared/models');
const { Ledger, Beneficiary, Claim } = require('../models');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

/* Yung module na ito ang nagbibigay ng plain 6-digit sequential memberIds.
Yung Member docs na ginawa sa ibang lugar (shared admin controller's
MEM-<uuid> passbook numbers, TEST- fixtures, etc.) ay sort AFTER sa kahit
anong 6-digit number lexicographically, kaya puwedeng mapili ng plain
memberId-descending sort yung isa sa mga yun bilang "last" at compute
parseInt(...) + 1 = NaN - confirmed live ito, nagresulta ng totoong member
na may memberId na "000NaN". Yung pag-match lang sa 6-digit IDs ang
nagpapanatili nitong generator sa loob lang ng sariling numbering space. */
const SEQUENTIAL_MEMBER_ID_PATTERN = /^\d{6}$/;
const nextSequentialMemberId = async () => {
  const lastMember = await Member.findOne({ memberId: SEQUENTIAL_MEMBER_ID_PATTERN }).sort({ memberId: -1 });
  const nextId = lastMember ? parseInt(lastMember.memberId, 10) + 1 : 1;
  return nextId.toString().padStart(6, '0');
};

/* Gumagawa at nag-save ng Member gamit ang bagong-generate na sequential ID,
tumitry ulit kung na-claim na yung parehong ID ng concurrent request's insert.
Yung memberId's unique index ang totoong guard; ito ay para lang hindi
sumulpot yung benign race bilang ugly per-row error (bulkCreateMembers) sa halip na tahimik na mag-retry gamit yung next ID. */
const MAX_MEMBER_ID_RETRIES = 5;
const createMemberWithRetry = async (buildMemberDoc) => {
  let lastError;
  for (let attempt = 0; attempt < MAX_MEMBER_ID_RETRIES; attempt++) {
    const memberId = await nextSequentialMemberId();
    const member = buildMemberDoc(memberId);
    try {
      await member.save();
      return member;
    } catch (error) {
      lastError = error;
      if (error.code !== 11000 || !(error.keyPattern?.memberId || error.keyValue?.memberId)) throw error;
    }
  }
  throw lastError;
};

const adminController = {
  // Get all members for admin - with pagination
  getAllMembers: async (req, res) => {
    try {
      const { page, limit, skip } = require('../../../shared/utils/pagination').getPaginationParams(req.query);
      const { status, search } = req.query;

      let query = {};
      
      // Filter by status if provided
      if (status) {
        query.status = status;
      }

      /* Nag-search by name o memberId kung provided - gamit yung Member.js's text
      index (member_search_text), pinalitan yung unanchored $regex $or na dating
      full collection scan kahit meron namang ibang indexes yung model na ito
      (confirmed via explain(): COLLSCAN sa 10k members). Nag-match ng whole
      tokens, hindi substrings - "mar" hindi na nag-match sa "Maria"; partial
      memberId fragment hindi na rin nag-match. */
      if (search) {
        query.$text = { $search: search };
      }

      // Get total count for pagination
      const total = await Member.countDocuments(query);

      // Get paginated members
      const members = await Member.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const formattedMembers = members.map(member => ({
        id: member.memberId,
        name: member.memberName,
        email: member.email,
        contact: member.phoneNumber,
        barangay: member.barangay,
        address: member.address,
        beneficiaries: member.beneficiaries,
        beneficiaryRelationship: member.beneficiaryRelationship,
        dateOfBirth: member.dateOfBirth,
        gender: member.gender,
        status: member.status,
        modules: member.modules,
        join_date: member.joinDate ? new Date(member.joinDate).toISOString().split('T')[0] : new Date(member.createdAt).toISOString().split('T')[0],
        created_at: new Date(member.createdAt).toISOString().split('T')[0]
      }));

      const { buildPaginatedResponse } = require('../../../shared/utils/pagination');
      const response = buildPaginatedResponse(formattedMembers, total, page, limit);
      
      res.json({
        ...response,
        members: response.data // Keep backward compatibility
      });
    } catch (error) {
      console.error('Error fetching all members:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch members',
        error: safeErrorMessage(error)
      });
    }
  },

  // Create new member
  // Update member
  updateMember: async (req, res) => {
    try {
      const { memberId } = req.params;
      const updateData = req.body;

      /* Shared yung Members. Gumagamit pa rin ng explicit field allowlist yung
      profile edits; hindi puwedeng baguhin dito yung QR data at module
      assignments. */
      const fields = {};
      if (updateData.name) fields.memberName = updateData.name;
      if (updateData.contact) fields.phoneNumber = updateData.contact;
      if (updateData.barangay) fields.barangay = updateData.barangay.trim();
      if (updateData.address) fields.address = updateData.address.trim();
      if (updateData.status) fields.status = updateData.status;
      const member = await Member.findOneAndUpdate(
        { memberId }, { $set: fields }, { new: true, runValidators: true },
      );
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }

      res.json({
        success: true,
        message: 'Member updated successfully',
        member: {
          id: member.memberId,
          name: member.memberName,
          contact: member.phoneNumber,
          barangay: member.barangay,
          address: member.address,
          status: member.status,
          join_date: member.joinDate.toISOString().split('T')[0]
        }
      });
    } catch (error) {
      console.error('Error updating member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update member',
        error: safeErrorMessage(error)
      });
    }
  },

  // Delete member
  deleteMember: async (req, res) => {
    try {
      const { memberId } = req.params;

      const member = await Member.findOne({ memberId });
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }

      /* Kung i-delete yung member na yung memberId niya ay ginagamit pa sa ibang
      lugar, maiiwan nang walang reference yung mga records na yun - i-check muna
      lahat ng lugar na gumagamit nito, hindi lang ledger, bago payagan. */
      const [claimCount, beneficiaryCount] = await Promise.all([
        Claim.countDocuments({ memberId }),
        Beneficiary.countDocuments({ memberId }),
      ]);

      if (claimCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete member with existing claim records'
        });
      }

      if (beneficiaryCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete member with a registered beneficiary'
        });
      }

      // Check if member has any transactions
      const ledgerEntries = await Ledger.find({ memberId });

      if (ledgerEntries.length > 1) { // More than just initial balance
        return res.status(400).json({
          success: false,
          message: 'Cannot delete member with existing transactions'
        });
      }

      // Delete ledger entries and member
      await Ledger.deleteMany({ memberId });
      await Member.deleteOne({ memberId });

      res.json({
        success: true,
        message: 'Member deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete member',
        error: safeErrorMessage(error)
      });
    }
  },

  // Bulk create members
  bulkCreateMembers: async (req, res) => {
    try {
      const { members } = req.body;

      if (!Array.isArray(members) || members.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Members array is required'
        });
      }

      const createdMembers = [];
      const errors = [];

      /* Bawat row ay humihingi ng fresh ID kay createMemberWithRetry sa save time,
      hindi nagre-reserve ng block of IDs up front - kung pre-computed na
      nextId/nextId++ dito, go stale ito (at silently collide) laban sa isang
      concurrent single member registration o ibang bulk upload na tumatakbo sa
      same time, na walang paraan para ma-recover mid-loop. */
      for (const memberData of members) {
        try {
          const { name, contact, barangay, address, status = 'active' } = memberData;

          if (!name || !contact || !barangay || !address) {
            errors.push(`Missing name, contact, barangay or address for member: ${JSON.stringify(memberData)}`);
            continue;
          }

          const member = await createMemberWithRetry((memberId) => new Member({
            memberId,
            memberName: name,
            phoneNumber: contact,
            email: `member${memberId}@temp.com`,
            barangay: barangay.trim(),
            address: address.trim(),
            status,
            joinDate: new Date(),
            modules: ['attendance', 'mortuary']
          }));

          // Create initial ledger entry
          const ledger = new Ledger({
            ledgerId: `L${Date.now()}_${member.memberId}`,
            memberId: member.memberId,
            transactionType: 'contribution',
            description: 'Initial member registration',
            credit: 0,
            debit: 0,
            balance: 0,
            transactionDate: new Date()
          });

          await ledger.save();

          createdMembers.push({
            id: member.memberId,
            name: member.memberName,
            contact: member.phoneNumber,
            barangay: member.barangay,
            address: member.address,
            status: member.status,
            join_date: member.joinDate.toISOString().split('T')[0]
          });
        } catch (error) {
          errors.push(`Error creating member ${memberData.name}: ${error.message}`);
        }
      }

      res.json({
        success: true,
        message: `Successfully created ${createdMembers.length} members`,
        createdMembers,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error('Error bulk creating members:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk create members',
        error: safeErrorMessage(error)
      });
    }
  }
};

module.exports = adminController;
