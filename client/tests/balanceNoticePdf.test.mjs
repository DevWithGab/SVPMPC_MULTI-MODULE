import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jsPDF } from 'jspdf';
import { downloadBalanceNoticePDF, downloadBalanceNoticesBulkPDF, printBalanceNotice, parseRichTextBody, drawRichTextBody } from '../src/utils/balanceNotice.js';
import batchService from '../../server/modules/mortuary/services/noticeLetterPdfService.js';
import { drawCooperativeNotice, drawTwoCopyNotice } from '../src/utils/cooperativeNotice.js';

const member = { id: 'MEM-2026-0042', name: 'Test Member', address: 'Sample Street', balance: -2000 };

test('two-copy Letter layout keeps all text inside its half sheet, including long messages', () => {
  for (const message of [undefined, 'A longer custom notice message. '.repeat(200)]) {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const matrixMethod = doc.setCurrentTransformationMatrix.bind(doc);
    const textMethod = doc.text.bind(doc);
    let matrix;
    let copy = -1;
    const rendered = [[], []];
    doc.setCurrentTransformationMatrix = value => { matrix = value; copy++; return matrixMethod(value); };
    doc.text = (value, x, y, options) => {
      const screenY = 792 - (matrix.d * (792 - y) + matrix.f);
      assert.ok(screenY >= copy * 396 && screenY < (copy + 1) * 396, `text stays inside copy ${copy + 1}`);
      rendered[copy].push(value);
      return textMethod(value, x, y, options);
    };
    drawTwoCopyNotice(doc, member, 3, 1000, null, message ? { finalNoticeMessageTemplate: message } : undefined);
    assert.equal(doc.getNumberOfPages(), 1);
    assert.deepEqual(rendered[0], rendered[1], 'both copies have identical member content');
    assert.ok(rendered[0].some(value => String(value).includes('Received by:')));
  }
});

test('edited messages are used for print, individual PDF and background batches at every notice level', async (t) => {
  const previousWindow = globalThis.window;
  const originalSave = jsPDF.API.save;
  let markup;
  let saved;
  globalThis.window = { location: { origin: 'http://localhost' }, open: () => ({ document: { write: value => { markup = value; }, close() {} } }) };
  jsPDF.API.save = function () { saved = this.output(); return this; };
  t.after(() => { globalThis.window = previousWindow; if (originalSave === undefined) delete jsPDF.API.save; else jsPDF.API.save = originalSave; });
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  const template = 'Edited message for {name}. Balance: {balance}. Deposit {amountNeeded}.\n\nCustom closing from {managerName}.';
  const settings = { ...batchService.DEFAULT_NOTICE_THRESHOLDS, noticeMessageTemplate: template, finalNoticeMessageTemplate: template, noticeManagerName: 'MARIA C. SANTOS' };
  const directory = await mkdtemp(join(tmpdir(), 'edited-notices-'));
  try {
    for (const [level, balance] of [[1, 800], [2, 500], [3, -200]]) {
      const record = { ...member, name: 'Juan <Cruz>', balance };
      printBalanceNotice(record, 'Treasurer', settings);
      assert.ok(markup.includes('Edited message for Juan &lt;Cruz&gt;'));
      assert.ok(markup.includes('Custom closing from MARIA C. SANTOS.'));
      assert.ok(markup.includes('<b>MARIA C. SANTOS</b>'));
      assert.ok(!markup.includes('MONINA C. GUZMAN'));
      assert.ok(!markup.includes('{amountNeeded}'));
      await downloadBalanceNoticePDF(record, 'Treasurer', settings);
      assert.ok(saved.includes('Edited message for Juan <Cruz>'));
      assert.ok(saved.includes('Custom closing from MARIA C. SANTOS.'));
      assert.ok(!saved.includes('MONINA C. GUZMAN'));
      const outputPath = join(directory, `notice-${level}.pdf`);
      await batchService.generateNoticeBatchPdf([record], level, 'Treasurer', settings, outputPath);
      const content = await readFile(outputPath, 'latin1');
      assert.ok(content.includes('Edited message for Juan <Cruz>'));
      assert.ok(content.includes('Custom closing from MARIA C. SANTOS.'));
      assert.ok(!content.includes('MONINA C. GUZMAN'));
      await rm(outputPath);
    }
  } finally { await rmdir(directory); }
});

test('long edited messages continue onto additional pages and keep the receipt after the last paragraph', () => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  drawCooperativeNotice(doc, member, 3, 1000, null, { finalNoticeMessageTemplate: 'Additional information for the member. '.repeat(180) + '\n\nEND OF EDITED MESSAGE' });
  assert.ok(doc.getNumberOfPages() > 1);
  const lastPage = doc.internal.pages.at(-1).join('\n');
  assert.ok(lastPage.includes('END OF EDITED MESSAGE'));
  assert.ok(lastPage.includes('MONINA C. GUZMAN'));
  assert.ok(lastPage.includes('Received by:'));
});

