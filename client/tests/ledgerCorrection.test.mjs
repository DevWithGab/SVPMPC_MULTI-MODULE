import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('amount editing needs no reason, previews balances and retries unchanged', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const dialog = window.HTMLDialogElement.prototype;
  const originalShow = dialog.showModal, originalClose = dialog.close;
  dialog.showModal = function () {};
  dialog.close = function () {};
  let api, originalPost;
  try {
    ({ default: api } = await vite.ssrLoadModule('/src/services/api.js')); originalPost = api.post;
    const requests = []; let saved = 0;
    api.post = async (url, body) => { requests.push({ url, body }); if (requests.length === 1) throw { response: { data: { message: 'Balance saved; retry to finish audit.' } } }; return { data: { success: true } }; };
    const { default: Dialog } = await vite.ssrLoadModule('/src/components/mortuary/treasurer/LedgerCorrectionDialog.jsx');
    const member = { id: 'M 1', name: 'Test Member', balance: 1500 };
    const entry = { id: 'ORIGINAL', sourceLedgerId: 'ORIGINAL', received: 1000, ref_no: 'OR-1' };
    const button = text => [...container.querySelectorAll('button')].find(node => node.textContent === text);
    const setValue = async (element, value) => act(async () => {
      const proto = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
      element.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await act(async () => root.render(React.createElement(Dialog, { entry, member, onClose() {}, onSaved() { saved++; } })));
    assert.equal(button('Review change').disabled, true);
    await setValue(container.querySelector('input'), '100');
    assert.equal(container.querySelector('textarea'), null);
    assert.equal(button('Review change').disabled, false);
    await act(async () => button('Review change').click());
    assert.match(container.textContent, /600\.00/); assert.equal(requests.length, 0);
    await act(async () => button('Save amount').click());
    assert.match(container.querySelector('[role="alert"]').textContent, /retry/);
    assert.equal(button('Back'), undefined);
    await act(async () => button('Retry save').click());
    assert.equal(saved, 1); assert.deepEqual(requests[0], requests[1]);
    assert.equal(requests[0].body.reason, ''); assert.equal(requests[0].body.expectedBalance, 1500); assert.equal(requests[0].body.expectedAmount, 1000);
    assert.match(requests[0].url, /M%201\/entries\/ORIGINAL\/correct$/);
    await act(async () => root.render(React.createElement(Dialog, { key: 'pending', member: { ...member, balance: 600 }, entry: { ...entry, id: 'CORRECTION', received: 100, pendingCorrection: { sourceLedgerId: 'ORIGINAL', amount: 100, expectedAmount: 1000, reason: 'Entered 1000 instead of 100 from the receipt.' } }, onClose() {}, onSaved() { saved++; } })));
    assert.match(container.textContent, /Current balance \(already adjusted\)/);
    await act(async () => button('Retry save').click());
    assert.equal(requests.at(-1).body.amount, 100); assert.match(requests.at(-1).url, /entries\/ORIGINAL\/correct$/);
  } finally {
    await act(async () => root.unmount()); if (api) api.post = originalPost;
    dialog.showModal = originalShow; dialog.close = originalClose;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct; container.remove(); await vite.close();
  }
});
