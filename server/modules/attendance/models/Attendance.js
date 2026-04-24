const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    attendanceId: {
      type: String,
      unique: true,
      required: true,
    },
    memberId: {
      type: String,
      required: true,
      ref: 'Member',
    },
    memberName: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
    },
    eventId: {
      type: String,
      required: true,
      ref: 'Event',
    },
    eventName: {
      type: String,
      required: true,
    },
    barangay: {
      type: String,
      required: true,
    },
    scanTime: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['present', 'absent'],
      default: 'present',
    },
    scannedBy: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Attendance', attendanceSchema);
