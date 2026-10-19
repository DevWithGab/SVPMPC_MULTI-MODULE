const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { MongoRateLimitStore, ensureRateLimitIndexes } = require('../middleware/mongoRateLimitStore');
const { createRateLimitCollection } = require('./fixtures/rateLimitCollection');

function setup() {
  const collection = createRateLimitCollection();
  let time = 120000;
  const make = (prefix = 'login') => {
    const store = new MongoRateLimitStore({ prefix, collection: () => collection, now: () => time });
    store.init({ windowMs: 60000 });
    return store;
  };
  return { collection, make, setTime: value => { time = value; } };
}

test('new store instances reuse persisted counts and concurrent increments share one bucket', async () => {
  const { make, collection } = setup();
  const first = make();
  const key = first.key('staff@example.com');
  await first.increment(key);
  const restarted = make();
  assert.equal((await restarted.increment(restarted.key('staff@example.com'))).totalHits, 2);
  const counts = await Promise.all(Array.from({ length: 40 }, (_, i) => (i % 2 ? first : restarted).increment(key)));
  assert.deepEqual(counts.map(row => row.totalHits).sort((a, b) => a - b), Array.from({ length: 40 }, (_, i) => i + 3));
  assert.equal(collection.rows.size, 1);
  assert.ok(![...collection.rows.keys()][0].includes('staff@example.com'));
});

test('limiter namespaces remain independent and expiration does not depend on TTL deletion', async () => {
  const { make, setTime, collection } = setup();
  const account = make('login-account');
  const ip = make('login-ip');
  const key = account.key('same-identifier');
  assert.equal((await account.increment(key)).totalHits, 1);
  assert.equal((await ip.increment(ip.key('same-identifier'))).totalHits, 1);
  setTime(180001);
  assert.equal(await account.get(key), undefined);
  assert.equal((await account.increment(account.key('same-identifier'))).totalHits, 1);
  assert.equal(collection.rows.size, 3, 'expired rows may still exist until the TTL cleaner runs');
});

test('late successful requests cannot decrement the next window; decrements never go negative', async () => {
  const { make, setTime } = setup();
  const store = make();
  const oldKey = store.key('staff');
  await store.increment(oldKey);
  setTime(180001);
  const newKey = store.key('staff');
  await store.increment(newKey);
  await store.decrement(oldKey);
  assert.equal((await store.get(newKey)).totalHits, 1);
  await store.decrement(newKey);
  await store.decrement(newKey);
  assert.equal((await store.get(newKey)).totalHits, 0);
  await store.resetKey(newKey);
  assert.equal(await store.get(newKey), undefined);
});

test('concurrent upsert duplicate retries without upserting again; other errors fail closed', async () => {
  let calls = 0;
  const store = new MongoRateLimitStore({ prefix: 'login', collection: () => ({
    async findOneAndUpdate(filter, update, options) {
      if (++calls === 1) { const error = new Error('duplicate'); error.code = 11000; throw error; }
      assert.equal(options.upsert, undefined);
      return { totalHits: 2, expiresAt: update.$setOnInsert.expiresAt };
    },
  }) });
  store.init({ windowMs: 60000 });
  assert.equal((await store.increment(store.key('staff'))).totalHits, 2);
  const unavailable = new MongoRateLimitStore({ prefix: 'login', collection: () => { throw new Error('private database detail'); } });
  unavailable.init({ windowMs: 60000 });
  await assert.rejects(unavailable.increment(unavailable.key('staff')), error => error.statusCode === 503 && error.isOperational && !error.message.includes('private'));
});

test('TTL index setup is awaited and reports initialization failure', async () => {
  let complete = false;
  await ensureRateLimitIndexes({ async createIndex(keys, options) {
    assert.deepEqual(keys, { expiresAt: 1 });
    assert.equal(options.expireAfterSeconds, 0);
    await Promise.resolve();
    complete = true;
  } });
  assert.equal(complete, true);
  await assert.rejects(ensureRateLimitIndexes({ createIndex: async () => { throw new Error('index denied'); } }), /index denied/);
});

test('HTTP middleware shares limits across two instances and blocks requests when storage fails', async () => {
  const { collection } = setup();
  let unavailable = false;
  let handled = 0;
  const limiter = () => {
    const store = new MongoRateLimitStore({ prefix: 'http', collection: () => {
      if (unavailable) throw new Error('offline');
      return collection;
    } });
    return rateLimit({ store, windowMs: 60000, limit: 2, keyGenerator: () => store.key('same-account'), passOnStoreError: false });
  };
  const app = express();
  const respond = (req, res) => { handled++; res.json({ ok: true }); };
  app.get('/one', limiter(), respond);
  app.get('/two', limiter(), respond);
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ message: err.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const call = async path => {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/${path}`);
      await res.text();
      return res.status;
    };
    assert.equal(await call('one'), 200);
    assert.equal(await call('two'), 200);
    assert.equal(await call('one'), 429);
    unavailable = true;
    assert.equal(await call('two'), 503);
    assert.equal(handled, 2);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
