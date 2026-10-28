const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Same VM-sandbox require-interception helper as the other controller
// tests in this suite.
function load(path, dependencies, globals = {}) {
  const filename = require.resolve(path);
  const localRequire = createRequire(filename);
  const context = { module: { exports: {} }, process, Buffer, console, setInterval, clearInterval, ...globals,
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : localRequire(name) };
  context.exports = context.module.exports;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports;
}
// Real Express defaults to 200 if .json() is called without an explicit
// .status() first — transitionEvent's success path does exactly that
// (`return res.json({...})` with no .status(200) before it), so the fake
// must match that default rather than leaving .code unset.
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });

function database(events = []) {
  const state = { events: events.map(e => ({ ...e })), auditLogs: [] };

  class EventDoc {
    constructor(data) { Object.assign(this, data); }
    // Mongoose casts a plain assignment to a Date-typed schema field (e.g.
    // `event.eventDate = "2026-10-20"`, a plain string straight off a JSON
    // request body) to a real Date instance immediately — getPhtParts
    // relies on that, calling Intl.DateTimeFormat directly on
    // event.eventDate. A fake that just stored the raw string would make
    // reopenEvent crash on a perfectly realistic request.
    set eventDate(value) { this._eventDate = value instanceof Date ? value : new Date(value); }
    get eventDate() { return this._eventDate; }
    // eventDate is a getter/setter (see above), so a plain object spread —
    // which only copies own enumerable properties, not prototype accessors
    // — silently drops it. Both persistence and toObject() need it
    // included explicitly.
    toObject() { return { ...this, eventDate: this.eventDate }; }
    async save() {
      const index = state.events.findIndex(e => e.eventId === this.eventId);
      const plain = this.toObject();
      if (index === -1) state.events.push(plain); else state.events[index] = plain;
      return this;
    }
  }

  const Event = Object.assign(EventDoc, {
    findOne: async (query) => {
      const found = state.events.find(e => e.eventId === query.eventId);
      return found ? new EventDoc({ ...found }) : null;
    },
    findOneAndUpdate: async (query, updates) => {
      const index = state.events.findIndex(e => e.eventId === query.eventId);
      if (index === -1) return null;
      state.events[index] = { ...state.events[index], ...updates };
      return new EventDoc({ ...state.events[index] });
    },
    findOneAndDelete: async (query) => {
      const index = state.events.findIndex(e => e.eventId === query.eventId);
      if (index === -1) return null;
      const [removed] = state.events.splice(index, 1);
      return new EventDoc(removed);
    },
  });

  return {
    state,
    deps: {
      '../models/Event': Event,
      '../../../shared/services/auditLoggingService': { createAuditLog: async (log) => { state.auditLogs.push(log); } },
    },
  };
}

function controller(db, globals) {
  return load('../modules/attendance/controllers/eventController', db.deps, globals);
}

const event = (overrides) => ({
  eventId: 'EVT-1', eventName: 'General Assembly', eventDate: new Date(), startTime: '09:00', endTime: '17:00',
  location: 'Hall', status: 'draft', ...overrides,
});

// --- reopenEvent -------------------------------------------------------------

// PHT is UTC+8 — build date/time strings directly against that offset so
// the test doesn't depend on the machine's own local timezone.
const phtNow = () => new Date(Date.now() + 8 * 60 * 60 * 1000);
const phtDateString = (date) => date.toISOString().slice(0, 10);
const phtTimeString = (date) => date.toISOString().slice(11, 16);

