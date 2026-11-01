const test = require('node:test');
const assert = require('node:assert/strict');
const { createLedgerPostingService } = require('../modules/mortuary/services/ledgerPostingService');

function database() {
  const rows = [];
  const failures = new Set();
  const afterCommitFailures = new Set();
  const beforeCommit = new Map();
  let conflicts = 0;
  class Ledger {
    constructor(data) { Object.assign(this, data); }
    static findOne(query) {
      const found = rows.filter(row => Object.entries(query).every(([key, value]) => row[key] === value));
      return {
        then: (resolve, reject) => Promise.resolve(found[0] || null).then(resolve, reject),
        sort: async () => [...found].sort((a, b) => b.createdAt - a.createdAt)[0] || null,
      };
    }
    async save() {
      await new Promise(resolve => setImmediate(resolve));
      if (beforeCommit.has(this.ledgerId)) await beforeCommit.get(this.ledgerId)();
      if (failures.delete(this.ledgerId)) throw new Error('Synthetic storage failure');
      // Check and insert without an await in between, matching unique-index
      // enforcement inside MongoDB rather than a client-side existence check.
      if (rows.some(row => row.ledgerId === this.ledgerId)) throw Object.assign(new Error('Duplicate ID'), { code: 11000, keyPattern: { ledgerId: 1 } });
      if (rows.some(row => row.memberId === this.memberId && row.postingParent === this.postingParent)) {
        conflicts++;
        throw Object.assign(new Error('Duplicate parent'), { code: 11000, keyPattern: { memberId: 1, postingParent: 1 } });
      }
      rows.push({ ...this });
      if (afterCommitFailures.delete(this.ledgerId)) throw new Error('Lost write acknowledgement');
      return this;
    }
  }
  const client = () => createLedgerPostingService({ Ledger, wait: async () => {} });
  return { rows, failures, afterCommitFailures, beforeCommit, client, conflicts: () => conflicts };
}
const entry = (id, credit = 0, debit = 0, memberId = 'MEMBER') => ({
  ledgerId: id, memberId, transactionType: 'adjustment', description: 'Test posting', credit, debit,
});

test('independent writers retry competing parents and preserve every intermediate running balance', async () => {
  const db = database();
  await db.client().postLedgerEntry(entry('OPEN', 1000));
  const clients = Array.from({ length: 4 }, db.client);
  await Promise.all(Array.from({ length: 32 }, (_, i) => clients[i % 4].postLedgerEntry(entry(`TX-${i}`, i % 2 ? 0 : 10, i % 2 ? 3 : 0))));
  let expected = 0;
  for (const row of db.rows) {
    expected += row.credit - row.debit;
    assert.equal(row.balance, expected);
  }
  assert.equal(expected, 1112);
  assert.equal(new Set(db.rows.map(row => row.postingParent)).size, db.rows.length);
  assert.ok(db.conflicts() > 0, 'the test must exercise conflicting heads');
  assert.ok(db.rows.every((row, index) => !index || row.createdAt > db.rows[index - 1].createdAt));
});

test('concurrent retries insert the same posting once and reject different amounts for its ID', async () => {
  const db = database();
  const results = await Promise.all(Array.from({ length: 12 }, () => db.client().postLedgerEntry(entry('SAME-ID', 25))));
  assert.equal(db.rows.length, 1);
  assert.equal(results.filter(result => result.created).length, 1);
  assert.equal(db.rows[0].balance, 25);
  await assert.rejects(db.client().postLedgerEntry(entry('SAME-ID', 100)), { status: 409 });
});

test('a failed insert does not reserve a parent or change a member balance', async () => {
  const db = database();
  await db.client().postLedgerEntry(entry('OPEN', 100));
  db.failures.add('FAIL');
  await assert.rejects(db.client().postLedgerEntry(entry('FAIL', 50)), /storage failure/);
  await db.client().postLedgerEntry(entry('NEXT', 5));
  assert.equal(db.rows.length, 2);
  assert.equal(db.rows[1].balance, 105);
});

test('corrections with a stale expected balance fail without a financial write', async () => {
  const db = database();
  await db.client().postLedgerEntry(entry('OPEN', 100));
  await db.client().postLedgerEntry(entry('PAYMENT', 10));
  await assert.rejects(db.client().postLedgerEntry(entry('CORRECTION', 90, 100), { expectedBalance: 100 }), { status: 409 });
  assert.equal(db.rows.length, 2);
  assert.equal(db.rows.at(-1).balance, 110);
});

test('separate members have independent root postings', async () => {
  const db = database();
  await Promise.all(['A', 'B'].map(id => db.client().postLedgerEntry(entry(id, 10, 0, id))));
  assert.equal(db.rows.length, 2);
  assert.ok(db.rows.every(row => row.postingParent === 'root' && row.balance === 10));
});

test('a correction losing a head race rechecks its expected balance before retrying', async () => {
  const db = database();
  await db.client().postLedgerEntry(entry('OPEN', 100));
  let release, reached;
  const gate = new Promise(resolve => { release = resolve; });
  const waiting = new Promise(resolve => { reached = resolve; });
  db.beforeCommit.set('CORRECTION', async () => { reached(); await gate; });
  const correction = assert.rejects(db.client().postLedgerEntry(entry('CORRECTION', 90, 100), { expectedBalance: 100 }), { status: 409 });
  await waiting;
  await db.client().postLedgerEntry(entry('PAYMENT', 10));
  release();
  await correction;
  assert.equal(db.rows.length, 2);
  assert.equal(db.rows.at(-1).balance, 110);
  assert.equal(db.conflicts(), 1);
});

test('lost acknowledgements do not block later postings or double-apply a retry', async () => {
  const db = database();
  db.afterCommitFailures.add('FIRST');
  await assert.rejects(db.client().postLedgerEntry(entry('FIRST', 100)), /Lost write/);
  await db.client().postLedgerEntry(entry('NEXT', 10));
  const replay = await db.client().postLedgerEntry(entry('FIRST', 100));
  assert.equal(replay.created, false);
  assert.equal(db.rows.length, 2);
  assert.equal(db.rows.at(-1).balance, 110);
});

test('new postings stay after a legacy head even when its clock was ahead', async () => {
  const db = database();
  db.rows.push({ ...entry('LEGACY', 100), balance: 100, createdAt: new Date('2100-01-01') });
  const result = await db.client().postLedgerEntry(entry('NEXT', 10));
  assert.equal(result.ledger.balance, 110);
  assert.ok(result.ledger.createdAt > db.rows[0].createdAt);
  assert.equal(result.ledger.postingParent, 'ledger:LEGACY');
});

test('an invalid stored balance fails closed instead of becoming a zero opening balance', async () => {
  const db = database();
  db.rows.push({ ...entry('INVALID'), balance: NaN, createdAt: new Date() });
  await assert.rejects(db.client().postLedgerEntry(entry('NEXT', 10)), { status: 503 });
  assert.equal(db.rows.length, 1);
});
