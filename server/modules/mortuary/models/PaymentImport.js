const mongoose = require('mongoose');

/* Durable receipt reservation - yung stable IDs, kahit mag-retry ang write,
hindi na madoble yung credit sa ledger, kasama na sa standalone MongoDB. */
const schema = new mongoose.Schema({
  _id: String,
  memberId: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentDate: { type: String, required: true },
  referenceNumber: { type: String, required: true },
  paymentMethod: { type: String, enum: ['cash'], required: true },
  notes: { type: String, default: '' },
  recordedBy: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('PaymentImport', schema);
