const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Same VM-sandbox require-interception helper as the other controller
// tests in this suite.
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

// processDeductionBatch (Flow A, a batch of claims) is the same blanket
// per-member-charge mechanism as processAutomaticDeduction, but its
// duplicate-prevention is a DIFFERENT mechanism: not a deterministic
// ledgerId per member, but an atomic lock on every claim in the batch
// (Claim.findOneAndUpdate({claimId, status:'pending_deduction'},
// {$set:{status:'deduction_processing'}})) — only one caller can ever win
// each status flip, and a batch that loses any of them gives back the ones
// it won. The fakes below implement that check-and-set with no
// internal `await` between reading and writing, matching real MongoDB's
// atomicity for a single document, which is what actually lets two
// concurrent calls in this test reliably produce one winner and one
// rejection instead of a race.
function database(members, { claims = [] } = {}) {
  // state.claims holds the canonical stored records as plain objects — a
  // fresh ClaimDoc copy is handed out on every read (findOne), matching
  // real Mongoose: two separate findOne() calls hydrate two independent
  // in-memory documents, so mutating one before calling .save() does NOT
  // retroactively change what a different in-flight request already read.
  // Getting this right matters here specifically: a first draft of this
  // fake had findOne return the SAME shared object on every call, which
  // accidentally made even a non-atomic read-then-write implementation
  // look race-safe in this test — reverting the real atomic lock to a
  // plain findOne+field-check (the actual regression this test guards
  // against) still passed, which would have made this test worthless.
  // Only findOneAndUpdate is allowed to mutate the shared canonical state
  // directly, since that's the one operation real MongoDB performs
  // atomically against the stored document itself.
  class ClaimDoc {
    constructor(data) { Object.assign(this, { statusHistory: [], ...data }); }
    async save() {
      const stored = state.claims.find(c => c.claimId === this.claimId);
      if (stored) Object.assign(stored, this);
      return this;
    }
    toObject() { return { ...this }; }
  }
  const state = { members, ledgers: [], claims: claims.map(c => ({ statusHistory: [], ...c })), deductionRate: { amount: 25, settingId: 'DED-1' }, failForMemberId: null };

  const Claim = {
    findOneAndUpdate: async (query, update) => {
      const stored = state.claims.find(c => c.claimId === query.claimId && c.status === query.status);
      if (!stored) return null;
      Object.assign(stored, update.$set);
      return new ClaimDoc({ ...stored });
    },
    findOne: async query => {
      const stored = state.claims.find(c => c.claimId === query.claimId);
      return stored ? new ClaimDoc({ ...stored }) : null;
    },
    find: query => {
      const docs = state.claims.filter(c => query.claimId.$in.includes(c.claimId)).map(c => new ClaimDoc({ ...c }));
      return { sort: async () => docs };
    },
    updateMany: async (query, update) => {
      for (const stored of state.claims) {
        if (query.claimId.$in.includes(stored.claimId) && stored.status === query.status) Object.assign(stored, update.$set);
      }
    },
  };

  const DeductionSetting = { findOne: async () => state.deductionRate };

  class LedgerDoc {
    constructor(data) { Object.assign(this, data); }
    async save() {
      if (state.failForMemberId && this.memberId === state.failForMemberId) {
        throw new Error('Simulated ledger write failure');
      }
      state.ledgers.push(this);
      return this;
    }
  }

  return {
    state,
    deps: {
      '../models/Claim': Claim,
      '../models/DeductionSetting': DeductionSetting,
      '../models/Ledger': LedgerDoc,
      '../../../shared/models': { Member: {} },
      '../../../shared/utils/pagination': {},
      './deductionController': { getMemberBalanceSnapshots: async () => ({ members: state.members }) },
      './dashboardController': { getClaimFinancialTotals: async () => ({}) },
      '../../../shared/services/auditLoggingService': { createAuditLog: async () => {} },
      '../utils/ledgerBalance': { getLatestBalance: async () => 0 },
    },
  };
}

function controller(db) {
  return load('../modules/mortuary/controllers/treasurerClaimController', db.deps);
}

