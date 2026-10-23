import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('notices has its own treasurer tab with barangay counts and background PDF downloads', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  const originalOpen = window.open;
  const originalRevoke = URL.revokeObjectURL;
  const originalFrame = globalThis.requestAnimationFrame;
  const originalCancelFrame = globalThis.cancelAnimationFrame;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  let api, treasurer, originals;
  let Swal, originalMixin;
  const alerts = [];
  let confirmAction = false;
  try {
    ({ default: Swal } = await import('sweetalert2'));
    originalMixin = Swal.mixin;
    Swal.mixin = () => ({ fire: async options => {
      alerts.push(options);
      return { isConfirmed: confirmAction, value: confirmAction ? options.preConfirm?.() : undefined };
    } });
    const { default: Portal } = await vite.ssrLoadModule('/src/pages/mortuary/TreasurerPortal.jsx');
    const service = await vite.ssrLoadModule('/src/services/api.js');
    api = service.default;
    treasurer = service.treasurerAPI;
    originals = [api.get, treasurer.startNoticeBatch, treasurer.getNoticeBatchStatus, treasurer.downloadNoticeBatchPdf];
    const members = [
      ...Array.from({ length: 100 }, (_, index) => ({ id: `M-${index}`, name: `Member ${index}`, balance: 800, barangay: 'Barangay A', status: 'active' })),
      { id: 'M-101', name: 'Second notice member', balance: 500, barangay: 'Barangay B', status: 'active' },
      { id: 'M-102', name: 'Final notice member', balance: -100, barangay: 'Barangay B', status: 'active' },
    ];
    api.get = async path => {
      if (path.endsWith('/balances/all')) return { data: { success: true, data: { members } } };
      if (path.endsWith('/contributions')) return { data: { success: true, data: [], pagination: { totalPages: 1 } } };
      if (path.endsWith('/dashboard')) return { data: { success: true, data: {} } };
      if (path.endsWith('/notice-thresholds')) return { data: { success: true, data: null } };
      if (path.includes('/claims/')) return { data: { success: true, pagination: { total: 0 } } };
      throw new Error(`Unexpected request: ${path}`);
    };
    const jobs = [];
    treasurer.startNoticeBatch = async (level, barangay) => { jobs.push({ level, barangay }); return { jobId: 'TEST-JOB' }; };
    treasurer.getNoticeBatchStatus = async () => ({ status: 'completed', totalMembers: 100, barangay: 'Barangay A' });
    treasurer.downloadNoticeBatchPdf = async () => 'blob:notice-pdf';
    const printWindows = [];
    window.open = () => {
      const output = { html: '', closed: false };
      printWindows.push(output);
      return { document: {
        write: html => { output.html = html; },
        close: () => { output.closed = true; },
      } };
    };
    const revoked = [];
    URL.revokeObjectURL = url => revoked.push(url);
    const render = (tab, key) => act(async () => root.render(React.createElement(MemoryRouter, {
      key, initialEntries: [`/mortuary/treasurer?tab=${tab}`],
    }, React.createElement(Portal, { user: { username: 'treasurer', name: 'Treasurer' } }))));
    await render('members', 'navigation');
    const main = () => container.querySelector('main');
    assert.equal(main().querySelector('h1').textContent, 'Member balances');
    assert.equal(main().querySelector('#notice-panel-title'), null);
    await act(async () => container.querySelector('[aria-label="Notices"]').click());
    assert.equal(main().querySelector('h1').textContent, 'Notices');
    assert.equal(container.querySelector('[aria-label="Notices"]').getAttribute('aria-current'), 'page');
    assert.equal(main().querySelector('table'), null, 'the member balance register stays in its own tab');
    assert.ok(main().querySelector('[aria-label="Download Notice 1 PDF for 100 members"]'));
    assert.ok(main().querySelector('[aria-label="Download Notice 2 PDF for 1 members"]'));
    assert.ok(main().querySelector('[aria-label="Download Final Notice PDF for 1 members"]'));
    await act(async () => {
      const filter = main().querySelector('#notice-barangay');
      filter.value = 'Barangay A';
      filter.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    assert.equal(main().querySelector('[aria-label="Download Notice 2 PDF for 0 members"]').disabled, true);
    assert.ok(main().querySelector('[aria-label="Print Notice 1 for 100 members"]'));
    const clickPrint = () => act(async () => main().querySelector('[aria-label="Print Notice 1 for 100 members"]').click());
    await clickPrint();
    assert.equal(alerts.at(-1).title, 'Print member notices?');
    assert.match(alerts.at(-1).text, /100 members in Barangay A/);
    assert.equal(printWindows.length, 0, 'canceling must not open a print window');
    confirmAction = true;
    await clickPrint();
    assert.equal(printWindows.length, 1);
    assert.equal(printWindows[0].closed, true);
    assert.match(printWindows[0].html, /Batch \(100\)/);
    assert.equal(alerts.at(-1).title, 'Notices ready for printing');
    const workingOpen = window.open;
    window.open = () => null;
    await clickPrint();
    assert.equal(alerts.at(-1).title, 'Print window blocked');
    assert.equal(alerts.at(-1).icon, 'error');
    window.open = workingOpen;
    confirmAction = false;
    await act(async () => main().querySelector('[aria-label="Download Notice 1 PDF for 100 members"]').click());
    assert.equal(jobs.length, 0, 'canceling the SweetAlert must not generate a PDF');
    assert.equal(alerts.at(-1).title, 'Download notice PDF?');
    assert.match(alerts.at(-1).text, /100 members in Barangay A/);
    confirmAction = true;
    await act(async () => main().querySelector('[aria-label="Download Notice 1 PDF for 100 members"]').click());
    assert.deepEqual(jobs, [{ level: 1, barangay: 'Barangay A' }]);
    assert.equal(main().querySelector('a[href="blob:notice-pdf"]').textContent.trim(), 'Download ready PDF');
    assert.equal(alerts.at(-1).title, 'Notice PDF ready');
    assert.equal(alerts.at(-1).icon, 'success');
    await act(async () => container.querySelector('[aria-label="Member Balances"]').click());
    assert.equal(main().querySelector('h1').textContent, 'Member balances');
    assert.equal(main().querySelector('#notice-panel-title'), null);
    assert.ok(revoked.includes('blob:notice-pdf'));
    await render('notices', 'direct-link');
    assert.equal(main().querySelector('h1').textContent, 'Notices', 'the notices URL opens directly');
  } finally {
    await act(async () => root.unmount());
    if (originals) [api.get, treasurer.startNoticeBatch, treasurer.getNoticeBatchStatus, treasurer.downloadNoticeBatchPdf] = originals;
    if (originalMixin) Swal.mixin = originalMixin;
    window.open = originalOpen;
    URL.revokeObjectURL = originalRevoke;
    globalThis.requestAnimationFrame = originalFrame;
    globalThis.cancelAnimationFrame = originalCancelFrame;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    container.remove();
    await vite.close();
  }
});
