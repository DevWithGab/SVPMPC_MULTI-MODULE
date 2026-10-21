import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('benefit cap form blocks invalid values and saves 10,000 as 10000', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let api, original;
  try {
    const { default: Modal } = await vite.ssrLoadModule('/src/components/mortuary/admin/modals/UpdateBenefitCapModal.jsx');
    ({ benefitCapSettingAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    original = api.updateCap;
    const calls = [];
    let closed = 0, refreshed = 0;
    api.updateCap = async data => { calls.push(data); };
    await act(async () => root.render(React.createElement(Modal, {
      isOpen: true, currentAmount: 50000, user: { username: 'admin' },
      onClose: () => { closed++; }, onSaved: () => { refreshed++; },
    })));
    const input = container.querySelector('#benefit-cap-amount');
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const submit = async value => {
      await act(async () => {
        setValue.call(input, value);
        input.dispatchEvent(new window.Event('input', { bubbles: true }));
      });
      await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
    };
    for (const invalid of ['100a', '10,00', '1.234', '', '0', '-10']) {
      await submit(invalid);
      assert.equal(calls.length, 0, invalid);
      assert.match(container.querySelector('[role="alert"]').textContent, /letters are not allowed/);
      assert.equal(input.getAttribute('aria-invalid'), 'true');
    }
    await submit('10,000');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].amount, 10000);
    assert.equal(closed, 1);
    assert.equal(refreshed, 1);
    assert.equal(input.value, '');
    await submit('10,000.50');
    assert.equal(calls[1].amount, 10000.5);
  } finally {
    await act(async () => root.unmount());
    if (original) api.updateCap = original;
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    await vite.close();
  }
});
