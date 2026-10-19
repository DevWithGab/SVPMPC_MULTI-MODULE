// Explicit integration run: node --test tests/integration/mongoRateLimit.integration.js
// Uses its own temporary mongod, never MONGODB_URI or the application database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { MongoClient } = require('mongoose').mongo;
const { MongoRateLimitStore, ensureRateLimitIndexes } = require('../../middleware/mongoRateLimitStore');

test('real MongoDB shares atomic counters across independent connections and reconnects', { timeout: 30000 }, async t => {
  const binary = process.env.MONGOD_TEST_BINARY || 'C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe';
  try { await fs.access(binary); } catch { t.skip('Set MONGOD_TEST_BINARY to an installed mongod executable'); return; }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'svpmpc-rate-limit-test-'));
  const socket = net.createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const child = spawn(binary, ['--bind_ip', '127.0.0.1', '--port', String(port), '--dbpath', dir, '--logpath', path.join(dir, 'mongod.log'), '--noauth'], { windowsHide: true, stdio: 'ignore' });
  const stopped = once(child, 'exit');
  const uri = `mongodb://127.0.0.1:${port}/isolated_rate_limit_test`;
  const clients = [];
  t.after(async () => {
    await Promise.all(clients.map(client => client.close()));
    child.kill();
    await stopped;
    // Only remove the uniquely generated directory immediately under TEMP.
    assert.equal(path.dirname(path.resolve(dir)).toLowerCase(), path.resolve(os.tmpdir()).toLowerCase());
    assert.ok(path.basename(dir).startsWith('svpmpc-rate-limit-test-'));
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });
  const connect = async () => {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    clients.push(client);
    await client.connect();
    return client;
  };
  const first = await connect();
  const second = await connect();
  const make = client => {
    const store = new MongoRateLimitStore({ prefix: 'integration', collection: () => client.db().collection('rate_limit_counters') });
    store.init({ windowMs: 300000 });
    return store;
  };
  const collection = first.db().collection('rate_limit_counters');
  await ensureRateLimitIndexes(collection);
  const a = make(first);
  const b = make(second);
  const key = a.key('synthetic-staff');
  const counts = await Promise.all(Array.from({ length: 60 }, (_, i) => (i % 2 ? a : b).increment(key)));
  assert.deepEqual(counts.map(row => row.totalHits).sort((x, y) => x - y), Array.from({ length: 60 }, (_, i) => i + 1));
  assert.equal(await collection.countDocuments(), 1);
  await first.close();
  const reconnected = make(await connect());
  assert.equal((await reconnected.increment(key)).totalHits, 61);
  await reconnected.decrement(key);
  assert.equal((await b.get(key)).totalHits, 60);
  const index = (await second.db().collection('rate_limit_counters').listIndexes().toArray()).find(row => row.name === 'rate_limit_expiry');
  assert.equal(index.expireAfterSeconds, 0);
  await reconnected.resetKey(key);
  assert.equal(await b.get(key), undefined);
});
