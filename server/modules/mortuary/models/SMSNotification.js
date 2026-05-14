const mongoose = require('mongoose');

const smsNotificationSchema = new mongoose.Schema(
  {
    notificationId: {
      type: String,
      unique: true,
      required: true,
    },
    memberId: {
      type: String,
      required: true,
      ref: 'Member',
    },
    memberName: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    thresholdType: {
      type: String,
      enum: ['threshold_300', 'threshold_100', 'negative_balance'],
      required: true,
    },
    balance: {
      type: Number,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    sentAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    triggeredBy: {
      type: String, // 'contribution', 'deduction', 'manual'
      required: true,
    },
    transactionId: {
      type: String, // Reference to ledger entry that triggered this
      default: null,
    },
  },
  { timestamps: true }
);

// Index for faster queries
smsNotificationSchema.index({ memberId: 1, createdAt: -1 });
smsNotificationSchema.index({ status: 1 });
smsNotificationSchema.index({ thresholdType: 1 });

module.exports = mongoose.model('SMSNotification', smsNotificationSchema);
