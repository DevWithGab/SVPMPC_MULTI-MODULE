import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('admin dashboard refreshes Present and Absent every 10 seconds and recovers from incomplete refreshes', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const saved = { interval: globalThis.setInterval, clear: globalThis.clearInterval, act: globalThis.IS_REACT_ACT_ENVIRONMENT, visibility: Object.getOwnPropertyDescriptor(document, 'visibilityState') };
  let api, methods;
  try {
    const { default: AdminPortal } = await vite.ssrLoadModule('/src/pages/attendance/AdminPortal.jsx');
    api = await vite.ssrLoadModule('/src/services/api.js');
    methods = { members: api.memberAPI.getAllMembers, events: api.eventAPI.getEvents, attendance: api.attendanceAPI.getAllAttendance };
    const event = { eventId: 'TEST-A', eventName: 'Test assembly', eventDate: '2026-10-21', startTime: '13:15', endTime: '14:25', status: 'active' };
    api.memberAPI.getAllMembers = async () => ({ members: Array.from({ length: 20 }, (_, i) => ({ memberId: `M${i}` })) });
    api.eventAPI.getEvents = async () => ({ events: [event], pagination: { totalPages: 1 } });
    let records = [];
    let fail = false;
    let calls = 0;
    api.attendanceAPI.getAllAttendance = async ({ page }) => {
      calls++;
      if (fail && page === 2) throw new Error('Synthetic later page failure');
      return { attendance: page === 1 ? records.slice(0, 10) : records.slice(10), pagination: { totalPages: records.length > 10 ? 2 : 1 } };
    };
    const timers = new Map();
    let sequence = 0;
    globalThis.setInterval = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; };
    globalThis.clearInterval = id => timers.delete(id);
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    let visible = true;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visible ? 'visible' : 'hidden' });
    await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(AdminPortal, { user: { role: 'admin' } }))));
    const value = name => [...container.querySelectorAll('.attendance-metric')].find(card => card.querySelector('p')?.textContent === name)?.querySelector('strong')?.textContent;
    assert.equal(value('Present'), '0');
    assert.equal(value('Absent'), '20');
    const tick = () => act(async () => {
      for (const timer of timers.values()) {
        assert.equal(timer.delay, 10000);
        await timer.callback();
      }
    });
    records = Array.from({ length: 12 }, (_, i) => ({ memberId: `M${i}`, eventId: 'TEST-A', scanTime: '2026-10-21T06:00:00Z' }));
    records.push({ ...records[0] }, { memberId: 'OTHER', eventId: 'OTHER-EVENT' });
    await tick();
    assert.equal(value('Present'), '12', 'all pages counted, duplicates and other events excluded');
    assert.equal(value('Absent'), '8');
    records.push({ memberId: 'M12', eventId: 'TEST-A' });
    fail = true;
    await tick();
    assert.equal(value('Present'), '12', 'incomplete refresh must preserve previous totals');
    assert.match(container.textContent, /Unable to refresh attendance totals/);
    fail = false;
    await tick();
    assert.equal(value('Present'), '13');
    assert.equal(value('Absent'), '7');
    assert.doesNotMatch(container.textContent, /Unable to refresh attendance totals/);
    visible = false;
    const beforeHidden = calls;
    await tick();
    assert.equal(calls, beforeHidden);
    records.push({ memberId: 'M13', eventId: 'TEST-A' });
    visible = true;
    await act(async () => document.dispatchEvent(new window.Event('visibilitychange')));
    assert.equal(value('Present'), '14');
    assert.equal(value('Absent'), '6');
    await act(async () => root.unmount());
    assert.equal(timers.size, 0, 'unmount removes refresh timers');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    if (methods) {
      api.memberAPI.getAllMembers = methods.members;
      api.eventAPI.getEvents = methods.events;
      api.attendanceAPI.getAllAttendance = methods.attendance;
    }
    globalThis.setInterval = saved.interval;
    globalThis.clearInterval = saved.clear;
    globalThis.IS_REACT_ACT_ENVIRONMENT = saved.act;
    if (saved.visibility) Object.defineProperty(document, 'visibilityState', saved.visibility);
    else delete document.visibilityState;
    await vite.close();
  }
});
