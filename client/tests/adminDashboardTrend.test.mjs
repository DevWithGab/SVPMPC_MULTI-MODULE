import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

// Regression test: the Attendance Trend label used to compare only the
// first and last of the last 6 events, so a volatile series that peaked
// mid-window and ended a hair below its starting point was labeled
// "Decreasing" even while its last two points were clearly climbing. It
// should reflect recent momentum (last point vs. the one before it)
// instead.
test('Attendance Trend reflects recent momentum, not first-vs-last across the whole window', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const saved = { interval: globalThis.setInterval, clear: globalThis.clearInterval, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  let api, methods;
  try {
    const { default: AdminPortal } = await vite.ssrLoadModule('/src/pages/attendance/AdminPortal.jsx');
    api = await vite.ssrLoadModule('/src/services/api.js');
    methods = { members: api.memberAPI.getAllMembers, events: api.eventAPI.getEvents, attendance: api.attendanceAPI.getAllAttendance };
    // Rates (with 100 members, present count == rate%): 32, 73, 27, 44, 14, 30.
    // First (32) > last (30) — old first-vs-last logic says "Decreasing".
    // Last (30) > previous (14) — recent momentum says "Increasing".
    const rates = [32, 73, 27, 44, 14, 30];
    const events = rates.map((rate, i) => ({
      eventId: `E${i}`, eventName: `Event ${i}`, eventDate: `2026-10-${10 + i}`,
      startTime: '09:00', endTime: '10:00', status: 'closed',
    }));
    api.memberAPI.getAllMembers = async () => ({ members: Array.from({ length: 100 }, (_, i) => ({ memberId: `M${i}` })) });
    api.eventAPI.getEvents = async () => ({ events, pagination: { totalPages: 1 } });
    api.attendanceAPI.getAllAttendance = async () => ({
      attendance: events.flatMap((event, i) =>
        Array.from({ length: rates[i] }, (_, m) => ({ memberId: `M${m}`, eventId: event.eventId, scanTime: `${event.eventDate}T01:00:00Z` })),
      ),
      pagination: { totalPages: 1 },
    });
    globalThis.setInterval = () => 1;
    globalThis.clearInterval = () => {};
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(AdminPortal, { user: { role: 'admin' } }))));
    const trendPanel = [...container.querySelectorAll('.aad-chart-panel')]
      .find(panel => panel.querySelector('.aad-chart-title')?.textContent === 'Attendance Trend');
    const caption = trendPanel.querySelector('.aad-chart-caption');
    assert.match(caption.textContent, /Increasing/, `expected recent-momentum trend to read Increasing, got "${caption.textContent}"`);
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
    await vite.close();
  }
});
