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
  try {
    const { default: SuperAdmin } = await vite.ssrLoadModule('/src/pages/SuperAdmin.jsx');
    api = await vite.ssrLoadModule('/src/services/api.js');
    original = { members: api.adminAPI.getAllMembers, logs: api.auditAPI.getLogs };
    api.adminAPI.getAllMembers = async () => ({ members: [], pagination: { total: 0 } });
    const queries = [];
    api.auditAPI.getLogs = async query => { queries.push(query); return { logs: [], pagination: { page: 1, total: 0, totalPages: 1 } }; };
    window.sessionStorage.setItem('token', 'test-token');
    window.sessionStorage.setItem('user', JSON.stringify({ role: 'super_admin' }));
    await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(SuperAdmin))));
    const click = async label => {
      const button = [...container.querySelectorAll('button')].find(button => button.textContent.trim() === label);
      assert.ok(button, label); await act(async () => button.click());
    };
    await click('Attendance Audit Logs');
    assert.ok([...container.querySelectorAll('h1')].some(heading => heading.textContent === 'Audit logs'));
    assert.ok(queries.length);
    assert.ok(queries.every(query => query.module === 'attendance'));
    await click('Attendance Backup & Restore');
    assert.ok([...container.querySelectorAll('h1')].some(heading => heading.textContent === 'Backup & restore'));
    assert.ok(container.querySelector('#attendance-backup-title'));
    assert.match(container.textContent, /On export/);
  } finally {
    await act(async () => root.unmount());
    if (api && original) { api.adminAPI.getAllMembers = original.members; api.auditAPI.getLogs = original.logs; }
    for (const key of ['token', 'user']) {
      if (saved[key] === null) window.sessionStorage.removeItem(key); else window.sessionStorage.setItem(key, saved[key]);
    }
    globalThis.IS_REACT_ACT_ENVIRONMENT = saved.act;
    container.remove(); await vite.close();
  }
});
