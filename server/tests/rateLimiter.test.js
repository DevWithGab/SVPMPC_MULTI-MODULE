const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { loginKeyGenerator, staffActionLimiter } = require('../middleware/rateLimiter');

test('login limiter scopes attempts by account, module, and role', () => {
  const request = (body) => ({ ip: '127.0.0.1', body });
  const attendanceAdmin = loginKeyGenerator(request({
    username: 'Admin@Example.com',
    module: 'attendance',
    expectedRole: 'admin',
  }));

  assert.notEqual(attendanceAdmin, loginKeyGenerator(request({
    username: 'Admin@Example.com',
    module: 'mortuary',
    expectedRole: 'admin',
  })));
  assert.notEqual(attendanceAdmin, loginKeyGenerator(request({
    username: 'Admin@Example.com',
    module: 'attendance',
    expectedRole: 'secretary',
  })));
  assert.equal(attendanceAdmin, loginKeyGenerator(request({
    username: 'admin@example.com',
    module: 'ATTENDANCE',
    expectedRole: 'ADMIN',
  })));
});

// Regression test: staff creation and password reset were previously
// unbounded, so a compromised super_admin token (or a buggy client retry
// loop) could spam either endpoint with no limit at all. This mounts the
// real limiter on a throwaway route (not the full adminRoutes router, so
// other suites' use of the shared limiter instance can't skew the count)
// and proves it actually trips after its configured max.
test('staffActionLimiter blocks requests past its configured max', async () => {
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
