const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema(
  {
    ledgerId: {
      type: String,
      unique: true,
      required: true,
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
ledgerSchema.index({ transactionType: 1 });
ledgerSchema.index({ transactionDate: -1 });
ledgerSchema.index({ memberId: 1, transactionDate: -1 });
// Backs the posting-order balance lookup in utils/ledgerBalance — the running
// `balance` column follows the order rows were written, not their effective
// transactionDate, so this is the index every "current balance" read uses.
ledgerSchema.index({ memberId: 1, createdAt: -1 });

module.exports = mongoose.model('Ledger', ledgerSchema);
