import { peso, shortDate } from './claimWorkflowUtils';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/* Printable summary ng isang batch deduction - parehong window.open +
document.write pattern ng printed notices, para may papel na kopya ang JV. */
export const printDeductionSummary = (summary) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const logoUrl = `${window.location.origin}/SVPMPC-LOGO(MAIN).png`;
  const rows = summary.claims.map((claim, index) => `
    <tr><td>${index + 1}</td><td>${esc(claim.claimId)}</td><td>${esc(claim.memberName)}</td><td>${esc(claim.beneficiaryName)}</td><td class="num">${esc(peso(summary.collectedPerClaim))}</td></tr>`).join('');
  printWindow.document.write(`
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Deduction summary - JV ${esc(summary.jvNumber)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; font-size: 12px; }
          header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #245e32; padding-bottom: 12px; }
          header img { width: 48px; height: 48px; }
          h1 { font-size: 16px; margin: 0; } h2 { font-size: 14px; margin: 20px 0 8px; }
          dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 16px 0; }
          dt { color: #475569; } dd { margin: 0; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
          th { background: #f1f5f9; } .num { text-align: right; }
          tfoot td { font-weight: bold; }
          .signatures { display: flex; gap: 48px; margin-top: 48px; }
          .signatures div { flex: 1; border-top: 1px solid #0f172a; padding-top: 4px; text-align: center; }
        </style>
      </head>
      <body>
        <header><img src="${esc(logoUrl)}" alt="" /><div><h1>St. Vincent Parish Multi-Purpose Cooperative</h1><div>Mortuary Aid Fund Program - Death claim deduction summary</div></div></header>
        <dl>
          <dt>JV number</dt><dd>${esc(summary.jvNumber)}</dd>
          <dt>Processed on</dt><dd>${esc(shortDate(summary.processedAt))}</dd>
          <dt>Processed by</dt><dd>${esc(summary.processedBy)}</dd>
          <dt>Claims in this batch</dt><dd>${esc(summary.claimCount)}</dd>
          <dt>Rate per claim</dt><dd>${esc(peso(summary.ratePerClaim))}</dd>
          <dt>Deduction per member</dt><dd>${esc(peso(summary.amountPerMember))}</dd>
          <dt>Active members charged</dt><dd>${esc(Number(summary.membersCharged).toLocaleString())}</dd>
        </dl>
        <h2>Claims</h2>
        <table>
          <thead><tr><th>#</th><th>Claim ID</th><th>Deceased member</th><th>Beneficiary</th><th class="num">Collected</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="4">Total collected</td><td class="num">${esc(peso(summary.totalCollected))}</td></tr></tfoot>
        </table>
        <div class="signatures"><div>Prepared by</div><div>Checked by</div><div>Approved by</div></div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};
