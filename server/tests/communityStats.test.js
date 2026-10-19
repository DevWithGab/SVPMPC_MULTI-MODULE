const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { dirname } = require('node:path');
const express = require('express');

function load(path, dependencies, globals = {}) {
  const filename = require.resolve(path);
  const localRequire = createRequire(filename);
  const context = { module: { exports: {} }, __dirname: dirname(filename), console, process, Buffer, ...globals,
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : localRequire(name) };
  context.exports = context.module.exports;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}
const response = () => ({ headers: {}, set(key, value) { this.headers[key] = value; return this; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });

function harness() {
  let now = 0;
  let total = 1234;
  let calls = 0;
  let fail = false;
  const controller = load('../shared/controllers/communityController', {
    '../models/Member': { countDocuments(filter) {
      assert.equal(JSON.stringify(filter), '{}', 'count all shared registered members without caller filters');
      calls++;
      return { hint(index) {
        assert.equal(index, '_id_');
        return { async maxTimeMS(timeout) {
          assert.equal(timeout, 3000);
          if (fail) throw new Error('private database detail');
          return total;
        } };
      } };
    } },
  }, { Date: { now: () => now } });
  return { controller, calls: () => calls, advance: () => { now += 60001; }, setTotal: value => { total = value; }, fail: () => { fail = true; } };
}

test('community count coalesces requests, caches briefly, and refreshes actual totals including zero', async () => {
  const h = harness();
  const a = response(), b = response();
  await Promise.all([h.controller.getCommunityStats({ query: { status: 'active' } }, a), h.controller.getCommunityStats({}, b)]);
  assert.equal(h.calls(), 1);
  assert.equal(JSON.stringify(a.data), '{"totalMembers":1234}');
  assert.equal(JSON.stringify(b.data), '{"totalMembers":1234}');
  assert.equal(a.headers['Cache-Control'], 'public, max-age=60');
  h.setTotal(0);
  h.advance();
  const refreshed = response();
  await h.controller.getCommunityStats({}, refreshed);
  assert.equal(refreshed.data.totalMembers, 0);
  assert.equal(h.calls(), 2);
});

test('count failure returns a generic uncacheable error without a fabricated total or database details', async () => {
  const h = harness();
  h.fail();
  const res = response();
  await h.controller.getCommunityStats({}, res);
  assert.equal(res.code, 503);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.data.totalMembers, undefined);
  assert.ok(!JSON.stringify(res.data).includes('private'));
});

test('public community route returns only an aggregate count without requiring a staff token', async () => {
  const { controller } = harness();
  const routes = load('../shared/routes/authRoutes', { '../controllers/communityController': controller });
  const app = express();
  app.use('/api/auth', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/community-stats`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { totalMembers: 1234 });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
