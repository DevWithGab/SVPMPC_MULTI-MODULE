// Member model is now in shared/models/Member.js
const { Member } = require('../../../shared/models');
const Event = require('./Event');
const Attendance = require('./Attendance');
const AttendanceReport = require('./AttendanceReport');

module.exports = {
  Member,
  Event,
  Attendance,
  AttendanceReport,
};