const baseMembers = () => [
  { memberId: '001', memberName: 'Member One', balance: 500 },
  { memberId: '002', memberName: 'Member Two', balance: 1000 },
  { memberId: '003', memberName: 'Member Three', balance: -200 },
];
const pendingClaim = (overrides = {}) => ({ claimId: 'CLM-1', memberName: 'Deceased Member', status: 'pending_deduction', ...overrides });
const twoClaims = () => [pendingClaim(), pendingClaim({ claimId: 'CLM-2', memberName: 'Second Deceased' })];
const request = (body, user = { username: 'treasurer.jane' }) => ({ body, user, ip: '', get: () => '' });

test('a batch charges every active member once for all claims, sharing one JV number', async () => {
  const db = database(baseMembers(), { claims: twoClaims() });
  const { processDeductionBatch } = controller(db);

  const res = response();
  await processDeductionBatch(request({ claimIds: ['CLM-1', 'CLM-2'], jvNumber: 'JV-001' }), res);

  assert.equal(res.code, 200);
  assert.equal(res.data.data.claimCount, 2);
  assert.equal(res.data.data.amountPerMember, 50, '2 claims * ₱25');
  assert.equal(res.data.data.totalCollected, 150, '3 members * ₱50');
  assert.equal(db.state.ledgers.length, 3, 'one ledger row per member for the whole batch');

  const byMember = Object.fromEntries(db.state.ledgers.map(row => [row.memberId, row]));
  assert.equal(byMember['001'].balance, 450, '500 - 50');
  assert.equal(byMember['003'].balance, -250, '-200 - 50');
  // The ledger reference keeps the number exactly as entered, "JV" prefix included.
  assert.ok(db.state.ledgers.every(row => row.referenceId === 'JV-001' && row.debit === 50));

  for (const claim of db.state.claims) {
    assert.equal(claim.status, 'deduction_processed');
    assert.equal(claim.deduction.jvNumber, 'JV-001');
    assert.equal(claim.deduction.batchId, res.data.data.batchId);
    assert.equal(claim.deduction.claimsInBatch, 2);
    assert.equal(claim.deduction.amountPerMember, 25);
    assert.equal(claim.deduction.totalCollected, 75, 'each claim records its own share');
  }
});

test('preview reports the same figures without writing anything', async () => {
  const db = database(baseMembers(), { claims: twoClaims() });
  const res = response();
  await controller(db).previewDeductionBatch(request({ claimIds: ['CLM-1', 'CLM-2'] }), res);
  assert.equal(res.code, 200);
  assert.equal(res.data.data.amountPerMember, 50);
  assert.equal(res.data.data.totalCollected, 150);
  assert.equal(res.data.data.membersGoingNegative, 1);
  assert.equal(db.state.ledgers.length, 0);
  assert.ok(db.state.claims.every(c => c.status === 'pending_deduction'));
});

test('a missing JV number or claim list is rejected before any claim is locked', async () => {
  const db = database(baseMembers(), { claims: twoClaims() });
  const { processDeductionBatch } = controller(db);

  for (const body of [{ claimIds: ['CLM-1'] }, { jvNumber: 'JV-1' }, { jvNumber: 'JV-1', claimIds: [] }, { jvNumber: 'JV-1', claimIds: [{ $ne: null }] }, { jvNumber: 'JV-1', claimIds: ['CLM-1', 'CLM-1'] }]) {
    const res = response();
    await processDeductionBatch(request(body), res);
    assert.equal(res.code, 400);
  }
  assert.ok(db.state.claims.every(c => c.status === 'pending_deduction'), 'no claim may be touched');
  assert.equal(db.state.ledgers.length, 0);
});

test('two concurrent batches over the same claim: exactly one is processed', async () => {
  const db = database(baseMembers(), { claims: twoClaims() });
  const { processDeductionBatch } = controller(db);

  const resA = response();
  const resB = response();
  await Promise.all([
    processDeductionBatch(request({ claimIds: ['CLM-1', 'CLM-2'], jvNumber: 'JV-A' }), resA),
    processDeductionBatch(request({ claimIds: ['CLM-1'], jvNumber: 'JV-B' }), resB),
  ]);

  assert.deepEqual([resA.code, resB.code].sort(), [200, 400]);
  assert.equal(db.state.ledgers.length, 3, 'members are charged by one batch only');
});

