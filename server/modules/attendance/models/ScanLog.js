const mongoose = require('mongoose');

const scanLogSchema = new mongoose.Schema(
  {
    scanLogId: {
      type: String,
      unique: true,
      required: true,
    },
    stationId: {
      type: String,
      required: true,
      ref: 'ScannerStation',
    },
    memberId: {
      type: String,
      required: true,
      ref: 'Member',
    },
    eventId: {
      type: String,
      required: true,
      ref: 'Event',
    },
    qrCodeData: {
      type: String,
      required: true,
    },
    scanTime: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['success', 'duplicate', 'invalid', 'error'],
      default: 'success',
    },
    errorMessage: {
      type: String,
      default: null,
    },
    deviceInfo: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ScanLog', scanLogSchema);
