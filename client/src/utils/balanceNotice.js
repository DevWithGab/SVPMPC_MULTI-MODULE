import { buildCooperativeNoticeMarkup, COOPERATIVE_NOTICE_STYLES, drawCooperativeNotice } from './cooperativeNotice.js';
import { jsPDF } from 'jspdf';
import { sanitizeNoticeHtml } from './sanitizeHtml.js';

/* Balance-threshold notices - shared ito sa pagitan ng per-member "Print
Notice" action sa Member Ledger at yung bulk "print all by threshold"
action sa Notices, para parehas lang silang thresholds at letter template
ang gagamitin imbes na maghiwalay.

Admin-configurable yung thresholds (Mortuary Admin -> Notice Thresholds,
suportado ng NoticeThresholdSetting sa server) imbes na fixed sa code.
Kinukuha ng bawat function dito yung current thresholds bilang parameter
imbes magbasa ng hardcoded constant; yung DEFAULT_NOTICE_THRESHOLDS ay
fallback lang na ipinapakita bago pa ma-load yung totoong settings, at
tugma sa auto-seeded defaults ng server. */
export const DEFAULT_NOTICE_THRESHOLDS = {
  targetBalance: 1000,
  notice1Min: 700,
  notice1Max: 900,
  notice2Min: 300,
  notice2Max: 699,
  /* Yung BUONG letter body (title hanggang signatures) ay isang
  admin-editable block ng plain text, na pinaghihiwalay ng blank line yung
  mga paragraphs. Available placeholders: {noticeLabel} {name} {address}
  {passbook} {balance} {amountNeeded} {targetBalance} {managerName}.
  Laging bolded yung {balance} at {amountNeeded} saan man sila lumabas;
  plain text naman ang substitute sa iba. Yung letterhead (logo + org
  name) ay hiwalay na na-render at hindi na kasama sa template na ito. */
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
  return `${value < 0 ? '-' : ''}₱${Math.abs(value).toLocaleString('en-PH', {
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

/* Nag-edit na ngayon yung admin sa letter bilang totoong document
(Mortuary Admin -> Notice Thresholds -> Edit Document), kaya yung
noticeBodyTemplate/finalNoticeBodyTemplate ay nag-store ng HTML diretso
galing sa editor na yun, hindi escaped plain text. Yung mga older rows na
na-save bago pa magkaroon ng editor na yun ay plain text pa rin (paragraphs
na pinaghihiwalay ng blank line) - dito nadedetect yung case na iyon by
checking for a block tag, at kinoconvert ito isang beses para mag-display
nang tama sa editor at sa pag-print. */
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

/* Sino-substitute ang placeholders diretso papunta sa admin-authored HTML
(trusted - sinulat via in-app editor at sanitized nang isave). Yung data
VALUES na iniinterpolate lang ang escaped, kasi galing ito sa member
records, hindi sa admin. Laging bolded yung {balance}/{amountNeeded}
saan man sila lumabas sa template. */
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

/* Pinupuno dito yung letter body ng isang member (post-placeholder-
substitution HTML), shared ng print path (wrapped sa markup sa baba) at
yung native PDF path (parsed directly - tignan yung parseRichTextBody).
Nagbabalik ng level: null kung hindi na kailangan ng notice yung balance
ng member sa ngayon. */
const buildNoticeBodyHtml = (member, managerName, thresholds) => {
  const level = getNoticeLevel(member.balance, thresholds);
  if (!level) return { level: null, html: '' };

  const targetBalance = thresholds?.targetBalance ?? DEFAULT_NOTICE_THRESHOLDS.targetBalance;
  const template = level === 3
    ? (thresholds?.finalNoticeBodyTemplate || DEFAULT_NOTICE_THRESHOLDS.finalNoticeBodyTemplate)
    : (thresholds?.noticeBodyTemplate || DEFAULT_NOTICE_THRESHOLDS.noticeBodyTemplate);

  /* Yung template mismo ang untrusted part dito (admin-authored, stored
  HTML - tignan yung comment ni substitutePlaceholders kung bakit hindi
  na kailangan nito yung substituted member VALUES, naka-esc() na sila).
  Yung sanitizing post-substitution ay sakop na ang dalawang consumer ng
  function na ito sa isang lugar lang: yung print path sa baba
  (document.write) at yung parseRichTextBody ng native PDF path. */
  const html = sanitizeNoticeHtml(substitutePlaceholders(legacyPlainTextToHtml(template), {
    noticeLabel: NOTICE_LEVEL_LABELS[level].toUpperCase(),
    name: member.name,
    address: member.address,
    passbook: `#${member.id?.toString().padStart(6, '0') || ''}`,
    balanceText: formatPeso(member.balance),
    amountNeeded: formatPeso(Math.max(targetBalance - (member.balance || 0), 0)),
    targetBalanceText: formatPeso(targetBalance),
    managerName: managerName || 'Name of Manager',
  }));

  return { level, html };
};

