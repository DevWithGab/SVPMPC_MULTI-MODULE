const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Same VM-sandbox require-interception helper as staffAccess.test.js
// — loads the real controller source with specific
// `require()` targets swapped for in-memory fakes, so the actual
// idempotency logic under test runs unmodified against fake data instead
// of a live MongoDB connection (this suite has no DB-connected tests).
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

// Fakes just enough of Member/Ledger/DeductionSetting to exercise
// processAutomaticDeduction's real control flow, including its unique-
// ledgerId-backed dedup guard. getMemberBalanceSnapshots now computes
// "active members" via Member.find().select().lean() and each member's
// latest balance via one Ledger.aggregate() grouped by memberId (see
// deductionController.js for why — replaced a per-member $lookup that
// measured ~7s at 10k members with this two-query-plus-merge approach,
// ~10x faster at the same volume). This fake answers both calls with the
// behaviorally-correct result (active members; each one's latest-by-
// insertion-order ledger balance) without reinterpreting Mongo query/
// aggregation syntax.
function database(members) {
  const state = { members, ledgers: [] };
  const latestBalance = memberId => {
    const rows = state.ledgers.filter(row => row.memberId === memberId);
    return rows.length ? rows[rows.length - 1] : null;
  };
  const Member = {
    // Real Mongoose: await Member.find(query).select(...).lean() — chained
    // off find(), so the fake must match that shape. Every caller in this
    // test uses the default (no search/barangay/memberIds) filter, which
    // buildBalanceMatch renders as exactly { status: 'active' }.
    find: (query) => ({
      select: () => ({
        lean: async () => state.members.filter(member => !query?.status || member.status === query.status),
      }),
    }),
  };
  class Ledger {
    constructor(data) { Object.assign(this, data); }
    async save() {
      if (state.ledgers.some(row => row.ledgerId === this.ledgerId)) {
        const error = new Error('duplicate key'); error.code = 11000; throw error;
      }
      state.ledgers.push(this);
      return this;
    }
    static async findOne(query) { return state.ledgers.find(row => row.ledgerId === query.ledgerId) || null; }
    // Real Mongoose: await Ledger.aggregate(pipeline).allowDiskUse(true).
    static aggregate = (pipeline) => ({
      allowDiskUse: async () => {
        const memberIds = [...new Set(state.ledgers.map(row => row.memberId))];
        return memberIds.map(memberId => {
          const latest = latestBalance(memberId);
          return { _id: memberId, balance: latest?.balance ?? 0, transactionDate: latest?.transactionDate };
        });
      },
    });
  }
  const DeductionSetting = { findOne: async () => ({ amount: 25 }) };
  return { state, Member, Ledger, DeductionSetting };
}

function controller(db) {
  return load('../modules/mortuary/controllers/deductionController', {
    '../../../shared/models/Member': db.Member,
    '../models/Ledger': db.Ledger,
    '../models/DeductionSetting': db.DeductionSetting,
    '../../../shared/services/auditLoggingService': { createAuditLog: async () => {} },
  });
}

test('processAutomaticDeduction posts exactly one debit per member no matter how many times the same deceased-member run is submitted', async () => {
  const db = database([
    { memberId: '001', memberName: 'Member One', phoneNumber: '09171234567', status: 'active' },
    { memberId: '002', memberName: 'Member Two', phoneNumber: '09171234568', status: 'active' },
    { memberId: '003', memberName: 'Inactive Member', phoneNumber: '09171234569', status: 'inactive' },
  ]);
  const { processAutomaticDeduction } = controller(db);
  const req = { body: { deceasedMemberName: 'Juan Dela Cruz', recordedBy: 'forged.operator' }, user: { username: 'treasurer.jane', role: 'treasurer' }, ip: '127.0.0.1', get: () => '' };

  const first = response();
  await processAutomaticDeduction(req, first);
  assert.equal(first.code, 200);
  assert.equal(first.data.data.processedMembers, 2);
  assert.equal(db.state.ledgers.length, 2, 'one ledger row per active member');
  assert.ok(db.state.ledgers.every(row => row.recordedBy === 'treasurer.jane'), 'recordedBy reflects the actual actor');
  const [row1, row2] = first.data.data.deductionResults;
  assert.equal(row1.alreadyProcessed, false);
  assert.equal(row1.newBalance, -25);
  assert.equal(row2.newBalance, -25);

  // Resubmitting the exact same deceased-member run (double-click, retried
  // request after a timeout, a second staff tab) must not create a second
  // debit for either member.
  const second = response();
  await processAutomaticDeduction(req, second);
  assert.equal(second.code, 200);
  assert.equal(db.state.ledgers.length, 2, 'still exactly one ledger row per member after a repeat submission');
  assert.ok(second.data.data.deductionResults.every(row => row.alreadyProcessed === true));
  assert.ok(second.data.data.deductionResults.every(row => row.newBalance === -25), 'reports the balance that was actually posted, not a fresh double-deduction');

  // A deduction for a DIFFERENT deceased member is a distinct run and must
  // still go through — the dedup key must not be so broad it blocks
  // legitimate, unrelated deductions.
  const third = response();
  await processAutomaticDeduction({ ...req, body: { deceasedMemberName: 'Maria Santos' } }, third);
  assert.equal(db.state.ledgers.length, 4, 'a different deceased-member run posts its own new rows');
  assert.ok(third.data.data.deductionResults.every(row => row.alreadyProcessed === false));
});

