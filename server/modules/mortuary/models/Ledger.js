const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema(
  {
    ledgerId: {
      type: String,
      unique: true,
      required: true,
    },
    // New CSV imports reserve a stable transaction identity. Existing rows omit it.
    importKey: { type: String, unique: true, sparse: true },
    // One successor per entry. Both correction legs share one atomic posting.
    correctionOf: { type: String, unique: true, sparse: true },
    correction: {
      type: new mongoose.Schema({
        rootLedgerId: { type: String, required: true },
        originalType: { type: String, enum: ['contribution', 'adjustment'], required: true },
        beforeAmount: { type: Number, required: true },
        afterAmount: { type: Number, required: true },
        reason: { type: String, default: '' },
        userId: { type: String, required: true },
        userName: { type: String, required: true },
        userRole: { type: String, required: true },
        contributionId: String,
        completed: { type: Boolean, default: false },
      }, { _id: false }),
      default: undefined,
    },
    memberId: {
      type: String,
      required: true,
      ref: 'Member',
    },
    transactionType: {
      type: String,
      enum: ['contribution', 'payout', 'adjustment', 'penalty', 'automatic_deduction', 'claim_payout'],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    credit: {
      type: Number,
      default: 0,
    },
    debit: {
      type: Number,
      default: 0,
    },
    balance: {
      type: Number,
      required: true,
    },
    referenceId: {
      type: String,
    },
    transactionDate: {
      type: Date,
      default: Date.now,
    },
    recordedBy: {
      type: String,
    },
    // Payout-specific fields
    beneficiary: {
      type: String,
    },
    paymentMethod: {
      type: String,
      enum: ['cash'],
      default: 'cash',
    },
  },
  { timestamps: true }
);

// Indexes for better query performance
ledgerSchema.index({ memberId: 1 });
ledgerSchema.index({ 'correction.rootLedgerId': 1 });
ledgerSchema.index({ transactionType: 1 });
ledgerSchema.index({ transactionDate: -1 });
ledgerSchema.index({ memberId: 1, transactionDate: -1 });
/* Ito ang backing ng posting-order balance lookup sa utils/ledgerBalance - sumusunod
ang running `balance` column sa order kung kailan naisulat ang rows, hindi sa
effective transactionDate nila, kaya ito ang index na ginagamit ng bawat
"current balance" read. */
ledgerSchema.index({ memberId: 1, createdAt: -1 });

module.exports = mongoose.model('Ledger', ledgerSchema);
