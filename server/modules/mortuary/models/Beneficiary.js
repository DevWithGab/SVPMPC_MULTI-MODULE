const mongoose = require('mongoose');

const beneficiarySchema = new mongoose.Schema(
  {
    beneficiaryId: {
      type: String,
      unique: true,
      required: true,
    },
    memberId: {
      type: String,
      required: true,
      ref: 'Member',
    },
    // Denormalized so search/list queries don't need a join.
    memberName: {
      type: String,
      required: true,
    },
    beneficiaryName: {
      type: String,
      required: true,
    },
    relationship: {
      type: String,
      required: true,
    },
    contactNumber: {
      type: String,
      required: true,
    },
    address: {
      type: String,
    },
    notes: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    updatedBy: {
      type: String,
    },
  },
  { timestamps: true }
);

beneficiarySchema.index({ memberId: 1, isActive: 1 });
beneficiarySchema.index({ memberId: 1, effectiveFrom: -1 });
beneficiarySchema.index({ beneficiaryName: 1 });

module.exports = mongoose.model('Beneficiary', beneficiarySchema);
