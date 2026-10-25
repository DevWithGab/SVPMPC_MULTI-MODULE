import { jsPDF } from 'jspdf';
import { QR_CARD_MM, QR_CARD_PAPER } from './memberDirectory.js';

// The card keeps its original size (QR 180 px ≈ 47.6 mm) and sits centered on
// an A6 page, matching the printed version.
const PAGE = QR_CARD_PAPER;
const ORIGIN = { x: (QR_CARD_PAPER.width - QR_CARD_MM.width) / 2, y: (QR_CARD_PAPER.height - QR_CARD_MM.height) / 2 };
const PAD = 5.8;
const QR_SIZE = 47.6;

const loadImage = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`Image unavailable: ${url}`));
  img.src = url;
});

// The logo is a 2048 px PNG; shrink it once so jsPDF doesn't process the full
// image for every card.
const logoDataUrl = async (url) => {
  const img = await loadImage(url);
  const width = Math.min(160, img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round(img.naturalHeight * (width / img.naturalWidth));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
};

/* Reads the server's QR PNG back into its grid of modules, so the PDF can draw
the exact same code as vector squares: razor sharp at any size, tiny file, and
far faster than embedding one image per card. */
const readQrMatrix = async (url) => {
  const img = await loadImage(url);
  const { naturalWidth: width, naturalHeight: height } = img;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);
  const dark = (x, y) => data[(Math.floor(y) * width + Math.floor(x)) * 4] < 128;

  let minX = width, minY = height, maxX = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (dark(x, y)) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; }
    }
  }
  // The top-left finder pattern is 7 modules wide, which gives a rough module
  // width. Modules aren't whole pixels, so snap to the nearest valid QR size
  // (21, 25, …, 177 modules) and derive the exact width from the full span.
  let run = 0;
  while (minX + run < width && dark(minX + run, minY)) run++;
  const span = maxX - minX + 1;
  const estimate = span / (run / 7);
  const size = Math.min(177, Math.max(21, 17 + 4 * Math.round((estimate - 17) / 4)));
  const modulePx = span / size;
  if (!run || maxX < 0 || Math.abs(estimate - size) > 1.5) throw new Error(`Unreadable QR image: ${url}`);

  const rows = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) =>
    dark(minX + (c + 0.5) * modulePx, minY + (r + 0.5) * modulePx)));
  return { rows, imageWidth: width, offsetPx: minX, modulePx };
};

// Draws the QR at its original printed size. Every dark run becomes a rectangle
// in ONE path filled once, so viewers can't anti-alias seams between rows.
const drawQr = (doc, qr, x, y, sizeMm) => {
  const mm = sizeMm / qr.imageWidth;
  const module = qr.modulePx * mm;
  const ox = x + qr.offsetPx * mm;
  const oy = y + qr.offsetPx * mm;
  doc.setFillColor(0, 0, 0);
  qr.rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (!row[c]) continue;
      let end = c;
      while (end + 1 < row.length && row[end + 1]) end++;
      doc.rect(ox + c * module, oy + r * module, (end - c + 1) * module, module, null);
      c = end;
    }
  });
  doc.fill();
};

const fitText = (doc, text, maxWidth) => {
  let value = String(text ?? '');
  if (doc.getTextWidth(value) <= maxWidth) return value;
  while (value.length > 1 && doc.getTextWidth(`${value}…`) > maxWidth) value = value.slice(0, -1);
  return `${value}…`;
};

/**
 * Builds a PDF with one member QR card per card-sized page.
 * @param {{ member: { name, memberId, barangay, status }, qrUrl: string }[]} entries
 * @param {{ logoUrl?: string }} options
 * @returns {Promise<jsPDF>}
 */
export async function buildQrCardsPdf(entries, { logoUrl } = {}) {
  // Load every QR before drawing, so a missing image fails the whole download
  // instead of producing a PDF with blank cards.
  const [logo, ...qrCodes] = await Promise.all([
    logoUrl ? logoDataUrl(logoUrl).catch(() => null) : null,
    ...entries.map(({ qrUrl }) => readQrMatrix(qrUrl)),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: PAGE.name.toLowerCase(), compress: true });
  const inner = QR_CARD_MM.width - PAD * 2;
  const left = ORIGIN.x + PAD;
  const right = ORIGIN.x + QR_CARD_MM.width - PAD;
  const top = ORIGIN.y + PAD;

  entries.forEach(({ member }, index) => {
    if (index > 0) doc.addPage(PAGE.name.toLowerCase());

    // Letterhead
    const textX = left + (logo ? 12.5 : 0);
    if (logo) doc.addImage(logo, 'PNG', left, top, 9.3, 11.1, 'cooperative-logo');
    doc.setTextColor(36, 54, 42).setFont('helvetica', 'bold').setFontSize(8.5);
    doc.text('St. Vincent Parish', textX, top + 4);
    doc.text('Multi-Purpose Cooperative', textX, top + 7.6);
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(100, 112, 105);
    doc.text('Member identification', textX, top + 11);
    doc.setDrawColor(205, 214, 207).setLineWidth(0.3).line(left, top + 15.5, right, top + 15.5);

    // Member: long names wrap to a second line, like the printed card.
    doc.setTextColor(36, 54, 42).setFont('helvetica', 'bold').setFontSize(13.5);
    const nameLines = doc.splitTextToSize(String(member.name ?? ''), inner).slice(0, 2);
    doc.text(nameLines, left, top + 23);
    let y = top + 23 + (nameLines.length - 1) * 5.6;
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(82, 96, 88);
    doc.text(fitText(doc, `Passbook number: ${member.memberId}`, inner), left, y + 5);

    // QR at its original size
    y += 10;
    drawQr(doc, qrCodes[index], (PAGE.width - QR_SIZE) / 2, y, QR_SIZE);
    y += QR_SIZE + 5;
    doc.setFontSize(7.5).setTextColor(100, 112, 105);
    doc.text('Present this code for attendance scanning.', PAGE.width / 2, y, { align: 'center' });

    // Details
    y += 4;
    doc.setDrawColor(205, 214, 207).line(left, y, right, y);
    doc.setFontSize(8);
    [['Membership status', member.status || 'Not recorded'], ['Barangay', member.barangay || 'Not recorded']].forEach(([label, value], row) => {
      const rowY = y + 6 + row * 5.2;
      doc.setTextColor(100, 112, 105).text(label, left, rowY);
      doc.setTextColor(36, 54, 42).text(fitText(doc, value, inner - 30), right, rowY, { align: 'right' });
    });
  });

  return doc;
}
