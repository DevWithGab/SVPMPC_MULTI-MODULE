import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('Super Admin member register preserves editing and status controls while locking deceased status', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const saved = { act: globalThis.IS_REACT_ACT_ENVIRONMENT, confirm: globalThis.confirm, frame: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame, token: window.sessionStorage.getItem('token'), user: window.sessionStorage.getItem('user') };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.confirm = () => true;
  globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
  let api, original;
  try {
    const { default: SuperAdmin } = await vite.ssrLoadModule('/src/pages/SuperAdmin.jsx');
    ({ adminAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    original = { getAllMembers: api.getAllMembers, toggleMemberStatus: api.toggleMemberStatus };
    let members = [{ memberId: '0001', memberName: 'Ana Santos', email: 'ana@example.test', phoneNumber: '09123456789', barangay: 'Poblacion', status: 'active', modules: ['attendance', 'mortuary'] }, { memberId: '0002', memberName: 'Luis Ramos', status: 'deceased', modules: ['attendance', 'mortuary'] }];
    const toggles = [];
    api.getAllMembers = async () => ({ members, pagination: { total: 2 }, counts: { total: 2, active: 1, inactive: 0, deceased: 1 } });
    api.toggleMemberStatus = async id => { toggles.push(id); members = members.map(member => member.memberId === id ? { ...member, status: 'inactive' } : member); return {}; };
    window.sessionStorage.setItem('token', 'test-token'); window.sessionStorage.setItem('user', JSON.stringify({ role: 'super_admin' }));
    await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(SuperAdmin))));
    const rows = [...container.querySelectorAll('.sam-members-table tbody tr')];
    assert.equal(rows.length, 2);
    assert.match(rows[0].textContent, /ana@example.test/);
    assert.match(rows[0].querySelector('.sam-passbook').textContent, /0001/);
    assert.equal(rows[0].querySelectorAll('.sam-module').length, 2);
    assert.ok(rows[1].querySelector('[aria-label="Edit Luis Ramos"]'));
    assert.match(rows[1].querySelector('.sam-status-locked').textContent, /Status locked/);
    assert.equal(rows[1].querySelector('.sam-toggle'), null);
    await act(async () => rows[0].querySelector('[aria-label="Deactivate Ana Santos"]').click());
    assert.deepEqual(toggles, ['0001']);
    assert.ok(container.querySelector('[aria-label="Activate Ana Santos"]'));
    await act(async () => container.querySelector('[aria-label="Edit Luis Ramos"]').click());
    assert.ok(container.querySelector('[role="dialog"]'));
    assert.ok([...container.querySelectorAll('[role="dialog"] input')].some(input => input.value === 'Luis Ramos'));
  } finally {
    await act(async () => root.unmount());
    if (api && original) Object.assign(api, original);
    for (const key of ['token', 'user']) { if (saved[key] === null) window.sessionStorage.removeItem(key); else window.sessionStorage.setItem(key, saved[key]); }
    globalThis.IS_REACT_ACT_ENVIRONMENT = saved.act; globalThis.confirm = saved.confirm;
    globalThis.requestAnimationFrame = saved.frame; globalThis.cancelAnimationFrame = saved.cancel;
    container.remove(); await vite.close();
  }
});
