const mongoose = require('mongoose');

const scannerStationSchema = new mongoose.Schema(
  {
    stationId: {
      type: String,
      unique: true,
      required: true,
    },
    stationName: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    deviceId: {
      type: String,
      unique: true,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'offline'],
      default: 'inactive',
    },
    lastHeartbeat: {
      type: Date,
      default: null,
    },
    currentEventId: {
      type: String,
      ref: 'Event',
      default: null,
    },
    scansCount: {
      type: Number,
      default: 0,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ScannerStation', scannerStationSchema);
