// Official cooperative forms for all three notices. Keep the
// server counterpart in sync so background batches match browser downloads.
const NOTICE_MANAGER = 'MONINA C. GUZMAN';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const noticeDate = () => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric',
}).format(new Date());
const passbook = member => member.passbookNumber ?? member.passbook ?? `#${String(member.id ?? member.memberId ?? '').padStart(6, '0')}`;
const amount = value => Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signedMoney = (value, peso) => peso === 'PHP '
  ? `PHP ${value < 0 ? '-' : ''}${amount(Math.abs(value || 0))}`
  : `${value < 0 ? '-' : ''}${peso}${amount(Math.abs(value || 0))}`;
const title = level => level === 1 ? 'FIRST NOTICE' : 'SECOND NOTICE';

const DEFAULT_NOTICE_MESSAGE = 'This is to inform you that your deposit under the Mortuary Aid Fund Program has only a balance of {balance}. Please make an additional deposit of {amountNeeded} immediately to make your current balance of {targetBalance} from receipt of this notice to enjoy the benefit of this program.\n\nThank you and God Bless!';
const DEFAULT_FINAL_NOTICE_MESSAGE = 'This is to inform you that you have {balance} deposits in the Mortuary Aid Fund Program. Kindly replenish or deposit {amountNeeded} in your mortuary fund within (30) days to maintain your membership in the said program. Failure to do so will automatically drop you from the program.\n\nPlease be guided and updated accordingly.';
const getNoticeMessageTemplate = (settings, level) => level === 3
  ? settings?.finalNoticeMessageTemplate || DEFAULT_FINAL_NOTICE_MESSAGE
  : settings?.noticeMessageTemplate || DEFAULT_NOTICE_MESSAGE;
const fillNoticeMessage = (template, member, level, target, peso = '₱') => {
  const values = {
    name: member.name, address: member.address, passbook: passbook(member),
    balance: signedMoney(member.balance, peso), amountNeeded: signedMoney(Math.max(target - (member.balance || 0), 0), peso),
    targetBalance: signedMoney(target, peso), managerName: NOTICE_MANAGER, date: noticeDate(),
    noticeLabel: level === 3 ? 'LAST NOTICE' : title(level),
  };
  return String(template).replace(/\{(\w+)\}/g, (token, key) => values[key] === undefined ? token : String(values[key] ?? ''));
};
const messageMarkup = (template, member, level, target) => fillNoticeMessage(template, member, level, target)
  .split(/\n\s*\n/).map((paragraph, index) => `<p class="${index === 0 ? 'official-message' : 'official-closing'}">${escapeHtml(paragraph).replace(/\n/g, '<br>').replace(/-?₱[\d,]+\.\d{2}/g, '<strong>$&</strong>')}</p>`).join('');

const COOPERATIVE_NOTICE_STYLES = `
  @page { size: A4 landscape; margin: 0; }
  body { margin: 0; padding: 0; }
  .official-notice { width: 297mm; min-height: 210mm; padding: 22mm 18mm 16mm; font: 14pt Arial, sans-serif; color: #111; break-after: page; }
  .official-notice:last-child { break-after: auto; }
  .official-header { position: relative; padding-right: 46mm; text-align: center; }
  .official-brand { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .official-brand img { width: 42px; height: 48px; object-fit: contain; }
  .official-brand strong { font-size: 16pt; }
  .official-date { position: absolute; right: 0; top: 10px; font-size: 10pt; }
  .official-program { color: #303866; font-size: 19pt; font-weight: bold; margin: 10px 0; }
  .official-title { color: #ae3c40; font-size: 17pt; font-weight: bold; }
  .official-fields { display: flex; justify-content: space-between; gap: 16px; margin: 24px 0; }
  .official-member { width: 72%; }
  .official-field { display: flex; align-items: baseline; gap: 8px; margin-bottom: 5px; }
  .official-value { border-bottom: 1px solid #333; flex: 1; overflow-wrap: anywhere; }
  .official-pb { display: flex; align-items: baseline; gap: 5px; }
  .official-pb span { border: 1px solid #333; padding: 5px 8px; font-size: 11pt; overflow-wrap: anywhere; max-width: 52mm; }
  .official-message { line-height: 1.5; text-align: justify; text-indent: 18mm; margin: 20px 0 0; }
  .official-thanks { margin: 3px 0 14px 18mm; }
  .official-signoff { margin-left: 62%; line-height: 1.5; }
  .official-manager { margin-top: 18px; text-align: center; }
  .official-received { font-size: 12pt; line-height: 1.5; margin-top: 4px; }
  .official-note { color: #303866; font-size: 11pt; font-weight: bold; }
  .official-closing { margin: 5px 0 16px 18mm; line-height: 1.5; }
  .official-final .official-header { padding-right: 0; }
  .official-final .official-date { top: 88px; }
  .official-final .official-fields { margin-top: 32px; }
  .official-final .official-member { width: 80%; }
  .official-final .official-field b { min-width: 112px; }
  .official-final .official-field:last-child .official-value { flex: 0 1 45mm; }
  .official-final .official-closing { margin: 5px 0 16px 18mm; }
`;

