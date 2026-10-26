const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
// Unlike the rest of this suite, this file needs a real DB connection (see
// the comment below) — nothing else in package.json's test script loads
// .env, so this file loads it itself.
require('dotenv').config();

// Unlike every other test in this suite, this one connects to the real
// dev database instead of faking Mongoose models. getClaimFinancialTotals
// IS a MongoDB aggregation pipeline ($group/$sum/$ifNull) — the
// financial logic under test lives entirely inside that pipeline, so a
// hand-rolled JS reimplementation of the same grouping to use as a fake
// would risk mirroring the same misunderstanding as any bug in the real
// pipeline, rather than actually catching one. Running the real pipeline
// against real throwaway documents is the only way to prove the actual
// arithmetic (not a JS restatement of it) is correct. Every claim this
// file creates carries a TESTFIN- prefixed claimId so it can never collide
// with or be mistaken for real data, and all of it is deleted in `after`,
// including on a failing assertion.
const { getClaimFinancialTotals } = require('../modules/mortuary/controllers/dashboardController');
const Claim = require('../modules/mortuary/models/Claim');

const PREFIX = 'TESTFIN-';
let claimSeq = 0;

function makeClaim({ totalCollected, payoutAmount } = {}) {
  claimSeq += 1;
  const claimId = `${PREFIX}${claimSeq}-${Date.now()}`;
  return {
    claimId,
    memberId: `${PREFIX}MEM-${claimSeq}`,
    memberName: 'Test Financial Totals Member',
    beneficiaryId: `${PREFIX}BEN-${claimSeq}`,
    beneficiaryName: 'Test Beneficiary',
    beneficiaryRelationship: 'Spouse',
    beneficiaryContact: '09171234567',
    dateOfDeath: new Date('2026-01-01'),
    status: payoutAmount != null ? 'released' : 'deduction_processed',
    ...(totalCollected != null ? { deduction: { totalCollected } } : {}),
    ...(payoutAmount != null ? { payout: { amount: payoutAmount } } : {}),
  };
}

test('getClaimFinancialTotals: real arithmetic against real MongoDB documents', async (t) => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/svpmpc_test');
  t.after(async () => {
    await Claim.deleteMany({ claimId: { $regex: `^${PREFIX}` } });
    await mongoose.disconnect();
  });

  // Isolate every assertion in this test to only its own claims via match,
  // so it's correct even run against a database that already has real
  // claims in it.
  const matchMine = { claimId: { $regex: `^${PREFIX}` } };

  // 1. No claims at all for a given match — must return zero, not throw
  // or return null/NaN from the empty $group result.
  const empty = await getClaimFinancialTotals({ claimId: 'TESTFIN-nonexistent-marker' });
  assert.deepEqual(empty, { totalDeductionsCollected: 0 });

  // 2. Every collected amount counts, whatever the claim's status - including
  // older claims that were released before the release step was removed.
  await Claim.insertMany([
    makeClaim({ totalCollected: 100 }),
    makeClaim({ totalCollected: 50.5 }),
    makeClaim({ totalCollected: 120, payoutAmount: 100 }),
  ]);
  const totals = await getClaimFinancialTotals(matchMine);
  assert.deepEqual(totals, { totalDeductionsCollected: 270.5 });
  await Claim.deleteMany(matchMine);

  // 3. Rounding: sums that don't land on a clean 2-decimal boundary in
  // floating point must still come back rounded to the nearest centavo.
  await Claim.insertMany([
    makeClaim({ totalCollected: 10.1 }),
    makeClaim({ totalCollected: 10.2 }),
    makeClaim({ totalCollected: 10.3 }),
  ]);
  const rounded = await getClaimFinancialTotals(matchMine);
  assert.equal(rounded.totalDeductionsCollected, 30.6, '10.1 + 10.2 + 10.3 must round to exactly 30.6, not a floating-point artifact like 30.599999999999998');
  await Claim.deleteMany(matchMine);

  // 4. The match parameter actually scopes the aggregation — a claim
  // outside the given match must not leak into the totals.
  await Claim.insertMany([
    { ...makeClaim({ totalCollected: 999 }), memberId: `${PREFIX}SCOPE-A` },
    { ...makeClaim({ totalCollected: 1 }), memberId: `${PREFIX}SCOPE-B` },
  ]);
  const scoped = await getClaimFinancialTotals({ memberId: `${PREFIX}SCOPE-A` });
  assert.equal(scoped.totalDeductionsCollected, 999, 'only the matched claim should be counted');
  await Claim.deleteMany(matchMine);

  // Confirm cleanup actually leaves nothing behind for this test's own
  // run, independent of the t.after() hook.
  const remaining = await Claim.countDocuments(matchMine);
  assert.equal(remaining, 0);
});