test('reopenEvent only accepts a closed event, and requires a reason plus a new date/start/end time', async () => {
  const notClosed = database([event({ status: 'upcoming' })]);
  const res = response();
  await controller(notClosed).reopenEvent({ params: { eventId: 'EVT-1' }, body: { reason: 'x', eventDate: '2030-01-01', startTime: '09:00', endTime: '17:00' }, user: {}, ip: '', get: () => '' }, res);
  assert.equal(res.code, 400);

  const closed = () => database([event({ status: 'closed' })]);
  const missingReason = response();
  await controller(closed()).reopenEvent({ params: { eventId: 'EVT-1' }, body: { eventDate: '2030-01-01', startTime: '09:00', endTime: '17:00' }, user: {}, ip: '', get: () => '' }, missingReason);
  assert.equal(missingReason.code, 400);

  const missingSchedule = response();
  await controller(closed()).reopenEvent({ params: { eventId: 'EVT-1' }, body: { reason: 'Rescheduled' }, user: {}, ip: '', get: () => '' }, missingSchedule);
  assert.equal(missingSchedule.code, 400);
});

test('reopenEvent rejects a new schedule that would already be over, and requires it to end in the future', async () => {
  const db = database([event({ status: 'closed' })]);
  const pastDay = new Date(phtNow().getTime() - 24 * 60 * 60 * 1000);
  const res = response();
  await controller(db).reopenEvent({
    params: { eventId: 'EVT-1' },
    body: { reason: 'Rescheduled', eventDate: phtDateString(pastDay), startTime: '09:00', endTime: '17:00' },
    user: {}, ip: '', get: () => '',
  }, res);
  assert.equal(res.code, 400);
  assert.match(res.data.message, /must end in the future/);
  assert.equal(db.state.events[0].status, 'closed', 'a rejected reopen attempt must not change the event at all');
});

test('reopenEvent sets status to upcoming for a fully-future schedule, and to active when the new start time has already begun', async () => {
  // Keep this scenario at noon PHT: subtracting an hour from real midnight
  // wraps to the previous day and accidentally describes a future schedule.
  const fixedNow = new Date('2026-10-20T04:00:00Z');
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [fixedNow.getTime()])); }
    static now() { return fixedNow.getTime(); }
  }
  const future = database([event({ status: 'closed' })]);
  const now = new Date(fixedNow.getTime() + 8 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const upcomingRes = response();
  await controller(future, { Date: FixedDate }).reopenEvent({
    params: { eventId: 'EVT-1' },
    body: { reason: 'Rescheduled to tomorrow', eventDate: phtDateString(tomorrow), startTime: '09:00', endTime: '17:00' },
    user: {}, ip: '', get: () => '',
  }, upcomingRes);
  assert.equal(upcomingRes.code, 200);
  assert.equal(future.state.events[0].status, 'upcoming');
  assert.equal(future.state.events[0].reopenReason, 'Rescheduled to tomorrow');

  // A schedule that started earlier today (PHT) but doesn't end until
  // later must land as 'active', not 'upcoming' — mirrors refreshEventStatus's
  // own active-window rule, applied here at reopen time.
  const active = database([event({ status: 'closed' })]);
  const startedOneHourAgo = phtTimeString(new Date(now.getTime() - 60 * 60 * 1000));
  const endsInTwoHours = phtTimeString(new Date(now.getTime() + 2 * 60 * 60 * 1000));
  const activeRes = response();
  await controller(active, { Date: FixedDate }).reopenEvent({
    params: { eventId: 'EVT-1' },
    body: { reason: 'Reopened mid-day', eventDate: phtDateString(now), startTime: startedOneHourAgo, endTime: endsInTwoHours },
    user: {}, ip: '', get: () => '',
  }, activeRes);
  assert.equal(activeRes.code, 200);
  assert.equal(active.state.events[0].status, 'active');
});


const request = (body = {}) => ({ params: { eventId: 'EVT-1' }, body, user: { userId: 'SEC-1', username: 'secretary', role: 'secretary' }, ip: '', get: () => '' });

test('secretary creates an event without approval and forged statuses are ignored', async () => {
  const db = database();
  const res = response();
  await controller(db).createEvent(request({ eventName: 'Assembly', eventDate: '2035-01-01', startTime: '09:00', endTime: '17:00', location: 'Hall', createdBy: 'secretary', status: 'pending_approval' }), res);
  assert.equal(res.code, 201);
  assert.equal(res.data.event.status, 'upcoming');
  assert.equal(db.state.auditLogs[0].userId, 'SEC-1');
});

