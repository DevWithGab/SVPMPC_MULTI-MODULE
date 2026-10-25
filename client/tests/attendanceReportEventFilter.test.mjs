import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('event filter hides the table and CSV event columns and restores them for all events', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  const originalClick = window.HTMLAnchorElement.prototype.click;
  let api, originals;
  try {
    const { default: Reports } = await vite.ssrLoadModule('/src/components/attendance/secretary/AttendanceReports.jsx');
    api = await vite.ssrLoadModule('/src/services/api.js');
    originals = [api.eventAPI.getEvents, api.attendanceAPI.getAllAttendance, api.memberAPI.getAllMembers];
    const events = [{ eventId: 'E-1', eventName: 'Assembly One', eventDate: '2026-10-21' }, { eventId: 'E-2', eventName: 'Assembly Two', eventDate: '2026-10-20' }];
    const logs = events.map((event, index) => ({ ...event, memberId: `000${index}`, memberName: `Member ${index}`, scanTime: '2026-10-21T10:00:00+08:00', status: 'present' }));
    api.eventAPI.getEvents = async () => ({ events });
    api.attendanceAPI.getAllAttendance = async () => ({ attendance: logs });
    api.memberAPI.getAllMembers = async () => ({ members: [] });
    let downloaded;
    const csvHeaders = async () => (await downloaded.text()).split('\r\n').find(line => line.startsWith('"Passbook Number"'));
    URL.createObjectURL = blob => { downloaded = blob; return 'blob:report'; };
    URL.revokeObjectURL = () => {};
    window.HTMLAnchorElement.prototype.click = () => {};
    await act(async () => root.render(React.createElement(Reports, { events, attendanceLogs: logs })));
    const change = async (id, value) => {
      await act(async () => {
        const select = container.querySelector(`#${id}`);
        select.value = value;
        select.dispatchEvent(new window.Event('change', { bubbles: true }));
      });
    };
    await change('ar-period', 'all');
    const headers = () => [...container.querySelectorAll('thead th')].map(cell => cell.textContent.trim());
    assert.ok(headers().includes('Event Name'));
    const allEventHeaders = headers();
    await change('ar-event', 'E-1');
    assert.deepEqual(headers(), allEventHeaders.filter(label => label !== 'Event Name'));
    assert.ok(!headers().includes('Event Name'));
    assert.equal(container.querySelector('tbody tr').children.length, headers().length);
    assert.ok(container.querySelector('[aria-label="View attendees for Assembly One"]'));
    const exportCsv = [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Export CSV');
    await act(async () => exportCsv.click());
    assert.doesNotMatch(await csvHeaders(), /"Event"/);
    await change('ar-event', 'all');
    assert.deepEqual(headers(), allEventHeaders);
    assert.ok(headers().includes('Event Name'));
    await act(async () => exportCsv.click());
    assert.match(await csvHeaders(), /"Event"/);
    // Per-event exports also omit the event column when the report shows all events.
    await act(async () => container.querySelector('[aria-label="Export Assembly One attendees as CSV"]').click());
    assert.doesNotMatch(await csvHeaders(), /"Event"/);
  } finally {
    await act(async () => root.unmount());
    if (originals) [api.eventAPI.getEvents, api.attendanceAPI.getAllAttendance, api.memberAPI.getAllMembers] = originals;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    window.HTMLAnchorElement.prototype.click = originalClick;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    container.remove();
    await vite.close();
  }
});
