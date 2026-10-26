import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('Contributions bookmarks open Member Ledger and the Contributions sidebar tab is removed', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const originalAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let api, originalGet;
  try {
    ({ default: api } = await vite.ssrLoadModule('/src/services/api.js'));
    originalGet = api.get;
    api.get = async url => {
      if (url.endsWith('/balances/all')) return { data: { success: true, data: { members: [{ id: 'M1', name: 'Test Member', balance: 1000 }], pagination: { total: 1, totalPages: 1 } } } };
      if (url.endsWith('/ledger/M1')) return { data: { success: true, data: [{ id: 'OPEN', date: '2026-10-26', received: 1000, withdrawn: 0, balance: 1000, ref_no: 'OPEN-1', canCorrect: true }], pagination: { totalPages: 1 } } };
      if (url.endsWith('/contributions')) return { data: { success: true, data: [], pagination: { totalPages: 1 } } };
      if (url.includes('/claims')) return { data: { success: true, data: [], pagination: { total: 0, totalPages: 1 } } };
      return { data: { success: true, data: {} } };
    };
    const { default: TreasurerPortal } = await vite.ssrLoadModule('/src/pages/mortuary/TreasurerPortal.jsx');
    await act(async () => root.render(React.createElement(MemoryRouter, {
      initialEntries: ['/mortuary/treasurer?tab=contributions'],
    }, React.createElement(TreasurerPortal, { user: { name: 'Test Treasurer', role: 'treasurer' }, onBack() {} }))));
    assert.ok([...container.querySelectorAll('h1, h2')].some(heading => /Members? ledger/i.test(heading.textContent)));
    const buttons = [...container.querySelectorAll('button')];
    assert.equal(buttons.some(button => button.textContent.trim() === 'Contributions'), false);
    assert.equal(buttons.find(button => button.textContent.trim() === 'Members Ledger')?.getAttribute('aria-current'), 'page');
    assert.ok(buttons.find(button => /Bulk upload CSV/i.test(button.textContent)));
    await act(async () => root.render(React.createElement(MemoryRouter, {
      key: 'member', initialEntries: ['/mortuary/finance_officer?tab=ledger&member=M1'],
    }, React.createElement(TreasurerPortal, { user: { name: 'Finance Staff', role: 'finance_officer' }, onBack() {} }))));
    assert.match(container.textContent, /Transaction history for Test Member/);
    const memberButtons = [...container.querySelectorAll('button')];
    assert.equal(memberButtons.some(button => /Add Deposit|Record payment/i.test(button.textContent)), false);
    assert.ok(memberButtons.find(button => button.textContent.trim() === 'Edit amount'));
  } finally {
    await act(async () => root.unmount());
    if (originalGet) api.get = originalGet;
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalAct;
    container.remove();
    await vite.close();
  }
});
