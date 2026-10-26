import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('ledger date order invalidates preview and is sent for both preview and import', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const prototype = window.HTMLDialogElement.prototype;
  const originalShow = prototype.showModal, originalClose = prototype.close;
  prototype.showModal = function () {}; prototype.close = function () {};
  let api, original;
  try {
    ({ treasurerAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    original = api.bulkUploadLedger;
    const calls = [];
    api.bulkUploadLedger = async (csv, action, order) => {
      calls.push({action, order});
      return { summary: {ready: 1, invalid: 0, total: 1}, rows: [], results: {success: [{}], failed: []} };
    };
    const { default: Upload } = await vite.ssrLoadModule('/src/components/mortuary/treasurer/BulkLedgerUpload.jsx');
    await act(async () => root.render(React.createElement(Upload, {onClose() {}, onDownloadTemplate() {}})));
    const button = text => [...container.querySelectorAll('button')].find(node => node.textContent.trim() === text);
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', {value: [{name: 'ledger.csv', size: 100, text: async () => 'test CSV'}]});
    await act(async () => input.dispatchEvent(new window.Event('change', {bubbles: true})));
    await act(async () => button('Preview Entries').click());
    assert.ok(button('Import 1 Entries'));
    const order = container.querySelector('select');
    await act(async () => {order.value = 'dmy'; order.dispatchEvent(new window.Event('change', {bubbles: true}));});
    assert.equal(button('Import 1 Entries'), undefined);
    await act(async () => button('Preview Entries').click());
    await act(async () => button('Import 1 Entries').click());
    assert.deepEqual(calls, [{action:'preview',order:'auto'}, {action:'preview',order:'dmy'}, {action:'import',order:'dmy'}]);
  } finally {
    if (api) api.bulkUploadLedger = original;
    await act(async () => root.unmount());
    prototype.showModal = originalShow; prototype.close = originalClose;
    container.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; await vite.close();
  }
});
