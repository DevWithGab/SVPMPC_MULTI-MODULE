const test = require('node:test');
const assert = require('node:assert/strict');
const { createLedgerCorrectionService } = require('../modules/mortuary/services/ledgerCorrectionService');
const { decorateLedgerEntries } = require('../modules/mortuary/utils/ledgerCorrections');
const { createLedgerImportService } = require('../modules/mortuary/services/ledgerImportService');
const { validateLedgerEntries } = require('../modules/mortuary/utils/ledgerCsv');
const actor = { userId: 'staff-1', fullName: 'Finance Person', username: 'finance.person', role: 'finance_officer' };
const body = { amount: 100, expectedAmount: 1000, expectedBalance: 1500, reason: 'Entered 1000 instead of 100 on the receipt.' };
function harness({ referenceId = 'OR-1', type = 'contribution' } = {}) {
  const rows = [{ ledgerId: 'original', memberId: 'M1', transactionType: type, credit: 1000, debit: 0, balance: 1000,
    referenceId, transactionDate: new Date('2026-10-20'), createdAt: new Date('2026-10-20'), _id: '1', paymentMethod: 'cash' },
  { ledgerId: 'later', memberId: 'M1', transactionType: 'contribution', credit: 500, debit: 0, balance: 1500, transactionDate: new Date('2026-10-21'), createdAt: new Date('2026-10-21'), _id: '2' }];
  const payments = [{ contributionId: 'original', memberId: 'M1', amount: 1000, status: 'paid', paymentDate: new Date('2026-10-19'), referenceNumber: referenceId }];
  const audits = [];
  const failures = new Set();
  const throwOnce = name => { if (failures.delete(name)) throw new Error(`Synthetic ${name} failure`); };
  const match = (doc, query) => Object.entries(query).every(([key, value]) => {
    if (key === '$or') return value.some(q => match(doc, q));
    const normalize = item => item instanceof Date ? item.toISOString() : item;
    return value?.$in ? value.$in.some(item => normalize(doc[key]) === normalize(item)) : normalize(doc[key]) === normalize(value);
  });
  class Ledger {
    constructor(data) { Object.assign(this, data); }
    async save() {
      throwOnce('ledger');
      if (rows.some(row => row.ledgerId === this.ledgerId || this.correctionOf && row.correctionOf === this.correctionOf)) throw Object.assign(new Error('duplicate'), { code: 11000 });
      this.createdAt = new Date(Date.UTC(2026, 9, 26, 0, 0, rows.length)); this._id = String(rows.length + 1); rows.push(this);
    }
    static async find(query) { return rows.filter(row => match(row, query)); }
    static findOne(query) {
      const found = rows.filter(row => match(row, query));
      return { then: resolve => Promise.resolve(resolve(found[0] || null)), sort: async order => [...found].sort((a, b) => order.createdAt * (a.createdAt - b.createdAt))[0] || null };
    }
    static async updateOne(query, update) {
      throwOnce('complete');
      const row = rows.find(row => match(row, query));
      row.correction.completed = update.$set['correction.completed'];
    }
  }
  const Contribution = {
    findOne: async query => payments.find(row => match(row, query)) || null,
    find: async query => payments.filter(row => match(row, query)),
    updateOne: async (query, update) => {
      throwOnce('payment');
      const row = payments.find(row => match(row, query));
      if (row) Object.assign(row, update.$set || {});
      return { matchedCount: row ? 1 : 0 };
    },
  };
  const AuditLog = { updateOne: async (query, update) => { throwOnce('audit'); if (!audits.some(row => match(row, query))) audits.push(update.$setOnInsert); } };
  const service = createLedgerCorrectionService({ Ledger, Contribution, AuditLog });
  const importer = createLedgerImportService({ Ledger, Contribution, Member: { find: async () => [{ memberId: 'M1' }] }, getLatestBalancesByMember: async () => new Map([['M1', rows.at(-1).balance]]) });
  return { rows, payments, audits, failures, service, importer };
}
const correct = (db, values = body, id = 'original', user = actor) => db.service.correct('M1', id, values, user);

test('correction preserves original values, posts both legs atomically and updates the one payment and audit record', async () => {
  const db = harness(); const original = structuredClone(db.rows[0]);
  const posting = await correct(db);
  assert.deepEqual(db.rows[0], original);
  assert.equal(db.rows[1].balance, 1500);
  assert.equal(posting.credit, 100); assert.equal(posting.debit, 1000); assert.equal(posting.balance, 600);
  assert.equal(db.payments.length, 1); assert.equal(db.payments[0].amount, 100);
  assert.equal(db.payments[0].paymentDate.toISOString(), '2026-10-19T00:00:00.000Z');
  assert.equal(db.audits.length, 1); assert.equal(db.audits[0].userName, 'Finance Person');
  assert.equal(db.audits[0].metadata.reason, body.reason);
  const again = await correct(db); assert.equal(again.ledgerId, posting.ledgerId);
  assert.equal(db.rows.length, 3); assert.equal(db.audits.length, 1);
});

