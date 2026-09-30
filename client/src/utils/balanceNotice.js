// Balance-threshold notices — shared between the per-member "Print Notice"
// action on the Member Ledger and the bulk "print all by threshold" action
// on Member Balances, so both stay on the same thresholds and letter
// template instead of drifting apart.
//
// The minimum sustaining balance for the Mortuary Aid Fund is ₱1,000. A
// member below that gets one of three escalating paper notices depending
// on how far below it they are.
export const NOTICE_TARGET_BALANCE = 1000;

export const getNoticeLevel = (balance) => {
  const value = balance ?? 0;
  if (value >= 700 && value <= 900) return 1;
  if (value >= 300 && value <= 699) return 2;
  if (value <= 299) return 3; // covers negative balances too
  return null; // above ₱900 — no notice needed
};

export const NOTICE_LEVEL_LABELS = {
  1: 'Notice 1',
  2: 'Notice 2',
  3: 'Final Notice',
};

const formatPeso = (amount) => {
  const value = amount || 0;
  return `₱${Math.abs(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);

const NOTICE_STYLES = `
  @page { margin: 20mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 13pt; color: #111; padding: 24px; }
  .notice-page { page-break-after: always; }
  .notice-page:last-child { page-break-after: auto; }
  .letterhead { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 10px; }
  .letterhead img { width: 56px; height: 56px; object-fit: contain; flex-shrink: 0; }
  .letterhead .org-title { margin: 0; font-size: 16pt; font-weight: bold; letter-spacing: 0.02em; text-align: center; }
  .letterhead .org-sub { margin: 2px 0 0; font-size: 10.5pt; color: #444; text-align: center; }
  .letterhead-rule { border: none; border-top: 2px solid #111; margin: 10px 0 24px; }
  .notice-title { text-align: center; font-weight: bold; text-decoration: underline; letter-spacing: 0.05em; margin-bottom: 28px; }
  .field-row { margin-bottom: 6px; }
  .field-row .label { font-weight: bold; }
  .field-row .line { display: inline-block; min-width: 260px; border-bottom: 1px solid #111; padding-left: 6px; }
  .salutation { margin-top: 24px; margin-bottom: 4px; }
  .body-text { line-height: 1.7; text-align: justify; margin: 0 0 4px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 56px; }
  .sig-left, .sig-right { width: 46%; }
  .sig-line { border-bottom: 1px solid #111; min-height: 20px; margin-top: 26px; margin-bottom: 4px; }
  .sig-caption { font-size: 11pt; }
`;

// Builds just one member's letter (no outer <html>/<head>) so it can be
// dropped into either a single-notice print window or a batch one with
// several members concatenated as separate pages.
const buildNoticeMarkup = (member, managerName, logoUrl) => {
  const level = getNoticeLevel(member.balance);
  if (!level) return '';

  const balanceText = formatPeso(member.balance);
  const amountNeeded = formatPeso(Math.max(NOTICE_TARGET_BALANCE - (member.balance || 0), 0));
  const passbookNo = `#${member.id?.toString().padStart(6, '0') || ''}`;

  const bodyHtml = level === 3
    ? `
      <p class="salutation">Sir/Madam:</p>
      <p class="body-text">
        &emsp;&emsp;This is to inform you that you have <strong>${esc(balanceText)}</strong> deposits in the
        Mortuary Aid Fund Program. Kindly replenish or deposit <strong>${esc(amountNeeded)}</strong> in your
        mortuary fund within (30) days to maintain your membership in the said program.
      </p>
      <p class="body-text">&emsp;&emsp;Failure to do so will automatically drop you from the program.</p>
      <p class="body-text">&emsp;&emsp;Please be guided and updated accordingly.</p>
    `
    : `
      <p class="salutation">Sir/Madam:</p>
      <p class="body-text">
        &emsp;&emsp;This is to inform you that your deposit under the Mortuary Aid Fund Program has only a
        balance of <strong>${esc(balanceText)}</strong>. Please make an additional deposit of
        <strong>${esc(amountNeeded)}</strong> immediately to make your current balance of P 1,000.00 from
        receipt of this notice to enjoy the benefit of this program.
      </p>
      <p class="body-text">Thank you and God Bless!</p>
    `;

  return `
    <div class="notice-page">
      <div class="letterhead">
        <img src="${logoUrl}" alt="" />
        <div>
          <p class="org-title">St. Vincent Parish Multi-Purpose Cooperative</p>
          <p class="org-sub">Mortuary Aid Fund Program</p>
        </div>
      </div>
      <hr class="letterhead-rule" />

      <p class="notice-title">${esc(NOTICE_LEVEL_LABELS[level].toUpperCase())} — MORTUARY AID FUND PROGRAM</p>

      <div class="field-row"><span class="label">Name:</span> <span class="line">${esc(member.name)}</span></div>
      <div class="field-row"><span class="label">Address:</span> <span class="line">${esc(member.address)}</span></div>
      <div class="field-row"><span class="label">Passbook No${level === 3 ? '.' : ''}:</span> <span class="line">${esc(passbookNo)}</span></div>

      ${bodyHtml}

      <div class="signatures">
        <div class="sig-left">
          <p class="sig-caption">Received by:</p>
          <div class="sig-line"></div>
          <p class="sig-caption">Date received:</p>
          <div class="sig-line"></div>
        </div>
        <div class="sig-right">
          <p class="sig-caption">Very truly yours,</p>
          <div class="sig-line"></div>
          <p class="sig-caption">${esc(managerName || 'Name of Manager')}</p>
        </div>
      </div>
    </div>
  `;
};

// Same window.open + document.write pattern used elsewhere in the app for
// printable output (e.g. claim disbursement receipts, QR cards).
export const printBalanceNotice = (member, managerName) => {
  const level = getNoticeLevel(member.balance);
  if (!level) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  // Absolute URL — a print window's about:blank document can't reliably
  // resolve a root-relative asset path against the app's origin.
  const logoUrl = `${window.location.origin}/SVPMPC-LOGO(MAIN).png`;
  const markup = buildNoticeMarkup(member, managerName, logoUrl);

  printWindow.document.write(`
    <html>
      <head>
        <title>${esc(NOTICE_LEVEL_LABELS[level])} - ${esc(member.name)}</title>
        <style>${NOTICE_STYLES}</style>
      </head>
      <body>
        ${markup}
        <script>setTimeout(() => window.print(), 400);</script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// Prints every member at the given notice level as one combined job — one
// letter per page — instead of opening and printing each member's notice
// individually, which doesn't scale once there are dozens of members below
// the sustaining balance. Returns how many notices were queued so the
// caller can confirm/report the batch size.
export const printBalanceNoticesBulk = (members, level, managerName) => {
  const targets = members.filter((m) => getNoticeLevel(m.balance) === level);
  if (targets.length === 0) return 0;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return 0;

  const logoUrl = `${window.location.origin}/SVPMPC-LOGO(MAIN).png`;
  const pages = targets.map((m) => buildNoticeMarkup(m, managerName, logoUrl)).join('\n');

  printWindow.document.write(`
    <html>
      <head>
        <title>${esc(NOTICE_LEVEL_LABELS[level])} - Batch (${targets.length})</title>
        <style>${NOTICE_STYLES}</style>
      </head>
      <body>
        ${pages}
        <script>setTimeout(() => window.print(), 400);</script>
      </body>
    </html>
  `);
  printWindow.document.close();
  return targets.length;
};
