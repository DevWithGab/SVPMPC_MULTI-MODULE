// Shared by ClaimsAwaitingRelease (print right after releasing) and
// ClaimDisbursementReport (reprint from history) so the receipt layout only
// lives in one place. Opens a plain print window — same window.open +
// document.write pattern used elsewhere in the app for printable output
// (e.g. the Attendance module's QR card printing).
export const printClaimReceipt = (claim) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const payout = claim.payout || {};
  const amount = payout.amount?.toLocaleString?.() ?? payout.amount ?? '0';
  const releaseDate = payout.releasedAt ? new Date(payout.releasedAt).toLocaleDateString() : '—';

  printWindow.document.write(`
    <html>
      <head>
        <title>Disbursement Receipt - ${claim.claimId}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; }
          .receipt { max-width: 560px; margin: 0 auto; border: 2px solid #2D7A3E; border-radius: 12px; padding: 32px; }
          .header { text-align: center; margin-bottom: 24px; }
          .header h1 { color: #2D7A3E; font-size: 20px; margin: 0 0 4px; }
          .header p { color: #64748b; font-size: 12px; margin: 0; }
          .title { text-align: center; font-size: 16px; font-weight: bold; letter-spacing: 0.05em; margin: 20px 0; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          td { padding: 8px 0; font-size: 14px; vertical-align: top; }
          td.label { color: #64748b; width: 45%; }
          td.value { font-weight: 600; color: #0f172a; }
          .amount-row td { border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 14px 0; }
          .amount-row .value { font-size: 20px; color: #2D7A3E; }
          .remarks { font-size: 13px; color: #475569; margin-bottom: 24px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 48px; }
          .sig-block { width: 45%; text-align: center; }
          .sig-line { border-top: 1px solid #0f172a; margin-bottom: 6px; padding-top: 4px; }
          .sig-label { font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>St. Vincent Parish Multi-Purpose Cooperative</h1>
            <p>Mortuary Aid Fund — Claim Disbursement</p>
          </div>
          <div class="title">Acknowledgment Receipt</div>
          <table>
            <tr><td class="label">DV Number</td><td class="value">${payout.dvNumber || '—'}</td></tr>
            <tr><td class="label">Claim ID</td><td class="value">${claim.claimId}</td></tr>
            <tr><td class="label">Deceased Member</td><td class="value">${claim.memberName}</td></tr>
            <tr><td class="label">Beneficiary / Recipient</td><td class="value">${claim.beneficiaryName}</td></tr>
            <tr class="amount-row"><td class="label">Amount Released</td><td class="value">&#8369;${amount}</td></tr>
            <tr><td class="label">Release Date</td><td class="value">${releaseDate}</td></tr>
            <tr><td class="label">Released By</td><td class="value">${payout.releasedBy || '—'}</td></tr>
          </table>
          ${payout.remarks ? `<p class="remarks"><strong>Remarks:</strong> ${payout.remarks}</p>` : ''}
          <div class="signatures">
            <div class="sig-block">
              <div class="sig-line">&nbsp;</div>
              <div class="sig-label">Beneficiary Signature</div>
            </div>
            <div class="sig-block">
              <div class="sig-line">&nbsp;</div>
              <div class="sig-label">Released By</div>
            </div>
          </div>
        </div>
        <script>setTimeout(() => window.print(), 400);</script>
      </body>
    </html>
  `);
};