test('a batch containing an already-processed claim is rejected and gives back the claims it locked', async () => {
  const db = database(baseMembers(), { claims: [pendingClaim(), pendingClaim({ claimId: 'CLM-2', status: 'deduction_processed' })] });
  const res = response();
  await controller(db).processDeductionBatch(request({ claimIds: ['CLM-1', 'CLM-2'], jvNumber: 'JV-001' }), res);

  assert.equal(res.code, 400);
  assert.match(res.data.message, /CLM-2.*"deduction_processed"/);
  assert.equal(db.state.claims[0].status, 'pending_deduction', 'CLM-1 must be unlocked again');
  assert.equal(db.state.ledgers.length, 0);
});

test('an unknown claim returns 404 and leaves the rest of the batch pending', async () => {
  const db = database(baseMembers(), { claims: [pendingClaim()] });
  const res = response();
  await controller(db).processDeductionBatch(request({ claimIds: ['CLM-1', 'NOPE'], jvNumber: 'JV-1' }), res);
  assert.equal(res.code, 404);
  assert.equal(db.state.claims[0].status, 'pending_deduction');
});

test('a failed operation releases every lock, and a retry then succeeds', async () => {
  const db = database(baseMembers(), { claims: twoClaims() });
  const { processDeductionBatch } = controller(db);

  db.state.deductionRate = { amount: 0, settingId: 'DED-1' };
  const failed = response();
  await processDeductionBatch(request({ claimIds: ['CLM-1', 'CLM-2'], jvNumber: 'JV-001' }), failed);
  assert.equal(failed.code, 400);
  assert.ok(db.state.claims.every(c => c.status === 'pending_deduction'), 'locks must be released');
  assert.equal(db.state.ledgers.length, 0);

  db.state.deductionRate = { amount: 25, settingId: 'DED-1' };
  const retried = response();
  await processDeductionBatch(request({ claimIds: ['CLM-1', 'CLM-2'], jvNumber: 'JV-002' }), retried);
  assert.equal(retried.code, 200);
  assert.ok(db.state.claims.every(c => c.status === 'deduction_processed'));
});

test('a single member\'s ledger write failing does not abort the batch for everyone else', async () => {
  const db = database(baseMembers(), { claims: twoClaims() });
  db.state.failForMemberId = '002';
  const res = response();
  await controller(db).processDeductionBatch(request({ claimIds: ['CLM-1', 'CLM-2'], jvNumber: 'JV-001' }), res);

  assert.equal(res.code, 200);
  assert.equal(res.data.data.membersCharged, 2);
  assert.equal(res.data.data.totalCollected, 100);
  assert.equal(db.state.claims[0].deduction.totalCollected, 50);
  assert.ok(!db.state.ledgers.some(row => row.memberId === '002'));
});

test('claim deductions ignore supplied operator names in ledger, claim history and audit', async () => {
  const db = database(baseMembers(), { claims: [pendingClaim()] });
  const audits = [];
  db.deps['../../../shared/services/auditLoggingService'] = { createAuditLog: async row => audits.push(row) };
  const res = response();
  await controller(db).processDeductionBatch(request({ claimIds: ['CLM-1'], jvNumber: 'JV-SEC', processedBy: 'forged.operator' }, { userId: 'STAFF-1', username: 'real.operator', role: 'treasurer', id: 'mongo-id' }), res);
  assert.equal(res.code, 200);
  assert.ok(db.state.ledgers.every(row => row.recordedBy === 'real.operator'));
  assert.ok(db.state.ledgers.every(row => row.description.includes('Deceased Member')), 'a single-claim batch names the deceased');
  assert.equal(db.state.claims[0].deduction.processedBy, 'real.operator');
  assert.ok(db.state.claims[0].statusHistory.every(row => row.changedBy === 'real.operator'));
  assert.equal(audits[0].userName, 'real.operator');
  assert.equal(audits[0].userId, 'STAFF-1');
});
