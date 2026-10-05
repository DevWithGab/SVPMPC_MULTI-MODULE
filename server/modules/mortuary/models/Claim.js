const mongoose = require('mongoose');

const requirementItemSchema = new mongoose.Schema(
  {
    submitted: { type: Boolean, default: false },
    received: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    // Requirements are added to each claim because physical requirements may
    // differ between individuals. The label is stored with the claim so it
    // remains readable without a global settings record.
    label: { type: String },
  },
  { _id: false }
);

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
    // Snapshotted at filing time, same rationale as the beneficiary fields
    // below — lets list/search views read straight off Claim with no join.
    memberName: {
      type: String,
      required: true,
    },
    beneficiaryId: {
      type: String,
      required: true,
      ref: 'Beneficiary',
    },
    // Snapshotted at filing time — a Beneficiary record can change later,
    // the claim must retain what was true when it was filed.
    beneficiaryName: {
      type: String,
      required: true,
    },
    beneficiaryRelationship: {
      type: String,
      required: true,
    },
    beneficiaryContact: {
      type: String,
      required: true,
    },
    dateOfDeath: {
      type: Date,
      required: true,
    },
    dateFiled: {
      type: Date,
      default: Date.now,
    },
    causeOfDeath: {
      type: String,
    },
    remarks: {
      type: String,
    },
    status: {
      type: String,
      enum: [
        'pending_requirements',
        'approved',
        'pending_deduction',
        'deduction_processed',
        'released',
        'rejected',
      ],
      default: 'pending_requirements',
    },
    // Each claim stores its own requirement labels and checklist state.
    requirements: {
      type: Map,
      of: requirementItemSchema,
      default: () => new Map(),
    },
    verification: {
      verifiedBy: { type: String },
      verificationDate: { type: Date },
      remarks: { type: String },
    },
    approval: {
      approvedBy: { type: String },
      approvedAt: { type: Date },
    },
    rejection: {
      rejectedBy: { type: String },
      rejectedAt: { type: Date },
      reason: { type: String },
    },
    deduction: {
      deductionSettingId: { type: String },
      amountPerMember: { type: Number },
      membersCharged: { type: Number },
      totalCollected: { type: Number },
      processedBy: { type: String },
      processedAt: { type: Date },
    },
    payout: {
      amount: { type: Number },
      paymentMethod: { type: String, enum: ['cash'], default: 'cash' },
      dvNumber: { type: String },
      remarks: { type: String },
      releasedBy: { type: String },
      releasedAt: { type: Date },
      ledgerId: { type: String },
    },
    statusHistory: [
      {
        status: { type: String },
        changedBy: { type: String },
        changedAt: { type: Date, default: Date.now },
        notes: { type: String },
      },
    ],
    createdBy: {
      type: String,
    },
  },
  { timestamps: true }
);

claimSchema.index({ status: 1, dateFiled: -1 });
claimSchema.index({ memberId: 1 });
claimSchema.index({ beneficiaryId: 1 });

module.exports = mongoose.model('Claim', claimSchema);
