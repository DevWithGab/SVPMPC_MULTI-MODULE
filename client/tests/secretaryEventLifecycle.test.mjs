import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('secretary table and open event details close on time despite a stale server status', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const original = { now: Date.now, interval: globalThis.setInterval, clear: globalThis.clearInterval, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  try {
    const { default: EventManagement } = await vite.ssrLoadModule('/src/components/attendance/secretary/EventManagement.jsx');
    const event = { eventId: 'TIMED', eventName: 'Timed assembly', eventDate: '2026-10-21', startTime: '09:00', endTime: '10:00', status: 'active' };
    let now = Date.parse('2026-10-21T09:59:59+08:00');
    Date.now = () => now;
    const timers = new Map();
    globalThis.setInterval = (callback, delay) => { timers.set(delay, callback); return delay; };
    globalThis.clearInterval = delay => timers.delete(delay);
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => root.render(React.createElement(EventManagement, { events: [event], user: { username: 'secretary' } })));
    assert.match(container.querySelector('[aria-label="Active events"] tbody').textContent, /Active/);
    await act(async () => container.querySelector('[aria-label="View details for Timed assembly"]').click());
    now = Date.parse('2026-10-21T10:00:00+08:00');
    await act(async () => timers.get(1000)());
    assert.match(container.querySelector('[aria-label="Closed events"] tbody').textContent, /Timed assembly/);
    assert.match(container.querySelector('[role="dialog"]').textContent, /Closed/);
    await act(async () => root.render(React.createElement(EventManagement, { events: [{ ...event }], user: { username: 'secretary' } })));
    assert.match(container.querySelector('[aria-label="Closed events"] tbody').textContent, /Timed assembly/);
    now = Date.parse('2026-10-21T10:05:00+08:00');
    await act(async () => document.dispatchEvent(new window.Event('visibilitychange')));
    assert.match(container.querySelector('[aria-label="Closed events"] tbody').textContent, /Timed assembly/);
  } finally {
    await act(async () => root.unmount());
    Date.now = original.now;
    globalThis.setInterval = original.interval;
    globalThis.clearInterval = original.clear;
    globalThis.IS_REACT_ACT_ENVIRONMENT = original.act;
    container.remove();
    await vite.close();
  }
});
