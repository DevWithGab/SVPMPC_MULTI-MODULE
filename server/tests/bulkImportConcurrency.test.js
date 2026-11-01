const { postingLedger } = require('./fixtures/postingLedger');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLedgerImportService } = require('../modules/mortuary/services/ledgerImportService');
const { createBeneficiaryImportService } = require('../modules/mortuary/services/beneficiaryImportService');
const pause = () => new Promise(resolve => setImmediate(resolve));

test('legacy Mortuary member import reuses its ID lookup and refreshes after a concurrent collision', async () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const { createRequire } = require('node:module');
  const filename = require.resolve('../modules/mortuary/controllers/adminController');
  const localRequire = createRequire(filename);
  const saved = [];
  let lookups = 0;
  let collided = false;
  let active = 0;
  let peak = 0;
  class Member {
    constructor(data) { Object.assign(this, data); }
    static findOne() {
      lookups++;
      return { sort: async () => saved.at(-1) };
    }
    async save() {
      if (this.memberId === '000002' && !collided) {
        collided = true;
        saved.push({ memberId: this.memberId });
        throw Object.assign(new Error('Concurrent insert'), { code: 11000, keyPattern: { memberId: 1 } });
      }
      saved.push(this);
    }
  }
  const ledgers = [];
  class Ledger {
    constructor(data) { Object.assign(this, data); }
    async save() {
      peak = Math.max(peak, ++active);
      await pause();
      active--;
      ledgers.push(this);
    }
  }
  postingLedger(Ledger, ledgers);
  const context = { module: { exports: {} }, console, require: name => {
    if (name === '../../../shared/models') return { Member };
    if (name === '../models') return { Ledger };
    return localRequire(name);
  } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  const response = { json(data) { this.data = data; }, status() { return this; } };
  await context.module.exports.bulkCreateMembers({ body: { members: Array.from({ length: 60 }, (_, index) => ({
    name: `Member ${index}`, contact: '09123456789', barangay: 'Sample', address: 'Sample',
  })) } }, response);
  assert.equal(response.data.createdMembers.length, 60);
  assert.equal(lookups, 2);
  assert.equal(peak, 10);
  assert.equal(new Set(saved.map(row => row.memberId)).size, 61);
  assert.equal(saved.at(-1).memberId, '000061');
});

test('ledger import overlaps different members while retaining each running balance and CSV result order', async () => {
  const saved = [];
  const activeMembers = new Set();
  let peak = 0;
  class Ledger {
    constructor(data) { Object.assign(this, data); }
    static async find() { return []; }
    async save() {
      assert.equal(activeMembers.has(this.memberId), false);
      activeMembers.add(this.memberId);
      peak = Math.max(peak, activeMembers.size);
      await pause();
      saved.push(this);
      activeMembers.delete(this.memberId);
    }
  }
  postingLedger(Ledger, saved);
  const service = createLedgerImportService({
    Member: { find: async query => query.memberId.$in.map(memberId => ({ memberId })) },
    Ledger,
    Contribution: { find: async () => [], updateOne: async () => pause() },
    getLatestBalancesByMember: async ids => new Map(ids.map(id => [id, 0])),
  });
  const rows = Array.from({ length: 60 }, (_, index) => ({
    row: index + 2, status: 'ready', errors: [], entry: {
      memberId: String(index % 20), transactionDate: '2026-10-01',
      transactionType: 'contribution', credit: 10, debit: 0,
      referenceId: `OR-${index}`, description: 'CSV contribution', paymentMethod: 'cash',
    },
  }));
  const result = await service.importRows(rows, 'treasurer');
  assert.equal(peak, 10);
  assert.equal(saved.length, 60);
  assert.deepEqual(result.rows.map(row => row.balance), rows.map((_, index) => (Math.floor(index / 20) + 1) * 10));
  assert.ok(result.rows.every(row => row.status === 'imported'));
});

test('beneficiary import overlaps independent members and serializes replacements for a repeated member', async () => {
  const saved = [];
  let active = 0;
  let peak = 0;
  class Beneficiary {
    constructor(data) { Object.assign(this, data); }
    static async findOne(query) { return saved.find(row => row.memberId === query.memberId && row.isActive); }
    async save() {
      peak = Math.max(peak, ++active);
      await pause();
      if (!saved.includes(this)) saved.push(this);
      active--;
      return this;
    }
  }
  const service = createBeneficiaryImportService({
    Member: {
      find: query => ({ lean: async () => query.memberId.$in.map(memberId => ({ memberId, memberName: memberId })) }),
      findOne: async query => ({ memberId: query.memberId, memberName: query.memberId }),
    }, Beneficiary,
  });
  const rows = Array.from({ length: 60 }, (_, index) => ({
    row: index + 2, errors: [], entry: { memberId: String(index % 20), beneficiaryName: `Name ${index}` },
  }));
  const result = await service.importRows(rows, 'admin');
  assert.equal(peak, 10);
  assert.equal(saved.length, 60);
  assert.equal(saved.filter(row => row.isActive).length, 20);
  assert.deepEqual(result.rows.map(row => row.row), rows.map(row => row.row));
  assert.ok(result.rows.every(row => row.status === 'imported'));
});
