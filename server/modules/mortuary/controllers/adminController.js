const { Member } = require('../../../shared/models');
const { Ledger, Beneficiary, Claim } = require('../models');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

// This module hands out plain 6-digit sequential memberIds. Member docs
// created elsewhere (the shared admin controller's MEM-<uuid> passbook
// numbers, TEST- fixtures, etc.) sort AFTER any 6-digit number
// lexicographically, so a plain memberId-descending sort could pick one of
// those up as "last" and compute parseInt(...) + 1 = NaN — confirmed live,
// this created a real member with memberId "000NaN". Matching only 6-digit
// IDs keeps this generator entirely within its own numbering space.
const SEQUENTIAL_MEMBER_ID_PATTERN = /^\d{6}$/;
const nextSequentialMemberId = async () => {
  const lastMember = await Member.findOne({ memberId: SEQUENTIAL_MEMBER_ID_PATTERN }).sort({ memberId: -1 });
  const nextId = lastMember ? parseInt(lastMember.memberId, 10) + 1 : 1;
  return nextId.toString().padStart(6, '0');
};

// Builds and saves a Member with a freshly generated sequential ID,
// retrying if a concurrent request's insert claims the same ID first.
// memberId's unique index is the real guard; this just keeps that benign
// race from surfacing as a raw 500 (createMember) or an ugly per-row error
// (bulkCreateMembers) instead of quietly retrying with the next ID.
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

      // Search by name or memberId if provided — Member.js's text index
      // (member_search_text), replacing an unanchored $regex $or that was a
      // full collection scan regardless of this model's other indexes
      // (confirmed via explain(): COLLSCAN at 10k members). Matches whole
      // tokens, not substrings — "mar" no longer matches "Maria"; a partial
      // memberId fragment no longer matches either.
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
  createMember: async (req, res) => {
    try {
      const { name, contact, barangay, address, status = 'active' } = req.body;

      // Barangay and address are separate required fields on Member — the
      // barangay is what the treasurer screens filter and group by, so it
      // can't be a placeholder or be inferred from the address text.
      if (!name || !contact || !barangay || !address) {
        return res.status(400).json({
          success: false,
          message: 'Name, contact, barangay and address are required'
        });
      }

      const member = await createMemberWithRetry((memberId) => new Member({
        memberId,
        memberName: name,
        phoneNumber: contact,
        email: `member${memberId}@temp.com`, // Temporary email
        barangay: barangay.trim(),
        address: address.trim(),
        status,
        joinDate: new Date()
      }));

      // Create initial ledger entry
      const ledger = new Ledger({
        ledgerId: `L${Date.now()}`,
        memberId: member.memberId,
        transactionType: 'contribution',
        description: 'Initial member registration',
        credit: 0,
        debit: 0,
        balance: 0,
        transactionDate: new Date()
      });

      await ledger.save();

      res.json({
        success: true,
        message: 'Member created successfully',
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
      console.error('Error creating member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create member',
        error: safeErrorMessage(error)
      });
    }
  },

  // Update member
  updateMember: async (req, res) => {
    try {
      const { memberId } = req.params;
      const updateData = req.body;

      const member = await Member.findOne({ memberId });
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }

      // Map frontend fields to database fields
      if (updateData.name) member.memberName = updateData.name;
      if (updateData.contact) member.phoneNumber = updateData.contact;
      if (updateData.barangay) member.barangay = updateData.barangay.trim();
      if (updateData.address) member.address = updateData.address.trim();
      if (updateData.status) member.status = updateData.status;

      await member.save();

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

      // Deleting a member whose memberId is still referenced elsewhere would
      // leave those records pointing at nothing — check every place that
      // references it, not just the ledger, before allowing it.
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

      // Each row asks createMemberWithRetry for a fresh ID at save time,
      // rather than reserving a block of IDs up front — a pre-computed
      // nextId/nextId++ here would go stale (and silently collide) against
      // a concurrent single createMember call or another bulk upload
      // running at the same time, with no way to recover mid-loop.
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
            joinDate: new Date()
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