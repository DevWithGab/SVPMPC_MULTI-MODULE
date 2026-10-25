const test = require('node:test');
const assert = require('node:assert/strict');
const { restoreModule, summaryTotals } = require('../shared/utils/moduleBackup');

// In-memory stand-in for a Mongoose model (findOne / updateOne / create).
const fakeModel = (rows = []) => {
  const match = (row, filter) => Object.entries(filter).every(([key, value]) => row[key] === value);
  return {
    rows,
    async findOne(filter) { return rows.find(row => match(row, filter)) || null; },
    async updateOne(filter, update) {
      const row = rows.find(r => match(r, filter));
      if (!row) return { matchedCount: 0 };
      Object.assign(row, update.$set);
      return { matchedCount: 1 };
    },
    async create(fields) { rows.push({ ...fields }); return fields; },
  };
};

test('audit logs are only added, never overwritten, so history cannot be rewritten', async () => {
  const Member = fakeModel();
  const AuditLog = fakeModel([{ logId: 'L1', description: 'Original' }]);
  const summary = await restoreModule(Member, { auditLogs: [{ logId: 'L1', description: 'Forged' }, { logId: 'L2', description: 'Missing entry' }] },
    { collections: [{ name: 'auditLogs', Model: AuditLog, key: 'logId', insertOnly: true }], ownedFields: [], newMemberFields: [] });
  assert.deepEqual({ created: summary.auditLogs.created, skipped: summary.auditLogs.skipped }, { created: 1, skipped: 1 });
  assert.equal(AuditLog.rows[0].description, 'Original');
  assert.equal(AuditLog.rows[1].description, 'Missing entry');
});

test('an old active setting is restored as superseded and never replaces the current one', async () => {
  const Setting = fakeModel([{ settingId: 'NEW', status: 'active', rate: 20 }, { settingId: 'MID', status: 'superseded', rate: 15 }]);
  await restoreModule(fakeModel(), { deductionSettings: [
    { settingId: 'OLD', status: 'active', rate: 10 },
    { settingId: 'MID', status: 'active', rate: 15, description: 'restored' },
  ] }, { collections: [{ name: 'deductionSettings', Model: Setting, key: 'settingId', singleActive: true }], ownedFields: [], newMemberFields: [] });
  assert.equal(Setting.rows.find(row => row.settingId === 'NEW').status, 'active');
  assert.equal(Setting.rows.find(row => row.settingId === 'OLD').status, 'superseded');
  assert.equal(Setting.rows.find(row => row.settingId === 'MID').status, 'superseded', 'existing rows keep their status');
  assert.equal(Setting.rows.filter(row => row.status === 'active').length, 1);
});

test('member-scoped records keep their original timestamps; string _id keys (payment imports) restore', async () => {
  const Member = fakeModel([{ memberId: 'M1' }]);
  const Ledger = fakeModel();
  const PaymentImport = fakeModel();
  const createdAt = '2026-09-17T02:00:00.000Z';
  const summary = await restoreModule(Member, {
    ledgers: [{ _id: 'mongo-id', ledgerId: 'LG1', memberId: 'M1', credit: 1000, balance: 1000, createdAt }],
    paymentImports: [{ _id: 'CSV-abc', memberId: 'M1', amount: 100 }, { _id: 'CSV-def', memberId: 'NOPE', amount: 5 }],
  }, { collections: [
    { name: 'ledgers', Model: Ledger, key: 'ledgerId', memberScoped: true },
    { name: 'paymentImports', Model: PaymentImport, key: '_id', memberScoped: true },
  ], ownedFields: [], newMemberFields: [] });
  assert.equal(Ledger.rows[0].createdAt, createdAt);
  assert.equal(Ledger.rows[0]._id, undefined, 'Mongo ids are not copied');
  assert.equal(PaymentImport.rows[0]._id, 'CSV-abc');
  assert.equal(summary.paymentImports.errors.length, 1, 'records for unknown members are rejected');
  assert.deepEqual(summaryTotals(summary), { created: 2, updated: 0, skipped: 0, errors: 1 });
});

test('old superseded settings rows that fail today\'s validation are kept as history', async () => {
  const inserted = [];
  const Setting = {
    async findOne() { return null; },
    async create() { const error = new Error('Path `noticeBodyTemplate` is required.'); error.name = 'ValidationError'; throw error; },
    collection: { async insertOne(doc) { inserted.push(doc); } },
  };
  function FakeDoc(fields) { this.fields = fields; }
  FakeDoc.prototype.toObject = function () { return { ...this.fields }; };
  Object.setPrototypeOf(Setting, FakeDoc);
  const Model = Object.assign(function (fields) { return new FakeDoc(fields); }, Setting);
  const summary = await restoreModule({ async findOne() { return null; } }, {
    noticeThresholdSettings: [{ settingId: 'OLD', status: 'superseded', targetBalance: 1000 }, { settingId: 'BAD', status: 'active' }],
  }, { collections: [{ name: 'noticeThresholdSettings', Model, key: 'settingId', singleActive: true }], ownedFields: [], newMemberFields: [] });
  assert.equal(summary.noticeThresholdSettings.created, 1);
  assert.equal(inserted[0].settingId, 'OLD');
  assert.equal(summary.noticeThresholdSettings.errors.length, 1, 'an invalid active setting is still rejected');
});
