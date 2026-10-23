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
    // Stable authenticated account identity; absent on legacy attendance rows.
    scannedByUserId: {
      type: String,
      ref: 'User',
    },
    entrySource: {
      type: String,
      enum: ['qr', 'manual'],
      default: 'qr',
    },
    justification: {
      type: String,
    },
  },
  { timestamps: true }
);

// Indexes for better query performance
attendanceSchema.index({ memberId: 1 });
attendanceSchema.index({ eventId: 1 });
attendanceSchema.index({ scanTime: -1 });
attendanceSchema.index({ eventId: 1, scanTime: -1 });
attendanceSchema.index({ scannedByUserId: 1, scanTime: -1 });
/* Laging 'present' row lang ang ginawa ng every write path (declared sa
enum sa itaas yung status: 'absent' pero walang gumagawa nito sa codebase
na ito ngayon), kaya isa lang ang puwedeng Attendance row ng member per
event - ito na yung totoong duplicate-scan guard; yung application-level
findOne check sa recordAttendance ng attendanceController.js ay mas
mabilis at friendlier na first pass lang na puwedeng matalo sa race dito. */
attendanceSchema.index({ memberId: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
