// Balance-threshold notices — shared between the per-member "Print Notice"
// action on the Member Ledger and the bulk "print all by threshold" action
// on Member Balances, so both stay on the same thresholds and letter
// template instead of drifting apart.
//
// Thresholds are admin-configurable (Mortuary Admin → Notice Thresholds,
// backed by NoticeThresholdSetting on the server) rather than fixed in code.
// Every function here takes the current thresholds as a parameter instead of
// reading a hardcoded constant; DEFAULT_NOTICE_THRESHOLDS is only the
// fallback shown before the real settings have loaded, and matches the
// server's own auto-seeded defaults.
export const DEFAULT_NOTICE_THRESHOLDS = {
  targetBalance: 1000,
  notice1Min: 700,
  notice1Max: 900,
  notice2Min: 300,
  notice2Max: 699,
  // The ENTIRE letter body (title through signatures) is one admin-editable
  // block of plain text, paragraphs separated by a blank line. Available
  // placeholders: {noticeLabel} {name} {address} {passbook} {balance}
  // {amountNeeded} {targetBalance} {managerName}. {balance} and
  // {amountNeeded} are always bolded wherever they appear; everything else
  // substitutes as plain text. The letterhead (logo + org name) is rendered
  // separately and is not part of this template.
  noticeBodyTemplate:
    '{noticeLabel} — MORTUARY AID FUND PROGRAM\n\nName: {name}\nAddress: {address}\nPassbook No.: {passbook}\n\nSir/Madam:\n\nThis is to inform you that your deposit under the Mortuary Aid Fund Program has only a balance of {balance}. Please make an additional deposit of {amountNeeded} immediately to make your current balance of {targetBalance} from receipt of this notice to enjoy the benefit of this program.\n\nThank you and God Bless!\n\nReceived by: _______________________\nDate received: _______________________\n\nVery truly yours,\n\n_______________________\n{managerName}',
  finalNoticeBodyTemplate:
    '{noticeLabel} — MORTUARY AID FUND PROGRAM\n\nName: {name}\nAddress: {address}\nPassbook No: {passbook}\n\nSir/Madam:\n\nThis is to inform you that you have {balance} deposits in the Mortuary Aid Fund Program. Kindly replenish or deposit {amountNeeded} in your mortuary fund within (30) days to maintain your membership in the said program.\n\nFailure to do so will automatically drop you from the program.\n\nPlease be guided and updated accordingly.\n\nReceived by: _______________________\nDate received: _______________________\n\nVery truly yours,\n\n_______________________\n{managerName}',
};

export const getNoticeLevel = (balance, thresholds = DEFAULT_NOTICE_THRESHOLDS) => {
  const value = balance ?? 0;
  const t = thresholds || DEFAULT_NOTICE_THRESHOLDS;
  if (value >= t.notice1Min && value <= t.notice1Max) return 1;
  if (value >= t.notice2Min && value <= t.notice2Max) return 2;
  if (value < t.notice2Min) return 3;
  return null; // above notice1Max — no notice needed
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
  .body-text { line-height: 1.7; text-align: justify; margin: 0 0 14px; white-space: pre-wrap; }
`;

// Splits the admin-edited template into paragraphs (blank line = paragraph
// break), escapes the admin's own text for HTML safety, then substitutes
// every placeholder. {balance}/{amountNeeded} are always bolded wherever
// they appear; the rest substitute as plain text.
const renderNoticeTemplate = (template, values) => {
  const paragraphs = String(template || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs
    .map((paragraph) => {
      const escaped = esc(paragraph)
        .replace(/\{noticeLabel\}/g, esc(values.noticeLabel))
        .replace(/\{name\}/g, esc(values.name))
        .replace(/\{address\}/g, esc(values.address))
        .replace(/\{passbook\}/g, esc(values.passbook))
        .replace(/\{balance\}/g, `<strong>${esc(values.balanceText)}</strong>`)
        .replace(/\{amountNeeded\}/g, `<strong>${esc(values.amountNeeded)}</strong>`)
        .replace(/\{targetBalance\}/g, esc(values.targetBalanceText))
        .replace(/\{managerName\}/g, esc(values.managerName));
      return `<p class="body-text">${escaped}</p>`;
    })
    .join('\n');
};

// Builds just one member's letter (no outer <html>/<head>) so it can be
// dropped into either a single-notice print window or a batch one with
// several members concatenated as separate pages. Everything below the
// letterhead — title, fields, body, signatures — is the admin's own
// template; only the letterhead (branding) is fixed.
const buildNoticeMarkup = (member, managerName, logoUrl, thresholds) => {
  const level = getNoticeLevel(member.balance, thresholds);
  if (!level) return '';

  const targetBalance = thresholds?.targetBalance ?? DEFAULT_NOTICE_THRESHOLDS.targetBalance;
  const template = level === 3
    ? (thresholds?.finalNoticeBodyTemplate || DEFAULT_NOTICE_THRESHOLDS.finalNoticeBodyTemplate)
    : (thresholds?.noticeBodyTemplate || DEFAULT_NOTICE_THRESHOLDS.noticeBodyTemplate);

  const bodyHtml = renderNoticeTemplate(template, {
    noticeLabel: NOTICE_LEVEL_LABELS[level].toUpperCase(),
    name: member.name,
    address: member.address,
    passbook: `#${member.id?.toString().padStart(6, '0') || ''}`,
    balanceText: formatPeso(member.balance),
    amountNeeded: formatPeso(Math.max(targetBalance - (member.balance || 0), 0)),
    targetBalanceText: formatPeso(targetBalance),
    managerName: managerName || 'Name of Manager',
  });

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

      ${bodyHtml}
    </div>
  `;
};

// Same window.open + document.write pattern used elsewhere in the app for
// printable output (e.g. claim disbursement receipts, QR cards).
export const printBalanceNotice = (member, managerName, thresholds = DEFAULT_NOTICE_THRESHOLDS) => {
  const level = getNoticeLevel(member.balance, thresholds);
  if (!level) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  // Absolute URL — a print window's about:blank document can't reliably
  // resolve a root-relative asset path against the app's origin.
  const logoUrl = `${window.location.origin}/SVPMPC-LOGO(MAIN).png`;
  const markup = buildNoticeMarkup(member, managerName, logoUrl, thresholds);

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
export const printBalanceNoticesBulk = (members, level, managerName, thresholds = DEFAULT_NOTICE_THRESHOLDS) => {
  const targets = members.filter((m) => getNoticeLevel(m.balance, thresholds) === level);
  if (targets.length === 0) return 0;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return 0;

  const logoUrl = `${window.location.origin}/SVPMPC-LOGO(MAIN).png`;
  const pages = targets.map((m) => buildNoticeMarkup(m, managerName, logoUrl, thresholds)).join('\n');

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
