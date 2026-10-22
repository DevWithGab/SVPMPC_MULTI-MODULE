const { Member } = require('../models');
const Attendance = require('../models/Attendance');
const Event = require('../models/Event');
const AttendanceReport = require('../models/AttendanceReport');
const { v4: uuidv4 } = require('uuid');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

// Use an allowlist so new model fields cannot silently become scanner data.
const SCANNER_ATTENDANCE_FIELDS = ['attendanceId', 'memberId', 'memberName', 'eventId',
  'eventName', 'barangay', 'scanTime', 'status', 'entrySource', 'scannedBy'];
const SCANNER_REPORT_FIELDS = ['reportId', 'eventId', 'eventName', 'reportDate',
  'totalMembers', 'presentCount', 'absentCount', 'attendanceRate'];
const scannerProjection = req => req.user?.role === 'scanner_operator'
  ? `${SCANNER_ATTENDANCE_FIELDS.join(' ')} -_id`
  : null;
const restrictScannerResponse = (req, record, fields = SCANNER_ATTENDANCE_FIELDS) => {
  if (req.user?.role !== 'scanner_operator') return record;
  const data = typeof record.toObject === 'function' ? record.toObject() : record;
  return Object.fromEntries(fields.filter(field => Object.hasOwn(data, field)).map(field => [field, data[field]]));
};

// Record attendance via QR scan
const recordAttendance = async (req, res) => {
  const actor = { userId: req.user?.userId, userName: req.user?.username, userRole: req.user?.role };
  if (!actor.userId || !actor.userName || !actor.userRole) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  try {
    const { memberId, eventId, qrId, entrySource, justification } = req.body;

    /* using typeof checks para maiwasan ang NoSQL operator injection attacks.
       kasi for example ah, kung walang typeof check, puwede magpadala ang attacker ng:
       { "$gt": "" } as a memberId at eventId, at makakapasok sa attendance 
      kahit hindi valid ang member/event. */
    if (!memberId || !eventId || typeof memberId !== 'string' || typeof eventId !== 'string') {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (entrySource !== undefined && !['qr', 'manual'].includes(entrySource)) {
      return res.status(400).json({ message: 'Entry source must be qr or manual' });
    }
    if (entrySource === 'manual' && (typeof justification !== 'string' ||
        !justification.trim() || justification.trim().length > 1000)) {
      return res.status(400).json({ message: 'Manual attendance requires a reason of 1–1000 characters' });
    }
    const manualReason = entrySource === 'manual' ? justification.trim() : undefined;

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
    if (entrySource !== 'manual' && (typeof qrId !== 'string' || !qrId || qrId !== member.qrCode)) {
      return res.status(400).json({ message: 'This QR code is invalid or has been replaced. Use the current card or manual entry with a reason.' });
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
      ...actor,
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
      scannedBy: actor.userName,
      scannedByUserId: actor.userId,
      entrySource: entrySource === 'manual' ? 'manual' : 'qr',
      justification: manualReason,
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
      ...actor,
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
      attendance: restrictScannerResponse(req, saved),
    });
  } catch (error) {
    // Log failed attempt
    await createAuditLog({
      ...actor,
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
    const attendance = await Attendance.find({ eventId }, scannerProjection(req))
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
    res.status(200).json(buildPaginatedResponse(attendance.map(record => restrictScannerResponse(req, record)), total, page, limit));
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
      report: restrictScannerResponse(req, saved, SCANNER_REPORT_FIELDS),
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

    // typeof check closes the same NoSQL operator-injection hole already
    // fixed on several req.body fields in this app (e.g. recordAttendance
    // above): Express's query-string parser turns a crafted
    // ?scannedBy[$ne]=x into an OBJECT, which — left unchecked — would be
    // embedded directly into the filter below and interpreted as a real
    // Mongo query operator instead of a literal scannedBy value.
    if (scannedBy !== undefined && typeof scannedBy !== 'string') {
      return res.status(400).json({ message: 'Invalid scannedBy filter' });
    }

    // My Scans uses the authenticated stable account ID. Keep legacy records
    // searchable by trusted account names, without trusting a supplied name.
    let filter = scannedBy ? { scannedBy } : {};
    if (req.user?.role === 'scanner_operator' && (scannedBy || req.query.mine === 'true')) {
      const names = [req.user.username, req.user.fullName].filter(Boolean);
      filter = { $or: [
        { scannedByUserId: req.user.userId },
        { scannedByUserId: { $exists: false }, scannedBy: { $in: names } },
      ] };
    }

    // Get total count for pagination
    const total = await Attendance.countDocuments(filter);

    // Get paginated attendance
    const attendance = await Attendance.find(filter, scannerProjection(req))
      .sort({ scanTime: -1 })
      .skip(skip)
      .limit(limit);

    const { buildPaginatedResponse } = require('../../../shared/utils/pagination');
    res.status(200).json(buildPaginatedResponse(attendance.map(record => restrictScannerResponse(req, record)), total, page, limit));
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
