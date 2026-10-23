const escapeHtml = (value) => String(value ?? '—').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

// Shared by the release confirmation and disbursement report reprint action.
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
          body { margin: 0; background: #eef2ef; color: #202c24; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; }
          .receipt { width: 100%; max-width: 720px; margin: 32px auto; padding: 38px 40px 28px; background: white; border: 1px solid #d8e1da; border-top: 6px solid #245e32; }
          .brand { display: flex; align-items: center; gap: 16px; padding-bottom: 24px; border-bottom: 1px solid #d8e1da; }
          .brand img { width: 68px; height: 68px; object-fit: contain; flex-shrink: 0; }
          .brand h1 { max-width: 400px; margin: 0 0 4px; font-size: 19px; line-height: 1.35; color: #245e32; }
          .brand p { margin: 0; font-size: 12px; color: #59695e; }
          .heading { display: flex; justify-content: space-between; align-items: start; gap: 24px; margin: 28px 0; }
          .eyebrow { margin: 0 0 6px; color: #52685a; font-size: 10px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; }
          h2 { margin: 0; font-size: 25px; line-height: 1.25; letter-spacing: -.5px; }
          .subtitle { margin: 7px 0 0; color: #647169; font-size: 12px; }
          .voucher { min-width: 152px; max-width: 46%; padding: 11px 14px; border: 1px solid #cddacf; background: #f7faf7; }
          .voucher strong { display: block; font-size: 15px; overflow-wrap: anywhere; }
          .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 28px; margin: 0 0 28px; }
          dt { margin-bottom: 4px; color: #67736a; font-size: 11px; }
          dd { margin: 0; font-size: 14px; font-weight: bold; overflow-wrap: anywhere; }
          .amount { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 20px; margin-bottom: 28px; background: #eff6f0; border: 1px solid #c8dccc; border-left: 4px solid #245e32; break-inside: avoid; }
          .amount p { margin: 0; }
          .amount .caption { color: #586c5d; font-size: 11px; }
          .amount strong { color: #245e32; font-size: 30px; line-height: 1.2; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
          h3 { margin: 0 0 8px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #52685a; }
          .acknowledgment { margin: 0; line-height: 1.85; overflow-wrap: anywhere; }
          .remarks { margin-top: 22px; padding-top: 16px; border-top: 1px solid #e0e6e1; }
          .remarks p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 68px; break-inside: avoid; }
          .signature { text-align: center; }
          .signature .name { padding: 0 4px 6px; border-bottom: 1px solid #69786d; font-weight: bold; overflow-wrap: anywhere; }
          .signature p { margin: 6px 0 0; font-size: 11px; color: #647169; }
          .footer { display: flex; justify-content: space-between; gap: 20px; margin-top: 34px; padding-top: 14px; border-top: 1px solid #d8e1da; color: #778078; font-size: 10px; overflow-wrap: anywhere; }
          @media print {
            body { background: white; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .receipt { max-width: none; margin: 0; padding: 24px 28px; }
          }
          @media screen and (max-width: 600px) {
            .receipt { margin: 0; padding: 24px; }
            .heading, .amount { flex-wrap: wrap; }
            .voucher { max-width: 100%; }
            .details { gap: 16px; }
            .signatures { gap: 24px; }
          }
        </style>
      </head>
      <body>
        <main class="receipt">
          <header class="brand">
            <img src="${escapeHtml(logo)}" alt="SVPMPC logo" />
            <div><h1>St. Vincent Parish Multi-Purpose Cooperative</h1><p>Mortuary Aid Fund</p></div>
          </header>
          <div class="heading">
            <div><p class="eyebrow">Claim disbursement</p><h2>Acknowledgment receipt</h2><p class="subtitle">Record of mortuary benefit released</p></div>
            <div class="voucher"><p class="eyebrow">DV number</p><strong>${escapeHtml(payout.dvNumber || '—')}</strong></div>
          </div>
          <dl class="details">
            <div><dt>Deceased member</dt><dd>${escapeHtml(claim.memberName)}</dd></div>
            <div><dt>Beneficiary / recipient</dt><dd>${escapeHtml(claim.beneficiaryName)}</dd></div>
            <div><dt>Claim ID</dt><dd>${escapeHtml(claim.claimId)}</dd></div>
            <div><dt>Release date</dt><dd>${escapeHtml(releaseDate)}</dd></div>
          </dl>
          <section class="amount" aria-label="Amount released">
            <div><p><b>Amount released</b></p><p class="caption">Mortuary benefit paid to the beneficiary</p></div>
            <strong>${escapeHtml(amount)}</strong>
          </section>
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
