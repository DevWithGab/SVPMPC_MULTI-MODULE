const mongoose = require('mongoose');

const importOperationSchema = new mongoose.Schema(
  {
    operationId: {
      type: String,
      unique: true,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['preview', 'processing', 'completed', 'failed'],
      default: 'preview',
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
    duplicateCount: {
      type: Number,
      default: 0,
    },
    emailsSent: {
      type: Number,
      default: 0,
    },
    emailsFailed: {
      type: Number,
      default: 0,
    },
    smsSent: {
      type: Number,
      default: 0,
    },
    smsFailed: {
      type: Number,
      default: 0,
    },
    previewData: [
      {
        rowNumber: Number,
        memberId: String,
        memberName: String,
        email: String,
        phoneNumber: String,
        barangay: String,
        address: String,
        validationStatus: String,
        validationMessage: String,
      },
    ],
    rowErrors: [
      {
        rowNumber: Number,
        memberId: String,
        errorType: String,
        errorMessage: String,
      },
    ],
    createdUsers: [
      {
        userId: String,
        memberId: String,
        username: String,
        email: String,
        phoneNumber: String,
        tempPassword: String,
        credentialsSentVia: [String],
      },
    ],
    createdBy: {
      type: String,
      required: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ImportOperation', importOperationSchema);
