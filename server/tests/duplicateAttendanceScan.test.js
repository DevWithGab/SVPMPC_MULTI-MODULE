const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Same VM-sandbox require-interception helper as the other controller
// tests in this suite.
function load(path, dependencies) {
  const filename = require.resolve(path);
  const localRequire = createRequire(filename);
  const context = { module: { exports: {} }, process, Buffer, console,
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : localRequire(name) };
  context.exports = context.module.exports;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}
const response = () => ({ status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });

// recordAttendance's real duplicate guard is two layers, per its own code
// comment: a cheap findOne pre-check (catches the common double-click, but
// has a race window — two near-simultaneous scans can both pass it before
// either has saved), backed by the unique {memberId, eventId} index on the
// Attendance model (catches the rest via an 11000 on save()). The fake
// Attendance model below enforces that same uniqueness against one shared
// array in save(), which is what actually lets the concurrency test below
// exercise the real race window instead of being serialized away.
function database({ members = [], events = [] } = {}) {
  const state = { members, events, attendance: [], auditLogs: [] };

  const Member = { findOne: async (query) => state.members.find(m => m.memberId === query.memberId) || null };
  const Event = { findOne: async (query) => state.events.find(e => e.eventId === query.eventId) || null };

  class AttendanceDoc {
    constructor(data) { Object.assign(this, data); }
    async save() {
      if (state.attendance.some(a => a.memberId === this.memberId && a.eventId === this.eventId)) {
        const error = new Error('E11000 duplicate key error'); error.code = 11000; throw error;
      }
      state.attendance.push(this);
      return this;
    }
    toObject() { return { ...this }; }
  }
  AttendanceDoc.findOne = async (query) =>
    state.attendance.find(a => a.memberId === query.memberId && a.eventId === query.eventId && a.status === query.status) || null;

  return {
    state,
    deps: {
      '../models': { Member },
      '../models/Attendance': AttendanceDoc,
      '../models/Event': Event,
      '../models/AttendanceReport': {},
      '../controllers/eventController': { refreshEventStatus: async () => {} },
      '../../../shared/services/auditLoggingService': { createAuditLog: async (log) => { state.auditLogs.push(log); } },
    },
  };
}

function controller(db) {
  return load('../modules/attendance/controllers/attendanceController', db.deps);
}

const actor = { userId: 'scanner-id', username: 'scanner.one', role: 'scanner_operator' };
const activeMember = (id) => ({ memberId: id, memberName: `Member ${id}`, phoneNumber: '09171234567', barangay: 'Test', status: 'active', qrCodeGenerated: true, qrCodeActive: true });
const activeEvent = (id) => ({ eventId: id, eventName: `Event ${id}`, location: 'Hall', status: 'active' });

test('a member can be scanned present for an event exactly once', async () => {
  const db = database({ members: [activeMember('M1')], events: [activeEvent('E1')] });
  const { recordAttendance } = controller(db);
  const req = { user: actor, body: { memberId: 'M1', eventId: 'E1', scannedBy: 'scanner.one' }, ip: '', get: () => '' };

  const first = response();
  await recordAttendance(req, first);
  assert.equal(first.code, 201);
  assert.equal(db.state.attendance.length, 1);
});

test('a sequential repeat scan is rejected by the findOne pre-check and logged as a duplicate attempt', async () => {
  const db = database({ members: [activeMember('M1')], events: [activeEvent('E1')] });
  const { recordAttendance } = controller(db);
  const req = { user: actor, body: { memberId: 'M1', eventId: 'E1', scannedBy: 'scanner.one' }, ip: '', get: () => '' };

  await recordAttendance(req, response());
  const retry = response();
  await recordAttendance(req, retry);

  assert.equal(retry.code, 400);
  assert.match(retry.data.message, /already marked present/);
  assert.equal(db.state.attendance.length, 1, 'no second attendance row is created');
  assert.ok(db.state.auditLogs.some(log => log.status === 'failed' && log.description.includes('Duplicate scan attempt')));
});

test('two truly concurrent scans of the same member for the same event: exactly one succeeds', async () => {
  const db = database({ members: [activeMember('M1')], events: [activeEvent('E1')] });
  const { recordAttendance } = controller(db);
  const req = { user: actor, body: { memberId: 'M1', eventId: 'E1', scannedBy: 'scanner.one' }, ip: '', get: () => '' };

  const resA = response();
  const resB = response();
  await Promise.all([recordAttendance(req, resA), recordAttendance(req, resB)]);

  const codes = [resA.code, resB.code].sort();
  assert.deepEqual(codes, [201, 400], 'one scan is recorded, the other is rejected — never both, never neither');
  assert.equal(db.state.attendance.length, 1, 'the unique-index-backed catch must prevent a second row even when the pre-check race is lost');
});

test('the same member can be scanned for a different event; a different member can be scanned for the same event', async () => {
  const db = database({ members: [activeMember('M1'), activeMember('M2')], events: [activeEvent('E1'), activeEvent('E2')] });
  const { recordAttendance } = controller(db);

  const sameMemberOtherEvent = response();
  await recordAttendance({ user: actor, body: { memberId: 'M1', eventId: 'E1' }, ip: '', get: () => '' }, response());
  await recordAttendance({ user: actor, body: { memberId: 'M1', eventId: 'E2' }, ip: '', get: () => '' }, sameMemberOtherEvent);
  assert.equal(sameMemberOtherEvent.code, 201, 'the dedup key must be scoped to (member, event), not member alone');

  const otherMemberSameEvent = response();
  await recordAttendance({ user: actor, body: { memberId: 'M2', eventId: 'E1' }, ip: '', get: () => '' }, otherMemberSameEvent);
  assert.equal(otherMemberSameEvent.code, 201, 'the dedup key must not block a different member at the same event');

  assert.equal(db.state.attendance.length, 3);
});

