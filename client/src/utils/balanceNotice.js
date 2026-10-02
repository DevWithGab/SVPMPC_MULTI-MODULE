import { jsPDF } from 'jspdf';

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

export const NOTICE_STYLES = `
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
  .notice-body { line-height: 1.7; text-align: justify; }
  .notice-body p, .notice-body div { margin: 0 0 12px; }
`;

// The admin now edits the letter as a real document (Mortuary Admin →
// Notice Thresholds → Edit Document), so noticeBodyTemplate/
// finalNoticeBodyTemplate store HTML straight from that editor, not escaped
// plain text. Older rows saved before that editor existed still hold plain
// text (paragraphs separated by a blank line) — this detects that case by
// checking for a block tag and converts it once so it displays correctly
// both in the editor and when printed.
export const legacyPlainTextToHtml = (value) => {
  const text = String(value || '');
  if (/<(p|div|br)[\s/>]/i.test(text)) return text;
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
};

// Substitutes placeholders directly into admin-authored HTML (trusted —
// written via the in-app editor and sanitized on save). Only the data
// VALUES being interpolated are escaped, since those come from member
// records, not the admin. {balance}/{amountNeeded} are always bolded
// wherever they appear in the template.
export const substitutePlaceholders = (templateHtml, values) =>
  String(templateHtml || '')
    .replace(/\{noticeLabel\}/g, esc(values.noticeLabel))
    .replace(/\{name\}/g, esc(values.name))
    .replace(/\{address\}/g, esc(values.address))
    .replace(/\{passbook\}/g, esc(values.passbook))
    .replace(/\{balance\}/g, `<strong>${esc(values.balanceText)}</strong>`)
    .replace(/\{amountNeeded\}/g, `<strong>${esc(values.amountNeeded)}</strong>`)
    .replace(/\{targetBalance\}/g, esc(values.targetBalanceText))
    .replace(/\{managerName\}/g, esc(values.managerName));

// Fills in one member's letter body (post-placeholder-substitution HTML),
// shared by the print path (wrapped in the markup below) and the native PDF
// path (parsed directly — see parseRichTextBody). Returns level: null when
// the member's balance doesn't currently need a notice.
const buildNoticeBodyHtml = (member, managerName, thresholds) => {
  const level = getNoticeLevel(member.balance, thresholds);
  if (!level) return { level: null, html: '' };

  const targetBalance = thresholds?.targetBalance ?? DEFAULT_NOTICE_THRESHOLDS.targetBalance;
  const template = level === 3
    ? (thresholds?.finalNoticeBodyTemplate || DEFAULT_NOTICE_THRESHOLDS.finalNoticeBodyTemplate)
    : (thresholds?.noticeBodyTemplate || DEFAULT_NOTICE_THRESHOLDS.noticeBodyTemplate);

  const html = substitutePlaceholders(legacyPlainTextToHtml(template), {
    noticeLabel: NOTICE_LEVEL_LABELS[level].toUpperCase(),
    name: member.name,
    address: member.address,
    passbook: `#${member.id?.toString().padStart(6, '0') || ''}`,
    balanceText: formatPeso(member.balance),
    amountNeeded: formatPeso(Math.max(targetBalance - (member.balance || 0), 0)),
    targetBalanceText: formatPeso(targetBalance),
    managerName: managerName || 'Name of Manager',
  });

  return { level, html };
};

