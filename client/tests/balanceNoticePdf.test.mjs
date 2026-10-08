import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jsPDF } from 'jspdf';
import { downloadBalanceNoticePDF, downloadBalanceNoticesBulkPDF, printBalanceNotice, parseRichTextBody, drawRichTextBody } from '../src/utils/balanceNotice.js';
import batchService from '../../server/modules/mortuary/services/noticeLetterPdfService.js';

const member = { id: 'MEM-2026-0042', name: 'Test Member', address: 'Sample Street', balance: -2000 };

test('individual and bulk downloads preserve signed balances and replenishment amounts', async (t) => {
  const saved = [];
  const originalSave = jsPDF.API.save;
  jsPDF.API.save = function (filename) {
    saved.push({ filename, content: this.output(), pages: this.getNumberOfPages() });
    return this;
  };
  t.after(() => {
    if (originalSave === undefined) delete jsPDF.API.save;
    else jsPDF.API.save = originalSave;
  });
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  assert.equal(await downloadBalanceNoticePDF(member, 'Manager'), true);
  assert.equal(await downloadBalanceNoticesBulkPDF([
    member, { ...member, name: 'Zero Balance', balance: 0 },
    { ...member, name: 'No Notice', balance: 1000 },
  ], 3, 'Manager'), 2);
  assert.equal(saved[0].filename, 'Final-Notice-Test-Member.pdf');
  assert.equal(saved[0].pages, 1);
  assert.equal(saved[1].pages, 2);
  for (const { content } of saved) {
    assert.match(content, /\(PHP\) Tj/);
    assert.match(content, /\(-2,000\.00\) Tj/);
    assert.match(content, /\(3,000\.00\) Tj/);
    assert.doesNotMatch(content, /₱|±/);
  }
  assert.match(saved[1].content, /\(0\.00\) Tj/);
  assert.equal(await downloadBalanceNoticePDF({ ...member, balance: 1000 }), false);
  assert.equal(saved.length, 2);
});

test('printed notices retain the peso symbol and negative sign', () => {
  let markup;
  const previousWindow = globalThis.window;
  globalThis.window = {
    location: { origin: 'http://localhost' },
    open: () => ({ document: { write: html => { markup = html; }, close() {} } }),
  };
  try {
    printBalanceNotice(member, 'Manager');
    assert.match(markup, /<strong>-₱2,000\.00<\/strong>/);
    assert.match(markup, /<strong>₱3,000\.00<\/strong>/);
    printBalanceNotice({ ...member, balance: 800 }, 'Manager');
    assert.match(markup, /<strong>₱800\.00<\/strong>/);
    assert.match(markup, /<strong>₱200\.00<\/strong>/);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('PDF currency is measured after conversion and cannot overlap adjacent words', () => {
  const doc = new jsPDF({ unit: 'pt' });
  doc.setFont('times', 'normal');
  const drawn = [];
  const originalText = doc.text.bind(doc);
  doc.text = (text, x, y) => {
    drawn.push({ text, x, y, width: doc.getTextWidth(text), style: doc.getFont().fontStyle });
    return originalText(text, x, y);
  };
  drawRichTextBody(doc, parseRichTextBody('<p>You have <strong>-₱2,000.00</strong> deposits. Please deposit <strong>₱3,000.00</strong> immediately.</p>'), {
    x: 54, y: 160, maxWidth: 240, lineHeight: 17, fontSize: 12, pageHeight: 842, topMargin: 54,
  });
  assert.equal(drawn.map(w => w.text).join(' '), 'You have PHP -2,000.00 deposits. Please deposit PHP 3,000.00 immediately.');
  assert.equal(drawn.find(w => w.text === '-2,000.00').style, 'bold');
  drawn.forEach((word, index) => {
    assert.ok(word.x + word.width <= 294.01);
    const next = drawn[index + 1];
    if (next?.y === word.y) assert.ok(next.x > word.x + word.width);
  });
});

test('server-generated batches use the same signed PDF currency', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'notice-pdf-'));
  const outputPath = join(directory, 'batch.pdf');
  try {
    const count = await batchService.generateNoticeBatchPdf([member], 3, 'Manager', batchService.DEFAULT_NOTICE_THRESHOLDS, outputPath);
    assert.equal(count, 1);
    const content = await readFile(outputPath, 'latin1');
    assert.match(content, /\(PHP\) Tj/);
    assert.match(content, /\(-2,000\.00\) Tj/);
    assert.match(content, /\(3,000\.00\) Tj/);
  } finally {
    await rm(outputPath, { force: true });
    await rmdir(directory);
  }
});
