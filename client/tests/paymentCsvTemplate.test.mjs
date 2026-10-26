import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildPaymentCsvTemplate, formatPaymentCsvDate } from '../src/utils/paymentCsvTemplate.js';
import { formatManilaDateISO } from '../src/utils/date.js';
const require = createRequire(import.meta.url);
const { parsePaymentCsv } = require('../../server/modules/mortuary/utils/paymentCsv.js');
test('downloaded payment template passes the server validator without changing IDs', () => {
  const csv = buildPaymentCsvTemplate(new Date('2026-10-20T04:00:00Z'));
  assert.ok(csv.includes(',2026-10-20,'));
  const [row] = parsePaymentCsv(csv);
  assert.deepEqual(row.errors, []);
  assert.equal(row.entry.paymentDate, '2026-10-20');
  assert.equal(row.entry.memberId, '000123');
  assert.equal(formatPaymentCsvDate(row.entry.paymentDate), '10-20-2026');
});
test('template dates use Manila time at day and year boundaries', () => {
  assert.equal(formatManilaDateISO(new Date('2026-10-19T16:00:00Z')), '2026-10-20');
  assert.equal(formatManilaDateISO(new Date('2026-12-31T16:00:00Z')), '2027-01-01');
  assert.equal(formatManilaDateISO(new Date('2028-02-29T04:00:00Z')), '2028-02-29');
});
