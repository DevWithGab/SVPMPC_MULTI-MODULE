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
    function Harness({ portal = false }) {
      navigate = useNavigate();
      location = useLocation();
      [tab, setTab] = useUrlState('tab', 'dashboard', ['dashboard', 'members', 'claims']);
      return portal ? React.createElement('p', null, tab) : React.createElement(SystemSelector, { key: location.search });
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
    shows('Select Your Role');
    assert.equal(location.search, '?module=attendance');
    await click('Scanner Operator');
    shows('Sign in as Scanner Operator to continue.');
    assert.equal(location.search, '?module=attendance&role=scanner_operator');
    await travel(-1);
    shows('Select Your Role');
    await travel(-1);
    shows('Choose a module');
    await travel(1);
    shows('Select Your Role');
    await travel(1);
    shows('Sign in as Scanner Operator to continue.');
    await click('Back to Role Selection');
    shows('Select Your Role');
    await travel(-1);
    shows('Choose a module');
    await travel(1);
    shows('Select Your Role');
    await click('Back to Modules');
    shows('Choose a module');

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