test('caller-supplied operator identity cannot change recorded or duplicate-scan audit attribution', async () => {
  const db = database({ members: [activeMember('M1')], events: [activeEvent('E1')] });
  const { recordAttendance } = controller(db);
  const req = { user: actor, body: { memberId: 'M1', eventId: 'E1', scannedBy: 'forged.admin',
    scannedByUserId: 'forged-admin-id', userRole: 'super_admin' }, ip: '', get: () => '' };
  const created = response();
  await recordAttendance(req, created);
  assert.equal(created.code, 201);
  assert.equal(db.state.attendance[0].scannedBy, actor.username);
  assert.equal(db.state.attendance[0].scannedByUserId, actor.userId);
  const duplicate = response();
  await recordAttendance(req, duplicate);
  assert.equal(duplicate.code, 400);
  assert.equal(db.state.auditLogs.length, 2);
  for (const log of db.state.auditLogs) {
    assert.equal(log.userId, actor.userId);
    assert.equal(log.userName, actor.username);
    assert.equal(log.userRole, actor.role);
  }
});

test('failed attendance writes also attribute the authenticated account', async () => {
  const db = database();
  db.deps['../models'].Member.findOne = async () => { throw new Error('Synthetic database failure'); };
  const result = response();
  await controller(db).recordAttendance({ user: actor, body: { memberId: 'M1', eventId: 'E1', scannedBy: 'forged.admin' },
    ip: '', get: () => '' }, result);
  assert.equal(result.code, 500);
  assert.equal(db.state.auditLogs[0].userId, actor.userId);
  assert.equal(db.state.auditLogs[0].userName, actor.username);
  assert.equal(db.state.auditLogs[0].userRole, actor.role);
});

test('manual entries require a nonblank string reason of at most 1000 characters', async () => {
  const db = database({ members: [activeMember('M1')], events: [activeEvent('E1')] });
  const { recordAttendance } = controller(db);
  for (const justification of [undefined, null, '', '  \n ', 123, {}, [], 'x'.repeat(1001)]) {
    const result = response();
    await recordAttendance({ user: actor, body: { memberId: 'M1', eventId: 'E1', entrySource: 'manual', justification } }, result);
    assert.equal(result.code, 400);
  }
  assert.equal(db.state.attendance.length, 0);
  const valid = response();
  await recordAttendance({ user: actor, body: { memberId: 'M1', eventId: 'E1', entrySource: 'manual',
    justification: '  Printed QR is damaged.  ' }, get: () => '', ip: '' }, valid);
  assert.equal(valid.code, 201);
  assert.equal(db.state.attendance[0].justification, 'Printed QR is damaged.');
  assert.equal(db.state.auditLogs[0].metadata.justification, 'Printed QR is damaged.');
});

test('unknown entry sources and missing authentication are rejected without writing attendance', async () => {
  const db = database();
  const { recordAttendance } = controller(db);
  for (const entrySource of ['MANUAL', 'other', null, {}, []]) {
    const result = response();
    await recordAttendance({ user: actor, body: { memberId: 'M1', eventId: 'E1', entrySource } }, result);
    assert.equal(result.code, 400);
  }
  const anonymous = response();
  await recordAttendance({ body: { memberId: 'M1', eventId: 'E1', scannedBy: 'forged.admin' } }, anonymous);
  assert.equal(anonymous.code, 401);
  assert.equal(db.state.attendance.length, 0);
});

test('My Scans uses trusted identity, supports legacy names, and cannot query another operator', async () => {
  const rows = [
    { attendanceId: 'stable-id', scannedByUserId: actor.userId, scannedBy: 'previous.username' },
    { attendanceId: 'legacy', scannedBy: actor.username },
    { attendanceId: 'other', scannedByUserId: 'another-user', scannedBy: actor.username },
    { attendanceId: 'legacy-other', scannedBy: 'other.operator' },
  ];
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(part => matches(row, part));
    if (typeof value === 'object' && '$exists' in value) return Object.hasOwn(row, key) === value.$exists;
    if (typeof value === 'object' && '$in' in value) return value.$in.includes(row[key]);
    return row[key] === value;
  });
  const db = database();
  const Attendance = db.deps['../models/Attendance'];
  Attendance.countDocuments = async filter => rows.filter(row => matches(row, filter)).length;
  Attendance.find = filter => ({ sort: () => ({ skip: () => ({ limit: async () => rows.filter(row => matches(row, filter)) }) }) });
  for (const query of [{ mine: 'true' }, { scannedBy: 'other.operator' }]) {
    const result = response();
    await controller(db).getAllAttendance({ user: actor, query }, result);
    assert.equal(result.code, 200);
    assert.equal(result.data.pagination.total, 2);
    assert.deepEqual(result.data.data.map(row => row.attendanceId), ['stable-id', 'legacy']);
  }
});
