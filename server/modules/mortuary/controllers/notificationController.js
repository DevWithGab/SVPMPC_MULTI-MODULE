const PaymentSchedule = require('../models/PaymentSchedule');
const { Member } = require('../../../shared/models');
const { sendEmailReminder, sendSMSReminder, sendBulkReminders } = require('../services/notificationService');

// Send reminder to single member
const sendReminderToMember = async (req, res) => {
  try {
    const { memberId, notificationType } = req.body;

    if (!memberId || !notificationType) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!['email', 'sms', 'both'].includes(notificationType)) {
      return res.status(400).json({ message: 'Invalid notification type' });
    }

    // Get member
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Get payment schedule
    const schedule = await PaymentSchedule.findOne({ memberId, status: 'active' });
    if (!schedule) {
      return res.status(404).json({ message: 'No active payment schedule found' });
    }

    const results = {
      email: null,
      sms: null,
    };

    // Send email
    if (notificationType === 'email' || notificationType === 'both') {
      results.email = await sendEmailReminder(
        member.email,
        member.memberName,
        schedule.nextDueDate,
        schedule.contributionAmount
      );
    }

    // Send SMS
    if (notificationType === 'sms' || notificationType === 'both') {
      results.sms = await sendSMSReminder(
        member.phoneNumber,
        member.memberName,
        schedule.nextDueDate,
        schedule.contributionAmount
      );
    }

    // Mark reminder as sent
    if ((results.email && results.email.success) || (results.sms && results.sms.success)) {
      await PaymentSchedule.findOneAndUpdate(
        { scheduleId: schedule.scheduleId },
        {
          reminderSent: true,
          reminderSentDate: new Date(),
        }
      );
    }

    res.status(200).json({
      message: 'Reminder sent successfully',
      memberId,
      memberName: member.memberName,
      results: results,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error sending reminder', error: error.message });
  }
};

// Send bulk reminders to all overdue members
const sendBulkRemindersToOverdue = async (req, res) => {
  try {
    const { notificationType } = req.body;

    if (!notificationType) {
      return res.status(400).json({ message: 'Notification type required' });
    }

    if (!['email', 'sms', 'both'].includes(notificationType)) {
      return res.status(400).json({ message: 'Invalid notification type' });
    }

    // Get all overdue schedules that haven't been reminded
    const now = new Date();
    const overdueSchedules = await PaymentSchedule.find({
      nextDueDate: { $lt: now },
      status: 'active',
      reminderSent: false,
    });

    if (overdueSchedules.length === 0) {
      return res.status(200).json({
        message: 'No overdue payments to remind',
        count: 0,
      });
    }

    // Send bulk reminders
    const results = await sendBulkReminders(overdueSchedules, notificationType);

    res.status(200).json({
      message: 'Bulk reminders sent',
      totalMembers: overdueSchedules.length,
      sent: results.sent,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error sending bulk reminders', error: error.message });
  }
};

// Send reminders to specific members
const sendRemindersToMembers = async (req, res) => {
  try {
    const { memberIds, notificationType } = req.body;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ message: 'Member IDs array required' });
    }

    if (!notificationType) {
      return res.status(400).json({ message: 'Notification type required' });
    }

    // Get schedules for specified members
    const schedules = await PaymentSchedule.find({
      memberId: { $in: memberIds },
      status: 'active',
    });

    if (schedules.length === 0) {
      return res.status(404).json({ message: 'No active schedules found for specified members' });
    }

    // Send reminders
    const results = await sendBulkReminders(schedules, notificationType);

    res.status(200).json({
      message: 'Reminders sent to selected members',
      totalMembers: schedules.length,
      sent: results.sent,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error sending reminders', error: error.message });
  }
};

// Get reminder history
const getReminderHistory = async (req, res) => {
  try {
    const { memberId } = req.params;

    // Get member
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Get payment schedule with reminder history
    const schedule = await PaymentSchedule.findOne({ memberId });

    if (!schedule) {
      return res.status(404).json({ message: 'No payment schedule found' });
    }

    res.status(200).json({
      memberId,
      memberName: member.memberName,
      reminderSent: schedule.reminderSent,
      reminderSentDate: schedule.reminderSentDate,
      nextDueDate: schedule.nextDueDate,
      contributionAmount: schedule.contributionAmount,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reminder history', error: error.message });
  }
};

module.exports = {
  sendReminderToMember,
  sendBulkRemindersToOverdue,
  sendRemindersToMembers,
  getReminderHistory,
};
