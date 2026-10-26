const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Same sandbox-load helper used by tests/staffAccess.test.js — runs the
// controller file with its own requires swapped for in-memory fakes, so
// these tests exercise the real validation/branching logic with no
// database connection.
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
// A successful release also writes an audit log entry, which reads req.ip
// and calls req.get('user-agent') — only the error-path tests can get away
// with a bare { params, body }.
const req = (params, body) => ({ params, body, ip: '127.0.0.1', get: () => 'test-agent' });

function makeClaim(overrides = {}) {
  return {
    claimId: 'CLAIM-1',
    memberId: 'MEM-1',
    beneficiaryName: 'Juana Dela Cruz',
    status: 'deduction_processed',
    deduction: { totalCollected: 20000 },
    statusHistory: [],
    toObject() { return { ...this }; },
    async save() {},
    ...overrides,
  };
}

function controllerFor(claim) {
  const ledgers = [];
  const audits = [];
  // Mirrors real Mongoose findOneAndUpdate semantics closely enough for
  // these tests: only transitions (and returns the doc) if the current
  // status matches the query's status precondition, otherwise returns null
  // — same atomic-lock behavior releaseClaim relies on in production.
  const FakeClaim = {
    findOne: async () => claim,
    findOneAndUpdate: async (query, update) => {
      if (claim.status !== query.status) return null;
      claim.status = update.$set.status;
      return claim;
    },
    updateOne: async (query, update) => {
      if (claim.status === query.status) claim.status = update.$set.status;
    },
  };
  const treasurerClaimController = load('../modules/mortuary/controllers/treasurerClaimController', {
    '../models/Claim': FakeClaim,
    '../models/DeductionSetting': { findOne: async () => null },
    '../models/Ledger': class {
      constructor(data) { Object.assign(this, data); }
      async save() { ledgers.push(this); }
    },
    '../../../shared/models': { Member: {} },
    uuid: { v4: () => 'ledger-uuid' },
    '../../../shared/utils/pagination': { getPaginationParams: () => ({}), buildPaginatedResponse: () => ({}) },
    './deductionController': { getMemberBalanceSnapshots: async () => ({ members: [] }) },
    './dashboardController': { getClaimFinancialTotals: async () => ({}) },
    '../../../shared/services/auditLoggingService': { createAuditLog: async row => audits.push(row) },
    '../utils/ledgerBalance': { getLatestBalance: async () => 1000 },
  });
  return { controller: treasurerClaimController, ledgers, audits };
}

test('releasing a claim requires a DV number', async () => {
  const { controller } = controllerFor(makeClaim());
  const res = response();
  await controller.releaseClaim({ params: { claimId: 'CLAIM-1' }, body: {} }, res);
  assert.equal(res.code, 400);
  assert.match(res.data.message, /DV/);
});

test('a claim cannot be released before its deduction has been processed', async () => {
  const { controller } = controllerFor(makeClaim({ status: 'approved' }));
  const res = response();
  await controller.releaseClaim({ params: { claimId: 'CLAIM-1' }, body: { dvNumber: 'DV-1' } }, res);
  assert.equal(res.code, 400);
  assert.match(res.data.message, /approved/);
});

test('releasing with no amount specified pays out the full amount collected', async () => {
  const claim = makeClaim(); // totalCollected = 20000
  const { controller, ledgers } = controllerFor(claim);
  const res = response();
  await controller.releaseClaim(req({ claimId: 'CLAIM-1' }, { dvNumber: 'DV-1' }), res);
  assert.equal(res.code, 200);
  assert.equal(claim.payout.amount, 20000);
  assert.equal(claim.status, 'released');
  assert.equal(ledgers[0].credit, 20000);
});

test('the treasurer can release less than the amount collected (a partial disbursement)', async () => {
  const claim = makeClaim(); // totalCollected = 20000
  const { controller } = controllerFor(claim);
  const res = response();
  await controller.releaseClaim(req({ claimId: 'CLAIM-1' }, { dvNumber: 'DV-1', amount: 15000 }), res);
  assert.equal(res.code, 200);
  assert.equal(claim.payout.amount, 15000);
});

test('releasing more than the amount collected is rejected', async () => {
  const claim = makeClaim(); // totalCollected = 20000
  const { controller } = controllerFor(claim);
  const res = response();
  await controller.releaseClaim({ params: { claimId: 'CLAIM-1' }, body: { dvNumber: 'DV-1', amount: 20000.01 } }, res);
  assert.equal(res.code, 400);
  assert.match(res.data.message, /cannot exceed/);
  assert.equal(claim.status, 'deduction_processed', 'a rejected release must not change claim status');
});

test('zero or negative requested amounts are rejected', async () => {
  for (const amount of [0, -5]) {
    const claim = makeClaim();
    const { controller } = controllerFor(claim);
    const res = response();
    await controller.releaseClaim({ params: { claimId: 'CLAIM-1' }, body: { dvNumber: 'DV-1', amount } }, res);
    assert.equal(res.code, 400);
  }
});

test('claim release ignores forged releasedBy in payout, ledger, history and audit', async () => {
  const claim = makeClaim();
  const { controller, ledgers, audits } = controllerFor(claim);
  const res = response();
  await controller.releaseClaim({ ...req({ claimId: 'CLAIM-1' }, { dvNumber: 'DV-SEC', releasedBy: 'forged.operator' }), user: { userId: 'STAFF-1', username: 'real.operator', role: 'treasurer', id: 'mongo-id' } }, res);
  assert.equal(res.code, 200);
  assert.equal(claim.payout.releasedBy, 'real.operator');
  assert.equal(ledgers[0].recordedBy, 'real.operator');
  assert.equal(claim.statusHistory[0].changedBy, 'real.operator');
  assert.equal(audits[0].userName, 'real.operator');
  assert.equal(audits[0].userId, 'STAFF-1');
});
