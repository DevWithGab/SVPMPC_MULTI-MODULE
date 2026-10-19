const { Member } = require('../../../shared/models');
const Event = require('../models/Event');
const Attendance = require('../models/Attendance');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

const QR_FIELDS = ['qrCode', 'qrCodeUrl', 'qrCodeGenerated', 'qrCodeActive'];
const NEW_MEMBER_FIELDS = ['memberId', 'memberName', 'email', 'phoneNumber', 'barangay', 'address', ...QR_FIELDS];
const pickFields = (record, allowed) => Object.fromEntries(
  allowed.filter(field => Object.hasOwn(record, field)).map(field => [field, record[field]])
);
const validRecordId = value => typeof value === 'string' && value.trim().length > 0;

// Attendance can recover QR data, but cannot rewrite the shared profile,
// mortuary eligibility/status, beneficiaries, or module assignments.
const restoreMembers = async (records) => {
  const result = { created: 0, updated: 0, errors: [] };
  for (const record of records) {
    const memberId = record?.memberId;
    if (!validRecordId(memberId)) {
      result.errors.push({ error: 'Record requires a string memberId' });
      continue;
    }

    try {
      // Check the stored membership, never the membership claimed by the file.
      const existing = await Member.findOne({ memberId });
      if (existing) {
        if (!existing.modules?.includes('attendance')) {
          result.errors.push({ memberId, error: 'Member is not enrolled in Attendance' });
          continue;
        }
        const fields = pickFields(record, QR_FIELDS);
        if (Object.keys(fields).length) {
          // Recheck membership atomically in case it changed after the lookup.
          const update = await Member.updateOne(
            { memberId, modules: 'attendance' },
            { $set: fields },
            { runValidators: true },
          );
          if (!update.matchedCount) {
            result.errors.push({ memberId, error: 'Member is no longer available in Attendance' });
            continue;
          }
        }
        result.updated += 1;
      } else {
        if (record.modules !== undefined &&
            (!Array.isArray(record.modules) || !record.modules.includes('attendance'))) {
          result.errors.push({ memberId, error: 'Backup member is not enrolled in Attendance' });
          continue;
        }
        // Override Member's default (both modules). Restoring Attendance must
        // never enroll a new member in Mortuary or import their eligibility.
        await Member.create({ ...pickFields(record, NEW_MEMBER_FIELDS), modules: ['attendance'] });
        result.created += 1;
      }
    } catch (error) {
      result.errors.push({ memberId, error: safeErrorMessage(error) });
    }
  }
  return result;
};

/*Safe ang restore dahil hindi nito basta binubura ang existing data
 na hindi kasama sa backup, kahit partial o luma na ang backup file. */
const upsertMany = async (Model, key, records) => {
  const result = { created: 0, updated: 0, errors: [] };
  if (!Array.isArray(records)) return result;

  for (const record of records) {
    const keyValue = record?.[key];
    if (!validRecordId(keyValue)) {
      result.errors.push({ error: `Record requires a string ${key}` });
      continue;
    }

    try {
      // Strip Mongo-internal fields — these must never be copied from the
      // backup file, they belong to whatever document ends up storing this.
      const { _id, __v, createdAt, updatedAt, ...fields } = record;
      const existing = await Model.findOne({ [key]: keyValue });

      if (existing) {
        await Model.updateOne({ [key]: keyValue }, { $set: fields }, { runValidators: true });
        result.updated += 1;
      } else {
        await Model.create(fields);
        result.created += 1;
      }
    } catch (error) {
      result.errors.push({ [key]: keyValue, error: safeErrorMessage(error) });
    }
  }

  return result;
};

/* Restores from the same JSON shape the "Complete System Backup" button
downloads: { members, events, attendanceLogs }. Any subset of those three
arrays is accepted, so a members-only or events-only export also works.*/
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
    if (hasMembers) summary.members = await restoreMembers(members);
    if (hasEvents) summary.events = await upsertMany(Event, 'eventId', events);
    if (hasAttendance) {
      summary.attendance = await upsertMany(Attendance, 'attendanceId', attendanceRecords);
    }

    const totalCreated = Object.values(summary).reduce((sum, s) => sum + s.created, 0);
    const totalUpdated = Object.values(summary).reduce((sum, s) => sum + s.updated, 0);
    const totalErrors = Object.values(summary).reduce((sum, s) => sum + s.errors.length, 0);

    await createAuditLog({
      userId: req.user?.userId,
      userName: req.user?.username || 'Unknown',
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
      userId: req.user?.userId,
      userName: req.user?.username || 'Unknown',
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

    res.status(500).json({ message: 'Error restoring backup', error: safeErrorMessage(error) });
  }
};

module.exports = { restoreBackup };
