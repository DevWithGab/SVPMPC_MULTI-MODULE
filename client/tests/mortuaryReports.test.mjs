import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createMortuaryReportPdf, negativeBalanceMembers, reportAmount } from '../src/utils/mortuaryReportPdf.js';

const logo = new Uint8Array(readFileSync(new URL('../public/SVPMPC-LOGO(MAIN).png', import.meta.url)));
const options = { logo, generatedAt: new Date('2026-10-05T03:00:00Z') };
function reviewFile(name, doc) {
  if (!process.env.REPORT_QA_DIR) return;
  mkdirSync(process.env.REPORT_QA_DIR, { recursive: true });
  writeFileSync(resolve(process.env.REPORT_QA_DIR, name + '.pdf'), Buffer.from(doc.output('arraybuffer')));
}

test('negative balances include all statuses, exclude zero/invalid values, and rank largest shortfall first', () => {
  const members = [
    { memberId: '001', memberName: 'One', balance: '-250.50', status: 'inactive' },
    { id: '002', name: 'Two', currentBalance: -1000, balance: 100, status: 'active' },
    { id: '003', currentBalance: 0 }, { id: '004', currentBalance: 10 },
    { id: '005' }, { id: '006', currentBalance: 'invalid' },
    { id: '007', currentBalance: -100, status: 'deceased' },
  ];
  const result = negativeBalanceMembers(members);
  assert.deepEqual(result.map(member => member.id), ['002', '001', '007']);
  assert.equal(result.reduce((sum, member) => sum - member.balance, 0), 1350.50);
  assert.equal(reportAmount(-250.5), '-250.50');
  assert.equal(reportAmount(1234567.8), '1,234,567.80');
  assert.equal(members[0].memberId, '001');
});

test('branded PDF paginates all 205 rows and retains the final record', () => {
  const body = Array.from({ length: 205 }, (_, index) => [
    '05 Oct 2026', `MEM-${String(index + 1).padStart(4, '0')}`,
    index % 9 === 0 ? 'Maria Lourdes de la Cruz Santos' : `Sample member ${index + 1}`,
    reportAmount(1250.5 + index), 'Paid',
  ]);
  const doc = createMortuaryReportPdf({ ...options, title: 'Contributions', scope: 'All recorded contributions. 205 payments.',
    sections: [{ head: ['Payment date', 'Member ID', 'Member name', 'Amount (PHP)', 'Status'], widths: [28, 30, 62, 32, 24], numberColumns: [3], body }] });
  assert.ok(doc.getNumberOfPages() > 1);
  assert.equal(doc.lastAutoTable.body.length, 205);
  assert.deepEqual(doc.lastAutoTable.body.at(-1).cells[1].text, ['MEM-0205']);
  assert.ok(Object.keys(doc.internal.collections.addImage_images).length > 0);
  reviewFile('contributions', doc);
});

test('negative balance report renders a summary, wrapped names, full list and total', () => {
  const body = Array.from({ length: 28 }, (_, index) => [
    `MEM-${String(index + 1).padStart(4, '0')}`,
    index % 3 === 0 ? 'Maria Concepcion del Rosario Villanueva' : `Sample member ${index + 1}`,
    index % 4 === 0 ? 'Barangay San Vicente de Paul' : 'San Vicente',
    index % 2 ? 'inactive' : 'active', reportAmount(-1000 + index * 25),
  ]);
  const total = body.reduce((sum, row, index) => sum + 1000 - index * 25, 0);
  const doc = createMortuaryReportPdf({ ...options, title: 'Negative Balances',
    scope: 'Current posted balances below zero, across all member statuses. Largest shortfall first.',
    sections: [
      { title: 'Balance overview', head: ['Particulars', 'Value'], widths: [125, 51], numberColumns: [1], body: [['Members with negative balances', '28'], ['Total shortfall to zero (PHP)', reportAmount(total)]] },
      { title: 'Members with negative balances', head: ['Member ID', 'Member name', 'Barangay', 'Status', 'Balance (PHP)'], widths: [28, 55, 37, 23, 33], numberColumns: [4], body, total: ['Total balance', '', '', '', reportAmount(-total)] },
    ] });
  assert.equal(doc.lastAutoTable.body.length, 28);
  assert.equal(doc.lastAutoTable.foot.length, 1);
  reviewFile('negative-balances', doc);
});

test('empty report remains explicit and a missing logo cannot silently produce an unbranded report', () => {
  assert.throws(() => createMortuaryReportPdf({ title: 'Test', sections: [] }), /logo/);
  const doc = createMortuaryReportPdf({ ...options, title: 'Negative Balances', scope: 'Current posted balances below zero.',
    sections: [{ head: ['Member ID', 'Member name', 'Balance (PHP)'], body: [], emptyMessage: 'No members have a negative balance.' }] });
  assert.equal(doc.getNumberOfPages(), 1);
  assert.equal(doc.lastAutoTable.body[0].cells[0].colSpan, 3);
  reviewFile('empty-negative-balances', doc);
});

test('financial summary uses separate financial-position and period tables', () => {
  const doc = createMortuaryReportPdf({ ...options, title: 'Financial Summary', scope: 'All recorded transactions. Monthly breakdown.',
    sections: [
      { title: 'Financial position', head: ['Particulars', 'Amount (PHP)'], widths: [125, 51], numberColumns: [1],
        body: [['Total fund balance', '1,250,000.00'], ['Contributions collected', '1,600,000.00'], ['Deductions collected', '320,000.00'], ['Payouts released', '300,000.00']] },
      { title: 'Monthly breakdown', head: ['Month', 'Contributions', 'Deductions', 'Payouts', 'Net'], widths: [38, 35, 35, 34, 34], numberColumns: [1, 2, 3, 4],
        body: [['September 2026', '125,000.00', '52,000.00', '50,000.00', '127,000.00'], ['August 2026', '100,000.00', '49,000.00', '49,000.00', '100,000.00']] },
    ] });
  assert.equal(doc.getNumberOfPages(), 1);
  assert.equal(doc.lastAutoTable.head[0].cells[4].styles.halign, 'right');
  reviewFile('financial-summary', doc);
});
