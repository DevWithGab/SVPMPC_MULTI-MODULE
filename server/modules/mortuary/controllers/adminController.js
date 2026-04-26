const { Member } = require('../../../shared/models');
const { Ledger } = require('../models');

const adminController = {
  // Get all members for admin
  getAllMembers: async (req, res) => {
    try {
      const members = await Member.find({}, {
        memberId: 1,
        memberName: 1,
        phoneNumber: 1,
        status: 1,
        joinDate: 1,
        createdAt: 1
      }).sort({ createdAt: -1 });

      const formattedMembers = members.map(member => ({
        id: member.memberId,
        name: member.memberName,
        contact: member.phoneNumber,
        status: member.status,
        join_date: member.joinDate ? member.joinDate.toISOString().split('T')[0] : null
      }));

      res.json({
        success: true,
        members: formattedMembers || []
      });
    } catch (error) {
      console.error('Error fetching all members:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch members',
        error: error.message
      });
    }
  },

  // Create new member
  createMember: async (req, res) => {
    try {
      const { name, contact, status = 'active' } = req.body;

      if (!name || !contact) {
        return res.status(400).json({
          success: false,
          message: 'Name and contact are required'
        });
      }

      // Generate unique member ID
      const lastMember = await Member.findOne().sort({ memberId: -1 });
      const nextId = lastMember ? parseInt(lastMember.memberId) + 1 : 1;
      const memberId = nextId.toString().padStart(6, '0');

      const member = new Member({
        memberId,
        memberName: name,
        phoneNumber: contact,
        email: `member${memberId}@temp.com`, // Temporary email
        barangay: 'Not specified',
        address: 'Not specified',
        status,
        joinDate: new Date()
      });

      await member.save();

      // Create initial ledger entry
      const ledger = new Ledger({
        ledgerId: `L${Date.now()}`,
        memberId,
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
          status: member.status,
          join_date: member.joinDate.toISOString().split('T')[0]
        }
      });
    } catch (error) {
      console.error('Error creating member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create member',
        error: error.message
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
      if (updateData.status) member.status = updateData.status;

      await member.save();

      res.json({
        success: true,
        message: 'Member updated successfully',
        member: {
          id: member.memberId,
          name: member.memberName,
          contact: member.phoneNumber,
          status: member.status,
          join_date: member.joinDate.toISOString().split('T')[0]
        }
      });
    } catch (error) {
      console.error('Error updating member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update member',
        error: error.message
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
        error: error.message
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

      // Get the last member ID for sequential numbering
      const lastMember = await Member.findOne().sort({ memberId: -1 });
      let nextId = lastMember ? parseInt(lastMember.memberId) + 1 : 1;

      for (const memberData of members) {
        try {
          const { name, contact, status = 'active' } = memberData;

          if (!name || !contact) {
            errors.push(`Missing name or contact for member: ${JSON.stringify(memberData)}`);
            continue;
          }

          const memberId = nextId.toString().padStart(6, '0');

          const member = new Member({
            memberId,
            memberName: name,
            phoneNumber: contact,
            email: `member${memberId}@temp.com`,
            barangay: 'Not specified',
            address: 'Not specified',
            status,
            joinDate: new Date()
          });

          await member.save();

          // Create initial ledger entry
          const ledger = new Ledger({
            ledgerId: `L${Date.now()}_${memberId}`,
            memberId,
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
            status: member.status,
            join_date: member.joinDate.toISOString().split('T')[0]
          });

          nextId++;
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
        error: error.message
      });
    }
  }
};

module.exports = adminController;