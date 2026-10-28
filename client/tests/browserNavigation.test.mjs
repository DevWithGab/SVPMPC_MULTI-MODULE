import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';
import { MemoryRouter, useNavigate, useLocation } from 'react-router-dom';

test('login and portal screens follow browser Back/Forward, including direct login links', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    const { default: SystemSelector } = await vite.ssrLoadModule('/src/pages/SystemSelector.jsx');
    const { default: useUrlState } = await vite.ssrLoadModule('/src/hooks/useUrlState.js');
    let navigate;
    let location;
    let setTab;
    let tab;
    let signedIn;
    function Harness({ portal = false }) {
      navigate = useNavigate();
      location = useLocation();
      [tab, setTab] = useUrlState('tab', 'dashboard', ['dashboard', 'members', 'claims']);
      return portal ? React.createElement('p', null, tab) : React.createElement(SystemSelector, { key: location.search, onModuleSelect: (...args) => { signedIn = args; } });
    }
    const mount = (entry, portal = false) => act(async () => root.render(
      React.createElement(MemoryRouter, { key: entry, initialEntries: [entry] }, React.createElement(Harness, { portal })),
    ));
    const click = async text => {
      const button = [...container.querySelectorAll('button')].find(item => item.textContent.includes(text));
      assert.ok(button, `Missing button: ${text}`);
      await act(async () => button.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    };
    const travel = delta => act(async () => navigate(delta));
    const shows = text => assert.ok(container.textContent.includes(text), `Expected screen: ${text}`);

    await mount('/');
    shows('Choose a module');
    await click('Attendance System');
    shows('Sign in to your account to continue.');
    assert.equal(location.search, '?module=attendance');
    assert.equal(container.querySelector('.role-selection'), null);
    await travel(-1);
    shows('Choose a module');
    await travel(1);
    shows('Sign in to your account to continue.');
    await click('Back to System Selection');
    shows('Choose a module');
    await mount('/?module=attendance&role=scanner_operator');
    shows('Sign in to your account to continue.');
    await click('Back to System Selection');
    shows('Choose a module');

    const originalFetch = globalThis.fetch;
    try {
      for (const role of ['secretary', 'scanner_operator']) {
        await mount('/?module=attendance');
        globalThis.fetch = async (_url, options) => {
          const body = JSON.parse(options.body);
          assert.equal(body.module, 'attendance');
          assert.equal(body.expectedRole, undefined);
          return { ok: true, json: async () => ({ token: 'test-token', user: { role } }) };
        };
        await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
        assert.equal(signedIn[0], 'attendance');
        assert.equal(signedIn[1], role);
      }
    } finally { globalThis.fetch = originalFetch; window.sessionStorage.clear(); }

    await mount('/?module=mortuary&role=treasurer');
    shows('Sign in to your account to continue.');
    await click('Back to System Selection');
    shows('Choose a module');
    await mount('/?module=mortuary&role=scanner_operator');
    shows('Sign in to your account to continue.');
    await mount('/?module=unknown&role=admin');
    shows('Choose a module');

    await mount('/mortuary/treasurer', true);
    await act(async () => setTab('members'));
    await act(async () => setTab('claims'));
    assert.equal(tab, 'claims');
    await travel(-1);
    assert.equal(tab, 'members');
    await travel(-1);
    assert.equal(tab, 'dashboard');
    await travel(1);
    assert.equal(tab, 'members');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    await vite.close();
  }
});