test('saved corrections safely resume after reporting, audit, or completion-marker failures', async () => {
  for (const phase of ['payment', 'audit', 'complete']) {
    const db = harness(); db.failures.add(phase);
    await assert.rejects(correct(db), error => error.status === 503 && error.saved);
    assert.equal(db.rows.at(-1).balance, 600);
    const id = db.rows.at(-1).ledgerId;
    await assert.rejects(correct(db, { ...body, amount: 200, expectedAmount: 100, expectedBalance: 600 }, id), /pending correction/);
    await correct(db, body, 'original', { ...actor, userId: 'another', fullName: 'Another Person' });
    assert.equal(db.rows.length, 3); assert.equal(db.payments[0].amount, 100); assert.equal(db.audits.length, 1);
    assert.equal(db.audits[0].userId, actor.userId); assert.equal(db.rows.at(-1).correction.completed, true);
  }
});

test('a failed ledger save changes no balances or reporting and a retry can complete', async () => {
  const db = harness(); db.failures.add('ledger');
  await assert.rejects(correct(db));
  assert.equal(db.rows.length, 2); assert.equal(db.payments[0].amount, 1000); assert.equal(db.audits.length, 0);
  await correct(db); assert.equal(db.rows.at(-1).balance, 600);
});

test('concurrent duplicate submissions post one correction; competing amounts cannot overwrite it', async () => {
  const db = harness(); await Promise.all([correct(db), correct(db)]);
  assert.equal(db.rows.length, 3);
  await assert.rejects(correct(db, { ...body, amount: 200 }), error => error.status === 409);
  assert.equal(db.payments[0].amount, 100);
});

test('a later correction targets the replacement and preserves the full chain', async () => {
  const db = harness(); const first = await correct(db);
  const next = await correct(db, { ...body, amount: 250, expectedAmount: 100, expectedBalance: 600, reason: 'Receipt was checked again; actual amount is 250.' }, first.ledgerId);
  assert.equal(next.balance, 750); assert.equal(db.payments[0].amount, 250);
  assert.equal(next.correction.rootLedgerId, 'original'); assert.equal(db.audits.length, 2);
  const formatted = db.rows.map(row => ({ id: row.ledgerId, received: row.credit, withdrawn: row.debit, balance: row.balance }));
  const lines = decorateLedgerEntries(formatted, db.rows, db.rows);
  assert.equal(lines.length, 6); assert.equal(lines[0].corrected, true); assert.equal(lines[0].canCorrect, false);
  const replacement = lines.find(row => row.id === next.ledgerId);
  assert.equal(replacement.correctionHistory.length, 2); assert.equal(replacement.canCorrect, true);
  assert.equal(lines.find(row => row.id === `${first.ledgerId}-reversal`).balance, 500);
  assert.equal(lines.reduce((sum, row) => sum + row.received - row.withdrawn, 0), 750);
});

test('rejects invalid amounts/reasons, stale previews, unrelated members, deductions, payouts and non-opening adjustments', async () => {
  for (const values of [{ ...body, amount: 0 }, { ...body, amount: -1 }, { ...body, amount: 1.001 }, { ...body, amount: true }, { ...body, amount: 1000 }, { ...body, reason: 'typo' }, { ...body, reason: 'x'.repeat(501) }]) await assert.rejects(correct(harness(), values), error => error.status === 400);
  for (const values of [{ ...body, expectedAmount: 999 }, { ...body, expectedBalance: 1499 }]) await assert.rejects(correct(harness(), values), error => error.status === 409);
  const db = harness(); await assert.rejects(db.service.correct('OTHER', 'original', body, actor), error => error.status === 404);
  for (const type of ['payout', 'penalty', 'automatic_deduction', 'claim_payout']) await assert.rejects(correct(harness({ type })), error => error.status === 400);
  db.rows[1].transactionType = 'adjustment';
  await assert.rejects(correct(db, { ...body, expectedAmount: 500 }, 'later'), error => error.status === 400);
});

test('opening balance correction affects no payment record; ambiguous or missing payment links are blocked', async () => {
  const db = harness({ type: 'adjustment' }); await correct(db);
  assert.equal(db.payments[0].amount, 1000); assert.equal(db.rows.at(-1).balance, 600);
  const missing = harness(); missing.payments.length = 0;
  await assert.rejects(correct(missing), /safely link/); assert.equal(missing.rows.length, 2);
});

test('original CSV re-uploads remain duplicates; changed references cannot overwrite corrected payments', async () => {
  const db = harness(); await correct(db);
  const source = { memberId: 'M1', transactionDate: '2026-10-20', credit: 1000, debit: 0, transactionType: 'contribution', referenceId: 'OR-1' };
  const old = await db.importer.preview(validateLedgerEntries([source])); assert.equal(old[0].status, 'duplicate');
  const changed = await db.importer.preview(validateLedgerEntries([{ ...source, credit: 100 }])); assert.equal(changed[0].status, 'error');
  assert.match(changed[0].errors.join(' '), /Correct entry/);
  const noRef = harness({ referenceId: null }); await correct(noRef);
  const amended = await noRef.importer.preview(validateLedgerEntries([{ ...source, referenceId: '', credit: 100 }])); assert.equal(amended[0].status, 'duplicate');
});
