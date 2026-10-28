import { createMortuaryReportPdf, loadReportLogo, reportAmount } from '../../../utils/mortuaryReportPdf.js';
import { formatDate } from '../../../utils/date.js';

export function createDeductionSummaryPdf(summary, { logo, generatedAt = new Date() }) {
  return createMortuaryReportPdf({
    title: 'Death Claim Deduction Summary',
    scope: 'Mortuary Aid Fund Program - Completed batch deduction.',
    metadataLabel: 'Batch',
    metadataValue: String(summary.batchId),
    logo,
    generatedAt,
    sections: [
      {
        head: ['Batch details', 'Value'],
        widths: [66, 110],
        body: [
          ['Processed on', summary.processedAt ? formatDate(summary.processedAt) : '-'],
          ['Processed by', summary.processedBy || '-'],
          ['Claims in this batch', String(summary.claimCount)],
          ['Rate per claim (PHP)', reportAmount(summary.ratePerClaim)],
          ['Deduction per member (PHP)', reportAmount(summary.amountPerMember)],
          ['Active members charged', Number(summary.membersCharged).toLocaleString('en-PH')],
        ],
      },
      {
        title: 'Claims covered',
        head: ['#', 'Claim ID', 'Reference number', 'Deceased member', 'Beneficiary', 'Collected (PHP)'],
        widths: [9, 25, 29, 39, 39, 35],
        numberColumns: [0, 5],
        body: summary.claims.map((claim, index) => [
          String(index + 1), claim.claimId, claim.referenceNumber || '-',
          claim.memberName, claim.beneficiaryName || '-', reportAmount(summary.collectedPerClaim),
        ]),
        total: [{ content: 'Total collected (PHP)', colSpan: 5 }, reportAmount(summary.totalCollected)],
      },
      {
        head: ['Prepared by', 'Checked by', 'Approved by'],
        body: [['\n\n____________________', '\n\n____________________', '\n\n____________________']],
      },
    ],
  });
}

export async function printDeductionSummary(summary) {
  // Open during the click event so loading the report logo does not trigger popup blocking.
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Please allow pop-ups to print the deduction summary.');
  printWindow.document.title = 'Preparing deduction summary';
  printWindow.document.body.textContent = 'Preparing deduction summary...';
  try {
    const logo = await loadReportLogo();
    const doc = createDeductionSummaryPdf(summary, { logo });
    doc.autoPrint();
    const url = URL.createObjectURL(doc.output('blob'));
    printWindow.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 300000);
  } catch (error) {
    printWindow.close();
    throw error;
  }
}