// Builds just one member's letter (no outer <html>/<head>) so it can be
// dropped into either a single-notice print window or a batch one with
// several members concatenated as separate pages. Everything below the
// letterhead — title, fields, body, signatures — is the admin's own
// document; only the letterhead (branding) is fixed.
const buildNoticeMarkup = (member, managerName, logoUrl, thresholds) => {
  const { level, html: bodyHtml } = buildNoticeBodyHtml(member, managerName, thresholds);
  if (!level) return '';

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

      <div class="notice-body">${bodyHtml}</div>
    </div>
  `;
};

// Same window.open + document.write pattern used elsewhere in the app for
// printable output (e.g. claim disbursement receipts, QR cards). Prints
// render in a bare window with no app stylesheet loaded, so they were never
// affected by the html2canvas/oklch issue the PDF path below used to hit —
// no change needed here.
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

// ── PDF downloads ──────────────────────────────────────────────────────
// Renders each letter as native PDF text (vector) instead of rasterizing a
// DOM screenshot — orders of magnitude faster for a batch, and the file
// size stays small regardless of how many members are included. Mirrors
// the server-side port of this same approach in
// server/modules/mortuary/services/noticeLetterPdfService.js — keep the two
// in sync if the letter layout ever changes.
const decodeEntities = (text) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

// Tokenizes one <br>-separated line's inner HTML into styled runs. Only
// recognizes the tags this app ever actually produces (see
// NoticeLetterEditorModal.jsx's toolbar: bold/italic/underline/justify) —
// any other markup is stripped but its text content is kept, so a stray
// paste never throws or silently drops content.
const parseRuns = (lineHtml) => {
  const runs = [];
  let bold = 0;
  let italic = 0;
  let underline = 0;
  const tokenRe = /<(\/?)(strong|b|em|i|u)\b[^>]*>|([^<]+)/gi;
  let m;
  while ((m = tokenRe.exec(lineHtml)) !== null) {
    const [, closing, tag, text] = m;
    if (text !== undefined) {
      const decoded = decodeEntities(text);
      if (decoded) runs.push({ text: decoded, bold: bold > 0, italic: italic > 0, underline: underline > 0 });
      continue;
    }
    const delta = closing ? -1 : 1;
    if (tag === 'strong' || tag === 'b') bold = Math.max(0, bold + delta);
    else if (tag === 'em' || tag === 'i') italic = Math.max(0, italic + delta);
    else if (tag === 'u') underline = Math.max(0, underline + delta);
  }
  return runs;
};

// Parses letter-body HTML (p/div blocks, br line breaks, bold/italic/
// underline inline tags, optional text-align style) into
// [{ align, lines: [[run, ...], ...] }] — one entry per paragraph, each
// split into <br>-separated lines of styled runs. Deliberately not a full
// HTML parser (no DOMParser/jsdom dependency) since the tag set this app
// produces is small and fixed.
export const parseRichTextBody = (html) => {
  const source = String(html || '');
  const paragraphs = [];
  const blockRe = /<(p|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  const alignRe = /text-align\s*:\s*(left|right|center|justify)/i;
  let match;
  let foundBlock = false;
  while ((match = blockRe.exec(source)) !== null) {
    foundBlock = true;
    const [, , attrs, inner] = match;
    const alignMatch = alignRe.exec(attrs);
    const align = alignMatch ? alignMatch[1].toLowerCase() : 'justify';
    const lines = inner.split(/<br\s*\/?>/i).map(parseRuns);
    paragraphs.push({ align, lines });
  }
  // legacyPlainTextToHtml always wraps content in <p> blocks, so this is a
  // defensive fallback rather than an expected path — keeps unexpected
  // input visible instead of silently vanishing.
  if (!foundBlock && source.trim()) {
    paragraphs.push({ align: 'justify', lines: [parseRuns(source)] });
  }
  return paragraphs;
};

const fontStyleFor = (run) => {
  if (run.bold && run.italic) return 'bolditalic';
  if (run.bold) return 'bold';
  if (run.italic) return 'italic';
  return 'normal';
};

// Lays out parsed paragraphs as native PDF text: greedy word-wrap,
// bold/italic via font switching, underline drawn manually (jsPDF has no
// built-in text-decoration), and justify-stretching every wrapped line
// except the last line of each paragraph line (matching normal typeset
// justified-text behavior — text-align-last defaults to non-justify).
// Adds pages on overflow. Returns the y position after the last line drawn.
export const drawRichTextBody = (doc, paragraphs, { x, y, maxWidth, lineHeight, fontSize, pageHeight, topMargin }) => {
  doc.setFontSize(fontSize);
  const spaceWidth = doc.getTextWidth(' ');
  let cursorY = y;

  const ensureSpace = () => {
    if (cursorY > pageHeight - topMargin) {
      doc.addPage();
      cursorY = topMargin;
    }
  };

  const flushLine = (words, align, isLastLineOfParagraphLine) => {
    if (words.length === 0) {
      cursorY += lineHeight;
      return;
    }
    ensureSpace();
    const naturalWidth = words.reduce((sum, w) => sum + w.width, 0) + spaceWidth * (words.length - 1);
    const extraSpace = align === 'justify' && !isLastLineOfParagraphLine && words.length > 1
      ? Math.max(0, (maxWidth - naturalWidth)) / (words.length - 1)
      : 0;

    let drawX = x;
    if (align === 'center') drawX = x + Math.max(0, (maxWidth - naturalWidth) / 2);
    else if (align === 'right') drawX = x + Math.max(0, maxWidth - naturalWidth);

    words.forEach((w) => {
      doc.setFont('times', w.style);
      doc.text(w.text, drawX, cursorY);
      if (w.underline) {
        doc.setLineWidth(0.6);
        doc.line(drawX, cursorY + 2, drawX + w.width, cursorY + 2);
      }
      drawX += w.width + spaceWidth + extraSpace;
    });
    cursorY += lineHeight;
  };

  paragraphs.forEach((paragraph) => {
    paragraph.lines.forEach((runs) => {
      // Flatten runs into individual words carrying their own style, so a
      // bold/italic toggle mid-sentence never gets lost at a wrap point.
      const words = [];
      runs.forEach((run) => {
        const style = fontStyleFor(run);
        run.text.split(/\s+/).filter(Boolean).forEach((text) => {
          doc.setFont('times', style);
          words.push({ text, style, underline: run.underline, width: doc.getTextWidth(text) });
        });
      });

      let visualLine = [];
      let lineWidth = 0;
      words.forEach((word) => {
        const prospective = lineWidth + (visualLine.length > 0 ? spaceWidth : 0) + word.width;
        if (visualLine.length > 0 && prospective > maxWidth) {
          flushLine(visualLine, paragraph.align, false);
          visualLine = [];
          lineWidth = 0;
        }
        lineWidth += (visualLine.length > 0 ? spaceWidth : 0) + word.width;
        visualLine.push(word);
      });
      flushLine(visualLine, paragraph.align, true);
    });
    cursorY += lineHeight * 0.4; // paragraph spacing
  });

  return cursorY;
};

const LOGO_SIZE_PT = 42; // ~56px at 96dpi, matching the print/editor letterhead size

// Draws the fixed letterhead (logo + org name, centered) at the top of a
// page and returns the y position the letter body should start at. Always
// passes the same `alias` to addImage so jsPDF embeds the logo once and
// reuses it across every page instead of re-embedding per page — confirmed
// live: without the alias, a 2-page document with the same ~1MB logo image
// ballooned to 16.7MB; with it, a 20-page document stayed ~1.15MB.
const drawNoticeLetterhead = (doc, logoDataUrl, { x, y, maxWidth }) => {
  const centerX = x + maxWidth / 2;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', centerX - LOGO_SIZE_PT / 2, y, LOGO_SIZE_PT, LOGO_SIZE_PT, 'notice-logo', 'FAST');
    } catch {
      // A broken/undecodable logo shouldn't block generating the letter text.
    }
  }
  let cursorY = y + LOGO_SIZE_PT + 14;
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('St. Vincent Parish Multi-Purpose Cooperative', centerX, cursorY, { align: 'center' });
  cursorY += 14;
  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(68, 68, 68);
  doc.text('Mortuary Aid Fund Program', centerX, cursorY, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  cursorY += 10;
  doc.setLineWidth(1.2);
  doc.line(x, cursorY, x + maxWidth, cursorY);
  return cursorY + 26;
};

const PAGE_MARGIN_PT = 54; // ~0.75in

// Draws one member's full notice (letterhead + body) onto the PDF's current
// page. Caller is responsible for calling doc.addPage() beforehand for
// every member after the first. Returns false if the member doesn't
// currently need a notice (caller should have already filtered for this,
// but kept defensive since this draws destructively).
const renderMemberNoticePage = (doc, member, managerName, thresholds, logoDataUrl) => {
  const { level, html: bodyHtml } = buildNoticeBodyHtml(member, managerName, thresholds);
  if (!level) return false;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - PAGE_MARGIN_PT * 2;

  const bodyStartY = drawNoticeLetterhead(doc, logoDataUrl, { x: PAGE_MARGIN_PT, y: PAGE_MARGIN_PT, maxWidth });
  const paragraphs = parseRichTextBody(bodyHtml);
  drawRichTextBody(doc, paragraphs, {
    x: PAGE_MARGIN_PT,
    y: bodyStartY,
    maxWidth,
    lineHeight: 17,
    fontSize: 12,
    pageHeight,
    topMargin: PAGE_MARGIN_PT,
  });
  return true;
};

// Fetched once and cached for the life of the tab — a bulk run of hundreds
// of members shouldn't re-fetch the same static asset per member.
let cachedLogoDataUrl;
const getLogoDataUrl = async () => {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  try {
    const response = await fetch(`${window.location.origin}/SVPMPC-LOGO(MAIN).png`);
    const blob = await response.blob();
    cachedLogoDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    cachedLogoDataUrl = null; // the letter still generates, just without the logo
  }
  return cachedLogoDataUrl;
};

const filenameSafe = (value) => String(value || '').trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-');

// Downloads one member's notice as a PDF instead of (or in addition to)
// printing it — same letter content, same thresholds/template, just saved
// to disk rather than sent to a printer. Returns false if the member
// doesn't currently need a notice.
export const downloadBalanceNoticePDF = async (member, managerName, thresholds = DEFAULT_NOTICE_THRESHOLDS) => {
  const level = getNoticeLevel(member.balance, thresholds);
  if (!level) return false;

  const logoDataUrl = await getLogoDataUrl();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  renderMemberNoticePage(doc, member, managerName, thresholds, logoDataUrl);
  doc.save(`${filenameSafe(NOTICE_LEVEL_LABELS[level])}-${filenameSafe(member.name)}.pdf`);
  return true;
};

// Downloads every member at the given notice level as one combined PDF —
// one letter per page — mirroring printBalanceNoticesBulk but saved to
// disk. Native text rendering (no per-member screenshot/rasterize step)
// means this loop is now plain synchronous CPU work, not an awaited
// DOM-capture per member — hundreds of members generate in a fraction of a
// second instead of potentially minutes. Returns how many notices were
// included.
export const downloadBalanceNoticesBulkPDF = async (members, level, managerName, thresholds = DEFAULT_NOTICE_THRESHOLDS) => {
  const targets = members.filter((m) => getNoticeLevel(m.balance, thresholds) === level);
  if (targets.length === 0) return 0;

  const logoDataUrl = await getLogoDataUrl();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  targets.forEach((member, index) => {
    if (index > 0) doc.addPage();
    renderMemberNoticePage(doc, member, managerName, thresholds, logoDataUrl);
  });
  doc.save(`${filenameSafe(NOTICE_LEVEL_LABELS[level])}-Batch-${targets.length}.pdf`);
  return targets.length;
};
