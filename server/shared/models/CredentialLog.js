const mongoose = require('mongoose');

const credentialLogSchema = new mongoose.Schema(
  {
    logId: {
      type: String,
      unique: true,
      required: true,
    },
    userId: {
      type: String,
      required: true,
      ref: 'User',
    },
    memberId: {
      type: String,
    },
    staffId: {
      type: String,
    },
    action: {
      type: String,
      enum: ['generated', 'resent', 'password_changed', 'password_reset'],
      required: true,
    },
    sentMethod: {
      type: [String],
      enum: ['email', 'sms'],
    },
    sentDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'partial'],
      default: 'success',
    },
    failureReason: {
      type: String,
      default: null,
    },
    operationId: {
      type: String,
      ref: 'ImportOperation',
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CredentialLog', credentialLogSchema);
