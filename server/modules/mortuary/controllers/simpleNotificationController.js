const { Member } = require('../../../shared/models');
const { sendBalanceReminder } = require('../services/simpleNotificationService');

// Send reminder to single member
const sendReminderToMember = async (req, res) => {
  try {
    const { memberId, message } = req.body;

    if (!memberId) {
      return res.status(400).json({ 
        success: false,
        message: 'Member ID is required' 
      });
    }

    // Get member details
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ 
        success: false,
        message: 'Member not found' 
      });
    }

    // Get member balance (from latest ledger entry)
    const Ledger = require('../models/Ledger');
    const latestLedger = await Ledger.findOne({ memberId })
      .sort({ createdAt: -1 });
    
    const balance = latestLedger ? latestLedger.balance : 0;

    // Prepare member data with balance
    const memberData = {
      memberId: member.memberId,
      memberName: member.memberName,
      email: member.email,
      phoneNumber: member.phoneNumber,
      balance: balance
    };

    // Send reminder
    const results = await sendBalanceReminder(memberData, message);

    if (results.success) {
      return res.status(200).json({
        success: true,
        message: 'Reminder sent successfully',
        data: {
          memberId: member.memberId,
          memberName: member.memberName,
          sentVia: {
            sms: results.sms?.success || false,
            email: results.email?.success || false
          }
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to send reminder',
        error: 'No notification method succeeded'
      });
    }
  } catch (error) {
    console.error('Error sending reminder:', error);
    return res.status(500).json({
      success: false,
      message: 'Error sending reminder',
      error: error.message
    });
  }
};

module.exports = {
  sendReminderToMember
};