test('events open at the start boundary and close at the end boundary in Philippine time', async () => {
  for (const [time, expected] of [['08:59:59', 'upcoming'], ['09:00:00', 'active'], ['16:59:59', 'active'], ['17:00:00', 'closed']]) {
    const fixed = new Date('2026-10-28T' + time + '+08:00');
    class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [fixed.getTime()])); } }
    const db = database([event({ eventDate: '2026-10-28', status: 'upcoming' })]);
    const doc = await db.deps['../models/Event'].findOne({ eventId: 'EVT-1' });
    await controller(db, { Date: FixedDate }).refreshEventStatus(doc);
    assert.equal(doc.status, expected, time);
  }
});

test('old pending events follow their schedule without an approval step', async () => {
  const db = database([event({ eventDate: '2035-01-01', status: 'pending_approval' })]);
  const doc = await db.deps['../models/Event'].findOne({ eventId: 'EVT-1' });
  await controller(db).refreshEventStatus(doc);
  assert.equal(doc.status, 'upcoming');
});

test('secretary edits all event details and schedules without approval locks', async () => {
  const db = database([event({ eventDate: '2035-01-01', status: 'upcoming' })]);
  const res = response();
  await controller(db).updateEvent(request({ eventName: 'Changed assembly', description: 'Updated', location: 'New Hall', startTime: '10:00', status: 'pending_approval' }), res);
  assert.equal(res.code, 200);
  assert.equal(res.data.event.eventName, 'Changed assembly');
  assert.equal(res.data.event.location, 'New Hall');
  assert.equal(res.data.event.eventTime, '10:00');
  assert.equal(res.data.event.status, 'upcoming');
});

test('closed details can be edited, but changing a closed schedule requires Reopen and a reason', async () => {
  const db = database([event({ status: 'closed' })]);
  const res = response();
  await controller(db).updateEvent(request({ eventName: 'Corrected name' }), res);
  assert.equal(res.code, 200);
  assert.equal(res.data.event.status, 'closed');
  const denied = response();
  await controller(db).updateEvent(request({ eventDate: '2035-01-01' }), denied);
  assert.equal(denied.code, 400);
  assert.match(denied.data.message, /Reopen/);
});

test('secretary can delete upcoming, active, and closed events with an audit record', async () => {
  for (const status of ['upcoming', 'active', 'closed']) {
    const db = database([event({ status })]);
    const res = response();
    await controller(db).deleteEvent(request(), res);
    assert.equal(res.code, 200);
    assert.equal(db.state.events.length, 0);
    assert.equal(db.state.auditLogs[0].action, 'event_deleted');
  }
});

test('invalid schedules are rejected without saving an event', async () => {
  for (const patch of [{ eventDate: 'invalid' }, { startTime: '25:00' }, { endTime: '08:00' }]) {
    const db = database();
    const res = response();
    await controller(db).createEvent(request({ eventName: 'Assembly', eventDate: '2035-01-01', startTime: '09:00', endTime: '17:00', location: 'Hall', createdBy: 'secretary', ...patch }), res);
    assert.equal(res.code, 400);
    assert.equal(db.state.events.length, 0);
  }
});


test('event name and location are required on create and edit, including whitespace-only values', async () => {
  for (const field of ['eventName', 'location']) {
    for (const value of ['', '   ', null]) {
      const db = database();
      const res = response();
      await controller(db).createEvent(request({ eventName: 'Assembly', eventDate: '2035-01-01', startTime: '09:00', endTime: '17:00', location: 'Hall', createdBy: 'secretary', [field]: value }), res);
      assert.equal(res.code, 400);
      assert.equal(db.state.events.length, 0);
      const existing = database([event({ status: 'upcoming', eventDate: '2035-01-01' })]);
      const edited = response();
      await controller(existing).updateEvent(request({ [field]: value }), edited);
      assert.equal(edited.code, 400);
      assert.equal(existing.state.events[0][field], field === 'eventName' ? 'General Assembly' : 'Hall');
    }
  }
});
