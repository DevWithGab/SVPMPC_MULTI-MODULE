import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { createMemberLedgerPdf, LEDGER_HEADERS, outputMemberLedgerPdf } from '../src/utils/memberLedgerPdf.js';

const member = { name: 'Juan Dela Cruz', address: 'Dupax del Sur, Nueva Vizcaya', beneficiaries: 'Maria Dela Cruz' };
const entry = { date: '2026-10-22', ref_no: 'OR-2026-000000123456789', received: 100, withdrawn: 0, balance: -250.5 };

test('ledger form fills member details and preserves full references and signed amounts', () => {
  const doc = createMemberLedgerPdf(member, [entry]);
  assert.equal(doc.getNumberOfPages(), 1);
  assert.deepEqual(doc.lastAutoTable.head[0].cells[1].text, ['OR/DV', 'Number']);
  const cells = doc.lastAutoTable.body[0].cells;
  assert.equal(cells[0].text.join(''), '22/10/2026');
  assert.equal(cells[1].text.join(''), entry.ref_no);
  assert.equal(cells[2].text.join(''), '100.00');
  assert.equal(cells[3].text.join(''), '');
  assert.equal(cells[4].text.join(''), '-250.50');
  const content = doc.output();
  for (const text of ['MUTUAL ASSISTANCE FUND', member.name, member.address, member.beneficiaries, 'Full transaction history']) assert.ok(content.includes(text));
  assert.ok(doc.lastAutoTable.body.length > 20, 'short ledgers retain the blank ruled rows of the cooperative form');
});

test('long ledgers repeat the form and keep all rows across continuation pages', () => {
  const entries = Array.from({ length: 80 }, (_, index) => ({ ...entry, ref_no: `OR-${index}` }));
  const doc = createMemberLedgerPdf(member, entries, { filtered: true });
  assert.ok(doc.getNumberOfPages() >= 3);
  assert.equal(doc.lastAutoTable.body.length, entries.length);
  for (const page of doc.internal.pages.slice(1)) {
    const content = page.join('\n');
    for (const text of ['MUTUAL ASSISTANCE FUND', member.name, 'OR/DV', 'Filtered transactions']) assert.ok(content.includes(text));
  }
  assert.ok(doc.lastAutoTable.finalY < 800);
});

test('empty ledgers produce a blank form with beneficiary names and no fabricated transactions', () => {
  const doc = createMemberLedgerPdf({ ...member, beneficiaries: [{ name: 'Maria Dela Cruz' }, { beneficiaryName: 'Pedro Dela Cruz' }] }, []);
  assert.equal(LEDGER_HEADERS.length, 5);
  assert.ok(doc.output().includes('Maria Dela Cruz, Pedro Dela Cruz'));
  for (const row of doc.lastAutoTable.body) {
    for (const cell of Object.values(row.cells)) assert.equal(cell.text.join(''), '');
  }
});

test('download saves the ledger and print opens the same form with a print action', async (t) => {
  let saved;
  let printed;
  const popup = { location: { href: '' }, close() {} };
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  const originalSave = jsPDF.API.save;
  jsPDF.API.save = function (filename) { saved = { filename, content: this.output() }; };
  t.after(() => {
    if (originalSave === undefined) delete jsPDF.API.save;
    else jsPDF.API.save = originalSave;
  });
  t.mock.method(window, 'open', () => popup);
  t.mock.method(URL, 'createObjectURL', blob => { printed = blob; return 'blob:ledger-print'; });
  t.mock.method(globalThis, 'setTimeout', () => 0);
  await outputMemberLedgerPdf(member, [entry]);
  assert.equal(saved.filename, 'Juan-Dela-Cruz-Mortuary-Ledger.pdf');
  assert.ok(saved.content.includes('MUTUAL ASSISTANCE FUND'));
  await outputMemberLedgerPdf(member, [entry], { print: true });
  assert.equal(popup.location.href, 'blob:ledger-print');
  const content = await printed.text();
  assert.ok(content.includes('MUTUAL ASSISTANCE FUND'));
  assert.ok(content.includes('/Print'));
});
