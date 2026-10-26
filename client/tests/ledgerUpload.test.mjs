import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('ledger upload rejects non-CSV files and requires a valid preview before importing', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const dialog = window.HTMLDialogElement.prototype;
  const originalShow = dialog.showModal;
  const originalClose = dialog.close;
  dialog.showModal = function () {};
  dialog.close = function () {};
  let api, original;
  try {
    const { default: BulkLedgerUpload } = await vite.ssrLoadModule('/src/components/mortuary/treasurer/BulkLedgerUpload.jsx');
    ({ treasurerAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    original = api.bulkUploadLedger;
    let invalid = true;
    let completedImport = false;
    const actions = [];
    api.bulkUploadLedger = async (csv, action) => {
      actions.push(action);
      assert.equal(csv, 'test CSV content');
      if (action === 'import') completedImport = true;
      return { summary: { ready: invalid || completedImport ? 0 : 1, invalid: invalid ? 1 : 0, duplicates: invalid ? 0 : completedImport && action === 'preview' ? 2 : 1, total: invalid ? 1 : 2 },
        ...(action === 'import' ? { results: { success: [{}], failed: [], skipped: [{}] } } : {}),
        rows: [{
        row: 8, memberName: 'Test Member', entry: { memberId: '000123', transactionDate: '2026-10-21', credit: 100, debit: 0 },
        status: invalid ? 'error' : action === 'import' ? 'imported' : completedImport ? 'duplicate' : 'ready', errors: invalid ? ['Only cash paymentMethod is supported.'] : [],
      }, ...(!invalid ? [{ row: 9, entry: { memberId: '000123', transactionDate: '2026-10-21', credit: 100, debit: 0 }, status: action === 'import' ? 'skipped' : 'duplicate', errors: [], message: 'Already recorded.' }] : [])] };
    };
    await act(async () => root.render(React.createElement(BulkLedgerUpload, { onClose() {}, onDownloadTemplate() {} })));
    const choose = async name => {
      const input = container.querySelector('input[type="file"]');
      Object.defineProperty(input, 'files', { configurable: true, value: [{ name, size: 50, text: async () => 'test CSV content' }] });
      await act(async () => input.dispatchEvent(new window.Event('change', { bubbles: true })));
    };
    const button = label => [...container.querySelectorAll('button')].find(item => item.textContent.trim() === label);
    await choose('wrong.xlsx');
    assert.match(container.querySelector('[role="alert"]').textContent, /Choose a CSV/);
    assert.equal(button('Preview Entries').disabled, true);
    await choose('ledger.csv');
    assert.equal(button('Preview Entries').disabled, false);
    assert.equal(button('Import 1 Entries'), undefined);
    await act(async () => button('Preview Entries').click());
    assert.match(container.querySelector('tbody').textContent, /Only cash/);
    assert.equal(button('Import 1 Entries'), undefined);
    invalid = false;
    await act(async () => button('Preview Again').click());
    assert.ok(button('Import 1 Entries'));
    assert.match(container.textContent, /1 duplicates will not be recorded/);
    await act(async () => button('Import 1 Entries').click());
    assert.match(container.textContent, /1 recorded · 1 duplicates not recorded · 0 need retry/);
    assert.match(container.querySelector('tbody').textContent, /Duplicate — not recorded/);
    assert.equal(button('Import 1 Entries'), undefined);
    await act(async () => button('Preview Again').click());
    assert.match(container.textContent, /All entries are already recorded/);
    assert.equal(button('Import 1 Entries'), undefined);
    await choose('replacement.csv');
    assert.equal(button('Import 1 Entries'), undefined);
    assert.deepEqual(actions, ['preview', 'preview', 'import', 'preview']);
  } finally {
    await act(async () => root.unmount());
    if (original) api.bulkUploadLedger = original;
    dialog.showModal = originalShow;
    dialog.close = originalClose;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    container.remove();
    await vite.close();
  }
});
