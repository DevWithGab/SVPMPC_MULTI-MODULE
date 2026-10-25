import { formatDate, formatDateTime } from './date.js';

const validDate = value => value && Number.isFinite(new Date(value).getTime());
export const directoryDate = (value, withTime = false) => validDate(value)
  ? (withTime ? formatDateTime(value) : formatDate(value)) : 'Not recorded';

export function getQrUnavailableReason(member) {
  if (member.status === 'deceased') return 'Unavailable for deceased member';
  if (member.status === 'inactive') return 'Unavailable for inactive member';
  if (!member.qrCodeGenerated) return 'Not issued';
  if (member.qrCodeActive === false) return 'Deactivated';
  if (!member.qrCodeUrl) return 'Image unavailable';
  return null;
}

export function normalizeDirectoryMembers(members, attendance) {
  const latest = new Map();
  for (const record of attendance) {
    const id = String(record.memberId || record.member_id || record.member?.memberId || '').trim();
    const value = record.scanTime || record.timestamp || record.createdAt || record.updatedAt;
    if (!id || !validDate(value)) continue;
    if (!latest.has(id) || new Date(value) > new Date(latest.get(id))) latest.set(id, value);
  }
  return members.map(member => {
    const memberId = String(member.memberId || member.id || '').trim();
    const recorded = latest.get(memberId);
    const stored = validDate(member.lastAttendance) ? member.lastAttendance : null;
    return {
      id: member._id || memberId,
      memberId: memberId || 'Not recorded',
      name: member.memberName || member.name || 'Unknown member',
      email: member.email || '', phone: member.phoneNumber || member.phone || '',
      barangay: member.barangay || '', status: String(member.status || 'inactive').toLowerCase(),
      joinDate: member.joinDate || member.createdAt || null,
      lastAttendance: recorded && (!stored || new Date(recorded) > new Date(stored)) ? recorded : stored,
      qrCodeGenerated: Boolean(member.qrCodeGenerated), qrCodeActive: member.qrCodeActive !== false,
      qrCodeUrl: member.qrCodeUrl || null,
    };
  });
}

export function filterDirectoryMembers(members, { search = '', status = 'all', barangay = 'all', sort = 'name' }) {
  const query = search.trim().toLowerCase();
  return members.filter(member =>
    [member.name, member.memberId, member.email, member.phone, member.barangay].some(value => String(value || '').toLowerCase().includes(query)) &&
    (status === 'all' || member.status === status) && (barangay === 'all' || member.barangay === barangay),
  ).sort((a, b) => {
    if (sort === 'passbook') return a.memberId.localeCompare(b.memberId, undefined, { numeric: true });
    if (sort === 'attendance') {
      const difference = (new Date(b.lastAttendance).getTime() || 0) - (new Date(a.lastAttendance).getTime() || 0);
      if (difference) return difference;
    }
    return a.name.localeCompare(b.name) || a.memberId.localeCompare(b.memberId);
  });
}