test('official PDF paragraphs wrap within the landscape page', () => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const originalText = doc.text.bind(doc);
  const bodyLines = [];
  doc.text = (value, x, y, options) => {
    if (x === 73) {
      bodyLines.push(value);
      assert.ok(x + doc.getTextWidth(value) <= doc.internal.pageSize.getWidth() - 47);
    }
    return originalText(value, x, y, options);
  };
  drawCooperativeNotice(doc, { ...member, balance: 800 }, 1, 1000, null);
  assert.ok(bodyLines.length >= 3);
  assert.equal(doc.getNumberOfPages(), 1);
});

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
    assert.match(content, /PHP -2,000\.00/);
    assert.match(content, /PHP 3,000\.00/);
    assert.match(content, /LAST NOTICE/);
    assert.doesNotMatch(content, /₱|±/);
  }
  assert.match(saved[1].content, /PHP 0\.00/);
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
    assert.match(content, /PHP -2,000\.00/);
    assert.match(content, /PHP 3,000\.00/);
    assert.match(content, /LAST NOTICE/);
  } finally {
    await rm(outputPath, { force: true });
    await rmdir(directory);
  }
});


test('all official forms auto-fill details and keep browser and server PDFs aligned', async (t) => {
  const saved = [];
  const originalSave = jsPDF.API.save;
  jsPDF.API.save = function () { saved.push({ content: this.output(), pages: this.getNumberOfPages(), width: this.internal.pageSize.getWidth(), height: this.internal.pageSize.getHeight() }); return this; };
  t.after(() => { jsPDF.API.save = originalSave; });
  const previousWindow = globalThis.window;
  let markup;
  globalThis.window = { location: { origin: 'http://localhost' }, open: () => ({ document: { write: html => { markup = html; }, close() {} } }) };
  const directory = await mkdtemp(join(tmpdir(), 'official-notice-'));
  try {
    for (const [level, balance, heading] of [[1, 800, 'FIRST NOTICE'], [2, 500, 'SECOND NOTICE'], [3, -200, 'LAST NOTICE']]) {
      const record = { ...member, name: 'Juan <Dela Cruz>', passbookNumber: 'PB-0042', balance };
      printBalanceNotice(record, 'Treasurer');
      assert.ok(markup.includes(heading));
      assert.ok(markup.includes('Juan &lt;Dela Cruz&gt;'));
      assert.ok(markup.includes('PB-0042'));
      assert.ok(markup.includes('MONINA C. GUZMAN'));
      if (level === 3) {
        assert.ok(markup.includes('within (30) days'));
        assert.ok(markup.includes('Failure to do so will automatically drop you from the program.'));
        assert.ok(markup.includes('Please be guided and updated accordingly.'));
        assert.ok(markup.includes('Passbook #:'));
        assert.ok(markup.includes('Please disregard notice if payment has been made.'));
      }
      assert.match(markup, /Date:<\/b> [A-Za-z]+ \d{1,2}, \d{4}/);
      await downloadBalanceNoticePDF(record, 'Treasurer');
      const pdf = saved.at(-1);
      assert.equal(pdf.pages, 1);
      assert.equal(pdf.width, 612);
      assert.equal(pdf.height, 792);
      assert.equal(pdf.content.split('(PB-0042)').length - 1, 2, 'each member has two copies on one sheet');
      assert.equal((markup.match(/class="notice-copy"/g) || []).length, 2);
      assert.match(markup, /size: Letter portrait/);
      for (const expected of [heading, 'PB-0042', 'MONINA C. GUZMAN', 'Dupax del Sur, Nueva Vizcaya']) assert.ok(pdf.content.includes(expected));
      const outputPath = join(directory, 'notice-' + level + '.pdf');
      assert.equal(await batchService.generateNoticeBatchPdf([record], level, 'Treasurer', batchService.DEFAULT_NOTICE_THRESHOLDS, outputPath), 1);
      const content = await readFile(outputPath, 'latin1');
      assert.equal(content.split('(PB-0042)').length - 1, 2, 'background PDFs also contain both copies');
      assert.match(content, /\/MediaBox \[0 0 612(?:\.0*)? 792(?:\.0*)?\]/);
      for (const expected of [heading, 'PB-0042', 'MONINA C. GUZMAN']) assert.ok(content.includes(expected));
      await rm(outputPath);
    }
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    await rmdir(directory);
  }
});
