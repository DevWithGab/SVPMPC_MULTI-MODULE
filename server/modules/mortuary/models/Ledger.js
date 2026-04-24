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
      enum: ['contribution', 'claim_payout', 'adjustment', 'penalty', 'automatic_deduction'],
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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ledger', ledgerSchema);
