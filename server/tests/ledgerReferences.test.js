const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { resolveLedgerPaymentReferences } = require('../modules/mortuary/utils/ledgerReferences');

const id = letter => `CSV-${letter.repeat(64)}`;
const entry = (letter, memberId = '001') => ({ ledgerId: id(letter), referenceId: id(letter), memberId, transactionType: 'contribution' });
const paymentModel = rows => ({ find: () => ({ select: () => ({ lean: async () => rows }) }) });

test('legacy references resolve from reservations or contribution history without changing ledger records', async () => {
  const entries = [entry('a'), entry('b'), entry('c'), entry('d')];
  const references = await resolveLedgerPaymentReferences(entries, {
    PaymentImport: paymentModel([
      { _id: id('a'), memberId: '001', referenceNumber: '000123' },
      { _id: id('c'), memberId: 'OTHER', referenceNumber: 'WRONG-MEMBER' },
    ]),
    Contribution: paymentModel([{ contributionId: id('b'), memberId: '001', referenceNumber: 'OR-2026-002' }]),
  });
  assert.equal(references.get(id('a')), '000123');
  assert.equal(references.get(id('b')), 'OR-2026-002');
  assert.equal(references.has(id('c')), false);
  assert.equal(references.has(id('d')), false);
  assert.equal(entries[0].referenceId, id('a'), 'display does not rewrite the stored ledger');
});

test('normal receipt numbers, manual entries and deduction references do not trigger legacy lookups', async () => {
  const forbidden = { find() { throw new Error('Unexpected payment lookup'); } };
  const references = await resolveLedgerPaymentReferences([
    { ...entry('a'), referenceId: 'OR-123' },
    { ...entry('b'), transactionType: 'automatic_deduction' },
    { ledgerId: 'MANUAL-123', referenceId: 'MANUAL-123', transactionType: 'contribution' },
  ], { Contribution: forbidden, PaymentImport: forbidden });
  assert.equal(references.size, 0);
});

test('both ledger APIs return the original CSV receipt for already imported payments', async () => {
  const stored = { ...entry('a'), transactionDate: new Date('2026-10-21'), credit: 100, debit: 0, balance: 100, description: 'CSV contribution' };
  const filename = require.resolve('../modules/mortuary/controllers/ledgerController');
  const localRequire = createRequire(filename);
  const dependencies = {
    '../models/Ledger': {
      countDocuments: async () => 1,
      find() {
        const query = Promise.resolve([stored]);
        query.sort = query.skip = query.limit = () => query;
        return query;
      },
    },
    '../../../shared/models': { Member: { findOne: async () => ({ memberName: 'Member One' }) } },
    '../models/Contribution': paymentModel([]),
    '../models/PaymentImport': paymentModel([{ _id: id('a'), memberId: '001', referenceNumber: '000123' }]),
    '../utils/ledgerBalance': { getLatestBalance: async () => 100 },
  };
  const context = { module: { exports: {} }, console, require: name => dependencies[name] || localRequire(name) };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  for (const action of ['getMemberLedger', 'getAllLedger']) {
    const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; } };
    await context.module.exports[action]({ params: { memberId: '001' }, query: {} }, res);
    assert.equal(res.code, 200);
    assert.equal(res.data.data[0].ref_no, '000123');
    assert.equal(res.data.data[0].id, id('a'));
    assert.equal(res.data.data[0].balance, 100);
  }
  assert.equal(stored.referenceId, id('a'));
});
