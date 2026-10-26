const mongoose = require('mongoose');

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
      enum: [
        'pending_requirements',
        'approved',
        'pending_deduction',
        /* Transient lock state ito: nandito lang muna ang claim habang tumatakbo ang
        sariling request ng processDeductionBatch - ang pag-claim nito
        atomically (findOneAndUpdate gamit ang prior status bilang filter) ang
        pumipigil sa dalawang concurrent request na magkasabay gumawa ng money math
        para sa parehong claim. Ibabalik kapag nagfail; tingnan ang function na
        iyon sa treasurerClaimController.js para malaman kung bakit ito existing.
        Ang 'releasing'/'released' ay para na lang sa mga lumang claim na na-release
        bago tinanggal ang release step. */
        'deduction_processing',
        'deduction_processed',
        'releasing',
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
      jvNumber: { type: String, trim: true },
      // Claims processed together share one batchId and one JV number.
      batchId: { type: String },
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
claimSchema.index({ beneficiaryId: 1 });

module.exports = mongoose.model('Claim', claimSchema);
