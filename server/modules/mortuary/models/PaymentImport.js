const mongoose = require('mongoose');

// Durable receipt reservation. Stable IDs allow a retry to finish either write
// without crediting the ledger twice, including on standalone MongoDB.
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
