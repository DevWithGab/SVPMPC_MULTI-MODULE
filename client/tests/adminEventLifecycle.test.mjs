import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('admin approved-events table closes on time despite a stale server status', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const original = { now: Date.now, interval: globalThis.setInterval, clear: globalThis.clearInterval, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  try {
    const { default: EventManagement } = await vite.ssrLoadModule('/src/components/attendance/admin/EventManagement.jsx');
    const event = { eventId: 'TIMED', eventName: 'Timed assembly', eventDate: '2026-10-21', startTime: '09:00', endTime: '10:00', status: 'active', location: 'Hall' };
    let now = Date.parse('2026-10-21T09:59:59+08:00');
    Date.now = () => now;
    const timers = new Map();
    globalThis.setInterval = (callback, delay) => { timers.set(delay, callback); return delay; };
    globalThis.clearInterval = delay => timers.delete(delay);
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const render = (events) => act(async () => root.render(React.createElement(EventManagement, { events, setEvents: () => {} })));
    await render([event]);
    const approvedTable = () => container.querySelector('[aria-label="Approved events"] tbody');
    const closedTable = () => container.querySelector('[aria-label="Closed events"] tbody');
    assert.match(approvedTable().textContent, /Active/);
    assert.doesNotMatch(closedTable().textContent, /Timed assembly/);

    // The server's own status field is still "active" here — only the
    // ticking clock (not a refetch) should move this event into the Closed
    // events table. (That table has no status badge column of its own —
    // every row in it is implicitly closed — so "Reopen" standing in for
    // the closed-only action is the signal, not the literal word.)
    now = Date.parse('2026-10-21T10:00:00+08:00');
    await act(async () => timers.get(1000)());
    assert.doesNotMatch(approvedTable().textContent, /Timed assembly/);
    assert.match(closedTable().textContent, /Timed assembly/);
    assert.match(closedTable().textContent, /Reopen/);
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
