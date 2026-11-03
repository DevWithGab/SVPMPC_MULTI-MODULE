const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { postingLedger } = require('./fixtures/postingLedger');

function harness(failure = '') {
  const members = [], ledgers = [];
  let attempts = 0;
  class Member {
    constructor(data) { Object.assign(this, data); }
    async save() { members.push(this); }
    static async findOne(query) { return members.find(row => Object.entries(query).every(([key, value]) => row[key] === value)) || null; }
  }
  class Ledger {
    constructor(data) { Object.assign(this, data); }
    async save() {
      attempts++;
      if (failure === 'persistent') throw new Error('Ledger unavailable');
      if (failure === 'transient' && attempts === 1) throw new Error('Temporary failure');
      ledgers.push(this);
      if (failure === 'acknowledgement' && attempts === 1) throw new Error('Lost acknowledgement');
    }
  }
  postingLedger(Ledger, ledgers);
  const filename = require.resolve('../shared/controllers/adminController');
  const localRequire = createRequire(filename);
  const dependencies = { '../models': { Member }, '../../modules/mortuary/models/Ledger': Ledger };
  const context = { module: { exports: {} }, console: { error() {} }, process,
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : localRequire(name) };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return { members, ledgers, async upload(rows) {
    const res = { status() { return this; }, json(data) { this.data = data; return this; } };
    await context.module.exports.bulkCreateMembers({ body: { members: rows }, user: { userId: 'SUPER-ADMIN' } }, res);
    return res.data;
  } };
}
const member = (id, beginningBalance) => ({ passbookNo: id, memberName: `Member ${id}`, barangay: 'Centro', address: 'Street', beginningBalance });

test('Super Admin bulk registration posts beginning balances as ledger adjustments and keeps old CSVs compatible', async () => {
  const h = harness();
  const result = await h.upload([member('0001', '1250.75'), member('0002', -200.25), member('0003', 0), member('0004', ''), member('0005')]);
  assert.equal(result.summary.successful, 5);
  assert.equal(h.ledgers.length, 3);
  assert.deepEqual(h.ledgers.map(row => [row.memberId, row.credit, row.debit, row.balance]), [
    ['0001', 1250.75, 0, 1250.75], ['0002', 0, 200.25, -200.25], ['0003', 0, 0, 0],
  ]);
  assert.ok(h.ledgers.every(row => row.transactionType === 'adjustment' && row.recordedBy === 'SUPER-ADMIN'));
  const replay = await h.upload([member('0001', 1250.75)]);
  assert.equal(replay.summary.failed, 1);
  assert.equal(h.ledgers.length, 3);
});

test('invalid beginning balances are rejected before saving member records', async () => {
  const h = harness();
  const invalid = ['invalid', '12.345', '1e3', '1,000', Infinity, NaN, {}, true, 9007199254740992];
  const result = await h.upload(invalid.map((value, index) => member(String(index), value)));
  assert.equal(result.summary.failed, invalid.length);
  assert.equal(h.members.length, 0);
  assert.equal(h.ledgers.length, 0);
  assert.ok(result.results.failed.every(row => /Beginning balance/.test(row.reason)));
});

test('opening entries retry safely without duplicate credits after transient failures or lost acknowledgements', async () => {
  for (const failure of ['transient', 'acknowledgement']) {
    const h = harness(failure);
    const result = await h.upload([member('0001', 1000)]);
    assert.equal(result.summary.successful, 1);
    assert.equal(result.results.success[0].ledgerWarning, undefined);
    assert.equal(h.ledgers.length, 1);
    assert.equal(h.ledgers[0].balance, 1000);
  }
});

test('persistent ledger failures identify the saved member for review instead of asking users to register them again', async () => {
  const h = harness('persistent');
  const result = await h.upload([member('0001', 1000)]);
  assert.equal(result.summary.successful, 1);
  assert.equal(result.summary.failed, 0);
  assert.equal(h.members.length, 1);
  assert.equal(h.ledgers.length, 0);
  assert.match(result.results.success[0].ledgerWarning, /beginning balance could not be confirmed/);
  assert.equal(result.results.success[0].beginningBalance, 1000);
});
