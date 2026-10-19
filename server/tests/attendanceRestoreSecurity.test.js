const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const Member = require('../shared/models/Member');
const Event = require('../modules/attendance/models/Event');
const Attendance = require('../modules/attendance/models/Attendance');

const profile = (memberId, modules) => ({ memberId, modules, memberName: 'Current Name',
  barangay: 'Current Barangay', address: 'Current address', status: 'deceased',
  beneficiaries: 'Current beneficiary', beneficiaryRelationship: 'Spouse',
  qrCodeGenerated: true, qrCodeActive: false });

function harness({ members = [], events = [], attendance = [], changeMembership = false } = {}) {
  const audit = [], queries = [], updates = [];
  function model(SchemaModel, records) {
    const match = (record, filter) => Object.entries(filter).every(([key, value]) =>
      Array.isArray(record[key]) ? record[key].includes(value) : record[key] === value);
    return {
      async findOne(filter) {
        queries.push(filter);
        const record = records.find(record => match(record, filter));
        return record ? structuredClone(record) : null;
      },
      async updateOne(filter, update, options) {
        updates.push({ filter, update, options });
        if (changeMembership && SchemaModel === Member) records[0].modules = ['mortuary'];
        const record = records.find(record => match(record, filter));
        if (!record) return { matchedCount: 0 };
        assert.equal(options.runValidators, true);
        await new SchemaModel({ ...record, ...update.$set }).validate();
        Object.assign(record, update.$set);
        return { matchedCount: 1 };
      },
      async create(fields) {
        const document = new SchemaModel(fields);
        await document.validate();
        records.push(document.toObject());
      },
    };
  }
  const filename = require.resolve('../modules/attendance/controllers/backupController');
  const localRequire = createRequire(filename);
  const dependencies = {
    '../../../shared/models': { Member: model(Member, members) },
    '../models/Event': model(Event, events), '../models/Attendance': model(Attendance, attendance),
    '../../../shared/services/auditLoggingService': { createAuditLog: async entry => audit.push(entry) },
  };
  const context = { module: { exports: {} }, process, console,
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : localRequire(name) };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return { members, events, attendance, queries, updates, audit,
    async restore(body) {
      const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
      await context.module.exports.restoreBackup({ body,
        user: { userId: 'attendance-admin', username: 'attendance.admin', role: 'admin' },
        ip: '127.0.0.1', get: () => 'synthetic-test' }, res);
      return res;
    },
  };
}

test('restore rejects mortuary-only targets even when the backup claims Attendance membership', async () => {
  const original = profile('MORT-1', ['mortuary']);
  const db = harness({ members: [structuredClone(original)] });
  const res = await db.restore({ members: [{ ...original, modules: ['attendance'], status: 'active', qrCodeActive: true }] });
  assert.equal(res.code, 200);
  assert.equal(res.data.summary.members.updated, 0);
  assert.equal(res.data.summary.members.errors.length, 1);
  assert.deepEqual(db.members[0], original);
  assert.equal(db.updates.length, 0);
  assert.equal(db.audit[0].status, 'partial');
  assert.equal(db.audit[0].userId, 'attendance-admin');
});

test('existing Attendance and shared members restore QR fields without changing shared or mortuary fields', async () => {
  for (const modules of [['attendance'], ['attendance', 'mortuary']]) {
    const original = profile('SHARED-1', modules);
    const db = harness({ members: [structuredClone(original)] });
    const res = await db.restore({ members: [{ ...original, memberName: 'Replaced',
      address: 'Replaced', modules: ['mortuary'], status: 'active',
      beneficiaries: 'Replaced', beneficiaryRelationship: 'Replaced',
      qrCode: 'restored-qr', qrCodeUrl: '/uploads/qrcodes/restored.png', qrCodeActive: true }] });
    assert.equal(res.data.summary.members.updated, 1);
    assert.equal(res.data.summary.members.errors.length, 0);
    for (const field of ['memberName', 'address', 'modules', 'status', 'beneficiaries', 'beneficiaryRelationship']) {
      assert.deepEqual(db.members[0][field], original[field], field);
    }
    assert.equal(db.members[0].qrCode, 'restored-qr');
    assert.equal(db.members[0].qrCodeActive, true);
    assert.equal(db.updates[0].filter.modules, 'attendance');
  }
});

test('new members are created only in Attendance, without importing mortuary fields or schema defaults for both modules', async () => {
  const db = harness();
  const res = await db.restore({ members: [{ ...profile('NEW-1', ['attendance', 'mortuary']),
    qrCode: 'restored-qr', dateOfBirth: '1980-01-01', emergencyContact: { name: 'Injected' } }] });
  assert.equal(res.data.summary.members.created, 1);
  assert.deepEqual(db.members[0].modules, ['attendance']);
  assert.equal(db.members[0].status, 'active'); // Explicitly exclude backup eligibility/status.
  assert.equal(db.members[0].beneficiaries, '');
  assert.equal(db.members[0].beneficiaryRelationship, '');
  assert.equal(db.members[0].dateOfBirth, undefined);
  assert.equal(db.members[0].memberName, 'Current Name');
  assert.equal(db.members[0].qrCode, 'restored-qr');
  const rejected = await db.restore({ members: [profile('MORT-NEW', ['mortuary'])] });
  assert.equal(rejected.data.summary.members.created, 0);
  assert.equal(rejected.data.summary.members.errors.length, 1);
});

test('membership changes between lookup and update do not allow an out-of-scope write', async () => {
  const db = harness({ members: [profile('RACE-1', ['attendance'])], changeMembership: true });
  const res = await db.restore({ members: [{ memberId: 'RACE-1', qrCodeActive: true }] });
  assert.equal(res.data.summary.members.updated, 0);
  assert.equal(res.data.summary.members.errors.length, 1);
  assert.equal(db.members[0].qrCodeActive, false);
});

test('operator-shaped identifiers are rejected before any query in every restore collection', async () => {
  const db = harness();
  const res = await db.restore({ members: [{ memberId: { $ne: null } }],
    events: [{ eventId: { $gt: '' } }], attendanceLogs: [{ attendanceId: { $ne: null } }] });
  assert.equal(db.queries.length, 0);
  for (const summary of Object.values(res.data.summary)) assert.equal(summary.errors.length, 1);
});

test('valid event/attendance backups and the legacy attendance property still restore; invalid updates fail validation', async () => {
  const db = harness();
  const event = { eventId: 'E1', eventName: 'Assembly', eventDate: '2026-10-19',
    eventTime: '09:00', startTime: '09:00', endTime: '10:00', location: 'Hall', createdBy: 'admin', status: 'closed' };
  const attendance = { attendanceId: 'A1', memberId: 'M1', memberName: 'Member', eventId: 'E1',
    eventName: 'Assembly', barangay: 'Test', status: 'present' };
  const created = await db.restore({ events: [event], attendance: [attendance] });
  assert.equal(created.data.summary.events.created, 1);
  assert.equal(created.data.summary.attendance.created, 1);
  const updated = await db.restore({ events: [{ ...event, eventName: 'Restored Assembly' }],
    attendanceLogs: [{ ...attendance, status: 'absent' }] });
  assert.equal(updated.data.summary.events.updated, 1);
  assert.equal(updated.data.summary.attendance.updated, 1);
  const invalid = await db.restore({ events: [{ ...event, status: 'invalid' }] });
  assert.equal(invalid.data.summary.events.errors.length, 1);
  assert.equal(db.events[0].status, 'closed');
});
