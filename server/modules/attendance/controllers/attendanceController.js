const { Member } = require('../models');
const Attendance = require('../models/Attendance');
const Event = require('../models/Event');
const AttendanceReport = require('../models/AttendanceReport');
const { v4: uuidv4 } = require('uuid');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

// Record attendance via QR scan
const recordAttendance = async (req, res) => {
  try {
    const { memberId, eventId, scannedBy, entrySource, justification } = req.body;

    /* using typeof checks para maiwasan ang NoSQL operator injection attacks.
       kasi for example ah, kung walang typeof check, puwede magpadala ang attacker ng:
       { "$gt": "" } as a memberId at eventId, at makakapasok sa attendance 
      kahit hindi valid ang member/event. */
    if (!memberId || !eventId || typeof memberId !== 'string' || typeof eventId !== 'string') {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify member exists
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    /*
    Member.status is shared with the Mortuary module 
    kaya we need to check if the member is deceased before
    allowing attendance recording, tapos mag return ng error
    message na hindi puwede i-check in ang deceased member.*/
    if (member.status === 'deceased') {
      return res.status(400).json({ message: `${member.memberName} is recorded as deceased and cannot be marked present for an event.` });
    }

    /* A deactivated or never-generated QR can't check in via scan. Manual
    entries (staff recording attendance by hand) are a deliberate
    override and bypass this — matches how the justification field
    already handles irregular entries.*/
    if (entrySource !== 'manual' && (!member.qrCodeGenerated || member.qrCodeActive === false)) {
      return res.status(400).json({ message: 'This member\'s QR code is not active. Generate or reactivate it before scanning.' });
    }

    // Verify event exists
    const event = await Event.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    await require('../controllers/eventController').refreshEventStatus(event);
    if (event.status !== 'active') {
      return res.status(400).json({ message: 'Attendance can only be recorded while the event is active' });
    }

    /*Ang fast-path check ay para sa mabilis at friendly na feedback, 
    while the unique index is the one na pumipigil sa duplicate attendance records. */ 
    const logDuplicateScan = () => createAuditLog({
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

    const existingAttendance = await Attendance.findOne({
      memberId,
      eventId,
      status: 'present',
    });

    if (existingAttendance) {
      await logDuplicateScan();
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
      entrySource: entrySource === 'manual' ? 'manual' : 'qr',
      justification: justification || undefined,
    });

    let saved;
    try {
      saved = await newAttendance.save();
    } catch (error) {
      if (error.code !== 11000) throw error;
      /* Lost the race: another request's insert landed between the
       findOne above and this save. The unique index just caught what the
       findOne couldn't.*/
      await logDuplicateScan();
      return res.status(400).json({
        message: 'Member already marked present for this event',
      });
    }

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
        entrySource: saved.entrySource,
        justification: saved.justification,
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

    res.status(500).json({ message: 'Error recording attendance', error: safeErrorMessage(error) });
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
    res.status(500).json({ message: 'Error fetching attendance', error: safeErrorMessage(error) });
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

    /*Active members lang ang dapat bilangin bilang expected attendees 
    para tama ang attendance percentages sa screen. */
    const totalMembers = await Member.countDocuments({ status: 'active' });
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
    res.status(500).json({ message: 'Error fetching attendance stats', error: safeErrorMessage(error) });
  }
};

// Generate attendance report
const generateReport = async (req, res) => {
  try {
    const { eventId, generatedBy } = req.body;

    // Same NoSQL operator-injection guard as recordAttendance above — eventId
    // is never legitimately anything but a string.
    if (!eventId || !generatedBy || typeof eventId !== 'string') {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const event = await Event.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const attendanceRecords = await Attendance.find({ eventId });
    // Same "expected attendee = active member" rule as getAttendanceStats above.
    const totalMembers = await Member.countDocuments({ status: 'active' });
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
    res.status(500).json({ message: 'Error generating report', error: safeErrorMessage(error) });
  }
};

// Get all attendance records - with pagination
const getAllAttendance = async (req, res) => {
  try {
    const { page, limit, skip } = require('../../../shared/utils/pagination').getPaginationParams(req.query);
    const { scannedBy } = req.query;

    // Scanner Operator's "My Scans" view narrows this down to just the
    // records that operator personally scanned in (matches the scannedBy
    // value attendanceAPI.recordAttendance stores for each scan).
    const filter = scannedBy ? { scannedBy } : {};

    // Get total count for pagination
    const total = await Attendance.countDocuments(filter);

    // Get paginated attendance
    const attendance = await Attendance.find(filter)
      .sort({ scanTime: -1 })
      .skip(skip)
      .limit(limit);

    const { buildPaginatedResponse } = require('../../../shared/utils/pagination');
    res.status(200).json(buildPaginatedResponse(attendance, total, page, limit));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching attendance', error: safeErrorMessage(error) });
  }
};

module.exports = {
  recordAttendance,
  getAttendanceByEvent,
  getAttendanceStats,
  generateReport,
  getAllAttendance,
};
