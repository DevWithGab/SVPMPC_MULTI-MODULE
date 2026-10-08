import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDashboardRecords, summarizeDashboard } from '../src/utils/attendanceDashboard.js';

test('dashboard totals include all pages and reject incomplete results', async () => {
  const calls = [];
  const records = await loadDashboardRecords(async ({ page, limit }) => {
    calls.push([page, limit]);
    return { attendance: [{ memberId: page }], pagination: { totalPages: 3 } };
  }, 'attendance');
  assert.equal(records.length, 3);
  assert.deepEqual(calls, [[1, 100], [2, 100], [3, 100]]);
  await assert.rejects(loadDashboardRecords(async ({ page }) => {
    if (page === 2) throw new Error('Network unavailable');
    return { events: [{ eventId: 'one' }], pagination: { totalPages: 2 } };
  }, 'events'), /Network unavailable/);
  await assert.rejects(loadDashboardRecords(async () => ({ success: false }), 'events'));
  await assert.rejects(loadDashboardRecords(async () => ({}), 'events'));
});

test('today uses Philippine time and recent attendance is chronological without mutating inputs', () => {
  const records = [
    { id: 'yesterday', scanTime: '2026-10-07T15:59:59Z' },
    { id: 'invalid', scanTime: 'invalid' },
    { id: 'latest', timestamp: '2026-10-08T03:00:00Z' },
    { id: 'midnight', createdAt: '2026-10-07T16:00:00Z' },
  ];
  const result = summarizeDashboard([], records, new Date('2026-10-08T03:30:00Z'));
  assert.equal(result.todayAttendance, 2);
  assert.deepEqual(result.latest.map(record => record.id), ['latest', 'midnight', 'yesterday', 'invalid']);
  assert.equal(records[0].id, 'yesterday');
});

test('active events take precedence over future events and all workflow states retain their counts', () => {
  const events = [
    { eventId: 'later', status: 'upcoming', eventDate: '2026-11-01' },
    { eventId: 'pending', status: 'pending_approval' },
    { eventId: 'next', status: 'upcoming', eventDate: '2026-10-10' },
    { eventId: 'active', status: 'active', eventDate: '2026-10-08' },
    { eventId: 'rejected', status: 'rejected' },
    { eventId: 'draft', status: 'draft' },
    { eventId: 'closed', status: 'closed' },
    { eventId: 'cancelled', status: 'cancelled' },
    { eventId: 'unknown' },
  ];
  const result = summarizeDashboard(events, []);
  assert.deepEqual(result.agenda.map(event => event.eventId), ['active', 'next', 'later']);
  assert.equal(result.counts.pending_approval, 1);
  assert.equal(result.counts.rejected, 1);
  assert.equal(result.counts.closed, 1);
  assert.equal(result.counts.unknown, 1);
  assert.equal(Object.values(result.counts).reduce((sum, count) => sum + count, 0), events.length);
  assert.equal(events[0].eventId, 'later');
});
