import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('Super Admin hosts attendance audit logs and backup tools with attendance-scoped data', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const saved = { act: globalThis.IS_REACT_ACT_ENVIRONMENT, token: window.sessionStorage.getItem('token'), user: window.sessionStorage.getItem('user') };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let api, original;
  const restoredMethods = [];
  try {
    const { default: SuperAdmin } = await vite.ssrLoadModule('/src/pages/SuperAdmin.jsx');
    api = await vite.ssrLoadModule('/src/services/api.js');
    original = { members: api.adminAPI.getAllMembers, logs: api.auditAPI.getLogs };
    api.adminAPI.getAllMembers = async () => ({ members: [], pagination: { total: 0 } });
    const queries = [];
    api.auditAPI.getLogs = async query => { queries.push(query); return { logs: [], pagination: { page: 1, total: 0, totalPages: 1 } }; };
    window.sessionStorage.setItem('token', 'test-token');
    window.sessionStorage.setItem('user', JSON.stringify({ role: 'super_admin' }));
    let signedOut = false;
    await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(SuperAdmin, { onLogout: () => { signedOut = true; } }))));
    assert.match(container.querySelector('.sam-account').textContent, /Super Admin/);
    await act(async () => container.querySelector('[aria-label="Collapse sidebar"]').click());
    assert.ok(container.querySelector('.sam-shell-collapsed'));
    await act(async () => container.querySelector('[aria-label="Expand sidebar"]').click());
    assert.equal(container.querySelector('.sam-shell-collapsed'), null);
    await act(async () => container.querySelector('[aria-label="Sign Out"]').click());
    assert.equal(signedOut, true);
    for (const [label, workspace, feature] of [['Claims workspace', 'mortuary-claims', 'claims'], ['Finance workspace', 'mortuary-finance', 'ledger'], ['Secretary workspace', 'attendance-workspace', 'events'], ['Scanner workspace', 'attendance-scanner', 'scanner']]) {
      const parent = container.querySelector(`button[aria-label="${label}"]`);
      const submenu = container.querySelector(`#${parent.getAttribute('aria-controls')}`);
      assert.equal(parent.getAttribute('aria-expanded'), 'false');
      assert.equal(submenu.hidden, true);
      await act(async () => parent.click());
      assert.equal(parent.getAttribute('aria-expanded'), 'true');
      assert.equal(submenu.hidden, false);
      assert.ok([...submenu.querySelectorAll('a')].some(link => link.getAttribute('href') === `/super-admin?tab=${workspace}&feature=${feature}`));
      assert.ok(container.querySelector('.sam-account'), 'Expanding keeps the Super Admin page mounted');
      await act(async () => parent.click());
      assert.equal(submenu.hidden, true);
    }
    const click = async label => {
      const button = [...container.querySelectorAll('button')].find(button => button.textContent.trim() === label);
      assert.ok(button, label); await act(async () => button.click());
    };
    const attendanceButton = label => [...[...container.querySelectorAll('.sam-nav-group')].find(group => group.querySelector('p')?.textContent === 'Attendance').querySelectorAll('button')].find(button => button.getAttribute('aria-label') === label);
    const secretary = attendanceButton('Secretary workspace');
    const scanner = attendanceButton('Scanner workspace');
    await act(async () => secretary.click());
    const secretarySubmenu = container.querySelector(`#${secretary.getAttribute('aria-controls')}`);
    await act(async () => secretarySubmenu.querySelector('a').dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true })));
    assert.equal(secretarySubmenu.hidden, false, 'Hovering a feature keeps its workspace open');
    await act(async () => scanner.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true })));
    assert.equal(secretary.getAttribute('aria-expanded'), 'true', 'Hovering another workspace keeps the submenu open');
    await act(async () => scanner.focus());
    assert.equal(secretary.getAttribute('aria-expanded'), 'true', 'Focusing another workspace keeps the submenu open');
    assert.equal(scanner.getAttribute('aria-expanded'), 'false', 'Hovering does not open or navigate to another workspace');
    await act(async () => scanner.click());
    assert.equal(secretary.getAttribute('aria-expanded'), 'false', 'Clicking another workspace closes the previous submenu');
    assert.equal(scanner.getAttribute('aria-expanded'), 'true');
    await act(async () => attendanceButton('Audit Logs').dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true })));
    assert.equal(scanner.getAttribute('aria-expanded'), 'true', 'Hovering a regular menu keeps the submenu open');
    await act(async () => attendanceButton('Audit Logs').click());
    assert.equal(scanner.getAttribute('aria-expanded'), 'false', 'Clicking a regular menu closes the open submenu');
    assert.ok([...container.querySelectorAll('h1')].some(heading => heading.textContent === 'Audit logs'));
    assert.ok(queries.length);
    assert.ok(queries.every(query => query.module === 'attendance'));
    await act(async () => attendanceButton('Backup & Restore').click());
    assert.ok([...container.querySelectorAll('h1')].some(heading => heading.textContent === 'Backup & restore'));
    assert.ok(container.querySelector('#attendance-backup-title'));
    assert.match(container.textContent, /On export/);
    for (const [service, method, response] of [
      [api.mortuaryMemberAPI, 'getAllMembers', { success: true, members: [], data: [], pagination: { totalPages: 1 } }],
      [api.contributionAPI, 'getAllContributions', { success: true, data: [] }],
      [api.mortuaryDashboardAPI, 'getFundOverview', { success: true, data: {} }],
      [api.mortuaryDashboardAPI, 'getBalances', { success: true, data: { members: [] } }],
      [api.mortuaryDashboardAPI, 'getAdminDashboard', { success: true, data: {} }],
    ]) {
      restoredMethods.push([service, method, service[method]]);
      service[method] = async () => response;
    }
    await click('Claims workspace');
    const dashboard = [...container.querySelectorAll('.sam-submenu a')].find(link => link.getAttribute('href') === '/super-admin?tab=mortuary-claims&feature=dashboard');
    await act(async () => dashboard.click());
    assert.ok(container.querySelector('.sam-navigation'), 'Super Admin navigation remains mounted');
    assert.ok(container.querySelector('.sam-embedded-workspace main[data-view="dashboard"]'), 'Only the selected feature is rendered in the hub');
    assert.equal(container.querySelector('.sam-embedded-workspace .mt-sidebar'), null, 'Original role sidebar is omitted');
    assert.equal(dashboard.getAttribute('aria-current'), 'page');
    const workspace = container.querySelector('.sam-embedded-workspace');
    assert.equal(workspace.closest('.super-admin-theme'), null, 'Super Admin typography and design overrides do not affect the module');
    assert.equal(workspace.closest('.super-admin-design'), null, 'The hub design system must not override original module sizes, controls, or layouts');
    assert.equal(workspace.querySelector('.mt-mobile-bar'), null, 'Original mobile menu is omitted');
    assert.equal(container.querySelector('nav[aria-label="Breadcrumb"]'), null, 'The module retains its own breadcrumb without a duplicate hub trail');
    assert.match(workspace.querySelector('.td-eyebrow').textContent, /Mortuary management.*Dashboard/);
  } finally {
    await act(async () => root.unmount());
    if (api && original) { api.adminAPI.getAllMembers = original.members; api.auditAPI.getLogs = original.logs; }
    for (const [service, method, implementation] of restoredMethods) service[method] = implementation;
    for (const key of ['token', 'user']) {
      if (saved[key] === null) window.sessionStorage.removeItem(key); else window.sessionStorage.setItem(key, saved[key]);
    }
    globalThis.IS_REACT_ACT_ENVIRONMENT = saved.act;
    container.remove(); await vite.close();
  }
});
