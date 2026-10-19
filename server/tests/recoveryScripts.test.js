const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const bcrypt = require('bcryptjs');

function load(path, dependencies, options = {}) {
  const filename = require.resolve(path), localRequire = createRequire(filename);
  const output = [], state = { connections: 0, disconnects: 0 };
  const mongoose = { connect: async () => { state.connections++; }, disconnect: async () => { state.disconnects++; } };
  const process = { env: options.uri === false ? {} : { MONGODB_URI: 'synthetic-test-database' },
    stdin: { isTTY: options.tty !== false }, stdout: { isTTY: options.tty !== false } };
  const deps = { mongoose, dotenv: { config() {} }, ...dependencies };
  const context = { module: { exports: {} }, process,
    console: { log: (...args) => output.push(args.join(' ')), table: value => output.push(JSON.stringify(value)) },
    require: name => Object.hasOwn(deps, name) ? deps[name] : localRequire(name) };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return { ...context.module.exports, state, output };
}

function recovery(options = {}) {
  const user = { userId: 'super-id', username: 'superadmin', role: 'super_admin', status: 'active',
    modules: ['attendance', 'mortuary'], passwordHash: 'old-hash', sessionVersion: 5, isTemporaryPassword: false };
  const updates = [];
  const script = load('../scripts/resetSuperAdminPassword', {
    '../shared/models/User': { async findOneAndUpdate(query, update, config) {
      assert.equal(query.username, 'superadmin');
      assert.equal(query.role, 'super_admin');
      assert.equal(config.runValidators, true);
      assert.equal(config.new, true);
      if (options.fail) throw new Error('Synthetic database failure');
      if (options.missing) return null;
      updates.push(update);
      Object.assign(user, update.$set);
      user.sessionVersion += update.$inc.sessionVersion;
      return user;
    } },
  }, options);
  return { ...script, user, updates };
}

test('Super Admin recovery hashes a random temporary password and invalidates previous sessions', async () => {
  const script = recovery();
  assert.equal(script.state.connections, 0, 'import must not connect');
  const credentials = await script.resetPassword();
  assert.match(credentials.password, /^[A-Za-z0-9_-]{24}$/);
  assert.equal(await bcrypt.compare(credentials.password, script.user.passwordHash), true);
  assert.notEqual(script.user.passwordHash, credentials.password);
  assert.equal(script.user.sessionVersion, 6);
  assert.equal(script.user.isTemporaryPassword, true);
  assert.equal(script.user.status, 'active');
  assert.deepEqual(script.user.modules, ['attendance', 'mortuary']);
  assert.ok(script.user.lastPasswordChangeDate);
  assert.deepEqual(script.output, [], 'core reset must not log credentials');

  const auth = load('../middleware/auth', {
    '../shared/models/User': { findOne: () => ({ select: async () => script.user }) },
    jsonwebtoken: { verify: () => ({ userId: 'super-id', sessionVersion: 5 }) },
  });
  const rejected = { status(code) { this.code = code; return this; }, json() {} };
  let passed = false;
  await auth.authenticateToken({ headers: { authorization: 'Bearer old-session' } }, rejected, () => { passed = true; });
  assert.equal(passed, false);
  assert.equal(rejected.code, 401);
});

test('concurrent recoveries produce different passwords and each increments the session version', async () => {
  const script = recovery();
  const results = await Promise.all([script.resetPassword(), script.resetPassword()]);
  assert.notEqual(results[0].password, results[1].password);
  assert.equal(script.user.sessionVersion, 7);
  assert.equal(script.updates.length, 2);
  assert.equal(script.updates.filter(update => update.$inc.sessionVersion === 1).length, 2);
  const matches = await Promise.all(results.map(result => bcrypt.compare(result.password, script.user.passwordHash)));
  assert.equal(matches.filter(Boolean).length, 1);
});

test('recovery requires an explicit database and private terminal before connecting', async () => {
  for (const options of [{ uri: false }, { tty: false }]) {
    const script = recovery(options);
    await assert.rejects(script.run());
    assert.equal(script.state.connections, 0);
    assert.equal(script.updates.length, 0);
    assert.deepEqual(script.output, []);
  }
});

test('CLI reveals new credentials once only after successful recovery and closes the connection', async () => {
  const script = recovery();
  await script.run();
  const passwordLines = script.output.filter(line => line.startsWith('Temporary password (shown once): '));
  assert.equal(passwordLines.length, 1);
  const password = passwordLines[0].split(': ')[1];
  assert.equal(await bcrypt.compare(password, script.user.passwordHash), true);
  assert.equal(script.state.connections, 1);
  assert.equal(script.state.disconnects, 1);
  for (const options of [{ fail: true }, { missing: true }]) {
    const failed = recovery(options);
    await assert.rejects(failed.run());
    assert.deepEqual(failed.output, []);
    assert.equal(failed.state.disconnects, 1);
  }
});

test('login diagnostics and account listing are read-only and exclude secrets even if queries return them', async () => {
  const user = { username: 'superadmin', role: 'super_admin', status: 'active', modules: ['attendance', 'mortuary'],
    isTemporaryPassword: false, passwordHash: 'synthetic-secret-hash', email: 'private@example.com',
    comparePassword() { throw new Error('Diagnostic must not compare passwords'); },
    save() { throw new Error('Diagnostic must never save'); } };
  const readOnly = load('../scripts/testLogin', {
    '../shared/models/User': { findOne(query) {
      assert.equal(query.role, 'super_admin');
      return { select: () => user };
    } },
  });
  const listing = load('../scripts/showCredentials', {
    '../shared/models': { User: { find: () => ({ select: () => ({ sort: async () => [user] }) }) } },
  });
  assert.equal(readOnly.state.connections, 0);
  assert.equal(listing.state.connections, 0);
  assert.deepEqual(Object.keys(await readOnly.checkSuperAdminAccount()).sort(), ['isTemporaryPassword', 'role', 'status', 'username']);
  await readOnly.run();
  await listing.run();
  for (const output of [readOnly.output, listing.output]) {
    const text = output.join('\n');
    assert.ok(!text.includes(user.passwordHash));
    assert.ok(!text.includes(user.email));
  }
  assert.equal(readOnly.state.disconnects, 1);
  assert.equal(listing.state.disconnects, 1);
});
