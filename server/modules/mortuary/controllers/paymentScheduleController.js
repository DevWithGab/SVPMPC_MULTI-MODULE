const PaymentSchedule = require('../models/PaymentSchedule');
const { Member } = require('../../../shared/models');
const { v4: uuidv4 } = require('uuid');

// Create payment schedule (admin)
const createPaymentSchedule = async (req, res) => {
  try {
    const { memberId, contributionAmount, frequency, dueDay, nextDueDate } = req.body;

    if (!memberId || !contributionAmount || !nextDueDate) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Check if schedule already exists
    const existingSchedule = await PaymentSchedule.findOne({ memberId, status: 'active' });
    if (existingSchedule) {
      return res.status(400).json({ message: 'Active payment schedule already exists for this member' });
    }

    const schedule = new PaymentSchedule({
      scheduleId: `SCHED-${Date.now()}`,
      memberId,
      contributionAmount,
      frequency: frequency || 'monthly',
      dueDay: dueDay || 15,
      nextDueDate,
      status: 'active',
    });

    const saved = await schedule.save();

    res.status(201).json({
      message: 'Payment schedule created',
      schedule: saved,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating schedule', error: error.message });
  }
};

// Get payment schedule for member
const getPaymentSchedule = async (req, res) => {
  try {
    const { memberId } = req.params;

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const schedule = await PaymentSchedule.findOne({ memberId, status: 'active' });

    if (!schedule) {
      return res.status(404).json({ message: 'No active payment schedule found' });
    }

    res.status(200).json(schedule);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching schedule', error: error.message });
  }
};

// Get all payment schedules (admin)
const getAllPaymentSchedules = async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;

    let query = {};
    if (status) {
      query.status = status;
    }

    const schedules = await PaymentSchedule.find(query)
      .sort({ nextDueDate: 1 })
      .limit(parseInt(limit));

    res.status(200).json({
      count: schedules.length,
      schedules: schedules,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching schedules', error: error.message });
  }
};

// Get overdue payments (admin)
const getOverduePayments = async (req, res) => {
  try {
    const now = new Date();

    const overdueSchedules = await PaymentSchedule.find({
      nextDueDate: { $lt: now },
      status: 'active',
      reminderSent: false,
    });

    res.status(200).json({
      count: overdueSchedules.length,
      overduePayments: overdueSchedules,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching overdue payments', error: error.message });
  }
};

// Update next due date (admin)
const updateNextDueDate = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { nextDueDate } = req.body;

    const schedule = await PaymentSchedule.findOneAndUpdate(
      { scheduleId },
      {
        nextDueDate,
        lastPaymentDate: new Date(),
        reminderSent: false,
      },
      { new: true }
    );

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    res.status(200).json({
      message: 'Next due date updated',
      schedule: schedule,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating schedule', error: error.message });
  }
};

// Mark reminder as sent (admin)
const markReminderSent = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await PaymentSchedule.findOneAndUpdate(
      { scheduleId },
      {
        reminderSent: true,
        reminderSentDate: new Date(),
      },
      { new: true }
    );

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    res.status(200).json({
      message: 'Reminder marked as sent',
      schedule: schedule,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error marking reminder', error: error.message });
  }
};

module.exports = {
  createPaymentSchedule,
  getPaymentSchedule,
  getAllPaymentSchedules,
  getOverduePayments,
  updateNextDueDate,
  markReminderSent,
};
