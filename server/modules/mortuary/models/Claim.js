const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema(
  {
    claimId: {
      type: String,
      unique: true,
      required: true,
    },
    memberId: {
      type: String,
      required: true,
      ref: 'Member',
    },
    deceasedName: {
      type: String,
      required: true,
    },
    dateOfDeath: {
      type: Date,
      required: true,
    },
    causeOfDeath: {
      type: String,
      required: true,
    },
    claimantName: {
      type: String,
      required: true,
    },
    claimantRelationship: {
      type: String,
      required: true,
    },
    claimAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'paid'],
      default: 'pending',
    },
    approvedBy: {
      type: String,
      default: null,
    },
    approvalDate: {
      type: Date,
      default: null,
    },
    paidDate: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    documents: [
      {
        fileName: String,
        fileUrl: String,
        uploadDate: Date,
      },
    ],
    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Claim', claimSchema);