test('two truly concurrent requests for the same deceased-member run still post exactly one debit per member', async () => {
  // Unlike the sequential retry above (one call fully finishes before the
  // next starts), this fires both calls together via Promise.all. The
  // per-member loop's "check, then maybe save" isn't atomic as a whole —
  // the code comment on autoDeductionId says as much — so this exercises
  // the actual race window: both calls' Ledger.findOne pre-checks can see
  // "nothing posted yet" for the same member before either one's save()
  // commits, which is exactly when the unique-ledgerId 11000 catch has to
  // do the real work instead of the cheap pre-check.
  const db = database([
    { memberId: '001', memberName: 'Member One', status: 'active' },
    { memberId: '002', memberName: 'Member Two', status: 'active' },
  ]);
  const { processAutomaticDeduction } = controller(db);
  const req = { body: { deceasedMemberName: 'Juan Dela Cruz' }, user: { username: 'treasurer.jane' }, ip: '', get: () => '' };

  const first = response();
  const second = response();
  await Promise.all([
    processAutomaticDeduction(req, first),
    processAutomaticDeduction(req, second),
  ]);

  assert.equal(first.code, 200);
  assert.equal(second.code, 200);
  assert.equal(db.state.ledgers.length, 2, 'exactly one ledger row per member, not one per (member, request)');
  // Across the two responses, each member must show as newly processed in
  // exactly one of them and already-processed in the other — never both
  // "newly processed" (that would mean both actually wrote a row).
  for (const memberId of ['001', '002']) {
    const flags = [first, second].map(res => res.data.data.deductionResults.find(row => row.memberId === memberId).alreadyProcessed);
    assert.deepEqual(flags.sort(), [false, true], `member ${memberId} must be newly-processed in exactly one response`);
  }
});

test('processAutomaticDeduction rejects a missing deceased member name and reports per-member failures without aborting the batch', async () => {
  const db = database([{ memberId: '001', memberName: 'Member One', status: 'active' }]);
  const { processAutomaticDeduction } = controller(db);

  const missingName = response();
  await processAutomaticDeduction({ body: {}, user: {}, ip: '', get: () => '' }, missingName);
  assert.equal(missingName.code, 400);
  assert.equal(db.state.ledgers.length, 0);

  // A per-member failure (e.g. a transient DB error on one member's save)
  // is recorded as a row-level error, not a thrown exception that would
  // abort deductions for every other member in the same run.
  const dbWithThrowingSave = database([
    { memberId: '001', memberName: 'Member One', status: 'active' },
    { memberId: '002', memberName: 'Member Two', status: 'active' },
  ]);
  const originalSave = dbWithThrowingSave.Ledger.prototype.save;
  dbWithThrowingSave.Ledger.prototype.save = async function () {
    if (this.memberId === '001') throw new Error('Simulated transient failure');
    return originalSave.call(this);
  };
  const { processAutomaticDeduction: runWithFailure } = controller(dbWithThrowingSave);
  const partial = response();
  await runWithFailure({ body: { deceasedMemberName: 'Juan Dela Cruz' }, user: {}, ip: '', get: () => '' }, partial);
  assert.equal(partial.code, 200);
  assert.equal(partial.data.data.deductionResults.find(row => row.memberId === '001').error, 'Simulated transient failure');
  assert.equal(partial.data.data.deductionResults.find(row => row.memberId === '002').alreadyProcessed, false);
  assert.equal(dbWithThrowingSave.state.ledgers.length, 1, 'the other member was still processed');
});
