const test = require('node:test');
const assert = require('node:assert/strict');
const { auditRequestFields } = require('../shared/utils/auditRequestFields');
const { secretaryRoles, attendanceRoles, moduleRoles } = require('../shared/utils/staffRoles');
const { authorizeSecretaryOnly, authorizeAttendanceRoles } = require('../middleware/auth');

const request = (user, headers = {}) => ({ user, ip: '192.168.1.20', get: name => headers[name] });

test('audit request fields name the signed-in staff member by full name, then username', () => {
  const fields = auditRequestFields(request({ userId: 'U-1', username: 'ana', fullName: ' Ana Cruz ', role: 'secretary' }, { 'user-agent': 'Browser/1' }), { role: 'admin' });
  assert.deepEqual(fields, { userId: 'U-1', userName: 'Ana Cruz', userRole: 'secretary', ipAddress: '192.168.1.20', userAgent: 'Browser/1' });
  assert.equal(auditRequestFields(request({ userId: 'U-2', username: 'ben', fullName: '   ', role: 'admin' })).userName, 'ben');
});

test('audit request fields fall back to the given role and name only without a signed-in user', () => {
  assert.deepEqual(auditRequestFields(request(undefined), { role: 'secretary', name: 'importer' }),
    { userId: undefined, userName: 'importer', userRole: 'secretary', ipAddress: '192.168.1.20', userAgent: undefined });
  assert.equal(auditRequestFields(request(undefined)).userName, 'Unknown');
});

test('attendance role lists keep their access rules', () => {
  assert.deepEqual(secretaryRoles, ['secretary', 'super_admin']);
  assert.deepEqual(attendanceRoles, [...moduleRoles.attendance, 'super_admin']);
  const allowed = (middleware, role) => { let passed = false; middleware({ user: { role } }, { status: () => ({ json: () => {} }) }, () => { passed = true; }); return passed; };
  for (const role of ['secretary', 'scanner_operator', 'super_admin', 'admin', 'treasurer', 'claims_officer', 'finance_officer']) {
    assert.equal(allowed(authorizeSecretaryOnly, role), ['secretary', 'super_admin'].includes(role), role);
    assert.equal(allowed(authorizeAttendanceRoles, role), ['secretary', 'scanner_operator', 'super_admin'].includes(role), role);
  }
});
