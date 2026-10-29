import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('button tooltips support focus, hover, dismissal, descriptions, and original actions', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    const { Button } = await vite.ssrLoadModule('/src/components/ui/button.jsx');
    let clicks = 0;
    await act(async () => root.render(React.createElement(Button, { tooltip: 'Review recorded changes.', 'aria-describedby': 'existing-help', onClick: () => clicks++ }, 'View')));
    const button = container.querySelector('button');
    await act(async () => button.focus());
    const tooltip = document.querySelector('[role="tooltip"]');
    assert.equal(tooltip.textContent, 'Review recorded changes.');
    assert.equal(tooltip.parentElement, document.body);
    assert.equal(button.getAttribute('aria-describedby'), `existing-help ${tooltip.id}`);
    await act(async () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(document.querySelector('[role="tooltip"]'), null);
    assert.equal(button.getAttribute('aria-describedby'), 'existing-help');
    await act(async () => button.dispatchEvent(new window.Event('pointerover', { bubbles: true })));
    assert.ok(document.querySelector('[role="tooltip"]'));
    await act(async () => button.click());
    assert.equal(clicks, 1);
    assert.equal(document.querySelector('[role="tooltip"]'), null);
    await act(async () => button.dispatchEvent(new window.Event('pointerover', { bubbles: true })));
    await act(async () => window.dispatchEvent(new window.Event('scroll')));
    assert.equal(document.querySelector('[role="tooltip"]'), null);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    await vite.close();
  }
});
