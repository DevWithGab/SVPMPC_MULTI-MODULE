const test = require('node:test');
const assert = require('node:assert/strict');
const { loginKeyGenerator } = require('../middleware/rateLimiter');

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
