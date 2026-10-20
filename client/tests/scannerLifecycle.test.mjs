import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('scanner enables without reload, releases the camera at end/cancellation, and rejects late permission streams', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const original = {
    now: Date.now, interval: globalThis.setInterval, clear: globalThis.clearInterval,
    raf: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame,
    act: globalThis.IS_REACT_ACT_ENVIRONMENT,
    media: Object.getOwnPropertyDescriptor(navigator, 'mediaDevices'),
    visibility: Object.getOwnPropertyDescriptor(document, 'visibilityState'),
    ready: Object.getOwnPropertyDescriptor(window.HTMLMediaElement.prototype, 'readyState'),
    play: window.HTMLMediaElement.prototype.play,
  };
  let api;
  let originalEvents;
  try {
    const { default: QRScanner } = await vite.ssrLoadModule('/src/components/attendance/scanner_operator/QRScanner.jsx');
    ({ eventAPI: api } = await vite.ssrLoadModule('/src/services/api.js'));
    originalEvents = api.getEvents;
    const scheduled = {
      eventId: 'TEST-TIMED', eventName: 'Timed assembly', status: 'upcoming',
      eventDate: '2026-10-21', startTime: '09:50', endTime: '10:20',
    };
    let serverEvent = scheduled;
    const pages = [];
    api.getEvents = async ({ page }) => {
      pages.push(page);
      return { events: page === 1 ? [{ ...scheduled, eventId: 'CLOSED', status: 'closed' }] : [{ ...serverEvent }], pagination: { totalPages: 2 } };
    };
    let now = Date.parse('2026-10-21T09:49:59+08:00');
    Date.now = () => now;
    const timers = new Map();
    globalThis.setInterval = (callback, delay) => { timers.set(delay, callback); return delay; };
    globalThis.clearInterval = delay => timers.delete(delay);
    globalThis.requestAnimationFrame = () => 1;
    globalThis.cancelAnimationFrame = () => {};
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    Object.defineProperty(window.HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 2 });
    window.HTMLMediaElement.prototype.play = async () => {};
    const makeStream = () => {
      const track = { stopped: false, stop() { this.stopped = true; }, getCapabilities: () => ({}) };
      return { track, getTracks: () => [track], getVideoTracks: () => [track] };
    };
    let stream = makeStream();
    const media = { getUserMedia: async () => stream };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: media });
    const button = name => [...container.querySelectorAll('button')].find(item => item.textContent.trim() === name);
    const tick = async time => {
      now = Date.parse(time);
      await act(async () => timers.get(1000)());
    };

    await act(async () => root.render(React.createElement(QRScanner, { events: [scheduled], user: { name: 'Test operator' } })));
    assert.equal(button('Start camera').disabled, true);
    assert.ok(pages.includes(2), 'scheduled events beyond the first API page are loaded');
    const callsBeforeStart = pages.length;
    await tick('2026-10-21T09:50:00+08:00');
    assert.equal(button('Start camera').disabled, false);
    assert.equal(pages.length, callsBeforeStart, 'start availability does not wait for another request or page reload');
    await act(async () => button('Start camera').click());
    assert.ok(button('Stop camera'));
    assert.equal(stream.track.stopped, false);
    await tick('2026-10-21T10:20:00+08:00');
    assert.equal(stream.track.stopped, true);
    assert.equal(container.querySelector('video').srcObject, null);
    assert.equal(button('Start camera').disabled, true);
    assert.match(container.textContent, /camera has been stopped/);

    await tick('2026-10-21T09:50:00+08:00');
    let grantPermission;
    media.getUserMedia = () => new Promise(resolve => { grantPermission = resolve; });
    await act(async () => button('Start camera').click());
    assert.ok(button('Cancel camera'));
    await tick('2026-10-21T10:20:00+08:00');
    const lateStream = makeStream();
    await act(async () => grantPermission(lateStream));
    assert.equal(lateStream.track.stopped, true);
    assert.equal(container.querySelector('video').srcObject, null);
    assert.equal(button('Start camera').disabled, true);

    await tick('2026-10-21T09:50:00+08:00');
    stream = makeStream();
    media.getUserMedia = async () => stream;
    await act(async () => button('Start camera').click());
    assert.ok(button('Stop camera'));
    serverEvent = { ...scheduled, status: 'cancelled' };
    await act(async () => timers.get(10000)());
    assert.equal(stream.track.stopped, true);
    assert.equal(button('Start camera').disabled, true);
  } finally {
    await act(async () => root.unmount());
    if (originalEvents) api.getEvents = originalEvents;
    Date.now = original.now;
    globalThis.setInterval = original.interval;
    globalThis.clearInterval = original.clear;
    globalThis.requestAnimationFrame = original.raf;
    globalThis.cancelAnimationFrame = original.cancel;
    globalThis.IS_REACT_ACT_ENVIRONMENT = original.act;
    if (original.media) Object.defineProperty(navigator, 'mediaDevices', original.media);
    else delete navigator.mediaDevices;
    if (original.visibility) Object.defineProperty(document, 'visibilityState', original.visibility);
    else delete document.visibilityState;
    Object.defineProperty(window.HTMLMediaElement.prototype, 'readyState', original.ready);
    window.HTMLMediaElement.prototype.play = original.play;
    container.remove();
    await vite.close();
  }
});
