const mongoose = require('mongoose');

const paymentScheduleSchema = new mongoose.Schema(
  {
    scheduleId: {
      type: String,
      unique: true,
      required: true,
    },
    memberId: {
      type: String,
      required: true,
      ref: 'Member',
    },
    contributionAmount: {
      type: Number,
      required: true,
    },
    frequency: {
      type: String,
      enum: ['monthly', 'quarterly', 'semi-annual', 'annual'],
      default: 'monthly',
    },
    dueDay: {
      type: Number,
      default: 15,
    },
    nextDueDate: {
      type: Date,
      required: true,
    },
    lastPaymentDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    reminderSentDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentSchedule', paymentScheduleSchema);