const buildLastNoticeMarkup = (member, target, logoUrl, settings) => `
  <div class="official-notice official-final">
    <div class="official-header">
      <div class="official-brand"><img src="${escapeHtml(logoUrl)}" alt="" /><div><strong>ST. VINCENT PARISH MULTI-PURPOSE COOPERATIVE</strong><br>Dupax del Sur, Nueva Vizcaya</div></div>
      <div class="official-date"><b>Date:</b> ${escapeHtml(noticeDate())}</div>
      <div class="official-program">MORTUARY AID FUND PROGRAM</div><div class="official-title">LAST NOTICE</div>
    </div>
    <div class="official-fields"><div class="official-member">
      <div class="official-field"><b>Name:</b><span class="official-value">${escapeHtml(member.name)}</span></div>
      <div class="official-field"><b>Address:</b><span class="official-value">${escapeHtml(member.address)}</span></div>
      <div class="official-field"><b>Passbook #:</b><span class="official-value">${escapeHtml(passbook(member))}</span></div>
    </div></div>
    <div>Sir/Madam:</div>
    ${messageMarkup(getNoticeMessageTemplate(settings, 3), member, 3, target)}
    <div class="official-signoff">Very truly yours,<div class="official-manager"><b>${NOTICE_MANAGER}</b><br>Manager</div></div>
    <div class="official-received">Received by: _______________________<br>Date received: ____________________</div>
    <div class="official-note">Note: Please disregard notice if payment has been made.</div>
  </div>`;

const buildCooperativeNoticeMarkup = (member, level, target, logoUrl, settings) => level === 3
  ? buildLastNoticeMarkup(member, target, logoUrl, settings)
  : `
  <div class="official-notice">
    <div class="official-header">
      <div class="official-brand"><img src="${escapeHtml(logoUrl)}" alt="" /><div><strong>ST. VINCENT PARISH MULTI-PURPOSE COOPERATIVE</strong><br>Dupax del Sur, Nueva Vizcaya</div></div>
      <div class="official-date"><b>Date:</b> ${escapeHtml(noticeDate())}</div>
      <div class="official-program">MORTUARY AID FUND PROGRAM</div><div class="official-title">${title(level)}</div>
    </div>
    <div class="official-fields"><div class="official-member">
      <div class="official-field"><b>NAME:</b><span class="official-value">${escapeHtml(member.name)}</span></div>
      <div class="official-field"><b>ADDRESS:</b><span class="official-value">${escapeHtml(member.address)}</span></div>
    </div><div class="official-pb"><b>PB NO.:</b><span>${escapeHtml(passbook(member))}</span></div></div>
    <div>Sir/Madam:</div>
    ${messageMarkup(getNoticeMessageTemplate(settings, level), member, level, target)}
    <div class="official-signoff">Very truly yours,<div class="official-manager"><b>${NOTICE_MANAGER}</b><br>Manager</div></div>
    <div class="official-received">Received by: _______________________<br>Date Received: ____________________</div>
    <div class="official-note">NOTE: Please disregard notice if payment has been made.</div>
  </div>`;

const drawCooperativeNotice = (doc, member, level, target, logo, settings) => {
  if (level === 3) return drawLastNotice(doc, member, target, logo, settings);
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  // Coordinates follow the landscape form; long member fields wrap and push
  // the body down rather than colliding with the salutation.
  const text = (value, x, y, size = 14, bold = false, options = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    doc.text(Array.isArray(value) ? value : String(value ?? ''), x, y, options);
  };
  const margin = 48;
  if (logo) { try { doc.addImage(logo, 'PNG', 76, 54, 38, 42, 'notice-logo', 'FAST'); } catch { /* Text remains printable if the logo cannot load. */ } }
  text('ST. VINCENT PARISH MULTI-PURPOSE COOPERATIVE', 374, 70, 16, true, { align: 'center' });
  text('Dupax del Sur, Nueva Vizcaya', 374, 91, 15, false, { align: 'center' });
  text(`Date: ${noticeDate()}`, width - margin, 75, 10, false, { align: 'right' });
  doc.setTextColor(48, 56, 102);
  text('MORTUARY AID FUND PROGRAM', width / 2, 122, 19, true, { align: 'center' });
  doc.setTextColor(174, 60, 64); text(title(level), width / 2, 150, 17, true, { align: 'center' });
  doc.setTextColor(17, 17, 17);
  const field = (label, value, y) => {
    text(label, margin, y, 14, true);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(13);
    const lines = doc.splitTextToSize(String(value ?? ''), 440);
    text(lines, 130, y, 13);
    const bottom = y + (lines.length - 1) * 15 + 4;
    doc.setLineWidth(0.6); doc.line(130, bottom, 574, bottom);
    return bottom + 20;
  };
  let y = field('NAME:', member.name, 195);
  y = field('ADDRESS:', member.address, y);
  text('PB NO.:', 620, 195, 14, true);
  doc.setFontSize(11);
  const pbLines = doc.splitTextToSize(String(passbook(member)), 100);
  doc.rect(682, 178, 112, Math.max(27, pbLines.length * 13 + 10));
  text(pbLines, 688, 195, 11);
  y += 17; text('Sir/Madam:', margin, y);
  doc.setFontSize(14); doc.setFont('helvetica', 'normal');
  y = drawMessage(doc, fillNoticeMessage(getNoticeMessageTemplate(settings, level), member, level, target, 'PHP '), y + 36, level);
  const signY = Math.max(y + 32, 414);
  text('Very truly yours,', 535, signY);
  text(NOTICE_MANAGER, 662, signY + 41, 16, true, { align: 'center' });
  text('Manager', 662, signY + 60, 14, false, { align: 'center' });
  const receiptY = Math.max(signY + 55, height - 85);
  text('Received by: _______________________', margin, receiptY, 12);
  text('Date Received: ____________________', margin, receiptY + 18, 12);
  doc.setTextColor(48, 56, 102);
  text('NOTE: Please disregard notice if payment has been made.', margin, receiptY + 36, 11, true);
  doc.setTextColor(0, 0, 0);
};

