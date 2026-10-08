import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSecretaryEvents, validateEventForm } from '../src/utils/eventManagement.js';

test('event register loads every page before presenting complete totals', async () => {
  const requested = [];
  const events = await loadSecretaryEvents(async ({ page, limit }) => {
    requested.push([page, limit]);
    return { success: true, data: { events: [{ eventId: `event-${page}` }] }, pagination: { totalPages: 3 } };
  });
  assert.deepEqual(requested, [[1, 100], [2, 100], [3, 100]]);
  assert.deepEqual(events.map(event => event.eventId), ['event-1', 'event-2', 'event-3']);
});

test('an API failure cannot be mistaken for an empty successful event list', async () => {
  await assert.rejects(loadSecretaryEvents(async ({ page }) => page === 1
    ? { success: true, data: [{ eventId: 'one' }], pagination: { totalPages: 2 } }
    : { success: false, message: 'Connection lost' }), /Connection lost/);
});

test('event forms require meaningful details and a valid same-day schedule', () => {
  const valid = { name: 'General Assembly', location: 'Main Hall', date: '2026-10-20', startTime: '09:00', endTime: '11:00' };
  assert.equal(validateEventForm(valid), '');
  assert.match(validateEventForm({ ...valid, name: '   ' }), /name/);
  assert.match(validateEventForm({ ...valid, location: '   ' }), /location/);
  assert.match(validateEventForm({ ...valid, endTime: '' }), /end time/);
  assert.match(validateEventForm({ ...valid, endTime: '09:00' }), /later/);
  assert.match(validateEventForm({ ...valid, endTime: '08:00' }), /later/);
});
