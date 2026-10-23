<<<<<<< Updated upstream
﻿const escapeHtml = (value) => String(value ?? '—').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

// Shared by the release confirmation and disbursement report reprint action.
=======
/* Ginagamit ito ng ClaimsAwaitingRelease (print agad pagkatapos i-release) at
ClaimDisbursementReport (reprint galing history) para isang lugar lang ang
receipt layout. Nag-open ng plain print window - parehong window.open +
document.write pattern na ginagamit sa ibang parte ng app para sa printable
output (hal., QR card printing ng Attendance module). */
>>>>>>> Stashed changes
export const printClaimReceipt = (claim) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const payout = claim.payout || {};
  const amountValue = Number(payout.amount ?? 0);
  const amount = Number.isFinite(amountValue)
    ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amountValue) : '—';
  const date = payout.releasedAt ? new Date(payout.releasedAt) : null;
  const releaseDate = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
  const logo = `${window.location.origin}/SVPMPC-LOGO(MAIN).png`;

  printWindow.document.write(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Disbursement Receipt - ${escapeHtml(claim.claimId)}</title>
        <style>
          @page { size: A4 portrait; margin: 16mm; }
          * { box-sizing: border-box; }
          body { margin: 0; background: white; color: #111; font: 14px/1.6 Arial, Helvetica, sans-serif; }
          .receipt { width: 100%; max-width: 720px; margin: 32px auto; padding: 28px; }
          .brand { display: flex; align-items: center; justify-content: center; gap: 12px; text-align: center; }
          .brand img { width: 48px; height: 54px; object-fit: contain; flex-shrink: 0; }
          .brand h1 { max-width: 490px; margin: 0 0 3px; font-size: 17px; line-height: 1.4; text-transform: uppercase; }
          .brand p { margin: 0; font-size: 14px; }
          .heading { text-align: center; margin: 20px 0 32px; }
          .program { margin: 0 0 8px; color: #303866; font-size: 20px; font-weight: bold; }
          h2 { margin: 0; color: #ae3c40; font-size: 18px; text-transform: uppercase; }
          .details { margin: 0 0 32px; }
          .details > div { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; break-inside: avoid; }
          dt { flex: 0 0 150px; font-weight: bold; }
          dd { flex: 1; min-width: 0; margin: 0; padding: 0 4px 2px; border-bottom: 1px solid #333; overflow-wrap: anywhere; }
          .amount-value { font-weight: bold; font-variant-numeric: tabular-nums; }
          h3 { margin: 0 0 8px; font-size: 14px; }
          .acknowledgment { margin: 0; line-height: 1.85; overflow-wrap: anywhere; }
          .remarks { margin-top: 22px; }
          .remarks p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 68px; break-inside: avoid; }
          .signature { text-align: center; }
          .signature .name { padding: 0 4px 6px; border-bottom: 1px solid #333; font-weight: bold; overflow-wrap: anywhere; }
          .signature p { margin: 6px 0 0; font-size: 12px; }
          .footer { display: flex; justify-content: space-between; gap: 20px; margin-top: 40px; padding-top: 12px; border-top: 1px solid #aaa; font-size: 10px; overflow-wrap: anywhere; }
          @media print {
            body { background: white; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .receipt { max-width: none; margin: 0; padding: 24px 28px; }
          }
          @media screen and (max-width: 600px) {
            .receipt { margin: 0; padding: 24px; }
            dt { flex-basis: 120px; }
            .signatures { gap: 24px; }
          }
        </style>
      </head>
      <body>
        <main class="receipt">
          <header class="brand">
            <img src="${escapeHtml(logo)}" alt="SVPMPC logo" />
            <div><h1>St. Vincent Parish Multi-Purpose Cooperative</h1><p>Dupax del Sur, Nueva Vizcaya</p></div>
          </header>
          <div class="heading">
            <p class="program">MORTUARY AID FUND PROGRAM</p>
            <h2>Acknowledgment receipt</h2>
          </div>
          <dl class="details">
            <div><dt>DV number:</dt><dd>${escapeHtml(payout.dvNumber || '—')}</dd></div>
            <div><dt>Deceased member:</dt><dd>${escapeHtml(claim.memberName)}</dd></div>
            <div><dt>Beneficiary:</dt><dd>${escapeHtml(claim.beneficiaryName)}</dd></div>
            <div><dt>Claim ID:</dt><dd>${escapeHtml(claim.claimId)}</dd></div>
            <div><dt>Release date:</dt><dd>${escapeHtml(releaseDate)}</dd></div>
            <div><dt>Amount released:</dt><dd class="amount-value">${escapeHtml(amount)}</dd></div>
          </dl>
          <section>
            <h3>Acknowledgment</h3>
            <p class="acknowledgment">I, <strong>${escapeHtml(claim.beneficiaryName)}</strong>, acknowledge receipt of <strong>${escapeHtml(amount)}</strong> from St. Vincent Parish Multi-Purpose Cooperative as the mortuary benefit for <strong>${escapeHtml(claim.memberName)}</strong>, under the claim and disbursement voucher stated above.</p>
          </section>
          ${payout.remarks ? `<section class="remarks"><h3>Remarks</h3><p>${escapeHtml(payout.remarks)}</p></section>` : ''}
          <div class="signatures">
            <div class="signature"><div class="name">${escapeHtml(claim.beneficiaryName || '________________________')}</div><p>Beneficiary signature over printed name</p><p>Received by</p></div>
            <div class="signature"><div class="name">${escapeHtml(payout.releasedBy || '________________________')}</div><p>Authorized releasing officer</p><p>Released by</p></div>
          </div>
          <footer class="footer"><span>SVPMPC · Mortuary Aid Fund</span><span>Claim reference: ${escapeHtml(claim.claimId)}</span></footer>
        </main>
        <script>window.addEventListener('load', () => { document.fonts.ready.then(() => { setTimeout(() => window.print(), 250); }); }, { once: true });</script>
      </body>
    </html>`);
  printWindow.document.close();
};
