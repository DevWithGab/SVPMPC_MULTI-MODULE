import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('personal scan history keeps authenticated scope, pagination, PHT timestamps, and errors', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const savedAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let api, original;
  try {
    const { default: MyScans } = await vite.ssrLoadModule('/src/components/attendance/scanner_operator/MyScans.jsx');
    ({ attendanceAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    original = api.getAllAttendance;
    const queries = [];
    let fail = false;
    api.getAllAttendance = async query => {
      queries.push(query);
      if (fail) throw new Error('History temporarily unavailable');
      const attendance = query.page === 1
        ? Array.from({ length: 100 }, (_, index) => ({ attendanceId: `first-${index}`, memberName: index === 0 ? 'Ana Santos' : 'Other Member', memberId: '001234', eventId: 'E1', eventName: 'General Assembly', barangay: 'Poblacion', scanTime: index === 0 ? '2026-10-25T11:25:00Z' : 'invalid' }))
        : Array.from({ length: 51 }, (_, index) => ({ attendanceId: `second-${index}`, memberName: 'Next Member', eventId: 'E2', eventName: 'Monthly Assembly', barangay: 'San Isidro' }));
      return { attendance, pagination: { total: 151, totalPages: 2 } };
    };
    await act(async () => root.render(React.createElement(MyScans, { user: { name: 'Test Operator' } })));
    assert.equal(queries[0].mine, true);
    assert.equal(queries[0].page, 1);
    assert.equal(queries[0].limit, 100);
    assert.equal(queries[0].scannedBy, undefined, 'the client does not choose whose history to read');
    assert.match(container.querySelector('.oms-identity').textContent, /Test Operator/);
    assert.match(container.querySelector('.oms-total').textContent, /151/);
    assert.match(container.querySelector('tbody').textContent, /Ana Santos/);
    assert.match(container.querySelector('.oms-checkin strong').textContent, /7:25 PM/);
    assert.match(container.querySelector('.oms-checkin > span').textContent, /Oct 25, 2026/);
    assert.match(container.querySelector('tbody').textContent, /Time not recorded/);
    await act(async () => container.querySelector('[aria-label="Next page"]').click());
    assert.equal(queries.at(-1).page, 2);
    assert.match(container.querySelector('tbody').textContent, /Next Member/);
    const [eventFilter, barangayFilter] = container.querySelectorAll('.oms-filters select');
    assert.equal(eventFilter.options.length, 3, 'filters include events from later API pages');
    await act(async () => { eventFilter.value = 'E2'; eventFilter.dispatchEvent(new window.Event('change', { bubbles: true })); });
    assert.equal(container.querySelectorAll('tbody tr').length, 51);
    assert.match(container.querySelector('.oms-pagination').textContent, /51/);
    await act(async () => { barangayFilter.value = 'Poblacion'; barangayFilter.dispatchEvent(new window.Event('change', { bubbles: true })); });
    assert.match(container.querySelector('tbody').textContent, /No matching scans/);
    await act(async () => container.querySelector('.oms-filters > button').click());
    assert.equal(container.querySelectorAll('tbody tr').length, 100);
    assert.match(container.querySelector('.oms-mobile-details summary').textContent, /Ana Santos/);
    assert.match(container.querySelector('.oms-detail-card').textContent, /001234.*General Assembly.*Poblacion.*7:25 PM/);
    const search = container.querySelector('#oms-search');
    const setInputValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => { setInputValue.call(search, 'Ana Santos'); search.dispatchEvent(new window.Event('input', { bubbles: true })); });
    assert.equal(container.querySelectorAll('tbody tr').length, 1);
    assert.match(container.querySelector('tbody').textContent, /Ana Santos/);
    await act(async () => { setInputValue.call(search, '001234'); search.dispatchEvent(new window.Event('input', { bubbles: true })); });
    assert.equal(container.querySelectorAll('tbody tr').length, 100, 'passbook search spans the loaded history');
    await act(async () => { setInputValue.call(search, ''); search.dispatchEvent(new window.Event('input', { bubbles: true })); });
    fail = true;
    await act(async () => container.querySelector('header button').click());
    assert.match(container.querySelector('[role="alert"]').textContent, /History temporarily unavailable/);
    assert.doesNotMatch(container.querySelector('tbody').textContent, /Next Member/);
  } finally {
    await act(async () => root.unmount());
    if (api && original) api.getAllAttendance = original;
    globalThis.IS_REACT_ACT_ENVIRONMENT = savedAct;
    container.remove(); await vite.close();
  }
});
