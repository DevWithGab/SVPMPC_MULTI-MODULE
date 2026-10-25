const test = require('node:test');
const assert = require('node:assert/strict');
const { withManualAttendanceReason } = require('../shared/services/auditLoggingService');

const scan = (metadata, description = 'Attendance recorded for member "Nestor Fajardo" at event "2nd General Assembly"') =>
  ({ action: 'attendance_recorded', entityName: 'Nestor Fajardo', description, metadata });

test('older manual attendance logs show that they were manual, with the reason', () => {
  const log = withManualAttendanceReason(scan({ entrySource: 'manual', justification: 'damaged code' }));
  assert.equal(log.description, 'Attendance manually marked for member "Nestor Fajardo" at event "2nd General Assembly". Reason: damaged code');
});

test('QR scans, other actions, and logs that already state the reason are unchanged', () => {
  const qr = scan({ entrySource: 'qr' });
  assert.equal(withManualAttendanceReason(qr), qr);
  const recent = scan({ entrySource: 'manual', justification: 'lost card' }, 'Attendance manually marked for member "A" at event "B". Reason: lost card');
  assert.equal(withManualAttendanceReason(recent), recent);
  const other = { action: 'event_created', metadata: { entrySource: 'manual' }, description: 'Event created' };
  assert.equal(withManualAttendanceReason(other), other);
});

test('every staff role can be recorded in the audit log (no entries silently dropped)', async () => {
  const AuditLog = require('../shared/models/AuditLog');
  const User = require('../shared/models/User');
  for (const role of User.schema.path('role').enumValues) {
    const log = new AuditLog({ logId: `test-${role}`, userName: 'Staff', userRole: role, action: 'attendance_recorded', module: 'attendance', entityType: 'attendance', description: 'test' });
    await assert.doesNotReject(log.validate(), `audit log rejects role ${role}`);
  }
});
