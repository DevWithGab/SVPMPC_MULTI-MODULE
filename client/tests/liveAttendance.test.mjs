import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('live attendance polls reliably, reacts to saved scans, preserves complete rows on failure, and follows the current active event', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const original = {
    interval: globalThis.setInterval, clear: globalThis.clearInterval,
    visibility: Object.getOwnPropertyDescriptor(document, 'visibilityState'),
    act: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  let api;
  let saved;
  try {
    const { default: LiveAttendanceList } = await vite.ssrLoadModule('/src/components/attendance/shared/LiveAttendanceList.jsx');
    api = await vite.ssrLoadModule('/src/services/api.js');
    const { ATTENDANCE_UPDATED_KEY, notifyAttendanceUpdated } = await vite.ssrLoadModule('/src/utils/attendanceUpdates.js');
    saved = { events: api.eventAPI.getEvents, attendance: api.attendanceAPI.getAttendanceByEvent, post: api.default.post };
    const eventA = { eventId: 'A', eventName: 'First assembly', status: 'active' };
    let serverEvents = [eventA];
    const record = (i, eventId = 'A') => ({
      memberId: `TEST-${i}`, memberName: `Member ${i}`, eventId, barangay: 'Test Barangay',
      scanTime: new Date(Date.UTC(2026, 9, 20, 2, i)).toISOString(),
    });
    let records = [];
    let failSecondPage = false;
    let holdNextRequest = false;
    let release;
    let attendanceCalls = 0;
    api.eventAPI.getEvents = async () => ({ events: serverEvents, pagination: { totalPages: 1 } });
    api.attendanceAPI.getAttendanceByEvent = async (eventId, { page }) => {
      attendanceCalls++;
      if (failSecondPage && page === 2) throw new Error('Synthetic later-page failure');
      const list = records.filter(row => row.eventId === eventId);
      const result = { attendance: page === 1 ? list.slice(0, 2) : list.slice(2), pagination: { totalPages: list.length > 2 ? 2 : 1 } };
      if (holdNextRequest) {
        holdNextRequest = false;
        return new Promise(resolve => { release = () => resolve(result); });
      }
      return result;
    };
    api.default.post = async () => ({ data: { success: true, attendance: records.at(-1) } });
    let tick;
    let intervals = 0;
    let cleared = 0;
    globalThis.setInterval = (callback, delay) => {
      assert.equal(delay, 3000);
      intervals++;
      tick = callback;
      return 42;
    };
    globalThis.clearInterval = () => { cleared++; };
    let visible = true;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visible ? 'visible' : 'hidden' });
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    let parentRefreshes = 0;
    const render = () => act(async () => root.render(React.createElement(LiveAttendanceList, {
      variant: 'admin', currentEvent: { ...eventA }, events: [{ ...eventA }],
      onRefresh: () => { parentRefreshes++; },
    })));
    const names = () => [...container.querySelectorAll('tbody strong')].map(item => item.textContent);
    await render();
    assert.equal(parentRefreshes, 1);
    records = [record(1)];
    await act(async () => tick());
    assert.deepEqual(names(), ['Member 1']);
    for (let i = 0; i < 4; i++) await render();
    assert.equal(intervals, 1, 'changing parent callbacks/objects must not restart the live timer');

    records.push(record(2));
    await act(async () => api.attendanceAPI.recordAttendance('TEST-2', 'A', new Date().toISOString(), 'Test operator'));
    assert.deepEqual(names(), ['Member 2', 'Member 1'], 'a confirmed scan refreshes immediately without a timer tick');
    records.push(record(3));
    await act(async () => window.dispatchEvent(new window.StorageEvent('storage', { key: ATTENDANCE_UPDATED_KEY, newValue: 'test-marker' })));
    assert.deepEqual(names(), ['Member 3', 'Member 2', 'Member 1']);
    assert.equal(parentRefreshes, 1, 'background updates must not reload the entire parent portal');

    visible = false;
    records.push(record(4));
    const beforeHidden = attendanceCalls;
    await act(async () => { tick(); notifyAttendanceUpdated(); });
    assert.equal(attendanceCalls, beforeHidden);
    visible = true;
    await act(async () => document.dispatchEvent(new window.Event('visibilitychange')));
    assert.equal(names().length, 4);

    failSecondPage = true;
    await act(async () => tick());
    assert.equal(names().length, 4, 'keep all previous rows when any attendance page fails');
    assert.match(container.querySelector('[role="alert"]').textContent, /Retrying automatically/);
    failSecondPage = false;
    await act(async () => tick());
    assert.equal(container.querySelector('[role="alert"]'), null);

    holdNextRequest = true;
    await act(async () => tick());
    records.push(record(5));
    await act(async () => notifyAttendanceUpdated());
    await act(async () => release());
    assert.equal(names()[0], 'Member 5', 'scan notifications during a request get an immediate queued follow-up');
    assert.equal(names().length, 5);

    serverEvents = [{ ...eventA, status: 'closed' }, { eventId: 'B', eventName: 'Next assembly', status: 'active' }];
    records.push(record(6, 'B'));
    await act(async () => window.dispatchEvent(new window.Event('focus')));
    assert.equal(container.querySelector('#sla-event-title').textContent, 'Next assembly');
    assert.deepEqual(names(), ['Member 6'], 'a stale currentEvent prop must not keep showing a closed event');
    await act(async () => root.unmount());
    assert.equal(cleared, 1);
    const afterUnmount = attendanceCalls;
    notifyAttendanceUpdated();
    assert.equal(attendanceCalls, afterUnmount);
  } finally {
    await act(async () => root.unmount());
    if (saved) {
      api.eventAPI.getEvents = saved.events;
      api.attendanceAPI.getAttendanceByEvent = saved.attendance;
      api.default.post = saved.post;
    }
    globalThis.setInterval = original.interval;
    globalThis.clearInterval = original.clear;
    globalThis.IS_REACT_ACT_ENVIRONMENT = original.act;
    if (original.visibility) Object.defineProperty(document, 'visibilityState', original.visibility);
    else delete document.visibilityState;
    container.remove();
    await vite.close();
  }
});
