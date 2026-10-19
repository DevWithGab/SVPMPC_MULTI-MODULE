const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const Member = require('../shared/models/Member');
const Contribution = require('../modules/mortuary/models/Contribution');
const Ledger = require('../modules/mortuary/models/Ledger');

function load(path, deps) {
  const filename = require.resolve(path), localRequire = createRequire(filename);
  const context = { module: { exports: {} }, process, console,
    require: name => Object.hasOwn(deps, name) ? deps[name] : localRequire(name) };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
const profile = (memberId, modules) => ({ memberId, modules, memberName: 'Current Name',
  barangay: 'Test', address: 'Current address', status: 'deceased',
  beneficiaries: 'Current beneficiary', beneficiaryRelationship: 'Spouse',
  qrCode: `qr-${memberId}`, qrCodeGenerated: true, qrCodeActive: false, joinDate: new Date(), createdAt: new Date() });

function harness(members = [], { contributions = [], ledgers = [], changeMembership = false } = {}) {
  const audit = [], writes = [], queries = [];
  const match = (row, filter) => Object.entries(filter).every(([key, value]) =>
    Array.isArray(row[key]) ? row[key].includes(value) : row[key] === value);
  function model(SchemaModel, rows) {
    async function update(filter, operation, options) {
      writes.push({ filter, fields: operation.$set });
      if (changeMembership && SchemaModel === Member) rows[0].modules = ['attendance'];
      const row = rows.find(row => match(row, filter));
      if (!row) return null;
      assert.equal(options.runValidators, true);
      await new SchemaModel({ ...row, ...operation.$set }).validate();
      Object.assign(row, operation.$set);
      return row;
    }
    return {
      async findOne(filter) { queries.push(filter); const row = rows.find(row => match(row, filter)); return row ? structuredClone(row) : null; },
      async updateOne(...args) { return { matchedCount: await update(...args) ? 1 : 0 }; },
      findOneAndUpdate: update,
      async create(fields) { const doc = new SchemaModel(fields); await doc.validate(); rows.push(doc.toObject()); },
      async countDocuments(filter) { return rows.filter(row => match(row, filter)).length; },
      find(filter) { return { sort: () => ({ skip: skip => ({ limit: async limit => rows.filter(row => match(row, filter)).slice(skip, skip + limit) }) }) }; },
    };
  }
  const shared = { Member: model(Member, members) };
  const financial = { Ledger: model(Ledger, ledgers), Beneficiary: { countDocuments: async () => 0 }, Claim: { countDocuments: async () => 0 } };
  const backup = load('../modules/mortuary/controllers/backupController', {
    '../../../shared/models': shared, '../models/Contribution': model(Contribution, contributions), '../models/Ledger': financial.Ledger,
    '../../../shared/services/auditLoggingService': { createAuditLog: async entry => audit.push(entry) },
  });
  const admin = load('../modules/mortuary/controllers/adminController', { '../../../shared/models': shared, '../models': financial });
  return { members, contributions, ledgers, writes, queries, audit, admin,
    async restore(body) {
      const res = response();
      await backup.restoreBackup({ body, user: { userId: 'admin-id', username: 'mortuary.admin', role: 'admin' },
        get: () => '', ip: '127.0.0.1' }, res);
      return res;
    },
  };
}

test('Mortuary restores reject Attendance-only members even with forged membership in the file', async () => {
  const original = profile('ATT-1', ['attendance']), db = harness([structuredClone(original)]);
  const res = await db.restore({ members: [{ ...original, modules: ['mortuary'], status: 'active', qrCodeActive: true }] });
  assert.equal(res.data.summary.members.errors.length, 1);
  assert.equal(db.writes.length, 0);
  assert.deepEqual(db.members[0], original);
  assert.equal(db.audit[0].status, 'partial');
  assert.equal(db.audit[0].userId, 'admin-id');
});

test('existing Mortuary/shared members restore only permitted beneficiary fields', async () => {
  for (const modules of [['mortuary'], ['attendance', 'mortuary']]) {
    const original = profile('M1', modules), db = harness([structuredClone(original)]);
    const res = await db.restore({ members: [{ ...original, memberName: 'Changed', address: 'Changed',
      status: 'active', modules: ['attendance'], qrCode: 'Changed', qrCodeActive: true,
      beneficiaries: 'Restored beneficiary', beneficiaryRelationship: 'Child' }] });
    assert.equal(res.data.summary.members.updated, 1);
    assert.deepEqual(db.members[0], { ...original, beneficiaries: 'Restored beneficiary', beneficiaryRelationship: 'Child' });
    assert.equal(db.writes[0].filter.modules, 'mortuary');
  }
});

test('new and legacy backup members enroll in Mortuary only and do not import QR fields', async () => {
  for (const modules of [undefined, ['attendance', 'mortuary']]) {
    const db = harness();
    const res = await db.restore({ members: [{ ...profile('NEW', modules), modules }] });
    assert.equal(res.data.summary.members.created, 1);
    assert.deepEqual(db.members[0].modules, ['mortuary']);
    assert.equal(db.members[0].qrCode, undefined);
    assert.equal(db.members[0].qrCodeGenerated, false);
    assert.equal(db.members[0].status, 'deceased');
  }
  const rejected = await harness().restore({ members: [profile('ATT', ['attendance'])] });
  assert.equal(rejected.data.summary.members.errors.length, 1);
});

test('restore rechecks membership at write time and rejects operator-shaped identifiers', async () => {
  const db = harness([profile('M1', ['mortuary'])], { changeMembership: true });
  const res = await db.restore({ members: [{ memberId: 'M1', beneficiaries: 'Changed' }] });
  assert.equal(res.data.summary.members.updated, 0);
  assert.equal(db.members[0].beneficiaries, 'Current beneficiary');
  const invalid = harness();
  const rejected = await invalid.restore({ members: [{ memberId: { $ne: null } }],
    contributions: [{ contributionId: { $ne: null } }], ledgers: [{ ledgerId: { $gt: '' } }] });
  assert.equal(invalid.queries.length, 0);
  for (const entry of Object.values(rejected.data.summary)) assert.equal(entry.errors.length, 1);
});

test('financial restore requires Mortuary members and forbids reassigning existing records', async () => {
  const contribution = { contributionId: 'C1', memberId: 'M1', amount: 25, dueDate: new Date(), status: 'paid' };
  const ledger = { ledgerId: 'L1', memberId: 'M1', transactionType: 'contribution', description: 'Test', credit: 25, balance: 25 };
  const db = harness([profile('M1', ['mortuary']), profile('ATT', ['attendance'])]);
  const created = await db.restore({ contributions: [contribution], ledgers: [ledger] });
  assert.equal(created.data.summary.contributions.created, 1);
  assert.equal(created.data.summary.ledgers.created, 1);
  const updated = await db.restore({ contributions: [{ ...contribution, amount: 50 }], ledgers: [{ ...ledger, credit: 50, balance: 50 }] });
  assert.equal(updated.data.summary.contributions.updated, 1);
  assert.equal(updated.data.summary.ledgers.updated, 1);
  const rejected = await db.restore({ contributions: [{ ...contribution, memberId: 'ATT' }],
    ledgers: [{ ...ledger, memberId: 'ATT' }, { ...ledger, ledgerId: 'L2', memberId: 'ATT' }] });
  assert.equal(rejected.data.summary.contributions.errors.length, 1);
  assert.equal(rejected.data.summary.ledgers.errors.length, 2);
  assert.equal(db.ledgers.length, 1);
  assert.equal(db.contributions[0].memberId, 'M1');
});

test('normal member updates cannot change Attendance-only records or inject module/QR fields', async () => {
  const attendance = profile('ATT', ['attendance']), shared = profile('SHARED', ['attendance', 'mortuary']);
  const db = harness([structuredClone(attendance), structuredClone(shared)]);
  const denied = response();
  await db.admin.updateMember({ params: { memberId: 'ATT' }, body: { status: 'active' } }, denied);
  assert.equal(denied.code, 404);
  assert.deepEqual(db.members[0], attendance);
  const allowed = response();
  await db.admin.updateMember({ params: { memberId: 'SHARED' }, body: {
    name: 'Edited profile', status: 'inactive', modules: ['mortuary'], qrCodeActive: true,
  } }, allowed);
  assert.equal(allowed.code, 200);
  assert.equal(db.members[1].memberName, 'Edited profile');
  assert.equal(db.members[1].status, 'inactive');
  assert.deepEqual(db.members[1].modules, shared.modules);
  assert.equal(db.members[1].qrCodeActive, false);
});

test('Mortuary listing and delete lookup exclude Attendance-only members', async () => {
  const db = harness([profile('ATT', ['attendance']), profile('M1', ['mortuary'])]);
  const listed = response();
  await db.admin.getAllMembers({ query: {} }, listed);
  assert.equal(listed.data.pagination.total, 1);
  assert.equal(listed.data.members[0].id, 'M1');
  const deleted = response();
  await db.admin.deleteMember({ params: { memberId: 'ATT' } }, deleted);
  assert.equal(deleted.code, 404);
  assert.equal(db.members.length, 2);
});
