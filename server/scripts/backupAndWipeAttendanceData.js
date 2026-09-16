const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Event = require('../modules/attendance/models/Event');
const Attendance = require('../modules/attendance/models/Attendance');
const AttendanceReport = require('../modules/attendance/models/AttendanceReport');

// Backs up every Event, Attendance, and AttendanceReport document to a
// timestamped JSON file, then deletes all of them. Members and AuditLogs
// are untouched. Run with: node scripts/backupAndWipeAttendanceData.js
const backupAndWipe = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const [events, attendanceLogs, attendanceReports] = await Promise.all([
      Event.find({}).lean(),
      Attendance.find({}).lean(),
      AttendanceReport.find({}).lean(),
    ]);

    console.log('📋 Found:');
    console.log(`   - ${events.length} events`);
    console.log(`   - ${attendanceLogs.length} attendance records`);
    console.log(`   - ${attendanceReports.length} attendance reports\n`);

    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `attendance-backup-${timestamp}.json`);

    fs.writeFileSync(
      backupPath,
      JSON.stringify({ events, attendanceLogs, attendanceReports }, null, 2)
    );

    console.log(`💾 Backup written to: ${backupPath}\n`);

    const eventResult = await Event.deleteMany({});
    const attendanceResult = await Attendance.deleteMany({});
    const reportResult = await AttendanceReport.deleteMany({});

    console.log('✅ Wipe complete!\n');
    console.log(`   Events deleted: ${eventResult.deletedCount}`);
    console.log(`   Attendance records deleted: ${attendanceResult.deletedCount}`);
    console.log(`   Attendance reports deleted: ${reportResult.deletedCount}`);
    console.log('\n💡 Members and Audit Logs were left untouched.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

backupAndWipe();
