const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const auth = require('../middleware/auth');
function load(path, dependencies = {}) {
  const filename = require.resolve(path), localRequire = createRequire(filename);
  const context = { module: { exports: {} }, process, console, Buffer,
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : localRequire(name) };
  context.exports = context.module.exports;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
const roles = ['claims_officer', 'finance_officer', 'admin', 'treasurer', 'super_admin', 'secretary', 'scanner_operator'];
test('shared Mortuary login accepts assigned officers and legacy staff, and rejects incompatible or unassigned accounts', async () => {
  for (const role of roles) for (const assigned of [true, false]) {
    const user = { userId: 'staff', username: 'staff', role, modules: assigned ? ['mortuary'] : [], status: 'active', comparePassword: async () => true, save: async () => {} };
    const controller = load('../shared/controllers/authController', { '../models/User': { findOne: async () => user }, jsonwebtoken: { sign: () => 'test-token' } });
    const res = response();
    await controller.login({ body: { username: 'staff', password: 'example-password', module: 'mortuary' } }, res);
    const permitted = role === 'super_admin' || assigned && ['claims_officer', 'finance_officer', 'admin', 'treasurer'].includes(role);
    assert.equal(res.code, permitted ? 200 : 403, `${role}/${assigned}`);
    if (permitted) assert.equal(res.data.user.role, role);
  }
});

test('Mortuary route permissions separate claims, finance, and Super Admin operations', () => {
  const middleware = { ...require('../middleware'), authenticateToken: (req, res, next) => next(), bulkUploadLimiter: (req, res, next) => next() };
  const admin = load('../modules/mortuary/routes/adminRoutes', { '../../../middleware': middleware });
  const finance = load('../modules/mortuary/routes/treasurerRoutes', { '../../../middleware': middleware });
  const legacy = load('../modules/mortuary/routes/mortuaryRoutes');
  const claims = ['claims_officer', 'admin', 'super_admin'];
  const finances = ['finance_officer', 'treasurer', 'super_admin'];
  for (const [router, method, path, allowed] of [
    [admin, 'get', '/dashboard', claims], [admin, 'get', '/fund-overview', claims],
    [admin, 'get', '/members', claims], [admin, 'post', '/claims', claims],
    [admin, 'put', '/claims/:claimId/approve', claims], [admin, 'put', '/beneficiaries/:memberId', claims],
    [admin, 'post', '/members/create', ['super_admin']],
    [admin, 'get', '/backup/export', ['super_admin']], [admin, 'post', '/backup/restore', ['super_admin']],
    [finance, 'get', '/dashboard', finances], [finance, 'post', '/ledger/bulk-upload', finances],
    [finance, 'get', '/ledger/daily-summary', finances],
    [finance, 'post', '/ledger/:memberId/entries/:ledgerId/correct', finances],
    [finance, 'post', '/claims/deduction-batch', finances],
    [legacy, 'post', '/contributions/record', finances],
  ]) {
    const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]);
    assert.ok(route, path);
    const guards = [...router.stack.filter(layer => !layer.route && layer.name !== 'router').map(layer => layer.handle), ...route.route.stack.slice(0, -1).map(layer => layer.handle)];
    for (const role of roles) {
      let passed = true;
      for (const guard of guards) {
        let called = false;
        guard({ user: { role, modules: ['mortuary'] } }, response(), () => { called = true; });
        if (!called) { passed = false; break; }
      }
      assert.equal(passed, allowed.includes(role), `${role} ${method} ${path}`);
    }
  }
});

test('Mortuary audit logs are Super Admin only, including legacy admins assigned both systems', () => {
  const router = load('../shared/routes/auditLogRoutes', { '../../middleware': { ...auth, authenticateToken: (req, res, next) => next() } });
  for (const role of roles) for (const query of [{ module: 'mortuary' }, {}]) {
    const req = { user: { role, modules: ['attendance', 'mortuary'] }, query };
    let passed = true;
    for (const layer of router.stack.filter(layer => !layer.route)) {
      let next = false; layer.handle(req, response(), () => { next = true; });
      if (!next) { passed = false; break; }
    }
    assert.equal(passed, role === 'super_admin' || !query.module && ['admin', 'secretary'].includes(role));
    if (passed && role !== 'super_admin') assert.deepEqual(Array.from(req.auditModule), ['attendance']);
  }
});

test('new officer accounts and audit records validate, while new legacy assignments are rejected', async () => {
  const { validateAccess } = require('../shared/controllers/staffController');
  const User = require('../shared/models/User'), AuditLog = require('../shared/models/AuditLog');
  for (const role of ['claims_officer', 'finance_officer']) {
    assert.equal(validateAccess(role, ['mortuary']), true);
    assert.equal(validateAccess(role, ['attendance']), false);
    await new User({ userId: 'test', staffId: 'test', username: 'test', passwordHash: 'password', role, modules: ['mortuary'] }).validate();
    await new AuditLog({ logId: 'test', userRole: role, module: 'mortuary', entityType: 'claim', action: 'claim_created', description: 'test' }).validate();
  }
  assert.equal(validateAccess('admin', ['mortuary']), false);
  assert.equal(validateAccess('treasurer', ['mortuary']), false);
});
