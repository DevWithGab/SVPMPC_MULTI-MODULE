const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const express = require('express');

function load(path, dependencies) {
  const filename = require.resolve(path);
  const localRequire = createRequire(filename);
  const context = { module: { exports: {} }, process, Buffer, console,
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : localRequire(name) };
  context.exports = context.module.exports;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}

const privateFields = {
  _id: 'internal-id', address: 'Private street', email: 'private@example.com',
  phoneNumber: '09123456789', beneficiaries: 'Private beneficiary',
  beneficiaryRelationship: 'Spouse', dateOfBirth: '1970-01-01',
  emergencyContact: { name: 'Private contact', phoneNumber: '09999999999' },
};
const records = [
  { ...privateFields, memberId: 'ATT-1', memberName: 'Attendance Member', barangay: 'Test', qrCode: 'qr-1', modules: ['attendance'] },
  { ...privateFields, memberId: 'MORT-1', memberName: 'Mortuary Member', barangay: 'Test', qrCode: 'qr-3', modules: ['mortuary'] },
  { ...privateFields, memberId: 'SHARED-1', memberName: 'Shared Member', barangay: 'Test', qrCode: 'qr-2', modules: ['attendance', 'mortuary'] },
];

function controller() {
  // Simulate Mongo's matching and inclusion projection without a connection.
  const matches = (record, filter) => Object.entries(filter).every(([key, value]) =>
    Array.isArray(record[key]) ? record[key].includes(value) : record[key] === value);
  const project = (record, projection) => {
    if (!record) return null;
    if (!projection) return { ...record };
    const fields = projection.split(' ').filter(field => !field.startsWith('-'));
    if (!projection.split(' ').includes('-_id')) fields.push('_id');
    return Object.fromEntries(fields.filter(field => field in record).map(field => [field, record[field]]));
  };
  const Member = {
    find(filter, projection) {
      return { skip(offset) { return { limit: async size => records.filter(record => matches(record, filter))
        .slice(offset, offset + size).map(record => project(record, projection)) }; } };
    },
    countDocuments: async filter => records.filter(record => matches(record, filter)).length,
    findOne: async (filter, projection) => project(records.find(record => matches(record, filter)), projection),
  };
  return load('../modules/attendance/controllers/memberController', {
    '../../../shared/models': { Member },
  });
}

const response = () => ({ status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });

test('scanner list and detail preserve privacy across all shared members', async () => {
  const members = controller();
  const user = { role: 'scanner_operator', modules: ['attendance'] };
  const list = response();
  await members.getAllMembers({ user, query: {} }, list);
  assert.equal(list.code, 200);
  assert.equal(list.data.pagination.total, 3);
  assert.deepEqual(list.data.members.map(member => member.memberId), ['ATT-1', 'MORT-1', 'SHARED-1']);
  for (const member of list.data.members) {
    assert.deepEqual(Object.keys(member).sort(), ['barangay', 'memberId', 'memberName', 'qrCode']);
    const detail = response();
    await members.getMemberById({ user, params: { memberId: member.memberId } }, detail);
    assert.equal(detail.code, 200);
    assert.deepEqual(detail.data, member);
  }
});

test('Attendance member reads include legacy module labels for every authorized attendance role', async () => {
  const members = controller();
  for (const role of ['scanner_operator', 'secretary', 'admin', 'super_admin']) {
    const user = { role, modules: ['attendance', 'mortuary'] };
    for (const memberId of ['does-not-exist']) {
      const detail = response();
      await members.getMemberById({ user, params: { memberId } }, detail);
      assert.equal(detail.code, 404, role);
      assert.equal(detail.data.message, 'Member not found');
    }
    const list = response();
    await members.getAllMembers({ user, query: { page: '2', limit: '1' } }, list);
    assert.equal(list.data.pagination.total, 3);
    assert.equal(list.data.pagination.totalPages, 3);
    assert.equal(list.data.members.length, 1);
    assert.equal(list.data.members[0].memberId, 'MORT-1');
    if (role !== 'scanner_operator') {
      const detail = response();
      await members.getMemberById({ user, params: { memberId: 'ATT-1' } }, detail);
      assert.equal(detail.code, 200);
      assert.equal(detail.data.address, privateFields.address);
    }
  }
});

test('member API routes enforce scanner privacy on direct HTTP requests', async () => {
  const members = controller();
  const router = load('../modules/attendance/routes/memberRoutes', {
    '../controllers/memberController': members,
  });
  const app = express();
  app.use((req, res, next) => { req.user = { role: 'scanner_operator', modules: ['attendance'] }; next(); });
  app.use('/api/attendance/member', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/attendance/member/members`;
    const found = await fetch(base + '/ATT-1');
    assert.equal(found.status, 200);
    assert.deepEqual(Object.keys(await found.json()).sort(), ['barangay', 'memberId', 'memberName', 'qrCode']);
    const hidden = await fetch(base + '/MORT-1');
    assert.equal(hidden.status, 200);
    assert.deepEqual(Object.keys(await hidden.json()).sort(), ['barangay', 'memberId', 'memberName', 'qrCode']);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