export function directoryCsv(members) {
  const cell = value => {
    const text = String(value ?? '');
    const safe = /^[\s]*[=+@-]/.test(text) || /^[\t\r]/.test(text) ? "'" + text : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [
    ['Name', 'Passbook Number', 'Barangay', 'Email', 'Phone', 'Status', 'Member Since (PHT)', 'Last Attendance (PHT)', 'QR availability'],
    ...members.map(member => [member.name, member.memberId, member.barangay, member.email, member.phone, member.status,
      directoryDate(member.joinDate), directoryDate(member.lastAttendance, true), getQrUnavailableReason(member) || 'Available']),
  ].map(row => row.map(cell).join(',')).join('\r\n');
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
// Each card keeps its original size (90 × 135 mm, 180 px ≈ 47.6 mm QR) and is
// printed centered on A6, the smallest standard paper size it fits. Browsers
// and printers recognise A6 paper (given in mm, since Chromium ignores the "A6" keyword).
export const QR_CARD_MM = { width: 90, height: 135 };
export const QR_CARD_PAPER = { name: 'A6', width: 105, height: 148 };
const PRINT_STYLES = `@page{size:${QR_CARD_PAPER.width}mm ${QR_CARD_PAPER.height}mm;margin:0}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#24362a;margin:0;padding:24px;background:#f4f6f4}.card{width:${QR_CARD_MM.width}mm;min-height:${QR_CARD_MM.height}mm;margin:0 auto 18px;border:1px solid #cdd6cf;padding:22px;background:#fff}header{display:flex;align-items:center;gap:12px;border-bottom:1px solid #cdd6cf;padding-bottom:16px}header img{width:35px;height:42px;object-fit:contain}header strong{font-size:12px;line-height:1.5}header p{font-size:10px;margin:4px 0 0;color:#647069}h1{font-size:19px;margin:20px 0 5px;overflow-wrap:anywhere}.id{font-size:12px;color:#526058;margin:0}.qr{text-align:center;padding:20px 0}.qr img{display:block;margin:auto;width:180px;height:180px;image-rendering:pixelated}.qr p{font-size:11px;color:#647069;margin:12px 0 0}dl{border-top:1px solid #cdd6cf;padding-top:14px;margin:0}dl div{display:flex;justify-content:space-between;gap:16px;padding:5px 0;font-size:11px}dt{color:#647069}dd{margin:0;overflow-wrap:anywhere;text-align:right}.sheet-title{font-size:18px;margin:0 0 4px;text-align:center}.sheet-scope{text-align:center;margin:0 0 12px;font-size:12px;color:#647069}#print-status{text-align:center;font-size:12px;color:#647069;margin:0 0 16px}@media print{body{padding:0;background:#fff}.card{height:${QR_CARD_MM.height}mm;margin:${(QR_CARD_PAPER.height - QR_CARD_MM.height) / 2}mm auto 0;border:0;overflow:hidden;break-after:page;page-break-after:always}.card:last-of-type{break-after:auto;page-break-after:auto}#print-status,.sheet-title,.sheet-scope{display:none}}`;

const directoryCardHtml = (member, qrUrl, logoUrl, imageId) => `<article class="card"><header><img src="${escapeHtml(logoUrl)}" alt="Cooperative logo"><div><strong>St. Vincent Parish<br>Multi-Purpose Cooperative</strong><p>Member identification</p></div></header><h1>${escapeHtml(member.name)}</h1><p class="id">Passbook number: ${escapeHtml(member.memberId)}</p><div class="qr"><img${imageId ? ` id="${imageId}"` : ''} src="${escapeHtml(qrUrl)}" alt="Issued member QR code"><p>Present this code for attendance scanning.</p></div><dl><div><dt>Membership status</dt><dd>${escapeHtml(member.status)}</dd></div><div><dt>Barangay</dt><dd>${escapeHtml(member.barangay || 'Not recorded')}</dd></div><div><dt>Member since</dt><dd>${escapeHtml(directoryDate(member.joinDate))}</dd></div></dl></article>`;

export function directoryPrintHtml(member, qrUrl, logoUrl) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(member.name)} — Member QR card</title>
    <style>${PRINT_STYLES}</style></head>
    <body>${directoryCardHtml(member, qrUrl, logoUrl, 'member-qr')}<footer id="print-status">Loading the QR card…</footer></body></html>`;
}

// One printable sheet of QR cards, e.g. every member of a barangay.
export function directoryBulkPrintHtml(entries, logoUrl, scope) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Member QR cards — ${escapeHtml(scope)}</title>
    <style>${PRINT_STYLES}</style></head>
    <body><h1 class="sheet-title">Member QR cards</h1><p class="sheet-scope">${escapeHtml(scope)} · ${entries.length.toLocaleString()} card${entries.length === 1 ? '' : 's'}</p><footer id="print-status">Loading ${entries.length.toLocaleString()} QR card${entries.length === 1 ? '' : 's'}…</footer>
    <main class="sheet">${entries.map(({ member, qrUrl }) => directoryCardHtml(member, qrUrl, logoUrl)).join('')}</main></body></html>`;
}
