import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseCsvDate } from '../src/utils/csvDate.js';
import { parseMemberUpload } from '../src/utils/memberBulkUpload.js';
const require = createRequire(import.meta.url);
const { parseCsvDate: serverDate } = require('../../server/shared/utils/csvDate.js');
const { parseLedgerCsv } = require('../../server/modules/mortuary/utils/ledgerCsv.js');
const { parsePaymentCsv } = require('../../server/modules/mortuary/utils/paymentCsv.js');

test('browser and server accept explicit dates and enforce calendar validity without rollover', () => {
  const cases = [
    ['2026-03-04','auto','2026-03-04'], ['2026/3/4','auto','2026-03-04'],
    ['March 4, 2026','auto','2026-03-04'], ['4 Mar 2026','auto','2026-03-04'],
    ['4-March-2026','auto','2026-03-04'], ['13/03/2026','auto','2026-03-13'],
    ['03/13/2026','auto','2026-03-13'], ['03.04.2026','mdy','2026-03-04'],
    ['03.04.2026','dmy','2026-04-03'], ['03/03/2026','auto','2026-03-03'],
    ['2028-02-29','auto','2028-02-29'],
  ];
  for (const [input, order, value] of cases) {
    assert.deepEqual(parseCsvDate(input, order), {value}, input);
    assert.deepEqual(serverDate(input, order), {value}, input);
  }
  for (const input of ['03/04/2026','2026-02-29','February 30, 2026','2026-04-31','00/12/2026','13/13/2026','04/03/26','2026-03-04T01:00:00Z','45000','March 2026','foo','']) {
    assert.ok(parseCsvDate(input).error, input);
    assert.deepEqual(serverDate(input), parseCsvDate(input));
  }
  assert.match(serverDate('03/04/2026').error, /Ambiguous/);
  assert.ok(serverDate('2026-03-04', 'invalid').error);
});

test('ledger and payment imports normalize before duplicate matching and return physical row errors', () => {
  const ledger = 'Passbook No.,transactionDate,credit,debit,referenceId\n0001,2026-03-04,100,0,OR1\n0001,"March 4, 2026",100,0,OR1';
  const rows = parseLedgerCsv(ledger);
  assert.equal(rows[1].status, 'duplicate');
  assert.equal(rows[1].entry.transactionDate, '2026-03-04');
  const invalid = parseLedgerCsv(ledger.replace('2026-03-04','03/04/2026'));
  assert.equal(invalid[0].row, 2);
  assert.match(invalid[0].errors.join(' '), /Ambiguous/);
  const payments = 'member_id,amount,payment_date,reference_number\n0001,100,03/04/2026,OR1';
  assert.match(parsePaymentCsv(payments)[0].errors.join(' '), /Ambiguous/);
  assert.equal(parsePaymentCsv(payments, 'dmy')[0].entry.paymentDate, '2026-04-03');
  assert.equal(parsePaymentCsv(payments, 'mdy')[0].entry.paymentDate, '2026-03-04');
});

test('member preview and submitted birth dates match, with row-specific invalid date errors', () => {
  const csv = 'memberName,barangay,address,dateOfBirth\nMaria,Centro,Street,03/04/1970';
  assert.throws(() => parseMemberUpload(csv), /Row 2, dateOfBirth: Ambiguous/);
  const result = parseMemberUpload(csv, 'dmy');
  assert.equal(result.members[0].dateOfBirth, '1970-04-03');
  assert.equal(result.preview[0].dateOfBirth, '1970-04-03');
  assert.throws(() => parseMemberUpload(csv.replace('03/04/1970','1970-02-30')), /Row 2.*Invalid date/);
});
