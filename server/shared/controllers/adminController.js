const { Member, User } = require('../models');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { sendCredentials, sendBulkCredentials, sendPasswordResetNotification } = require('../services/notificationService');

// PH mobile numbers: 11 digits, starting with 09 (e.g. 09171234567). Mirrors
// the client's utils/validation.js and beneficiaryController.js — the
// client-side check alone isn't real enforcement since this endpoint can be
// called directly.
const PH_PHONE_REGEX = /^09\d{9}$/;

// Generate a random password
const generatePassword = () => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// Create a new member with account
const createMemberWithAccount = async (req, res) => {
  try {
    const {
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
      modules = ['attendance', 'mortuary'],
    } = req.body;

    // Validate required fields
    if (!memberName || !email || !phoneNumber || !barangay || !address) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!PH_PHONE_REGEX.test(String(phoneNumber).trim())) {
      return res.status(400).json({
        message: 'Phone number must be an 11-digit PH mobile number starting with 09 (e.g. 09171234567)',
      });
    }

    // Check if email already exists
    const existingMember = await Member.findOne({ email });
    if (existingMember) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Generate unique memberId
    const memberId = `MEM-${Date.now()}`;

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

    // Generate temporary password
    const temporaryPassword = generatePassword();

    // Create user account
    const userId = uuidv4();
    const username = email.split('@')[0] + memberId.slice(-4); // Create username from email + last 4 digits of memberId

    const user = new User({
      userId,
      memberId,
      username,
      email,
      phoneNumber,
      passwordHash: temporaryPassword, // Will be hashed by pre-save hook
      isTemporaryPassword: true,
      status: 'active',
      modules,
    });

    await user.save();

    // Send credentials via email/SMS
    const notificationData = {
      memberId: member.memberId,
      memberName: member.memberName,
      email: member.email,
      phoneNumber: member.phoneNumber,
      username: user.username,
      temporaryPassword,
    };

    // Send notifications (email by default, SMS if configured)
    const notificationResults = await sendCredentials(notificationData, {
      email: true,
      sms: process.env.SEMAPHORE_API_KEY ? true : false, // Only send SMS if configured
    });

    res.status(201).json({
      message: 'Member and account created successfully',
      member: {
        memberId: member.memberId,
        memberName: member.memberName,
        email: member.email,
        phoneNumber: member.phoneNumber,
        status: member.status,
      },
      account: {
        userId: user.userId,
        username: user.username,
        temporaryPassword, // Send this to the member via email/SMS
        isTemporaryPassword: true,
      },
      notifications: notificationResults,
    });
  } catch (error) {
    console.error('Error creating member with account:', error);
    res.status(500).json({ message: 'Error creating member', error: error.message });
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
        console.log(`📝 Processing member: ${memberData.memberName} (${memberData.email})`);
        
        // Check if email already exists
        const existingMember = await Member.findOne({ email: memberData.email });
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
        const memberId = memberData.memberId || `MEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log(`🆔 Using memberId: ${memberId}`);

        // Check if memberId already exists
        const existingMemberId = await Member.findOne({ memberId });
        if (existingMemberId) {
          console.log(`❌ MemberId already exists: ${memberId}`);
          results.failed.push({
            email: memberData.email,
            memberName: memberData.memberName,
            reason: `MemberId ${memberId} already exists`,
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
          dateOfBirth: memberData.dateOfBirth,
          gender: memberData.gender,
          modules: memberData.modules || ['attendance', 'mortuary'],
          status: 'active',
        });

        await member.save();
        console.log(`✅ Member saved: ${member.memberId}`);

        // Generate temporary password
        const temporaryPassword = generatePassword();

        // Create user account
        const userId = uuidv4();
        const username = memberData.email.split('@')[0] + memberId.slice(-4);

        const user = new User({
          userId,
          memberId,
          username,
          email: memberData.email,
          phoneNumber: memberData.phoneNumber,
          passwordHash: temporaryPassword,
          isTemporaryPassword: true,
          status: 'active',
          modules: memberData.modules || ['attendance', 'mortuary'],
        });

        await user.save();
        console.log(`✅ User account created: ${user.username}`);

        results.success.push({
          memberId: member.memberId,
          memberName: member.memberName,
          email: member.email,
          username: user.username,
          temporaryPassword,
        });
      } catch (error) {
        console.error(`❌ Error processing ${memberData.email}:`, error.message);
        results.failed.push({
          email: memberData.email,
          memberName: memberData.memberName || 'Unknown',
          reason: error.message,
        });
      }
    }

    // Send bulk notifications to all successful members
    let notificationResults = [];
    if (results.success.length > 0) {
      console.log(`📧 Sending credentials to ${results.success.length} members...`);
      notificationResults = await sendBulkCredentials(results.success, {
        email: true,
        sms: false, // SMS disabled for bulk to avoid high costs, can be enabled if needed
      });
    }

    res.status(200).json({
      message: 'Bulk member creation completed',
      summary: {
        total: members.length,
        successful: results.success.length,
        failed: results.failed.length,
      },
      results,
      notifications: notificationResults,
    });
  } catch (error) {
    console.error('Error in bulk member creation:', error);
    res.status(500).json({ message: 'Error creating members', error: error.message });
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
      query.$or = [
        { memberName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { memberId: { $regex: search, $options: 'i' } },
      ];
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
    res.status(500).json({ message: 'Error fetching members', error: error.message });
  }
};

// Update member
const updateMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const updateData = req.body;

    // Don't allow updating memberId
    delete updateData.memberId;

    const member = await Member.findOneAndUpdate(
      { memberId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // If email or phoneNumber changed, update User as well
    if (updateData.email || updateData.phoneNumber) {
      await User.findOneAndUpdate(
        { memberId },
        {
          ...(updateData.email && { email: updateData.email }),
          ...(updateData.phoneNumber && { phoneNumber: updateData.phoneNumber }),
        }
      );
    }

    res.status(200).json({
      message: 'Member updated successfully',
      member,
    });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ message: 'Error updating member', error: error.message });
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

    // Also deactivate user account
    await User.findOneAndUpdate(
      { memberId },
      { status: 'inactive' }
    );

    res.status(200).json({
      message: 'Member deactivated successfully',
      member,
    });
  } catch (error) {
    console.error('Error deleting member:', error);
    res.status(500).json({ message: 'Error deleting member', error: error.message });
  }
};

// Toggle a member between active and inactive — flips both Member and User
// status together (mirrors deleteMember's active->inactive dual-write,
// made bidirectional so a deactivated member can be reactivated). Refuses
// to touch deceased/staff members since there's no sensible active/inactive
// toggle for those statuses.
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

    await User.findOneAndUpdate({ memberId }, { status: nextStatus });

    res.status(200).json({
      message: `Member ${nextStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      member,
    });
  } catch (error) {
    console.error('Error toggling member status:', error);
    res.status(500).json({ message: 'Error toggling member status', error: error.message });
  }
};

// Reset member password
const resetMemberPassword = async (req, res) => {
  try {
    const { memberId } = req.params;

    const user = await User.findOne({ memberId });
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    // Generate new temporary password
    const temporaryPassword = generatePassword();

    user.passwordHash = temporaryPassword; // Will be hashed by pre-save hook
    user.isTemporaryPassword = true;
    await user.save();

    // Get member details for notification
    const member = await Member.findOne({ memberId });

    // Send password reset notification
    const notificationData = {
      memberId: member.memberId,
      memberName: member.memberName,
      email: member.email,
      phoneNumber: member.phoneNumber,
      username: user.username,
      temporaryPassword,
    };

    const notificationResult = await sendPasswordResetNotification(notificationData);

    res.status(200).json({
      message: 'Password reset successfully',
      username: user.username,
      temporaryPassword,
      notification: notificationResult,
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

module.exports = {
  createMemberWithAccount,
  bulkCreateMembers,
  getAllMembers,
  updateMember,
  deleteMember,
  toggleMemberStatus,
  resetMemberPassword,
};
