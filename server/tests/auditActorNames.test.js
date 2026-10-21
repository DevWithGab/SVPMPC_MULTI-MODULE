const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { resolveAuditActorNames } = require('../shared/utils/auditActorNames');

test('legacy unknown actors resolve by business and Mongo IDs without replacing recorded names', async () => {
  const mongoId = '0123456789abcdef01234567';
  const users = [
    { _id: mongoId, userId: 'ADMIN-1', fullName: 'Attendance Administrator', username: 'attendance.admin' },
    { _id: '1123456789abcdef01234567', userId: 'ADMIN-2', username: 'second.admin' },
  ];
  let queryCount = 0;
  const User = { find(query) {
    queryCount++;
    assert.deepEqual(query.$or[1]._id.$in, [mongoId]);
    return { select(fields) {
      assert.equal(fields, 'userId fullName username');
      return { lean: async () => users };
    } };
  } };
  const logs = [
    { userId: 'ADMIN-1', userName: 'Unknown', userRole: 'admin' },
    { userId: mongoId, userName: 'Unknown', userRole: 'admin' },
    { userId: 'ADMIN-2', userName: '', userRole: 'admin' },
    { userId: 'ADMIN-1', userName: 'Original recorded name', userRole: 'admin' },
    { userId: 'DELETED', userName: 'Unknown', userRole: 'admin' },
  ];
  const result = await resolveAuditActorNames(logs, User);
  assert.deepEqual(result.map(row => row.userName), [
    'Attendance Administrator', 'Attendance Administrator', 'second.admin',
    'Original recorded name', 'Admin (name not recorded)',
  ]);
  assert.equal(queryCount, 1);
  assert.equal(logs[0].userName, 'Unknown', 'reading legacy logs does not rewrite history');
});

test('missing actor ID does not guess an account from the role or query users', async () => {
  const result = await resolveAuditActorNames([{ userName: 'Unknown', userRole: 'admin' }], {
    find() { throw new Error('No saved actor ID to resolve'); },
  });
  assert.equal(result[0].userName, 'Admin (name not recorded)');
});

test('QR management records the authenticated admin full name or username and business ID', async () => {
  for (const fullName of ['Attendance Administrator', undefined]) {
    const logs = [];
    const member = { memberId: 'M-1', memberName: 'Member One', qrCodeGenerated: true, qrCodeActive: true, save: async () => {} };
    const filename = require.resolve('../modules/attendance/controllers/memberController');
    const localRequire = createRequire(filename);
    const context = { module: { exports: {} }, console, require(name) {
      if (name === '../../../shared/models') return { Member: { findOne: async () => member } };
      if (name === '../../../shared/services/auditLoggingService') return { createAuditLog: async log => logs.push(log) };
      return localRequire(name);
    } };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await context.module.exports.deactivateQRCode({
      params: { memberId: 'M-1' }, user: { userId: 'ADMIN-1', id: 'mongo-id', fullName, username: 'attendance.admin', role: 'admin' },
      ip: '127.0.0.1', get: () => '',
    }, res);
    assert.equal(res.code, 200);
    assert.equal(logs[0].userId, 'ADMIN-1');
    assert.equal(logs[0].userName, fullName || 'attendance.admin');
  }
});