const drawLastNotice = (doc, member, target, logo, settings) => {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 48;
  const text = (value, x, y, size = 14, bold = false, options = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    doc.text(Array.isArray(value) ? value : String(value ?? ''), x, y, options);
  };
  if (logo) { try { doc.addImage(logo, 'PNG', 118, 48, 38, 42, 'notice-logo', 'FAST'); } catch { /* A missing logo must not prevent printing the notice. */ } }
  text('ST. VINCENT PARISH MULTI-PURPOSE COOPERATIVE', width / 2 + 15, 63, 16, true, { align: 'center' });
  text('Dupax del Sur, Nueva Vizcaya', width / 2 + 15, 84, 15, false, { align: 'center' });
  doc.setTextColor(48, 56, 102);
  text('MORTUARY AID FUND PROGRAM', width / 2, 113, 19, true, { align: 'center' });
  doc.setTextColor(174, 60, 64); text('LAST NOTICE', width / 2, 140, 17, true, { align: 'center' });
  doc.setTextColor(17, 17, 17);
  text(`Date: ${noticeDate()}`, width - margin, 140, 10, false, { align: 'right' });
  let y = 191;
  for (const [label, value, fieldWidth] of [['Name:', member.name, 470], ['Address:', member.address, 470], ['Passbook #:', passbook(member), 200]]) {
    text(label, margin, y, 14, true);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(13);
    const lines = doc.splitTextToSize(String(value ?? ''), fieldWidth);
    text(lines, 142, y, 13);
    y += (lines.length - 1) * 15;
    doc.setLineWidth(0.6); doc.line(142, y + 4, 142 + fieldWidth, y + 4);
    y += 24;
  }
  y += 17; text('Sir/Madam:', margin, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(14);
  y = drawMessage(doc, fillNoticeMessage(getNoticeMessageTemplate(settings, 3), member, 3, target, 'PHP '), y + 32, 3);
  const signY = y + 25;
  text('Very truly yours,', 535, signY);
  text(NOTICE_MANAGER, 662, signY + 34, 16, true, { align: 'center' });
  text('Manager', 662, signY + 52, 14, false, { align: 'center' });
  const receiptY = Math.max(signY + 47, height - 85);
  text('Received by: _______________________', margin, receiptY, 12);
  text('Date received: ____________________', margin, receiptY + 18, 12);
  doc.setTextColor(48, 56, 102);
  text('Note: Please disregard notice if payment has been made.', margin, receiptY + 36, 11, true);
  doc.setTextColor(0, 0, 0);
};

// Reserve room for the signature and receipt. Long edited messages continue
// on another page instead of overlapping those fields or being cut off.
const drawMessage = (doc, value, startY, level) => {
  let y = startY;
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal'); doc.setFontSize(14);
  const paragraphs = value.split(/\n\s*\n/);
  paragraphs.forEach((paragraph, index) => {
    if (index) y += 7;
    const lines = doc.splitTextToSize(paragraph, doc.internal.pageSize.getWidth() - 121);
    for (const line of lines) {
      if (y > pageHeight - 160) {
        doc.addPage();
        doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
        doc.text(`${level === 3 ? 'LAST NOTICE' : title(level)} (continued)`, 48, 60);
        y = 90;
      }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(14);
      doc.text(line, 73, y);
      y += 19.6;
    }
  });
  return y;
};

module.exports = { NOTICE_MANAGER, noticeDate, drawCooperativeNotice, getNoticeMessageTemplate, fillNoticeMessage };
