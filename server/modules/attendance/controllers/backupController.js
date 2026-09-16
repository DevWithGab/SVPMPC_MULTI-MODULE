const { Member } = require('../../../shared/models');
const Event = require('../models/Event');
const Attendance = require('../models/Attendance');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');

// Restoring from a backup upserts by each collection's natural key — an
// existing record with the same id gets its fields overwritten, a new one
// gets created. It never deletes anything not present in the backup, so a
// partial or older backup can't wipe out newer data that isn't in the file.
const upsertMany = async (Model, key, records) => {
  const result = { created: 0, updated: 0, errors: [] };
  if (!Array.isArray(records)) return result;

  for (const record of records) {
    const keyValue = record?.[key];
    if (!keyValue) {
      result.errors.push({ error: `Record missing ${key}`, record });
      continue;
    }

    try {
      // Strip Mongo-internal fields — these must never be copied from the
      // backup file, they belong to whatever document ends up storing this.
      const { _id, __v, createdAt, updatedAt, ...fields } = record;
      const existing = await Model.findOne({ [key]: keyValue });

      if (existing) {
        await Model.updateOne({ [key]: keyValue }, { $set: fields });
        result.updated += 1;
      } else {
        await Model.create(fields);
        result.created += 1;
      }
    } catch (error) {
      result.errors.push({ [key]: keyValue, error: error.message });
    }
  }

  return result;
};

// Restores from the same JSON shape the "Complete System Backup" button
// downloads: { members, events, attendanceLogs }. Any subset of those three
// arrays is accepted, so a members-only or events-only export also works.
const restoreBackup = async (req, res) => {
  try {
    const { members, events, attendanceLogs, attendance } = req.body || {};
    const attendanceRecords = Array.isArray(attendanceLogs) ? attendanceLogs : attendance;

    const hasMembers = Array.isArray(members);
    const hasEvents = Array.isArray(events);
    const hasAttendance = Array.isArray(attendanceRecords);

    if (!hasMembers && !hasEvents && !hasAttendance) {
      return res.status(400).json({
        message:
          'Invalid backup file — expected a "members", "events", and/or "attendanceLogs" array.',
      });
    }

    const summary = {};
    if (hasMembers) summary.members = await upsertMany(Member, 'memberId', members);
    if (hasEvents) summary.events = await upsertMany(Event, 'eventId', events);
    if (hasAttendance) {
      summary.attendance = await upsertMany(Attendance, 'attendanceId', attendanceRecords);
    }

    const totalCreated = Object.values(summary).reduce((sum, s) => sum + s.created, 0);
    const totalUpdated = Object.values(summary).reduce((sum, s) => sum + s.updated, 0);
    const totalErrors = Object.values(summary).reduce((sum, s) => sum + s.errors.length, 0);

    await createAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || 'Unknown',
      userRole: req.user?.role || 'admin',
      action: 'data_restored',
      module: 'attendance',
      entityType: 'backup',
      description: `Restored backup: ${totalCreated} created, ${totalUpdated} updated${totalErrors ? `, ${totalErrors} failed` : ''}`,
      status: totalErrors > 0 ? 'partial' : 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        members: summary.members
          ? { created: summary.members.created, updated: summary.members.updated, errors: summary.members.errors.length }
          : undefined,
        events: summary.events
          ? { created: summary.events.created, updated: summary.events.updated, errors: summary.events.errors.length }
          : undefined,
        attendance: summary.attendance
          ? { created: summary.attendance.created, updated: summary.attendance.updated, errors: summary.attendance.errors.length }
          : undefined,
      },
    });

    res.status(200).json({ message: 'Backup restored successfully', summary });
  } catch (error) {
    await createAuditLog({
      userId: req.user?.id,
      userName: req.user?.name || 'Unknown',
      userRole: req.user?.role || 'admin',
      action: 'data_restored',
      module: 'attendance',
      entityType: 'backup',
      description: 'Failed to restore backup',
      status: 'failed',
      errorMessage: error.message,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(500).json({ message: 'Error restoring backup', error: error.message });
  }
};

module.exports = { restoreBackup };
