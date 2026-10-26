import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('one Mortuary sign-in routes each account by its server role; staff forms offer system-specific roles', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const originalAct = globalThis.IS_REACT_ACT_ENVIRONMENT, originalFetch = globalThis.fetch;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let api, originalGet;
  const click = async text => {
    const button = [...container.querySelectorAll('button')].find(b => b.textContent.trim() === text);
    assert.ok(button, text); await act(async () => button.click());
  };
  try {
    const { default: SystemSelector } = await vite.ssrLoadModule('/src/pages/SystemSelector.jsx');
    for (const role of ['claims_officer', 'finance_officer']) {
      let result, body;
      globalThis.fetch = async (url, options) => {
        body = JSON.parse(options.body);
        return { ok: true, json: async () => ({ token: 'test-token', user: { role, modules: ['mortuary'] } }) };
      };
      await act(async () => root.render(React.createElement(MemoryRouter, { key: role, initialEntries: ['/?module=mortuary'] }, React.createElement(SystemSelector, { onModuleSelect: (...args) => { result = args; } }))));
      assert.ok(container.textContent.includes('Mortuary sign in'));
      assert.equal(container.textContent.includes('Select Your Role'), false);
      await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
      assert.equal(body.module, 'mortuary'); assert.equal(body.expectedRole, undefined);
      assert.equal(result[1], role);
    }
    ({ default: api } = await vite.ssrLoadModule('/src/services/api.js'));
    originalGet = api.get;
    api.get = async () => ({ data: { users: [
      { userId: 'a', username: 'attendance.person', role: 'secretary', modules: ['attendance'], status: 'active' },
      { userId: 'm', username: 'claims.person', role: 'claims_officer', modules: ['mortuary'], status: 'active' },
    ] } });
    const { default: StaffAccounts } = await vite.ssrLoadModule('/src/components/shared/StaffAccounts.jsx');
    await act(async () => root.render(React.createElement(StaffAccounts)));
    assert.ok(container.textContent.includes('attendance.person'));
    assert.equal(container.textContent.includes('claims.person'), false);
    await click('Mortuary');
    assert.ok(container.textContent.includes('claims.person'));
    assert.equal(container.textContent.includes('attendance.person'), false);
    await click('Create staff account');
    const selects = container.querySelectorAll('form select');
    assert.equal(selects[0].value, 'mortuary');
    assert.deepEqual([...selects[1].options].map(option => option.value), ['claims_officer', 'finance_officer']);
    await act(async () => { selects[0].value = 'attendance'; selects[0].dispatchEvent(new window.Event('change', { bubbles: true })); });
    assert.deepEqual([...container.querySelectorAll('form select')[1].options].map(option => option.value), ['admin', 'secretary', 'scanner_operator']);

    api.get = async url => {
      if (url.endsWith('/members') || url.endsWith('/contributions')) return { data: { success: true, data: [], pagination: { totalPages: 1 } } };
      return { data: { success: true, data: { members: [], claims: {} } } };
    };
    const { default: ClaimsPortal } = await vite.ssrLoadModule('/src/pages/mortuary/AdminPortal.jsx');
    await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ['/mortuary/claims_officer?tab=backup'] }, React.createElement(ClaimsPortal, { user: { role: 'claims_officer', name: 'Test Staff' }, onBack() {} }))));
    const names = [...container.querySelectorAll('button[aria-current]')].map(button => button.getAttribute('aria-label'));
    assert.ok(container.textContent.includes('Claims Officer'));
    for (const label of ['Dashboard', 'Claims', 'Beneficiaries']) assert.ok(container.querySelector(`button[aria-label="${label}"]`));
    for (const label of ['Members', 'Audit Logs', 'Backup & Restore']) assert.equal(container.querySelector(`button[aria-label="${label}"]`), null);
    assert.deepEqual(names, ['Dashboard']);
  } finally {
    await act(async () => root.unmount());
    if (api) api.get = originalGet;
    globalThis.fetch = originalFetch; globalThis.IS_REACT_ACT_ENVIRONMENT = originalAct;
    window.sessionStorage.clear(); container.remove(); await vite.close();
  }
});
