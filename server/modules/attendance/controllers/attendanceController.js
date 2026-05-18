const { Member } = require('../models');
const Attendance = require('../models/Attendance');
const Event = require('../models/Event');
const AttendanceReport = require('../models/AttendanceReport');
const { v4: uuidv4 } = require('uuid');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');

// Record attendance via QR scan
const recordAttendance = async (req, res) => {
  try {
    const { memberId, eventId, scannedBy, scanTime } = req.body;

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
      // Log duplicate scan attempt
      await createAuditLog({
        userId: scannedBy || 'scanner',
        userName: scannedBy || 'Scanner Device',
        userRole: 'scanner',
        action: 'attendance_recorded',
        module: 'attendance',
        entityType: 'attendance',
        entityId: `${memberId}-${eventId}`,
        entityName: member.memberName,
        description: `Duplicate scan attempt for member "${member.memberName}" at event "${event.eventName}"`,
        status: 'failed',
        errorMessage: 'Member already marked present for this event',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

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
      scanTime: scanTime ? new Date(scanTime) : new Date(),
      status: 'present',
      scannedBy: scannedBy || 'system',
    });

    const saved = await newAttendance.save();

    // Log audit event
    await createAuditLog({
      userId: scannedBy || 'system',
      userName: scannedBy || 'Scanner Device',
      userRole: 'scanner',
      action: 'attendance_recorded',
      module: 'attendance',
      entityType: 'attendance',
      entityId: saved.attendanceId,
      entityName: member.memberName,
      description: `Attendance recorded for member "${member.memberName}" at event "${event.eventName}"`,
      changes: {
        before: null,
        after: saved.toObject(),
      },
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        memberId,
        eventId,
        eventLocation: event.location,
        barangay: member.barangay,
      },
    });

    res.status(201).json({
      message: 'Attendance recorded successfully',
      attendance: saved,
    });
  } catch (error) {
    // Log failed attempt
    await createAuditLog({
      userId: req.body.scannedBy || 'system',
      userName: req.body.scannedBy || 'Scanner Device',
      userRole: 'scanner',
      action: 'attendance_recorded',
      module: 'attendance',
      entityType: 'attendance',
      description: `Failed to record attendance`,
      status: 'failed',
      errorMessage: error.message,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(500).json({ message: 'Error recording attendance', error: error.message });
  }
};

// Get attendance by event - with pagination
const getAttendanceByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { page, limit, skip } = require('../../../shared/utils/pagination').getPaginationParams(req.query);

    // Get total count for pagination
    const total = await Attendance.countDocuments({ eventId });

    // Get paginated attendance
    const attendance = await Attendance.find({ eventId })
      .sort({ scanTime: -1 })
      .skip(skip)
      .limit(limit);

    if (total === 0) {
      return res.status(200).json({
        success: true,
        message: 'No attendance records found for this event',
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
          nextPage: null,
          prevPage: null
        }
      });
    }

    const { buildPaginatedResponse } = require('../../../shared/utils/pagination');
    res.status(200).json(buildPaginatedResponse(attendance, total, page, limit));
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

// Get all attendance records - with pagination
const getAllAttendance = async (req, res) => {
  try {
    const { page, limit, skip } = require('../../../shared/utils/pagination').getPaginationParams(req.query);

    // Get total count for pagination
    const total = await Attendance.countDocuments();

    // Get paginated attendance
    const attendance = await Attendance.find()
      .sort({ scanTime: -1 })
      .skip(skip)
      .limit(limit);

    const { buildPaginatedResponse } = require('../../../shared/utils/pagination');
    res.status(200).json(buildPaginatedResponse(attendance, total, page, limit));
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
