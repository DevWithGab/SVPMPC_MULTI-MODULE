import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('secretary creates, edits, deletes, and reopens events from one screen without approval', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const frames = { request: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let api, original;
  try {
    const { default: Events } = await vite.ssrLoadModule('/src/components/attendance/secretary/EventManagement.jsx');
    ({ eventAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    original = { createEvent: api.createEvent, updateEvent: api.updateEvent, deleteEvent: api.deleteEvent, reopenEvent: api.reopenEvent };
    const calls = [];
    let created;
    const closed = { eventId: 'OLD', eventName: 'Past assembly', eventDate: '2020-01-01', startTime: '09:00', endTime: '12:00', location: 'Hall', status: 'closed' };
    api.createEvent = async data => { created = { ...data, eventId: 'NEW', status: 'upcoming' }; calls.push(['create', data]); return { event: created }; };
    api.updateEvent = async (id, data) => { created = { ...created, ...data }; calls.push(['edit', id, data]); return { event: created }; };
    api.deleteEvent = async id => { calls.push(['delete', id]); return {}; };
    api.reopenEvent = async (id, data) => { calls.push(['reopen', id, data]); return { event: { ...closed, ...data, status: 'upcoming' } }; };
    function Workspace() {
      const [events, setEvents] = useState([closed]);
      return React.createElement(Events, { events, setEvents, user: { userId: 'SEC-1' } });
    }
    await act(async () => root.render(React.createElement(Workspace)));
    const dialog = title => [...container.querySelectorAll('[role="dialog"]')].find(item => item.querySelector('.ui-dialog-header')?.textContent.includes(title || 'Edit event')) || [...container.querySelectorAll('[role="dialog"]')].at(-1);
    const click = async (text, scope = container) => {
      const button = [...scope.querySelectorAll('button')].find(item => item.textContent.trim() === text);
      assert.ok(button, text); await act(async () => button.click());
    };
    const fill = async (element, value) => {
      assert.ok(element);
      const prototype = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      await act(async () => {
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
        element.dispatchEvent(new window.Event('input', { bubbles: true }));
      });
    };
    assert.match(container.textContent, /Event Management/);
    assert.doesNotMatch(container.textContent, /Approve|Reject|Pending approvals/);
    await click('Create event');
    for (const id of ['admin-edit-event-name', 'admin-edit-event-location']) {
      const input = dialog().querySelector('#' + id);
      assert.equal(input.required, true);
      assert.match(dialog().querySelector('label[for="' + id + '"]').textContent, /\*/);
    }
    assert.equal(dialog().querySelector('#admin-edit-event-description').required, false);
    await fill(dialog().querySelector('#admin-edit-event-name'), 'New assembly');
    await fill(dialog().querySelector('#admin-edit-event-location'), 'Main Hall');
    await fill(dialog().querySelector('input[type="date"]'), '2035-01-01');
    await fill(dialog().querySelectorAll('input[type="time"]')[0], '09:00');
    await fill(dialog().querySelectorAll('input[type="time"]')[1], '12:00');
    await click('Create event', dialog());
    assert.equal(calls[0][0], 'create');
    assert.equal(calls[0][1].createdBy, 'SEC-1');
    assert.match(container.querySelector('[aria-label="Upcoming events"] tbody').textContent, /New assembly/);
    await act(async () => container.querySelector('[aria-label="Edit New assembly"]').click());
    assert.equal(dialog().querySelector('#admin-edit-event-name').readOnly, false);
    await fill(dialog().querySelector('#admin-edit-event-name'), 'Changed assembly');
    await click('Save event', dialog());
    assert.equal(calls[1][2].eventName, 'Changed assembly');
    await act(async () => container.querySelector('[aria-label="Delete Changed assembly"]').click());
    await click('Delete Event', dialog('Delete Event'));
    assert.deepEqual(calls[2], ['delete', 'NEW']);
    await act(async () => [...container.querySelectorAll('.aae-groups button')].find(button => button.textContent.startsWith('Closed')).click());
    await act(async () => container.querySelector('[aria-label="View details for Past assembly"]').click());
    assert.match(dialog('Closed event details').textContent, /Closed event details/);
    await click('Reopen event', dialog('Closed event details'));
    const reopen = () => [...dialog('Reopen Event').querySelectorAll('button')].find(button => button.textContent.trim() === 'Reopen Event');
    assert.equal(reopen().disabled, true, 'reason is required');
    await fill(dialog('Reopen Event').querySelector('input[type="date"]'), '2035-01-02');
    await fill(dialog('Reopen Event').querySelector('textarea'), 'Make-up session for absent members');
    assert.equal(reopen().disabled, false);
    await click('Reopen Event', dialog('Reopen Event'));
    assert.equal(calls[3][0], 'reopen');
    assert.equal(calls[3][2].reason, 'Make-up session for absent members');
  } finally {
    await act(async () => root.unmount());
    if (api && original) Object.assign(api, original);
    globalThis.requestAnimationFrame = frames.request; globalThis.cancelAnimationFrame = frames.cancel;
    container.remove(); globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct; await vite.close();
  }
});
