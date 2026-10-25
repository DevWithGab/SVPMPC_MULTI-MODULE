import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('approved event edits show read-only name and description and submit only schedule and location', async () => {
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
      await act(async () => container.querySelector('[aria-label="Edit Approved assembly"]').click());
      const dialog = container.querySelector('[role="dialog"]');
      assert.ok(dialog);
      assert.equal(dialog.querySelector('#admin-edit-event-name').readOnly, true);
      assert.equal(dialog.querySelector('#admin-edit-event-name').value, 'Approved assembly');
      assert.equal(dialog.querySelector('#admin-edit-event-description').readOnly, true);
      assert.equal(dialog.querySelector('#admin-edit-event-description').value, 'Original description');
      assert.equal(dialog.querySelector('input[type="date"]').readOnly, false);
      assert.match(dialog.textContent, /locked after approval/);
      const save = [...dialog.querySelectorAll('button')].find(button => button.textContent.includes('Save Changes'));
      await act(async () => save.click());
      assert.equal(saved.id, event.eventId);
      assert.equal(Object.hasOwn(saved.payload, 'eventName'), false);
      assert.equal(Object.hasOwn(saved.payload, 'description'), false);
      assert.equal(saved.payload.location, 'Main Hall');
      assert.equal(saved.payload.eventDate, event.eventDate);
      assert.equal(saved.payload.startTime, '09:00');
      assert.equal(saved.payload.endTime, '17:00');
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
