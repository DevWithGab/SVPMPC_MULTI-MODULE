const { Member } = require('../../../shared/models');
const Event = require('../models/Event');
const Attendance = require('../models/Attendance');
const AttendanceReport = require('../models/AttendanceReport');
const AuditLog = require('../../../shared/models/AuditLog');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const { actorName } = require('../../../shared/utils/actorName');
const { exportModule, restoreModule, summaryTotals } = require('../../../shared/utils/moduleBackup');

/* Everything the Attendance module owns. Members are always included (shared
with Mortuary); on restore an existing member only receives its QR fields,
never the shared profile, mortuary status or beneficiaries. */
const QR_FIELDS = ['qrCode', 'qrCodeUrl', 'qrCodeGenerated', 'qrCodeActive'];
// Shared profile used to recreate a member missing from the database.
const NEW_MEMBER_FIELDS = ['memberId', 'memberName', 'email', 'phoneNumber', 'barangay', 'address', 'status'];
const COLLECTIONS = [
  { name: 'events', Model: Event, key: 'eventId' },
  { name: 'attendanceLogs', Model: Attendance, key: 'attendanceId', summaryKey: 'attendance' },
  { name: 'attendanceReports', Model: AttendanceReport, key: 'reportId' },
  { name: 'auditLogs', Model: AuditLog, key: 'logId', insertOnly: true, filter: { module: 'attendance' } },
];

const audit = (req, fields) => createAuditLog({
  userId: req.user?.userId,
  userName: actorName(req.user, 'Unknown'),
  userRole: req.user?.role || 'admin',
  module: 'attendance',
  entityType: 'backup',
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
  ...fields,
});

// Complete Attendance backup: every member, event, attendance record, report and audit log.
const getFullBackup = async (req, res) => {
  try {
    const backup = await exportModule(Member, 'attendance', COLLECTIONS, actorName(req.user, 'Unknown'));
    await audit(req, {
      action: 'data_exported',
      description: `Downloaded a complete attendance backup (${Object.entries(backup.counts).map(([name, count]) => `${count} ${name}`).join(', ')})`,
      status: 'success',
      metadata: { counts: backup.counts },
    });
    res.status(200).json(backup);
  } catch (error) {
    console.error('Error exporting attendance backup:', error);
    res.status(500).json({ message: 'Error preparing the backup', error: safeErrorMessage(error) });
  }
};

/* Restores a complete backup, or any subset of its arrays. Older backups that
used "attendance" instead of "attendanceLogs" are still accepted. */
const restoreBackup = async (req, res) => {
  try {
    const payload = req.body || {};
    const known = ['members', 'attendance', ...COLLECTIONS.map(c => c.name)];
    if (!known.some(name => Array.isArray(payload[name]))) {
      return res.status(400).json({
        message: 'Invalid backup file — expected an Attendance backup with members, events, attendanceLogs, attendanceReports and/or auditLogs.',
      });
    }

    const summary = await restoreModule(Member, payload, { collections: COLLECTIONS, ownedFields: QR_FIELDS, newMemberFields: NEW_MEMBER_FIELDS, aliases: { attendance: 'attendanceLogs' } });
    const totals = summaryTotals(summary);
    await audit(req, {
      action: 'data_restored',
      description: `Restored backup: ${totals.created} created, ${totals.updated} updated${totals.skipped ? `, ${totals.skipped} already present` : ''}${totals.errors ? `, ${totals.errors} failed` : ''}`,
      status: totals.errors > 0 ? 'partial' : 'success',
      metadata: Object.fromEntries(Object.entries(summary).map(([name, s]) => [name, { created: s.created, updated: s.updated, skipped: s.skipped, errors: s.errors.length }])),
    });

    res.status(200).json({ message: 'Backup restored successfully', summary });
  } catch (error) {
    await audit(req, { action: 'data_restored', description: 'Failed to restore backup', status: 'failed', errorMessage: error.message });
    res.status(500).json({ message: 'Error restoring backup', error: safeErrorMessage(error) });
  }
};

module.exports = { getFullBackup, restoreBackup };
