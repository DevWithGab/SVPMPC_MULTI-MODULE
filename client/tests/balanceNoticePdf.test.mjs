import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { addCanvasAsPdfPage } from '../src/utils/balanceNotice.js';

const png = await readFile(new URL('../public/SVPMPC-LOGO(MAIN).png', import.meta.url));
const canvas = (width, height) => ({
  width, height,
  toDataURL: () => `data:image/png;base64,${png.toString('base64')}`,
});

function assertPageFits(pdf, width, height) {
  assert.ok(Math.abs(pdf.internal.pageSize.getWidth() - width) < 0.01);
  assert.ok(Math.abs(pdf.internal.pageSize.getHeight() - height) < 0.01);
}

test('short notices retain their full width instead of being forced into portrait', () => {
  const pdf = addCanvasAsPdfPage(null, canvas(1588, 1356));
  assertPageFits(pdf, 1588, 1356);
  assert.equal(pdf.getNumberOfPages(), 1);
});

test('bulk notices select orientation separately for short, tall and square pages', () => {
  let pdf = null;
  const sizes = [[1588, 1356], [1588, 2200], [1588, 1356], [1588, 1588]];
  for (const [width, height] of sizes) pdf = addCanvasAsPdfPage(pdf, canvas(width, height));
  assert.equal(pdf.getNumberOfPages(), sizes.length);
  sizes.forEach(([width, height], index) => {
    pdf.setPage(index + 1);
    assertPageFits(pdf, width, height);
  });
});
