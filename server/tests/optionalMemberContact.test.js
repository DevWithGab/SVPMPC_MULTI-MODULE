const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const Member = require('../shared/models/Member');
const User = require('../shared/models/User');

// Exercise controller behavior and real schema validation without a database
// or sending credentials to an email provider.
function controllerHarness() {
  const rows = { members: [], users: [], queries: [] };
  const model = (Schema, key) => class {
    constructor(data) { Object.assign(this, data); }
    async save() {
      await new Schema(this).validate();
      rows[key].push(this);
    }
    static async findOne(query) {
      rows.queries.push(query);
      return rows[key].find(row => Object.entries(query).every(([field, value]) => row[field] === value));
    }
  };
  const filename = require.resolve('../shared/controllers/adminController');
  const localRequire = createRequire(filename);
  const context = {
    module: { exports: {} }, process, console: { log() {}, error() {} },
    require: name => {
      if (name === '../models') return { Member: model(Member, 'members'), User: model(User, 'users') };
      if (name.includes('notificationService')) throw new Error('Member creation must not send notifications');
      return localRequire(name);
    },
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  const invoke = async (action, body) => {
    const response = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await context.module.exports[action]({ body }, response);
    return response;
  };
  return { rows, invoke };
}

const member = { memberName: 'Sample Member', barangay: 'Sample Barangay', address: 'Sample Address' };

test('single member creation accepts omitted, empty, and whitespace contact details', async () => {
  for (const contact of [{}, { email: '', phoneNumber: '' }, { email: '  ', phoneNumber: '  ' }]) {
    const { rows, invoke } = controllerHarness();
    const result = await invoke('createMember', { ...member, ...contact });
    assert.equal(result.code, 201);
    assert.equal(rows.members.length, 1);
    assert.equal(rows.users.length, 0);
    assert.equal(rows.members[0].email, '');
    assert.equal(rows.members[0].phoneNumber, '');
    assert.equal(result.data.account, undefined);
    assert.equal(rows.queries.length, 0, 'blank email must not be used for duplicate checks');
  }
});

test('single creation accepts either contact independently and rejects invalid provided values', async () => {
  for (const contact of [{ email: 'member@example.com' }, { phoneNumber: '09123456789' }]) {
    const { invoke } = controllerHarness();
    assert.equal((await invoke('createMember', { ...member, ...contact })).code, 201);
  }
  for (const contact of [{ email: 'invalid' }, { phoneNumber: '1234' }]) {
    const { rows, invoke } = controllerHarness();
    assert.equal((await invoke('createMember', { ...member, ...contact })).code, 400);
    assert.equal(rows.members.length, 0);
  }
});

test('bulk creation allows multiple members with blank contacts and retains email duplicate checks', async () => {
  const { rows, invoke } = controllerHarness();
  const result = await invoke('bulkCreateMembers', { members: [
    { ...member, memberId: '001' },
    { ...member, memberId: '002', email: ' ', phoneNumber: '' },
    { ...member, memberId: '003', email: 'member@example.com' },
    { ...member, memberId: '004', email: 'member@example.com' },
    { ...member, memberId: '005', phoneNumber: 'bad-number' },
    { ...member, memberId: '006', email: 'bad-email' },
  ] });
  assert.equal(result.code, 200);
  assert.equal(result.data.summary.successful, 3);
  assert.equal(result.data.summary.failed, 3);
  assert.equal(rows.users.length, 0);
  assert.ok(result.data.results.success.every(row => !row.username && !row.temporaryPassword));
  assert.ok(result.data.results.failed.some(row => row.reason === 'Email already exists'));
});

test('staff accounts still require email and phone number', async () => {
  const user = new User({ userId: 'staff-test', staffId: 'staff-test', username: 'staff-test', role: 'admin', passwordHash: 'test' });
  await assert.rejects(user.validate(), error => Boolean(error.errors.email && error.errors.phoneNumber));
});

