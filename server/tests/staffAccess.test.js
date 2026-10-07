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
const response = () => ({ set() { return this; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
const middleware = require('../middleware/auth');

test('module access requires both a compatible role and an assignment; superadmin accesses both', () => {
  for (const role of ['super_admin', 'admin', 'secretary', 'treasurer', 'scanner_operator']) {
    for (const module of ['attendance', 'mortuary']) {
      for (const assigned of [false, true]) {
        let passed = false;
        const compatible = role === 'admin' || (module === 'attendance' ? ['secretary', 'scanner_operator'].includes(role) : role === 'treasurer');
        middleware.authorizeModule(module)({ user: { role, modules: assigned ? [module] : [] } }, response(), () => { passed = true; });
        assert.equal(passed, role === 'super_admin' || assigned && compatible, `${role}/${module}/${assigned}`);
      }
    }
  }
});

test('existing sessions are rejected after deactivation, suspension, password reset, or access changes', async () => {
  for (const [status, version, expected] of [['active', 0, true], ['inactive', 0, false], ['suspended', 0, false], ['active', 1, false]]) {
    const auth = load('../middleware/auth', {
      '../shared/models/User': { findOne: () => ({ select: async () => ({ role: 'admin', status, sessionVersion: version }) }) },
      jsonwebtoken: { verify: () => ({ userId: 'staff', sessionVersion: 0 }) },
    });
    let passed = false;
    await auth.authenticateToken({ headers: { authorization: 'Bearer old-token' } }, response(), () => { passed = true; });
    assert.equal(passed, expected);
  }
});

test('temporary-password sessions cannot use protected module operations', () => {
  let passed = false;
  const res = response();
  middleware.requirePasswordChange({ user: { isTemporaryPassword: true } }, res, () => { passed = true; });
  assert.equal(passed, false);
  assert.equal(res.data.code, 'PASSWORD_CHANGE_REQUIRED');
  middleware.requirePasswordChange({ user: { isTemporaryPassword: false } }, response(), () => { passed = true; });
  assert.equal(passed, true);
});

test('staff creation and reset return credentials once, exclude secrets from listings/audits, and revoke sessions', async () => {
  const users = [], logs = [];
  class User {
    constructor(data) { Object.assign(this, data); }
    async save() { if (!users.includes(this)) users.push(this); }
    static async exists() { return false; }
    static async findOne(query) { return users.find(user => user.userId === query.userId && query.role.$in.includes(user.role)); }
    static find() { return { select: () => ({ sort: async () => users }) }; }
  }
  const staff = load('../shared/controllers/staffController', { '../models/User': User, '../models/AuditLog': { create: async log => logs.push(log) } });
  const actor = { userId: 'super', username: 'superadmin', role: 'super_admin' };
  const req = { user: actor, body: { fullName: 'Staff Example', username: 'maria.santos', email: 'STAFF@example.com', phoneNumber: '09123456789', role: 'secretary', modules: ['attendance'] } };
  const created = response(); await staff.create(req, created);
  assert.equal(created.code, 201);
  assert.equal(created.data.user.username, 'maria.santos');
  assert.ok(created.data.credentials.password.length >= 24);
  assert.equal(users[0].isTemporaryPassword, true);
  assert.equal(created.data.user.passwordHash, undefined);
  const listed = response(); await staff.list({}, listed);
  assert.equal(listed.data.users[0].passwordHash, undefined);
  assert.equal(listed.data.users[0].userId, created.data.user.userId);
  assert.equal(listed.data.credentials, undefined);
  const oldPassword = created.data.credentials.password;
  const reset = response(); await staff.resetPassword({ user: actor, params: { userId: users[0].userId } }, reset);
  assert.notEqual(reset.data.credentials.password, oldPassword);
  assert.equal(users[0].sessionVersion, 1);
  assert.equal(logs.length, 2);
  assert.ok(!JSON.stringify(logs).includes(oldPassword));
  assert.ok(!JSON.stringify(logs).includes(reset.data.credentials.password));
  const updated = response();
  await staff.update({ user: actor, params: { userId: users[0].userId }, body: { role: 'admin', modules: ['mortuary'], status: 'inactive' } }, updated);
  assert.equal(users[0].sessionVersion, 2);
  assert.equal(users[0].status, 'inactive');
  assert.equal(logs[2].changes.before.role, 'secretary');
  assert.equal(logs[2].changes.after.role, 'admin');
  const invalid = response(); await staff.create({ ...req, body: { ...req.body, role: 'super_admin' } }, invalid);
  assert.equal(invalid.code, 400);
  const crossModule = response(); await staff.create({ ...req, body: { ...req.body, modules: ['mortuary'] } }, crossModule);
  assert.equal(crossModule.code, 400);
  assert.equal(users.length, 1);
});

test('HTTP staff routes deny non-superadmins for listing, creation, editing, and reset', async () => {
  const routes = require('../shared/routes/adminRoutes');
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { role: req.headers['x-test-role'], isTemporaryPassword: false }; next(); });
  app.use('/admin', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const role of ['admin', 'secretary', 'treasurer', 'scanner_operator']) {
      for (const [method, path] of [['GET', '/staff'], ['POST', '/staff'], ['PUT', '/staff/test'], ['DELETE', '/staff/test'], ['POST', '/staff/test/reset-password']]) {
        const result = await fetch(base + '/admin' + path, { method, headers: { 'x-test-role': role } });
        assert.equal(result.status, 403, `${role} ${method} ${path}`);
      }
    }
    const result = await fetch(base + '/admin/staff', { method: 'POST', headers: { 'x-test-role': 'super_admin', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(result.status, 400); // Authorized, then rejected by input validation.
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('password change checks current password and clears the first-login requirement', async () => {
  const user = { userId: 'staff', role: 'secretary', isTemporaryPassword: true, comparePassword: async value => value === 'temporary-password', save: async () => {} };
  const controller = load('../shared/controllers/authController', {
    '../models/User': { findOne: async () => user },
    '../models/CredentialLog': class { async save() {} },
  });
  const short = response(); await controller.changePassword({ params: { userId: 'staff' }, body: { currentPassword: 'temporary-password', newPassword: 'short' } }, short);
  assert.equal(short.code, 400);
  const result = response(); await controller.changePassword({ params: { userId: 'staff' }, body: { currentPassword: 'temporary-password', newPassword: 'a-new-long-password' } }, result);
  assert.equal(result.code, 200);
  assert.equal(user.isTemporaryPassword, false);
  assert.equal(user.passwordHash, 'a-new-long-password');
});

test('audit routes deny cross-module requests and scope unfiltered requests to assigned modules', async () => {
  const showScope = (req, res) => res.json({ scope: req.auditModule });
  const router = load('../shared/routes/auditLogRoutes', {
    '../../middleware': { authenticateToken: (req, res, next) => { req.user = { role: req.headers['x-role'] || 'admin', modules: ['attendance'] }; next(); } },
    '../../shared/controllers/auditLogController': Object.fromEntries(['getAllAuditLogs', 'getAuditTrail', 'getAuditLogStats', 'getUserActivity', 'getRoleActivity'].map(name => [name, showScope])),
  });
  const app = express(); app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of ['/logs', '/trail/staff/example', '/stats', '/user/example', '/role/admin']) {
      const denied = await fetch(base + path + '?module=mortuary');
      assert.equal(denied.status, 403);
      const scoped = await fetch(base + path);
      assert.deepEqual((await scoped.json()).scope, ['attendance']);
      const superadmin = await fetch(base + path + '?module=admin', { headers: { 'x-role': 'super_admin' } });
      assert.equal(superadmin.status, 200);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('both admin routers permit superadmin and reject secretary, treasurer, and scanner roles before controllers', async () => {
  for (const module of ['attendance', 'mortuary']) {
    const filename = `../modules/${module}/routes/adminRoutes`;
    const localRequire = createRequire(require.resolve(filename));
    const auth = { ...localRequire('../../../middleware'), authenticateToken: (req, res, next) => next() };
    const router = load(filename, { '../../../middleware': auth });
    // Evaluate the router-level guards without invoking database-backed controllers.
    const guards = router.stack.filter(layer => !layer.route).map(layer => layer.handle);
    for (const role of ['super_admin', 'admin', 'secretary', 'treasurer', 'scanner_operator']) {
      let passed = true;
      for (const guard of guards) {
        let next = false;
        guard({ user: { role } }, response(), () => { next = true; });
        if (!next) { passed = false; break; }
      }
      assert.equal(passed, ['super_admin', 'admin'].includes(role), `${module}/${role}`);
    }
  }
});

test('staff username validation rejects invalid and duplicate names and supports renaming existing accounts', async () => {
  const user = { userId: 'staff', role: 'secretary', username: 'staff-old-random', fullName: 'Old Name', modules: ['attendance'], save: async () => {} };
  const staff = load('../shared/controllers/staffController', {
    '../models/User': { exists: async query => query.username && new RegExp(query.username.$regex, 'i').test('existing.user'), findOne: async () => user },
    '../models/AuditLog': { create: async () => {} },
  });
  const body = { fullName: 'Maria Santos', email: 'maria@example.com', phoneNumber: '09123456789', role: 'secretary', modules: ['attendance'], status: 'active' };
  for (const username of ['', 'a', 'has spaces', 'name@email.com', 'a'.repeat(33)]) {
    const result = response(); await staff.create({ body: { ...body, username } }, result);
    assert.equal(result.code, 400);
  }
  const duplicate = response(); await staff.create({ body: { ...body, username: ' Existing.User ' } }, duplicate);
  assert.equal(duplicate.code, 409);
  const result = response();
  await staff.update({ user: { role: 'super_admin' }, params: { userId: 'staff' }, body: { ...body, username: ' Maria.Santos ' } }, result);
  assert.equal(result.data.user.username, 'maria.santos');
  assert.equal(result.data.user.fullName, 'Maria Santos');
  assert.equal(user.sessionVersion, 1);
});

test('staff deletion removes the account, keeps an audit record, and cannot target superadmins or self', async () => {
  const users = [{ userId: 'staff', username: 'maria.santos', role: 'secretary' }, { userId: 'super', role: 'super_admin' }];
  const logs = [];
  const staff = load('../shared/controllers/staffController', {
    '../models/User': { findOneAndDelete: async query => {
      const index = users.findIndex(user => user.userId === query.userId && query.role.$in.includes(user.role));
      return index < 0 ? null : users.splice(index, 1)[0];
    } },
    '../models/AuditLog': { create: async log => logs.push(log) },
  });
  const actor = { userId: 'super', role: 'super_admin' };
  const deleted = response(); await staff.remove({ user: actor, params: { userId: 'staff' } }, deleted);
  assert.equal(deleted.data.userId, 'staff');
  assert.equal(users.length, 1);
  assert.equal(logs[0].action, 'staff_deleted');
  assert.equal(logs[0].changes.before.username, 'maria.santos');
  assert.equal(logs[0].changes.after, null);
  const self = response(); await staff.remove({ user: actor, params: { userId: 'super' } }, self);
  assert.equal(self.code, 403);
  const superadmin = response(); await staff.remove({ user: { userId: 'other-super' }, params: { userId: 'super' } }, superadmin);
  assert.equal(superadmin.code, 404);
  const missing = response(); await staff.remove({ user: actor, params: { userId: 'staff' } }, missing);
  assert.equal(missing.code, 404);
});
