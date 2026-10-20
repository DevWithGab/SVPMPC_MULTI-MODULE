const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const configureProxy = require('../configs/proxy');
const fs = require('node:fs');
const vm = require('node:vm');
const { dirname } = require('node:path');
const { createRequire } = require('node:module');
const { MongoRateLimitStore } = require('../middleware/mongoRateLimitStore');
const { createRateLimitCollection } = require('./fixtures/rateLimitCollection');

function freshLimiters(collection = createRateLimitCollection()) {
  return load('../middleware/rateLimiter', {
    './mongoRateLimitStore': { MongoRateLimitStore: class extends MongoRateLimitStore {
      constructor(options) { super({ ...options, collection: () => collection }); }
    } },
  });
}
const { loginKeyGenerator } = freshLimiters();

test('login counter ignores module, role, IP, and username casing/whitespace', () => {
  const request = (body) => ({ ip: '127.0.0.1', body });
  const attendanceAdmin = loginKeyGenerator(request({
    username: 'Admin@Example.com',
    module: 'attendance',
    expectedRole: 'admin',
  }));

  assert.equal(attendanceAdmin, loginKeyGenerator(request({
    username: 'Admin@Example.com',
    module: 'mortuary',
    expectedRole: 'admin',
  })));
  assert.equal(attendanceAdmin, loginKeyGenerator(request({
    username: 'Admin@Example.com',
    module: 'attendance',
    expectedRole: 'secretary',
  })));
  assert.equal(attendanceAdmin, loginKeyGenerator(request({
    username: 'admin@example.com',
    module: 'ATTENDANCE',
    expectedRole: 'ADMIN',
  })));
  assert.equal(attendanceAdmin, loginKeyGenerator({ ip: '192.0.2.10', body: { username: ' Admin@Example.com ' } }));
  assert.notEqual(attendanceAdmin, loginKeyGenerator(request({ username: 'another-admin' })));
  assert.equal(loginKeyGenerator(request({ username: { $ne: null } })).length, 64);
});

function load(path, dependencies = {}) {
  const filename = require.resolve(path);
  const localRequire = createRequire(filename);
  const context = { module: { exports: {} }, __dirname: dirname(filename), process, Buffer, console,
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : localRequire(name) };
  context.exports = context.module.exports;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}

async function withLoginRoute(run) {
  // Use fresh stores for every test and the real route wiring. Only the
  // controller is mocked, so these checks never query the database.
  const limiters = freshLimiters();
  const controller = require('../shared/controllers/authController');
  const router = load('../shared/routes/authRoutes', {
    '../../middleware': { ...require('../middleware'), ...limiters },
    '../controllers/authController': { ...controller, login: (req, res) =>
      res.status(req.body.password === 'synthetic-success' ? 200 : 401).json({ synthetic: true }) },
  });
  const app = express();
  // Exercise the production configuration with one simulated trusted proxy.
  configureProxy(app, { TRUST_PROXY_HOPS: '1' });
  app.use(express.json());
  app.use('/api/auth', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const login = async (body, ip = '192.0.2.1') => {
    const result = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify(body),
    });
    await result.json();
    return result.status;
  };
  try { await run(login); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('login route blocks the same username after 10 failures even if module, role, or IP changes', async () => {
  await withLoginRoute(async login => {
    for (let i = 0; i < 10; i++) {
      assert.equal(await login({ username: 'target', module: `module-${i}`, expectedRole: `role-${i}` }), 401);
    }
    for (const body of [
      { username: 'target', module: 'mortuary', expectedRole: 'admin' },
      { username: 'target', module: 'made-up', expectedRole: 'made-up' },
      { username: ' TARGET ' },
    ]) {
      assert.equal(await login(body, '198.51.100.1'), 429);
    }
    assert.equal(await login({ username: 'different-account' }), 401);
  });
});

test('login route IP limit blocks spraying across usernames, roles, and modules', async () => {
  await withLoginRoute(async login => {
    for (let i = 0; i < 100; i++) {
      assert.equal(await login({ username: `account-${i}`, module: `module-${i}`, expectedRole: `role-${i}` }), 401);
    }
    assert.equal(await login({ username: 'another-account' }), 429);
    assert.equal(await login({ username: 'spoofed-account' }, '203.0.113.99, 192.0.2.1'), 429);
    assert.equal(await login({ username: 'another-account' }, '198.51.100.1'), 401);
  });
});

test('successful logins do not consume failed-attempt limits', async () => {
  await withLoginRoute(async login => {
    for (let i = 0; i < 12; i++) {
      assert.equal(await login({ username: 'staff', password: 'synthetic-success' }), 200);
    }
    for (let i = 0; i < 10; i++) assert.equal(await login({ username: 'staff' }), 401);
    assert.equal(await login({ username: 'staff' }), 429);
  });
});

// Regression test: staff creation and password reset were previously
// unbounded, so a compromised super_admin token (or a buggy client retry
// loop) could spam either endpoint with no limit at all. This mounts the
// real limiter on a throwaway route (not the full adminRoutes router, so
// other suites' use of the shared limiter instance can't skew the count)
// and proves it actually trips after its configured max.
test('staffActionLimiter blocks requests past its configured max', async () => {
  const { staffActionLimiter } = freshLimiters();
  const app = express();
  app.use(express.json());
  app.post('/staff', staffActionLimiter, (req, res) => res.status(200).json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const statuses = [];
    for (let i = 0; i < 25; i++) {
      const result = await fetch(base + '/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      statuses.push(result.status);
    }
    assert.ok(statuses.slice(0, 20).every(code => code === 200), `expected the first 20 requests to succeed, got ${statuses}`);
    assert.ok(statuses.slice(20).every(code => code === 429), `expected requests past the limit to be blocked, got ${statuses}`);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
