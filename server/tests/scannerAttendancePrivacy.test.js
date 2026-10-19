const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { dirname } = require('node:path');
const { createRequire } = require('node:module');
const express = require('express');
const middleware = require('../middleware');

function load(path, deps) {
  const filename = require.resolve(path), localRequire = createRequire(filename);
  const context = { module: { exports: {} }, __dirname: dirname(filename), process, Buffer, console,
    require: name => Object.hasOwn(deps, name) ? deps[name] : localRequire(name) };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}
const response = () => ({ status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
const allowedAttendance = ['attendanceId', 'memberId', 'memberName', 'eventId', 'eventName', 'barangay', 'scanTime', 'status', 'entrySource'].sort();
const row = { attendanceId: 'A1', memberId: 'M1', memberName: 'Synthetic Member', eventId: 'E1',
  eventName: 'Synthetic Event', barangay: 'Test', scanTime: new Date(), status: 'present', entrySource: 'qr',
  _id: 'internal-id', phoneNumber: 'synthetic-private-phone', email: 'private@example.com',
  address: 'private-address', beneficiaries: 'private-beneficiary', futurePrivateField: 'private',
  scannedBy: 'operator', justification: 'private-manual-note' };

function fixture() {
  const saved = [], audit = [], projections = [];
  class Attendance {
    constructor(fields) { Object.assign(this, fields); }
    async save() { saved.push(this); return this; }
    toObject() { return { ...this }; }
    static async findOne() { return null; }
    static async countDocuments() { return 1; }
    static find(filter, projection) {
      projections.push(projection);
      // Intentionally return complete records even when projected: the response
      // allowlist must protect plain objects and documents independently.
      const records = [{ ...row, toObject() { return { ...row }; } }];
      return { then: (resolve, reject) => Promise.resolve(records).then(resolve, reject),
        sort: () => ({ skip: () => ({ limit: async () => records }) }) };
    }
  }
  class Report {
    constructor(fields) { Object.assign(this, fields, { futurePrivateField: 'private', phoneNumber: row.phoneNumber }); }
    async save() { return this; }
    toObject() { return { ...this }; }
  }
  const controller = load('../modules/attendance/controllers/attendanceController', {
    '../models': { Member: { findOne: async () => ({ ...row, modules: ['attendance'], qrCode: 'qr-M1', qrCodeGenerated: true, qrCodeActive: true }), countDocuments: async () => 2 } },
    '../models/Attendance': Attendance, '../models/AttendanceReport': Report,
    '../models/Event': { findOne: async () => ({ eventId: 'E1', eventName: 'Synthetic Event', status: 'active' }) },
    '../controllers/eventController': { refreshEventStatus: async () => {} },
    '../../../shared/services/auditLoggingService': { createAuditLog: async entry => audit.push(entry) },
  });
  return { controller, saved, audit, projections };
}

test('scanner scan/list/event responses exclude private fields while staff retain their responses', async () => {
  for (const role of ['scanner_operator', 'secretary', 'admin', 'super_admin']) {
    const { controller, saved, audit } = fixture();
    const request = { user: { role, userId: 'staff-id', username: 'staff.username' }, query: {}, params: { eventId: 'E1' },
      body: { memberId: 'M1', eventId: 'E1', qrId: 'qr-M1' }, get: () => '', ip: '127.0.0.1' };
    const scanned = response();
    await controller.recordAttendance(request, scanned);
    assert.equal(scanned.code, 201);
    assert.equal(saved[0].phoneNumber, row.phoneNumber, 'stored data is preserved');
    assert.equal(audit[0].changes.after.phoneNumber, row.phoneNumber, 'authorized audit history is preserved');
    if (role === 'scanner_operator') {
      assert.deepEqual(Object.keys(scanned.data.attendance).sort(), allowedAttendance);
    } else assert.equal(scanned.data.attendance.phoneNumber, row.phoneNumber);
    for (const method of ['getAllAttendance', 'getAttendanceByEvent']) {
      const result = response();
      await controller[method](request, result);
      assert.equal(result.code, 200);
      assert.equal(result.data.pagination.total, 1);
      if (role === 'scanner_operator') assert.deepEqual(Object.keys(result.data.data[0]).sort(), allowedAttendance);
      else assert.equal(result.data.data[0].phoneNumber, row.phoneNumber);
    }
  }
});

test('scanner report responses expose only summary fields and retain correct totals', async () => {
  const { controller } = fixture(), result = response();
  await controller.generateReport({ user: { role: 'scanner_operator' }, body: { eventId: 'E1', generatedBy: 'scanner' } }, result);
  assert.equal(result.code, 201);
  assert.deepEqual(Object.keys(result.data.report).sort(), ['reportId', 'eventId', 'eventName', 'reportDate',
    'totalMembers', 'presentCount', 'absentCount', 'attendanceRate'].sort());
  assert.equal(result.data.report.presentCount, 1);
  assert.equal(result.data.report.totalMembers, 2);
});

test('direct HTTP calls through legacy and member routes cannot expose contact fields to scanners', async () => {
  const { controller } = fixture();
  const memberRoutes = load('../modules/attendance/routes/memberRoutes', { '../controllers/attendanceController': controller });
  const routes = load('../modules/attendance/routes/attendanceRoutes', {
    '../controllers/attendanceController': controller, './memberRoutes': memberRoutes,
  });
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { role: 'scanner_operator', modules: ['attendance'], userId: 'scanner-id', username: 'scanner.one' }; next(); });
  app.use('/api/attendance', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/attendance`;
    for (const prefix of ['', '/member']) {
      for (const suffix of ['/attendance', '/attendance/event/E1']) {
        const result = await fetch(base + prefix + suffix);
        assert.equal(result.status, 200);
        assert.deepEqual(Object.keys((await result.json()).data[0]).sort(), allowedAttendance);
      }
      for (const [qrId, expected] of [['stale-qr', 400], ['qr-M1', 201]]) {
        const recorded = await fetch(base + prefix + '/attendance/record', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: 'M1', eventId: 'E1', qrId }),
        });
        assert.equal(recorded.status, expected);
        if (expected === 201) {
          assert.deepEqual(Object.keys((await recorded.json()).attendance).sort(), allowedAttendance);
        }
      }
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('scanner cannot retrieve contact-bearing snapshots through any audit endpoint', async () => {
  let calls = 0;
  const routes = load('../shared/routes/auditLogRoutes', {
    '../../middleware': { ...middleware, authenticateToken: (req, res, next) => {
      req.user = { role: req.headers['x-test-role'], modules: ['attendance'] }; next();
    } },
    '../../shared/controllers/auditLogController': Object.fromEntries(['getAllAuditLogs', 'getAuditTrail',
      'getAuditLogStats', 'getUserActivity', 'getRoleActivity'].map(name => [name, (req, res) => { calls++; res.json({ ok: true }); }])),
  });
  const app = express(); app.use('/api/audit', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/audit`;
    for (const path of ['/logs', '/trail/attendance/A1', '/stats', '/user/operator', '/role/admin']) {
      const result = await fetch(base + path, { headers: { 'x-test-role': 'scanner_operator' } });
      assert.equal(result.status, 403);
    }
    assert.equal(calls, 0);
    for (const role of ['admin', 'secretary', 'treasurer', 'super_admin']) {
      assert.equal((await fetch(base + '/logs', { headers: { 'x-test-role': role } })).status, 200);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