/* Gumagawa lang ito ng letter ng isang member (walang outer <html>/<head>)
para pwede itong ilagay sa single-notice print window o sa batch one na
may ilang members na pinagsama bilang separate pages. Lahat ng nasa baba
ng letterhead - title, fields, body, signatures - ay sariling document na
ng admin; yung letterhead (branding) lang ang fixed. */
const buildNoticeMarkup = (member, managerName, logoUrl, thresholds) => {
  const { level, html: bodyHtml } = buildNoticeBodyHtml(member, managerName, thresholds);
  if (!level) return '';
  if (level === 1 || level === 2 || level === 3) {
    return buildCooperativeNoticeMarkup(member, level, thresholds?.targetBalance ?? DEFAULT_NOTICE_THRESHOLDS.targetBalance, logoUrl, thresholds);
  }

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

/* Parehong window.open + document.write pattern na ginagamit sa ibang
parte ng app para sa printable output (hal. claim disbursement receipts,
QR cards). Nag-render yung prints sa bare window na walang loaded app
stylesheet, kaya hindi na naapektuhan yung html2canvas/oklch issue na
dating nadadapuan ng PDF path sa baba - walang kailangang baguhin dito. */
export const printBalanceNotice = (member, managerName, thresholds = DEFAULT_NOTICE_THRESHOLDS) => {
  const level = getNoticeLevel(member.balance, thresholds);
  if (!level) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  /* Absolute URL ito - hindi reliable ni-resolve ng about:blank document
  ng print window yung root-relative asset path against sa origin ng app. */
  const logoUrl = `${window.location.origin}/SVPMPC-LOGO(MAIN).png`;
  const markup = buildNoticeMarkup(member, managerName, logoUrl, thresholds);

  printWindow.document.write(`
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${esc(NOTICE_LEVEL_LABELS[level])} - ${esc(member.name)}</title>
        <style>${NOTICE_STYLES}${COOPERATIVE_NOTICE_STYLES}</style>
      </head>
      <body>
        ${markup}
        <script>setTimeout(() => window.print(), 400);</script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

/* Pinipirint dito yung bawat member sa given notice level bilang isang
combined job - isang letter per page - imbes buksan at iprint isa-isa
yung notice ng bawat member, na hindi na kakayanin pag dumoble-dosena na
yung members na below sustaining balance. Nagbabalik ng bilang kung ilang
notices ang naqueue para ma-confirm/report ng caller yung batch size. */
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
        <meta charset="utf-8" />
        <title>${esc(NOTICE_LEVEL_LABELS[level])} - Batch (${targets.length})</title>
        <style>${NOTICE_STYLES}${COOPERATIVE_NOTICE_STYLES}</style>
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
/* Nirerender dito yung bawat letter bilang native PDF text (vector) imbes
rasterize ng DOM screenshot - mas mabilis ng maraming order of magnitude
para sa batch, at manatiling maliit yung file size kahit gaano karami
yung members na kasama. Mirror ito ng server-side port ng parehong
approach na ito sa
server/modules/mortuary/services/noticeLetterPdfService.js - panatilihing
sync yung dalawa kung magbabago man yung letter layout. */
const decodeEntities = (text) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

/* Tokinenize dito yung isang <br>-separated line's inner HTML papunta sa
styled runs. Yung tags lang na talagang ginagawa ng app na ito ang
nareresognize (tignan yung toolbar ng NoticeLetterEditorModal.jsx:
bold/italic/underline/justify) - yung ibang markup ay strinip pero
napanatili yung text content niya, kaya walang throw o tahimik na
nawawalang content kung saglit mag-paste ng stray markup. */
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

/* Pina-parse dito yung letter-body HTML (p/div blocks, br line breaks,
bold/italic/underline inline tags, optional text-align style) papunta sa
[{ align, lines: [[run, ...], ...] }] - isang entry per paragraph, bawat
isa hinati sa <br>-separated lines ng styled runs. Sinadya na hindi full
HTML parser ito (walang DOMParser/jsdom dependency) dahil maliit at fixed
lang yung tag set na ginagawa ng app na ito. */
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
  /* Laging ibinabalot ng legacyPlainTextToHtml yung content sa <p> blocks,
  kaya defensive fallback lang ito imbes na expected path - pinapanatili
  nitong visible yung unexpected input imbes na tahimik na mawala. */
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

/* Ina-layout dito yung parsed paragraphs bilang native PDF text: greedy
word-wrap, bold/italic via font switching, underline drawn manually (walang
built-in text-decoration ang jsPDF), at justify-stretching sa bawat wrapped
line maliban sa last line ng bawat paragraph line (tugma sa normal typeset
justified-text behavior - default sa non-justify yung text-align-last).
Nagdadagdag ng pages sa overflow. Nagbabalik ng y position matapos yung
huling line na nadrawing. */
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
      /* Niflatten dito yung runs papunta sa individual words na may
      sariling style, para hindi mawala yung bold/italic toggle mid-sentence
      sa wrap point. */
      const words = [];
      runs.forEach((run) => {
        const style = fontStyleFor(run);
        /* Walang peso glyph ang built-in Times. I-normalize muna bago
        sukatin para magtugma yung visible amount at yung allocated width
        nito. */
        run.text.replace(/(-?)₱/g, 'PHP $1').split(/\s+/).filter(Boolean).forEach((text) => {
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

/* Dinadrawing dito yung fixed letterhead (logo + org name, centered) sa
taas ng page at nagbabalik ng y position kung saan dapat magsimula yung
letter body. Laging ipinapasa yung parehong `alias` sa addImage para
isang beses lang ma-embed ng jsPDF yung logo at gamitin ulit sa bawat page
imbes mag-re-embed per page - confirmed live: kung walang alias, yung
2-page document na may parehong ~1MB logo image ay naging 16.7MB; kapag
may alias, yung 20-page document ay nanatiling ~1.15MB. */
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

/* Dinadrawing dito yung full notice ng isang member (letterhead + body)
sa current page ng PDF. Responsibilidad ng caller na tawagin yung
doc.addPage() beforehand para sa bawat member matapos yung una. Nagbabalik
ng false kung hindi na kailangan ng notice yung member sa ngayon (dapat
na-filter na ito ng caller, pero iniwan pa ring defensive dahil
destructive yung draw na ito). */
const renderMemberNoticePage = (doc, member, managerName, thresholds, logoDataUrl) => {
  const { level, html: bodyHtml } = buildNoticeBodyHtml(member, managerName, thresholds);
  if (!level) return false;

  if (level === 1 || level === 2 || level === 3) {
    drawCooperativeNotice(doc, member, level, thresholds?.targetBalance ?? DEFAULT_NOTICE_THRESHOLDS.targetBalance, logoDataUrl, thresholds);
    return true;
  }

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

/* Kinukuha isang beses at ini-cache para sa buong buhay ng tab - hindi
dapat mag-re-fetch ulit ang bulk run ng daan-daang members ng parehong
static asset per member. */
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

/* Nidadownload dito yung notice ng isang member bilang PDF imbes (o
dagdag pa) sa pag-print nito - parehong letter content, parehong
thresholds/template, naka-save lang sa disk imbes na ipadala sa printer.
Nagbabalik ng false kung hindi na kailangan ng notice yung member sa
ngayon. */
export const downloadBalanceNoticePDF = async (member, managerName, thresholds = DEFAULT_NOTICE_THRESHOLDS) => {
  const level = getNoticeLevel(member.balance, thresholds);
  if (!level) return false;

  const logoDataUrl = await getLogoDataUrl();
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  renderMemberNoticePage(doc, member, managerName, thresholds, logoDataUrl);
  doc.save(`${filenameSafe(NOTICE_LEVEL_LABELS[level])}-${filenameSafe(member.name)}.pdf`);
  return true;
};

/* Nidadownload dito yung bawat member sa given notice level bilang isang
combined PDF - isang letter per page - mirror ng printBalanceNoticesBulk
pero naka-save sa disk. Dahil sa native text rendering (walang per-member
screenshot/rasterize step), plain synchronous CPU work na lang itong loop,
hindi na awaited DOM-capture per member - daan-daang members ang
nageneragte sa isang fraction of a second imbes posibleng minuto. Nagbabalik
ng bilang kung ilang notices ang naincluded. */
export const downloadBalanceNoticesBulkPDF = async (members, level, managerName, thresholds = DEFAULT_NOTICE_THRESHOLDS) => {
  const targets = members.filter((m) => getNoticeLevel(m.balance, thresholds) === level);
  if (targets.length === 0) return 0;

  const logoDataUrl = await getLogoDataUrl();
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  targets.forEach((member, index) => {
    if (index > 0) doc.addPage();
    renderMemberNoticePage(doc, member, managerName, thresholds, logoDataUrl);
  });
  doc.save(`${filenameSafe(NOTICE_LEVEL_LABELS[level])}-Batch-${targets.length}.pdf`);
  return targets.length;
};
