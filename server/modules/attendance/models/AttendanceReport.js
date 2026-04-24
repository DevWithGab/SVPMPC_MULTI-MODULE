const mongoose = require('mongoose');

const attendanceReportSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      unique: true,
      required: true,
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
    reportDate: {
      type: Date,
      default: Date.now,
    },
    totalMembers: {
      type: Number,
      default: 0,
    },
    presentCount: {
      type: Number,
      default: 0,
    },
    absentCount: {
      type: Number,
      default: 0,
    },
    attendanceRate: {
      type: Number,
      default: 0,
    },
    attendanceDetails: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attendance',
      },
    ],
    generatedBy: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AttendanceReport', attendanceReportSchema);
