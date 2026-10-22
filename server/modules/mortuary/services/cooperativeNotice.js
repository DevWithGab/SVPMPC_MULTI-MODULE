// Official cooperative form for the first and second notices. Keep the
// server counterpart in sync so background batches match browser downloads.
const NOTICE_MANAGER = 'MONINA C. GUZMAN';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const noticeDate = () => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric',
}).format(new Date());
const passbook = member => member.passbookNumber ?? member.passbook ?? `#${String(member.id ?? member.memberId ?? '').padStart(6, '0')}`;
const amount = value => Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const title = level => level === 1 ? 'FIRST NOTICE' : 'SECOND NOTICE';
const message = (member, target, peso) => `This is to inform you that your deposit under the Mortuary Aid Fund Program has only a balance of ${peso}${amount(member.balance)}. Please make an additional deposit of ${peso}${amount(Math.max(target - (member.balance || 0), 0))} immediately to make your current balance of ${peso}${amount(target)} from receipt of this notice to enjoy the benefit of this program.`;

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
`;

const buildCooperativeNoticeMarkup = (member, level, target, logoUrl) => `
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
    <p class="official-message">${escapeHtml(message(member, target, '₱')).replace(/₱[\d,]+\.\d{2}/g, '<strong>$&</strong>')}</p>
    <p class="official-thanks">Thank you and God Bless!</p>
    <div class="official-signoff">Very truly yours,<div class="official-manager"><b>${NOTICE_MANAGER}</b><br>Manager</div></div>
    <div class="official-received">Received by: _______________________<br>Date Received: ____________________</div>
    <div class="official-note">NOTE: Please disregard notice if payment has been made.</div>
  </div>`;

const drawCooperativeNotice = (doc, member, level, target, logo) => {
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
  const lines = doc.splitTextToSize(message(member, target, 'PHP '), width - 2 * margin - 25);
  y += 36; text(lines, margin + 25, y, 14, false, { lineHeightFactor: 1.45 });
  y += lines.length * 20.3 + 3; text('Thank you and God Bless!', margin + 25, y);
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

module.exports = { NOTICE_MANAGER, noticeDate, drawCooperativeNotice };
