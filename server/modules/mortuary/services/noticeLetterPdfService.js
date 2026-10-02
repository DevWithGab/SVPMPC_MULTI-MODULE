// Server-side port of client/src/utils/balanceNotice.js's native PDF
// renderer (parseRichTextBody/drawRichTextBody/drawNoticeLetterhead), used
// for large batches that are generated in the background instead of in the
// Treasurer's browser tab (see noticeBatchController.js). There's no
// client/server shared-code path in this repo, so this is a hand port
// rather than an import — keep the two in sync if the letter layout or
// template placeholders ever change.
const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');

const DEFAULT_NOTICE_THRESHOLDS = {
  targetBalance: 1000,
  notice1Min: 700,
  notice1Max: 900,
  notice2Min: 300,
  notice2Max: 699,
  noticeBodyTemplate:
    '{noticeLabel} — MORTUARY AID FUND PROGRAM\n\nName: {name}\nAddress: {address}\nPassbook No.: {passbook}\n\nSir/Madam:\n\nThis is to inform you that your deposit under the Mortuary Aid Fund Program has only a balance of {balance}. Please make an additional deposit of {amountNeeded} immediately to make your current balance of {targetBalance} from receipt of this notice to enjoy the benefit of this program.\n\nThank you and God Bless!\n\nReceived by: _______________________\nDate received: _______________________\n\nVery truly yours,\n\n_______________________\n{managerName}',
  finalNoticeBodyTemplate:
    '{noticeLabel} — MORTUARY AID FUND PROGRAM\n\nName: {name}\nAddress: {address}\nPassbook No: {passbook}\n\nSir/Madam:\n\nThis is to inform you that you have {balance} deposits in the Mortuary Aid Fund Program. Kindly replenish or deposit {amountNeeded} in your mortuary fund within (30) days to maintain your membership in the said program.\n\nFailure to do so will automatically drop you from the program.\n\nPlease be guided and updated accordingly.\n\nReceived by: _______________________\nDate received: _______________________\n\nVery truly yours,\n\n_______________________\n{managerName}',
};

const getNoticeLevel = (balance, thresholds = DEFAULT_NOTICE_THRESHOLDS) => {
  const value = balance ?? 0;
  const t = thresholds || DEFAULT_NOTICE_THRESHOLDS;
  if (value >= t.notice1Min && value <= t.notice1Max) return 1;
  if (value >= t.notice2Min && value <= t.notice2Max) return 2;
  if (value < t.notice2Min) return 3;
  return null;
};

const NOTICE_LEVEL_LABELS = { 1: 'Notice 1', 2: 'Notice 2', 3: 'Final Notice' };

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

const legacyPlainTextToHtml = (value) => {
  const text = String(value || '');
  if (/<(p|div|br)[\s/>]/i.test(text)) return text;
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
};

const substitutePlaceholders = (templateHtml, values) =>
  String(templateHtml || '')
    .replace(/\{noticeLabel\}/g, esc(values.noticeLabel))
    .replace(/\{name\}/g, esc(values.name))
    .replace(/\{address\}/g, esc(values.address))
    .replace(/\{passbook\}/g, esc(values.passbook))
    .replace(/\{balance\}/g, `<strong>${esc(values.balanceText)}</strong>`)
    .replace(/\{amountNeeded\}/g, `<strong>${esc(values.amountNeeded)}</strong>`)
    .replace(/\{targetBalance\}/g, esc(values.targetBalanceText))
    .replace(/\{managerName\}/g, esc(values.managerName));

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

const decodeEntities = (text) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

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

const parseRichTextBody = (html) => {
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

const drawRichTextBody = (doc, paragraphs, { x, y, maxWidth, lineHeight, fontSize, pageHeight, topMargin }) => {
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
    cursorY += lineHeight * 0.4;
  });

  return cursorY;
};

const LOGO_SIZE_PT = 42;
const PAGE_MARGIN_PT = 54;

// Read once per process (module-level cache), not once per job/member.
let cachedLogoDataUrl;
const getLogoDataUrl = () => {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  try {
    const logoPath = path.join(__dirname, '..', 'assets', 'SVPMPC-LOGO.png');
    const base64 = fs.readFileSync(logoPath).toString('base64');
    cachedLogoDataUrl = `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('Unable to load notice letterhead logo:', error.message);
    cachedLogoDataUrl = null;
  }
  return cachedLogoDataUrl;
};

const drawNoticeLetterhead = (doc, logoDataUrl, { x, y, maxWidth }) => {
  const centerX = x + maxWidth / 2;
  if (logoDataUrl) {
    try {
      // Always the same alias — jsPDF then embeds the logo once and reuses
      // it across every page instead of re-embedding per page. Confirmed
      // live: without this, a 2-page doc with the same ~1MB logo ballooned
      // to 16.7MB; with it, a 20-page doc stayed ~1.15MB.
      doc.addImage(logoDataUrl, 'PNG', centerX - LOGO_SIZE_PT / 2, y, LOGO_SIZE_PT, LOGO_SIZE_PT, 'notice-logo', 'FAST');
    } catch (error) {
      console.error('Unable to draw notice letterhead logo:', error.message);
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

// Builds the full multi-page PDF for every member at the given notice
// level and writes it to outputPath. Returns how many members were
// included. Synchronous CPU work (no screenshots, no DOM) — fast enough
// that even a 1,000-member batch is expected to take low single-digit
// seconds, but this still runs inside a background job (see
// noticeBatchController.js) so the HTTP request never has to hold the
// connection open for however long generation takes.
const generateNoticeBatchPdf = async (members, level, managerName, thresholds, outputPath) => {
  const targets = members.filter((m) => getNoticeLevel(m.balance, thresholds) === level);
  if (targets.length === 0) return 0;

  const logoDataUrl = getLogoDataUrl();
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  targets.forEach((member, index) => {
    if (index > 0) doc.addPage();
    renderMemberNoticePage(doc, member, managerName, thresholds, logoDataUrl);
  });

  const buffer = Buffer.from(doc.output('arraybuffer'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  return targets.length;
};

module.exports = {
  getNoticeLevel,
  NOTICE_LEVEL_LABELS,
  DEFAULT_NOTICE_THRESHOLDS,
  generateNoticeBatchPdf,
};
