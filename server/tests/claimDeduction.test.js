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

// processClaimDeduction (Flow A, per-claim) is the same blanket
// per-member-charge mechanism as processAutomaticDeduction, but its
// duplicate-prevention is a DIFFERENT mechanism: not a deterministic
// ledgerId per member, but a single atomic claim-level lock
// (Claim.findOneAndUpdate({claimId, status:'pending_deduction'},
// {$set:{status:'deduction_processing'}})) — only one caller can ever win
// that status flip. The fakes below implement that check-and-set with no
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
    updateOne: async (query, update) => {
      const stored = state.claims.find(c => c.claimId === query.claimId && c.status === query.status);
      if (stored) Object.assign(stored, update.$set);
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
      '../models/BenefitCapSetting': {},
      '../models/Ledger': LedgerDoc,
      '../../../shared/models': { Member: {} },
      '../../../shared/utils/pagination': {},
      './deductionController': { getMemberBalanceSnapshots: async () => ({ members: state.members }) },
      './dashboardController': { getClaimFinancialTotals: async () => ({}) },
      '../../../shared/services/auditLoggingService': { createAuditLog: async () => {} },
      '../utils/ledgerBalance': { getLatestBalance: async () => 0 },
      '../config/claimBenefit': { DEFAULT_MAX_BENEFIT_AMOUNT: 50000, benefitPayoutFor: () => 0, benefitSurplusFor: () => 0 },
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

test('processClaimDeduction charges every active member the configured rate with correct arithmetic', async () => {
  const db = database(baseMembers(), { claims: [pendingClaim()] });
  const { processClaimDeduction } = controller(db);

  const res = response();
  await processClaimDeduction({ params: { claimId: 'CLM-1' }, body: { jvNumber: 'JV-001' }, user: { username: 'treasurer.jane' }, ip: '', get: () => '' }, res);

  assert.equal(res.code, 200);
  assert.equal(res.data.data.deduction.membersCharged, 3);
  assert.equal(res.data.data.deduction.totalCollected, 75, '3 members * ₱25 = ₱75 exactly');
  assert.equal(res.data.data.status, 'deduction_processed');
  assert.equal(db.state.ledgers.length, 3);

  const byMember = Object.fromEntries(db.state.ledgers.map(row => [row.memberId, row]));
  assert.equal(byMember['001'].balance, 475, '500 - 25');
  assert.equal(byMember['002'].balance, 975, '1000 - 25');
  assert.equal(byMember['003'].balance, -225, '-200 - 25');
  assert.ok(db.state.ledgers.every(row => row.referenceId === 'JV-001'));
  assert.ok(db.state.ledgers.every(row => row.description.includes('Deceased Member')));
});

test('a missing JV number is rejected before the claim lock is even attempted', async () => {
  const db = database(baseMembers(), { claims: [pendingClaim()] });
  const { processClaimDeduction } = controller(db);

  const res = response();
  await processClaimDeduction({ params: { claimId: 'CLM-1' }, body: {}, user: {}, ip: '', get: () => '' }, res);

  assert.equal(res.code, 400);
  assert.equal(db.state.claims[0].status, 'pending_deduction', 'the claim must not be touched at all');
  assert.equal(db.state.ledgers.length, 0);
});

test('two concurrent requests for the same claim: exactly one is processed, the other is cleanly rejected', async () => {
  const db = database(baseMembers(), { claims: [pendingClaim()] });
  const { processClaimDeduction } = controller(db);
  const req = (jv) => ({ params: { claimId: 'CLM-1' }, body: { jvNumber: jv }, user: { username: 'treasurer.jane' }, ip: '', get: () => '' });

  const resA = response();
  const resB = response();
  await Promise.all([
    processClaimDeduction(req('JV-A'), resA),
    processClaimDeduction(req('JV-B'), resB),
  ]);

  const codes = [resA.code, resB.code].sort();
  assert.deepEqual(codes, [200, 400], 'one request succeeds, the other is rejected by the atomic lock');
  assert.equal(db.state.ledgers.length, 3, 'members are charged exactly once, not twice');
  assert.equal(db.state.claims[0].status, 'deduction_processed');
});

test('a retried request against an already-processed claim is rejected and does not re-charge anyone', async () => {
  const db = database(baseMembers(), { claims: [pendingClaim()] });
  const { processClaimDeduction } = controller(db);
  const req = { params: { claimId: 'CLM-1' }, body: { jvNumber: 'JV-001' }, user: { username: 'treasurer.jane' }, ip: '', get: () => '' };

  const first = response();
  await processClaimDeduction(req, first);
  assert.equal(first.code, 200);

  const retry = response();
  await processClaimDeduction(req, retry);
  assert.equal(retry.code, 400);
  assert.match(retry.data.message, /deduction_processed/);
  assert.equal(db.state.ledgers.length, 3, 'the retry must not add a second set of charges');
});

test('a claim not found returns 404; a claim in the wrong status reports that status and is left untouched', async () => {
  const db = database(baseMembers(), { claims: [pendingClaim({ claimId: 'CLM-2', status: 'approved' })] });
  const { processClaimDeduction } = controller(db);

  const missing = response();
  await processClaimDeduction({ params: { claimId: 'NOPE' }, body: { jvNumber: 'JV-1' }, user: {}, ip: '', get: () => '' }, missing);
  assert.equal(missing.code, 404);

  const wrongStatus = response();
  await processClaimDeduction({ params: { claimId: 'CLM-2' }, body: { jvNumber: 'JV-1' }, user: {}, ip: '', get: () => '' }, wrongStatus);
  assert.equal(wrongStatus.code, 400);
  assert.match(wrongStatus.data.message, /"approved"/);
  assert.equal(db.state.claims[0].status, 'approved');
});

test('a failed operation releases the claim lock back to pending_deduction, and a retry then succeeds', async () => {
  const db = database(baseMembers(), { claims: [pendingClaim()] });
  const { processClaimDeduction } = controller(db);

  // Force the first attempt to fail partway through, after the lock has
  // already been acquired (an invalid rate is the simplest realistic
  // trigger — the same guard previewClaimDeduction uses).
  db.state.deductionRate = { amount: 0, settingId: 'DED-1' };
  const failed = response();
  await processClaimDeduction({ params: { claimId: 'CLM-1' }, body: { jvNumber: 'JV-001' }, user: {}, ip: '', get: () => '' }, failed);
  assert.equal(failed.code, 400);
  assert.equal(db.state.claims[0].status, 'pending_deduction', 'the lock must be released, not left stuck in deduction_processing');
  assert.equal(db.state.ledgers.length, 0);

  // Fix the underlying problem and retry from the same (now-restored) state.
  db.state.deductionRate = { amount: 25, settingId: 'DED-1' };
  const retried = response();
  await processClaimDeduction({ params: { claimId: 'CLM-1' }, body: { jvNumber: 'JV-002' }, user: {}, ip: '', get: () => '' }, retried);
  assert.equal(retried.code, 200);
  assert.equal(db.state.claims[0].status, 'deduction_processed');
  assert.equal(db.state.ledgers.length, 3);
});

test('a single member\'s ledger write failing does not abort the batch for everyone else', async () => {
  const db = database(baseMembers(), { claims: [pendingClaim()] });
  db.state.failForMemberId = '002';
  const { processClaimDeduction } = controller(db);

  const res = response();
  await processClaimDeduction({ params: { claimId: 'CLM-1' }, body: { jvNumber: 'JV-001' }, user: {}, ip: '', get: () => '' }, res);

  assert.equal(res.code, 200);
  assert.equal(res.data.data.deduction.membersCharged, 2, 'the failing member is excluded, the other two still proceed');
  assert.equal(res.data.data.deduction.totalCollected, 50);
  assert.equal(db.state.ledgers.length, 2);
  assert.ok(!db.state.ledgers.some(row => row.memberId === '002'));
});

 test('claim deductions ignore supplied operator names in ledger, claim history and audit', async () => {
  const db = database(baseMembers(), { claims: [pendingClaim()] });
  const audits = [];
  db.deps['../../../shared/services/auditLoggingService'] = { createAuditLog: async row => audits.push(row) };
  const res = response();
  await controller(db).processClaimDeduction({ params: { claimId: 'CLM-1' }, body: { jvNumber: 'JV-SEC', processedBy: 'forged.operator' }, user: { userId: 'STAFF-1', username: 'real.operator', role: 'treasurer', id: 'mongo-id' }, ip: '', get: () => '' }, res);
  assert.equal(res.code, 200);
  assert.ok(db.state.ledgers.every(row => row.recordedBy === 'real.operator'));
  assert.equal(db.state.claims[0].deduction.processedBy, 'real.operator');
  assert.ok(db.state.claims[0].statusHistory.every(row => row.changedBy === 'real.operator'));
  assert.equal(audits[0].userName, 'real.operator');
  assert.equal(audits[0].userId, 'STAFF-1');
});
