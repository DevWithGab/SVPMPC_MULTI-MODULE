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
// Every write path only ever creates a 'present' row (status: 'absent' is
// declared in the enum above but nothing in this codebase currently creates
// one), so a member can have at most one Attendance row per event — this is
// the real duplicate-scan guard; the application-level findOne check in
// attendanceController.js's recordAttendance is just a faster, friendlier
// first pass that can lose a race to this.
attendanceSchema.index({ memberId: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
