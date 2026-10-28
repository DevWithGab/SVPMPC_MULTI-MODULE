import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('QR Management preserves the directory and supports creation, deactivation, activation, regeneration, and printing', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const saved = { act: globalThis.IS_REACT_ACT_ENVIRONMENT, open: window.open };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let api, originals;
  try {
    const { default: QRManagement } = await vite.ssrLoadModule('/src/components/attendance/admin/MemberManagement.jsx');
    api = await vite.ssrLoadModule('/src/services/api.js');
    const names = ['getAllMembers', 'generateMemberQR', 'getMemberQRStatus', 'deactivateMemberQR', 'reactivateMemberQR', 'regenerateMemberQR'];
    originals = Object.fromEntries(names.map(name => [name, api.memberAPI[name]]));
    originals.getAllAttendance = api.attendanceAPI.getAllAttendance;
    let member = { memberId: '001', memberName: 'Ana Santos', email: 'ana@example.test', phoneNumber: '09123456789', barangay: 'San Vicente', status: 'active', qrCodeGenerated: false, qrCodeActive: false };
    const blocked = ['inactive', 'deceased'].map((status, index) => ({ ...member, memberId: `00${index + 2}`, memberName: `${status} Member`, status, qrCodeGenerated: true, qrCodeActive: true, qrCodeUrl: '/uploads/blocked.png' }));
    const calls = [];
    api.memberAPI.getAllMembers = async () => ({ members: [member, ...blocked], pagination: { totalPages: 1 } });
    api.attendanceAPI.getAllAttendance = async () => ({ attendance: [{ memberId: '001', scanTime: '2026-10-01T02:00:00Z' }], pagination: { totalPages: 1 } });
    api.memberAPI.generateMemberQR = async id => { calls.push(['create', id]); member = { ...member, qrCodeGenerated: true, qrCodeActive: true, qrCodeUrl: '/uploads/first.png' }; return {}; };
    api.memberAPI.getMemberQRStatus = async () => member;
    api.memberAPI.deactivateMemberQR = async id => { calls.push(['deactivate', id]); member = { ...member, qrCodeActive: false }; return { member }; };
    api.memberAPI.reactivateMemberQR = async id => { calls.push(['activate', id]); member = { ...member, qrCodeActive: true }; return { member }; };
    api.memberAPI.regenerateMemberQR = async id => { calls.push(['regenerate', id]); member = { ...member, qrCodeUrl: '/uploads/regenerated.png' }; return { member }; };
    let printed = '', printCount = 0;
    window.open = () => ({ closed: false, focus() {}, print() { printCount++; }, document: { write(html) { printed = html; }, close() {}, images: [], getElementById() { return { textContent: '' }; } } });
    await act(async () => root.render(React.createElement(QRManagement)));
    assert.equal(container.querySelector('h1').textContent, 'QR Management');
    assert.match(container.textContent, /ana@example.test/);
    assert.match(container.textContent, /09123456789/);
    assert.match(container.textContent, /San Vicente/);
    const dialog = () => container.querySelector('[role="dialog"]');
    const click = async text => {
      const button = [...dialog().querySelectorAll('button')].find(button => button.textContent.trim() === text);
      assert.ok(button, text); assert.equal(button.disabled, false, text);
      await act(async () => button.click());
    };
    await act(async () => container.querySelector('[aria-label="Manage QR for Ana Santos"]').click());
    await click('Create QR');
    assert.match(dialog().textContent, /QR status: Active/);
    await click('Deactivate QR');
    assert.match(dialog().textContent, /QR status: Inactive/);
    assert.equal([...dialog().querySelectorAll('button')].find(button => button.textContent.trim() === 'Print QR card').disabled, true);
    await click('Activate QR');
    await click('Regenerate QR');
    const image = dialog().querySelector('.md-qr-preview img');
    assert.match(image.src, /regenerated\.png/);
    await act(async () => image.dispatchEvent(new window.Event('load')));
    await click('Print QR card');
    assert.equal(printCount, 1);
    assert.match(printed, /regenerated\.png/);
    assert.match(printed, /Ana Santos/);
    assert.deepEqual(calls.map(call => call[0]), ['create', 'deactivate', 'activate', 'regenerate']);
    await click('Close');
    for (const status of ['inactive', 'deceased']) {
      await act(async () => container.querySelector(`[aria-label="Manage QR for ${status} Member"]`).click());
      const controls = container.querySelector('[aria-label="QR controls"]');
      assert.ok([...controls.querySelectorAll('button')].every(button => button.disabled));
      await click('Close');
    }
  } finally {
    await act(async () => root.unmount());
    if (api && originals) {
      const { getAllAttendance, ...members } = originals;
      Object.assign(api.memberAPI, members); api.attendanceAPI.getAllAttendance = getAllAttendance;
    }
    window.open = saved.open; globalThis.IS_REACT_ACT_ENVIRONMENT = saved.act;
    container.remove(); await vite.close();
  }
});
