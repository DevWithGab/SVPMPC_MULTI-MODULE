const mongoose = require('mongoose');
const { CLAIM_STATUSES, CLAIM_MEMBER_INDEX, CLAIM_MEMBER_INDEX_OPTIONS } = require('../utils/claimEligibility');

const requirementItemSchema = new mongoose.Schema(
  {
    submitted: { type: Boolean, default: false },
    received: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    /* Idinaragdag ang requirements per claim dahil puwedeng magkaiba ang physical
    requirements ng bawat indibidwal. Naitatago ang label kasama ng claim para
    mabasa pa rin ito kahit walang global settings record. */
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
    referenceNumber: { type: String, trim: true, maxlength: 100 },
    memberId: {
      type: String,
      required: true,
      ref: 'Member',
    },
    /* Snapshotted sa filing time, parehong rationale ng beneficiary fields sa baba -
    para direktang makabasa ang list/search views mula sa Claim na walang join. */
    memberName: {
      type: String,
      required: true,
    },
    beneficiaryId: {
      type: String,
      required: true,
      ref: 'Beneficiary',
    },
    /* Snapshotted sa filing time - puwedeng magbago ang Beneficiary record mamaya,
    pero dapat itago ng claim kung ano ang totoo nung na-file ito. */
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
      enum: CLAIM_STATUSES,
      required: true,
      default: 'pending_requirements',
    },
    // Filing is reserved before changing the shared member. This journal lets
    // retries/restarts complete that change without filing a second claim.
    registration: {
      requestKey: String,
      userId: String,
      userName: String,
      userRole: String,
      ipAddress: String,
      userAgent: String,
      startedAt: Date,
      completedAt: Date,
      auditedAt: Date,
      lastAttemptAt: Date,
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
      jvNumber: { type: String, trim: true },
      // Keep the original batch plan so a failed request can resume safely.
      batchId: { type: String },
      claimIds: { type: [String], default: undefined },
      memberIds: { type: [String], default: undefined },
      startedAt: { type: Date },
      claimsInBatch: { type: Number },
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
claimSchema.index(CLAIM_MEMBER_INDEX, CLAIM_MEMBER_INDEX_OPTIONS);
claimSchema.index({ status: 1, 'registration.lastAttemptAt': 1, dateFiled: 1 });
claimSchema.index({ 'registration.auditedAt': 1, 'registration.lastAttemptAt': 1, dateFiled: 1 }, {
  partialFilterExpression: { 'registration.requestKey': { $type: 'string' } },
});
claimSchema.index({ beneficiaryId: 1 });

module.exports = mongoose.model('Claim', claimSchema);
