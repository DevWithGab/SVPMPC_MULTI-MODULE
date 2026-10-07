const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function load(relativePath, dependencies) {
  const filename = require.resolve(relativePath);
  const localRequire = createRequire(filename);
  const context = {
    module: { exports: {} }, process, Buffer, console: { log() {}, error() {} },
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : localRequire(name),
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}
const response = () => ({ status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });

test('legacy bulk import creates member records and results without accounts or credential logs', async () => {
  const members = [];
  const operation = { save: async () => {} };
  class Member {
    constructor(data) { Object.assign(this, data); }
    async save() { members.push(this); }
    static async findOne(query) { return members.find(row => Object.entries(query).every(([key, value]) => row[key] === value)); }
  }
  class ForbiddenAccount { constructor() { throw new Error('Member account or credential creation attempted'); } }
  const service = load('../shared/services/bulkImportService', {
    '../models': { Member, User: ForbiddenAccount, CredentialLog: ForbiddenAccount, ImportOperation: { findOne: async () => operation } },
  });
  const result = await service.processBulkImport('import-test', [
    { memberId: '001', memberName: 'First Member', barangay: 'Sample', address: 'Sample', email: '', phoneNumber: '' },
    { memberId: '002', memberName: 'Second Member', barangay: 'Sample', address: 'Sample', email: 'member@example.com', phoneNumber: '09123456789' },
  ]);
  assert.equal(result.summary.successCount, 2);
  assert.equal(members.length, 2);
  assert.equal(result.createdUsers, undefined);
  assert.equal(result.createdMembers.length, 2);
  assert.equal(operation.createdMembers.length, 2);
  assert.ok(result.createdMembers.every(member => !member.username && !member.tempPassword));
});

test('member login and password changes are blocked while staff login still issues tokens', async () => {
  for (const role of ['member', 'super_admin', 'admin', 'treasurer', 'secretary', 'scanner_operator']) {
    let tokens = 0;
    const user = { userId: 'test', role, status: 'active', modules: ['attendance', 'mortuary'], comparePassword: async () => true, save: async () => {} };
    const controller = load('../shared/controllers/authController', {
      '../models/User': { findOne: async () => user },
      jsonwebtoken: { sign() { tokens++; return 'staff-token'; }, verify: () => ({ role }) },
    });
    const login = response();
    await controller.login({ body: { username: 'test', password: 'test' } }, login);
    assert.equal(login.code, role === 'member' ? 403 : 200);
    assert.equal(tokens, role === 'member' ? 0 : 1);
    const verified = response();
    await controller.verifyToken({ headers: { authorization: 'Bearer token' } }, verified);
    assert.equal(verified.code, role === 'member' ? 403 : 200);
    if (role === 'member') {
      const changed = response();
      await controller.changePassword({ params: { userId: 'test' }, body: { currentPassword: 'test', newPassword: 'new-test' } }, changed);
      assert.equal(changed.code, 403);
    }
  }
});

test('existing member tokens cannot pass authentication; staff tokens still can', async () => {
  for (const role of ['member', 'super_admin', 'admin', 'treasurer', 'secretary', 'scanner_operator']) {
    const middleware = load('../middleware/auth', {
      '../shared/models/User': { findOne: () => ({ select: async () => ({ userId: 'test', role, status: 'active' }) }) },
      jsonwebtoken: { verify: () => ({ userId: 'test', role }) },
    });
    const result = response();
    let passed = false;
    await middleware.authenticateToken({ headers: { authorization: 'Bearer token' } }, result, () => { passed = true; });
    assert.equal(passed, role !== 'member');
    if (role === 'member') assert.equal(result.code, 403);
  }
});

test('member creation routes remain available and member password-reset route is removed', () => {
  const router = require('../shared/routes/adminRoutes');
  const paths = router.stack.filter(layer => layer.route).map(layer => layer.route.path);
  assert.ok(paths.includes('/members/create'));
  assert.ok(paths.includes('/members/bulk-create'));
  assert.ok(paths.includes('/members/:memberId/toggle-status'));
  assert.ok(!paths.includes('/members/:memberId/reset-password'));
});

test('User schema requires an explicit staff role and rejects member login accounts', async () => {
  const User = require('../shared/models/User');
  const account = { userId: 'test-user', staffId: 'STAFF-TEST', memberId: 'MEM-TEST', username: 'test-user', passwordHash: 'temporary-password', email: 'staff@example.com', phoneNumber: '09123456789' };
  await assert.rejects(new User({ ...account, role: 'member' }).validate(), error => Boolean(error.errors.role));
  await assert.rejects(new User(account).validate(), error => Boolean(error.errors.role));
  for (const role of ['admin', 'secretary', 'treasurer', 'scanner_operator', 'super_admin']) {
    await new User({ ...account, role }).validate();
    await assert.rejects(new User({ ...account, role, staffId: undefined }).validate(), error => Boolean(error.errors.staffId));
  }
});

test('Mortuary single and bulk member creation save members and ledgers without login accounts', async () => {
  const members = [], ledgers = [];
  class Member {
    constructor(data) { Object.assign(this, data); }
    async save() { members.push(this); return this; }
    static findOne() { return { sort: async () => members.at(-1) || null }; }
  }
  class Ledger {
    constructor(data) { Object.assign(this, data); }
    async save() { ledgers.push(this); }
  }
  class ForbiddenAccount { constructor() { throw new Error('Member registration must not create a User'); } }
  const controller = load('../modules/mortuary/controllers/adminController', {
    '../../../shared/models': { Member, User: ForbiddenAccount }, '../models': { Ledger },
  });
  const body = { name: 'Member Example', contact: '09123456789', barangay: 'Sample', address: 'Sample address' };
  const single = response(); await controller.createMember({ body }, single);
  assert.equal(single.data.success, true);
  const bulk = response(); await controller.bulkCreateMembers({ body: { members: [body, body] } }, bulk);
  assert.equal(bulk.data.success, true);
  assert.equal(members.length, 3);
  assert.equal(ledgers.length, 3);
  assert.ok(members.every(member => !member.username && !member.passwordHash));
});

test('Attendance CSV member creation saves only member records, without credentials', async () => {
  const members = [];
  class Member {
    constructor(data) { Object.assign(this, data); }
    async save() { members.push(this); return this; }
  }
  class ForbiddenAccount { constructor() { throw new Error('Member upload must not create a User'); } }
  const controller = load('../modules/attendance/controllers/memberController', {
    '../../../shared/models': { Member, User: ForbiddenAccount },
    '../services/csvParserService': { parseCSV: async () => [{ memberId: '001', memberName: 'Member Example', email: '', phoneNumber: '', barangay: 'Sample', address: 'Sample address' }], validateMemberData: () => ({ isValid: true }) },
    '../../../shared/services/auditLoggingService': { createAuditLog: async () => {} },
    fs: { unlinkSync() {} },
  });
  const result = response();
  await controller.uploadMembers({ file: { path: 'fake.csv', originalname: 'members.csv' }, get: () => '' }, result);
  assert.equal(result.code, 201);
  assert.equal(result.data.savedCount, 1);
  assert.equal(members.length, 1);
  assert.equal(members[0].username, undefined);
  assert.equal(members[0].passwordHash, undefined);
});
