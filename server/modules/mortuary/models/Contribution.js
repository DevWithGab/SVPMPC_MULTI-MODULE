const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema(
  {
    contributionId: {
      type: String,
      unique: true,
      required: true,
    },
    memberId: {
      type: String,
      required: true,
      ref: 'Member',
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['paid', 'pending', 'overdue'],
      default: 'paid',
    },
    paymentMethod: {
      type: String,
      enum: ['cash'],
      default: 'cash',
    },
    referenceNumber: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Contribution', contributionSchema);
