const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const configureProxy = require('../configs/proxy');

test('proxy configuration rejects invalid hop counts', () => {
  for (const value of ['true', '-1', '1.5', '1hop', 'Infinity', '9007199254740992']) {
    assert.throws(() => configureProxy(express(), { TRUST_PROXY_HOPS: value }), /non-negative integer/);
  }
});

test('direct connections ignore forwarded IPs; one trusted proxy selects the nearest forwarded IP', async () => {
  for (const env of [{}, { TRUST_PROXY_HOPS: '1' }]) {
    const app = express();
    configureProxy(app, env);
    app.get('/', (req, res) => res.json({ ip: req.ip }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/`, {
        headers: { 'X-Forwarded-For': '203.0.113.99, 192.0.2.1' },
      });
      const { ip } = await response.json();
      if (env.TRUST_PROXY_HOPS) assert.equal(ip, '192.0.2.1');
      else assert.match(ip, /127\.0\.0\.1$/);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  }
});
