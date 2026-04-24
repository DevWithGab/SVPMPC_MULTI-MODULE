const { Member } = require('../models');
const Attendance = require('../models/Attendance');
const Event = require('../models/Event');
const AttendanceReport = require('../models/AttendanceReport');
const { v4: uuidv4 } = require('uuid');

// Record attendance via QR scan
const recordAttendance = async (req, res) => {
  try {
    const { memberId, eventId, scannedBy } = req.body;

    if (!memberId || !eventId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Verify event exists
    const event = await Event.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if member already marked present for this event
    const existingAttendance = await Attendance.findOne({
      memberId,
      eventId,
      status: 'present',
    });

    if (existingAttendance) {
      return res.status(400).json({
        message: 'Member already marked present for this event',
      });
    }

    // Create attendance record
    const newAttendance = new Attendance({
      attendanceId: uuidv4(),
      memberId,
      memberName: member.memberName,
      phoneNumber: member.phoneNumber,
      eventId,
      eventName: event.eventName,
      barangay: member.barangay,
      scanTime: new Date(),
      status: 'present',
      scannedBy: scannedBy || 'system',
    });

    const saved = await newAttendance.save();

    res.status(201).json({
      message: 'Attendance recorded successfully',
      attendance: saved,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error recording attendance', error: error.message });
  }
};

// Get attendance by event
const getAttendanceByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const attendance = await Attendance.find({ eventId }).sort({ scanTime: -1 });

    if (attendance.length === 0) {
      return res.status(200).json({
        message: 'No attendance records found for this event',
        count: 0,
        attendance: [],
      });
    }

    res.status(200).json({
      count: attendance.length,
      attendance: attendance,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching attendance', error: error.message });
  }
};

// Get real-time attendance stats for event
const getAttendanceStats = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const presentCount = await Attendance.countDocuments({
      eventId,
      status: 'present',
    });

    const totalMembers = await Member.countDocuments();
    const absentCount = totalMembers - presentCount;
    const attendanceRate = totalMembers > 0 ? ((presentCount / totalMembers) * 100).toFixed(2) : 0;

    res.status(200).json({
      eventId,
      eventName: event.eventName,
      totalMembers,
      presentCount,
      absentCount,
      attendanceRate: `${attendanceRate}%`,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching attendance stats', error: error.message });
  }
};

// Generate attendance report
const generateReport = async (req, res) => {
  try {
    const { eventId, generatedBy } = req.body;

    if (!eventId || !generatedBy) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const event = await Event.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const attendanceRecords = await Attendance.find({ eventId });
    const totalMembers = await Member.countDocuments();
    const presentCount = attendanceRecords.length;
    const absentCount = totalMembers - presentCount;
    const attendanceRate = totalMembers > 0 ? ((presentCount / totalMembers) * 100).toFixed(2) : 0;

    const newReport = new AttendanceReport({
      reportId: uuidv4(),
      eventId,
      eventName: event.eventName,
      reportDate: new Date(),
      totalMembers,
      presentCount,
      absentCount,
      attendanceRate,
      attendanceDetails: attendanceRecords.map((record) => record._id),
      generatedBy,
    });

    const saved = await newReport.save();

    res.status(201).json({
      message: 'Report generated successfully',
      report: saved,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating report', error: error.message });
  }
};

// Get all attendance records
const getAllAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.find().sort({ scanTime: -1 });

    res.status(200).json({
      count: attendance.length,
      attendance: attendance,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching attendance', error: error.message });
  }
};

module.exports = {
  recordAttendance,
  getAttendanceByEvent,
  getAttendanceStats,
  generateReport,
  getAllAttendance,
};
