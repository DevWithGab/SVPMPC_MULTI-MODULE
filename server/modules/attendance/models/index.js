// Member model is now in shared/models/Member.js
const { Member } = require('../../../shared/models');
const Event = require('./Event');
const Attendance = require('./Attendance');
const AttendanceReport = require('./AttendanceReport');
const ScannerStation = require('./ScannerStation');
const ScanLog = require('./ScanLog');

module.exports = {
  Member,
  Event,
  Attendance,
  AttendanceReport,
  ScannerStation,
  ScanLog,
};
