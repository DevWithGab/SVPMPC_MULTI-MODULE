import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('event modals enforce locked details and show actions appropriate to each event status', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  const previousNow = Date.now;
  const previousFrame = globalThis.requestAnimationFrame;
  const previousCancelFrame = globalThis.cancelAnimationFrame;
  let api, originalUpdate;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  Date.now = () => Date.parse('2026-10-25T10:00:00+08:00');
  try {
    const { default: EventManagement } = await vite.ssrLoadModule('/src/components/attendance/admin/EventManagement.jsx');
    ({ eventAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    originalUpdate = api.updateEventAsAdmin;
    for (const status of ['upcoming', 'active']) {
      const event = { eventId: `EDIT-${status}`, eventName: 'Approved assembly', description: 'Original description', location: 'Main Hall', status, eventDate: status === 'active' ? '2026-10-25' : '2026-10-26', startTime: '09:00', endTime: '17:00' };
      let saved;
      api.updateEventAsAdmin = async (id, payload) => { saved = { id, payload }; return { event: { ...event, ...payload } }; };
      await act(async () => root.render(React.createElement(EventManagement, { key: status, events: [event], setEvents: () => {} })));
      await act(async () => [...container.querySelectorAll('.aae-groups button')].find(button => button.textContent.startsWith('Approved')).click());
      await act(async () => container.querySelector('[aria-label="View details for Approved assembly"]').click());
      assert.match(container.querySelector('[role="dialog"]').textContent, /Edit schedule/);
      await act(async () => [...container.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === 'Edit schedule').click());
      const dialog = container.querySelector('#admin-edit-event-name')?.closest('[role="dialog"]');
      assert.ok(dialog);
      assert.equal(dialog.querySelector('#admin-edit-event-name').readOnly, true);
      assert.equal(dialog.querySelector('#admin-edit-event-name').value, 'Approved assembly');
      assert.equal(dialog.querySelector('#admin-edit-event-description').readOnly, true);
      assert.equal(dialog.querySelector('#admin-edit-event-description').value, 'Original description');
      assert.equal(dialog.querySelector('#admin-edit-event-location').readOnly, true);
      assert.equal(dialog.querySelector('#admin-edit-event-location').value, 'Main Hall');
      assert.equal(dialog.querySelector('input[type="date"]').readOnly, false);
      assert.match(dialog.textContent, /locked after approval/);
      const save = [...dialog.querySelectorAll('button')].find(button => button.textContent.includes('Save schedule'));
      await act(async () => save.click());
      assert.equal(saved.id, event.eventId);
      assert.equal(Object.hasOwn(saved.payload, 'eventName'), false);
      assert.equal(Object.hasOwn(saved.payload, 'description'), false);
      assert.equal(Object.hasOwn(saved.payload, 'location'), false);
      assert.equal(saved.payload.eventDate, event.eventDate);
      assert.equal(saved.payload.startTime, '09:00');
      assert.equal(saved.payload.endTime, '17:00');
    }
    for (const status of ['closed', 'pending_approval']) {
      const event = { eventId: status, eventName: 'Review event', description: 'Recorded details', location: 'Main Hall', status, eventDate: '2026-10-24', startTime: '09:00', endTime: '17:00' };
      await act(async () => root.render(React.createElement(EventManagement, { key: status, events: [event], setEvents: () => {} })));
      const group = status === 'closed' ? 'Closed' : 'Pending';
      await act(async () => [...container.querySelectorAll('.aae-groups button')].find(button => button.textContent.startsWith(group)).click());
      assert.equal(container.querySelector('[aria-label="Edit Review event"]'), null);
      await act(async () => container.querySelector('[aria-label="View details for Review event"]').click());
      const dialog = container.querySelector('[role="dialog"]');
      assert.equal(dialog.querySelector('input, textarea'), null);
      const actions = [...dialog.querySelectorAll('.aae-modal-actions button')].map(button => button.textContent.trim());
      assert.deepEqual(actions, status === 'closed' ? ['Close', 'Reopen event'] : ['Close', 'Reject event', 'Approve event']);
      if (status === 'closed') {
        assert.match(dialog.querySelector('h2').textContent, /Closed event details/);
        assert.match(dialog.querySelector('.event-details-fields').textContent, /Main Hall/);
        assert.match(dialog.querySelector('.event-details-fields').textContent, /Recorded details/);
        assert.match(dialog.querySelector('.event-details-note').textContent, /Recorded details are read-only/);
        await act(async () => [...dialog.querySelectorAll('button')].find(button => button.textContent === 'Reopen event').click());
        assert.match(container.textContent, /Reason for Reopening/);
      }
    }
  } finally {
    await act(async () => root.unmount());
    if (api && originalUpdate) api.updateEventAsAdmin = originalUpdate;
    Date.now = previousNow;
    globalThis.requestAnimationFrame = previousFrame;
    globalThis.cancelAnimationFrame = previousCancelFrame;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
    container.remove();
    await vite.close();
  }
});
