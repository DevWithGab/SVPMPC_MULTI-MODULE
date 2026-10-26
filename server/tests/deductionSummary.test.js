const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
// Like claimFinancialTotals.test.js, this runs the real aggregation pipeline
// against a real database: the month grouping lives entirely inside MongoDB,
// so a JS fake would only restate it. Every claim carries a TESTSUM- prefixed
// claimId and the search parameter scopes the endpoint to them; all of it is
// deleted in `after`.
require('dotenv').config();

const { listDeductionSummary } = require('../modules/mortuary/controllers/treasurerClaimController');
const Claim = require('../modules/mortuary/models/Claim');

const PREFIX = `TESTSUM-${Date.now()}-`;
let seq = 0;
const claim = ({ batchId, jvNumber, processedAt, collected, rate = 25, members = 4 }) => {
  seq += 1;
  return {
    claimId: `${PREFIX}${seq}`,
    memberId: `${PREFIX}MEM-${seq}`,
    memberName: `Test Deceased ${seq}`,
    beneficiaryId: `${PREFIX}BEN-${seq}`,
    beneficiaryName: `Test Beneficiary ${seq}`,
    beneficiaryRelationship: 'Spouse',
    beneficiaryContact: '09171234567',
    dateOfDeath: new Date('2026-10-01'),
    status: 'deduction_processed',
    deduction: { batchId, jvNumber, processedAt, amountPerMember: rate, membersCharged: members, totalCollected: collected, processedBy: 'tester' },
  };
};
const run = async (query) => {
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await listDeductionSummary({ query }, res);
  return res;
};

test('deduction summary groups each month\'s claims with their details', async (t) => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/svpmpc_test');
  t.after(async () => {
    await Claim.deleteMany({ claimId: { $regex: `^${PREFIX}` } });
    await mongoose.disconnect();
  });

  await Claim.insertMany([
    // An October batch of two claims under one reference number.
    claim({ batchId: `${PREFIX}B1`, jvNumber: 'JV-OCT', processedAt: new Date('2026-10-31T09:00:00+08:00'), collected: 100 }),
    claim({ batchId: `${PREFIX}B1`, jvNumber: 'JV-OCT', processedAt: new Date('2026-10-31T09:00:00+08:00'), collected: 100 }),
    // A September batch, and an older claim processed before batches existed.
    claim({ batchId: `${PREFIX}B2`, jvNumber: 'JV-SEP', processedAt: new Date('2026-09-30T10:00:00+08:00'), collected: 75, members: 3 }),
    claim({ jvNumber: 'OLD-1', processedAt: new Date('2026-09-02T10:00:00+08:00'), collected: 50, members: 2 }),
    // Processed at 00:30 Manila time on Nov 1 = Oct 31 in UTC; must count as November.
    claim({ batchId: `${PREFIX}B3`, jvNumber: 'JV-NOV', processedAt: new Date('2026-11-01T00:30:00+08:00'), collected: 40 }),
  ]);

  const res = await run({ search: PREFIX });
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.totals, { totalCollected: 365, claimCount: 5, batchCount: 4 });
  assert.deepEqual(res.body.data.map(m => [m.month, m.batchCount, m.claimCount, m.totalCollected]), [
    ['2026-11', 1, 1, 40],
    ['2026-10', 1, 2, 200],
    ['2026-09', 2, 2, 125],
  ]);

  const october = res.body.data[1];
  assert.equal(october.claims.length, 2);
  const [first] = october.claims;
  assert.equal(first.jvNumber, 'JV-OCT');
  assert.equal(first.ratePerClaim, 25);
  assert.equal(first.membersCharged, 4);
  assert.equal(first.totalCollected, 100);
  assert.ok(first.memberName && first.beneficiaryName && first.dateOfDeath && first.processedAt);

  // A month filter returns only that month, with each claim's filing details.
  const onlyOct = await run({ search: PREFIX, month: '2026-10' });
  assert.deepEqual(onlyOct.body.data.map(m => m.month), ['2026-10']);
  assert.equal(onlyOct.body.totals.totalCollected, 200);
  assert.equal(onlyOct.body.data[0].claims[0].beneficiaryRelationship, 'Spouse');
  assert.equal(onlyOct.body.data[0].claims[0].batchId, `${PREFIX}B1`);
  // A malformed month is ignored rather than passed into the query.
  const bad = await run({ search: PREFIX, month: { $ne: null } });
  assert.equal(bad.body.data.length, 3);

  // Search by reference number narrows the months to the matching claims.
  const sep = await run({ search: 'JV-SEP' });
  const mine = sep.body.data.filter(m => m.claims.some(c => c.claimId.startsWith(PREFIX)));
  assert.equal(mine.length, 1);
  assert.equal(mine[0].month, '2026-09');
});
