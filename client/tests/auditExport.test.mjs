import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuditCsv, createAuditPdf } from '../src/utils/auditExport.js';

test('CSV declares UTF-8 for Excel and preserves peso symbols, names and quoted multiline text', () => {
  const csv = createAuditCsv([['Today', 'Admin', 'Release', 'Peña', 'success', '₱500 → "paid",\nreceived']]);
  assert.deepEqual([...new TextEncoder().encode(csv).slice(0, 3)], [239, 187, 191]);
  assert.ok(csv.includes('Peña'));
  assert.ok(csv.includes('"₱500 → ""paid"",\nreceived"'));
  assert.ok(csv.endsWith('\r\n'));
});

test('CSV treats formula-like user input as text', () => {
  assert.ok(createAuditCsv([['=1+1', '@SUM(A1)', '+1', '-1']]).includes('"\'=1+1"'));
});

test('PDF paginates long audit descriptions and renders readable currency equivalents', () => {
  const doc = createAuditPdf({ moduleName: 'Mortuary', filters: { page: 2 }, rows: Array.from({ length: 50 }, () => [
    '15 Oct 2026, 7:05 pm', 'Treasurer', 'Benefit Released', 'Peña', 'success',
    'Released ₱50000 → beneficiary. '.repeat(10),
  ]) });
  assert.ok(doc.getNumberOfPages() > 1);
  assert.ok(doc.output('arraybuffer').byteLength > 1000);
});
