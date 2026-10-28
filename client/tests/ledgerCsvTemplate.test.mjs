import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildLedgerCsvTemplate } from '../src/utils/ledgerCsvTemplate.js';
const require = createRequire(import.meta.url);
const { parseLedgerCsv } = require('../../server/modules/mortuary/utils/ledgerCsv.js');

test('simplified ledger template imports with defaults and preserves passbook numbers and references', () => {
  const csv = buildLedgerCsvTemplate(new Date('2026-10-28T17:00:00Z'));
  assert.equal(csv.split('\r\n')[0], 'Passbook No.,transactionDate,credit,debit,referenceId');
  const [credit, debit, duplicate] = parseLedgerCsv(csv +
    '000123,2026-10-29,0.00,25.00,WITHDRAWAL-001\r\n' +
    '000123,2026-10-29,100.00,0.00,RECEIPT-001\r\n');
  assert.equal(credit.status, 'ready');
  assert.deepEqual(credit.errors, []);
  assert.equal(credit.entry.memberId, '000123');
  assert.equal(credit.entry.referenceId, 'RECEIPT-001');
  assert.equal(credit.entry.transactionDate, '2026-10-29');
  assert.equal(credit.entry.transactionType, 'contribution');
  assert.equal(credit.entry.paymentMethod, 'cash');
  assert.equal(credit.entry.description, 'Bulk upload');
  assert.equal(debit.status, 'ready');
  assert.equal(debit.entry.transactionType, 'payout');
  assert.equal(duplicate.status, 'duplicate');
});
