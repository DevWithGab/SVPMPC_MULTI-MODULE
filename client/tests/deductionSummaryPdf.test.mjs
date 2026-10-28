import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createDeductionSummaryPdf } from '../src/components/mortuary/treasurer/deductionSummary.js';

const logo = new Uint8Array(readFileSync(new URL('../public/SVPMPC-LOGO-PRINT.png', import.meta.url)));
for (const count of [2, 60]) {
  test(`deduction report retains ${count} claims, totals and signature fields`, () => {
    const doc = createDeductionSummaryPdf({
      batchId: 'BATCH-20261028-001', processedAt: '2026-10-28T03:00:00Z', processedBy: 'Sample Treasurer',
      claimCount: count, ratePerClaim: 100, amountPerMember: count * 100, membersCharged: 150,
      collectedPerClaim: 15000, totalCollected: count * 15000,
      claims: Array.from({length: count}, (_, i) => ({claimId: `CLM-${i + 1}`, referenceNumber: `JV-${i + 1}`, memberName: 'Maria Concepcion del Rosario Villanueva', beneficiaryName: 'Juan Miguel de la Cruz Santos'})),
    }, {logo, generatedAt: new Date('2026-10-28T04:00:00Z')});
    const text = doc.internal.pages.slice(1).map(page => page.join('\n')).join('\n');
    for (const page of doc.internal.pages.slice(1)) {
      assert.ok(page.join('\n').includes('SAINT VINCENT PARISH'));
      assert.ok(page.join('\n').includes('Death Claim Deduction Summary'));
    }
    for (const expected of ['SAINT VINCENT PARISH', 'Death Claim Deduction Summary', `CLM-${count}`, 'Total collected', count === 2 ? '30,000.00' : '900,000.00', 'Prepared by', 'Checked by', 'Approved by', `Page ${doc.getNumberOfPages()} of ${doc.getNumberOfPages()}`]) {
      assert.ok(text.includes(expected), `Missing ${expected}`);
    }
    if (count === 60) assert.ok(doc.getNumberOfPages() > 1);
    if (process.env.DEDUCTION_QA_DIR) {
      mkdirSync(process.env.DEDUCTION_QA_DIR, {recursive: true});
      writeFileSync(`${process.env.DEDUCTION_QA_DIR}/deduction-summary-${count}.pdf`, Buffer.from(doc.output('arraybuffer')));
    }
  });
}
