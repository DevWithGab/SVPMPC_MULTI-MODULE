const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Same VM-sandbox require-interception helper as staffAccess.test.js/
// claimRelease.test.js/automaticDeduction.test.js.
function load(path, dependencies) {
  const filename = require.resolve(path);
  const localRequire = createRequire(filename);
  const context = { module: { exports: {} }, process, Buffer, console,
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : localRequire(name) };
  context.exports = context.module.exports;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}
const response = () => ({ status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });

function database() {
  const state = { contributions: [], ledgers: [], member: { memberId: '001', memberName: 'Member One' } };
  const Contribution = {
    findOneAndUpdate: async (query, update) => {
      let doc = state.contributions.find(row => row.contributionId === query.contributionId);
      if (!doc) { doc = { ...update.$setOnInsert }; state.contributions.push(doc); }
      return doc;
    },
    findOne: async query => state.contributions.find(row => row.contributionId === query.contributionId) || null,
  };
  const Ledger = {
    findOne: async query => state.ledgers.find(row => row.ledgerId === query.ledgerId) || null,
    findOneAndUpdate: async (query, update) => {
      let doc = state.ledgers.find(row => row.ledgerId === query.ledgerId);
      if (!doc) { doc = { ...update.$setOnInsert }; state.ledgers.push(doc); }
      return doc;
    },
  };
  const Member = { findOne: async query => (query.memberId === state.member.memberId ? state.member : null) };
  return { state, Contribution, Ledger, Member };
}

function controller(db) {
  return load('../modules/mortuary/controllers/contributionController', {
    '../models/Contribution': db.Contribution,
    '../models/Ledger': db.Ledger,
    '../../../shared/models': { Member: db.Member },
    '../utils/ledgerBalance': { getLatestBalance: async () => 0 },
  });
}

test('recordContribution attributes the ledger entry to the actual logged-in user, not a hardcoded value', async () => {
  const db = database();
  const { recordContribution } = controller(db);

  const res = response();
  await recordContribution({
    body: { memberId: '001', amount: 100, referenceNumber: 'OR-1' },
    user: { username: 'treasurer.jane' },
  }, res);

  assert.equal(res.code, 201);
  assert.equal(db.state.ledgers[0].recordedBy, 'treasurer.jane', 'must record the actual logged-in user, not "admin"');
});

test('recordContribution prefers an explicit recordedBy in the body over req.user, and falls back to "admin" only when neither is present', async () => {
  const explicit = database();
  await controller(explicit).recordContribution({
    body: { memberId: '001', amount: 50, referenceNumber: 'OR-2', recordedBy: 'counter.staff' },
    user: { username: 'treasurer.jane' },
  }, response());
  assert.equal(explicit.state.ledgers[0].recordedBy, 'counter.staff');

  const neither = database();
  await controller(neither).recordContribution({
    body: { memberId: '001', amount: 50, referenceNumber: 'OR-3' },
    user: {},
  }, response());
  assert.equal(neither.state.ledgers[0].recordedBy, 'admin');
});
