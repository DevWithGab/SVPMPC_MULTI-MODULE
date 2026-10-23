import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'
import { manifest } from '../vite.config.js'

const source = await readFile(new URL('../src/sw.js', import.meta.url), 'utf8')

function worker(fetchImpl) {
  const handlers = {}
  const deleted = []
  const stored = []
  const fallback = new Response('Offline page')
  const cache = {
    addAll: async (requests) => stored.push(...requests),
    match: async () => fallback,
  }
  const context = {
    URL, Response,
    Request: class { constructor(url, options) { this.url = String(url); this.cache = options.cache } },
    fetch: fetchImpl,
    caches: {
      open: async () => cache,
      keys: async () => ['svpmpc-offline-v0', 'svpmpc-offline-v1', 'another-app'],
      delete: async (name) => deleted.push(name),
    },
    self: {
      __WB_MANIFEST: [{ url: 'offline.html', revision: 'v1' }],
      location: { origin: 'https://coop.example' },
      clients: { claim: async () => {} },
      addEventListener: (name, handler) => { handlers[name] = handler },
    },
  }
  vm.runInNewContext(source, context)
  return { handlers, deleted, stored, fallback }
}

function navigate(handlers, overrides = {}) {
  let response
  handlers.fetch({
    request: { url: 'https://coop.example/mortuary/treasurer', method: 'GET', mode: 'navigate', ...overrides },
    respondWith: (promise) => { response = promise },
  })
  return response
}

test('offline navigation receives the fallback; online navigation stays fresh', async () => {
  const online = new Response('Current application')
  const connected = worker(async () => online)
  assert.equal(await navigate(connected.handlers), online)
  const disconnected = worker(async () => { throw new TypeError('Offline') })
  assert.equal(await navigate(disconnected.handlers), disconnected.fallback)
})

test('API calls, mutations, assets and other origins bypass the worker', () => {
  const { handlers } = worker(() => { throw new Error('Should not fetch') })
  for (const overrides of [
    { url: 'https://coop.example/api' },
    { url: 'https://coop.example/api/members' },
    { method: 'POST' },
    { mode: 'cors' },
    { url: 'https://external.example/' },
  ]) assert.equal(navigate(handlers, overrides), undefined)
})

test('HTTP errors are preserved rather than presented as offline', async () => {
  const response = new Response('Unavailable', { status: 503 })
  assert.equal(await navigate(worker(async () => response).handlers), response)
})

test('the letterhead logo is available from cache without a network connection', async () => {
  const { handlers, fallback } = worker(() => { throw new Error('Network unavailable') })
  assert.equal(await navigate(handlers, {
    url: 'https://coop.example/SVPMPC-LOGO-PRINT.png', mode: 'no-cors',
  }), fallback)
})

test('the notice distinguishes offline devices from an unreachable system and updates on reconnection', async () => {
  const html = await readFile(new URL('../public/offline.html', import.meta.url), 'utf8')
  const dom = new JSDOM(html, { runScripts: 'outside-only' })
  const { window } = dom
  try {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    window.eval(window.document.querySelector('script').textContent)
    assert.equal(window.document.querySelector('h1').textContent, "You're offline")
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
    window.dispatchEvent(new window.Event('online'))
    assert.equal(window.document.querySelector('h1').textContent, 'Unable to reach the system')
    assert.match(window.document.querySelector('#connection-message').textContent, /could not be reached/)
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    window.dispatchEvent(new window.Event('offline'))
    assert.equal(window.document.querySelector('h1').textContent, "You're offline")
  } finally {
    window.close()
  }
})

test('installation caches only the public fallback and cleanup is scoped', async () => {
  const { handlers, stored, deleted } = worker()
  let pending
  const event = { waitUntil: (promise) => { pending = promise } }
  handlers.install(event)
  await pending
  assert.deepEqual(stored.map(({ url, cache }) => ({ url, cache })), [{ url: 'https://coop.example/offline.html', cache: 'reload' }])
  handlers.activate(event)
  await pending
  assert.deepEqual(deleted, ['svpmpc-offline-v0'])
})

test('manifest references valid PNG icons at their declared dimensions', async () => {
  const publicDir = new URL('../public/', import.meta.url)
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/')
  for (const icon of manifest.icons) {
    const data = await readFile(new URL(icon.src.slice(1), publicDir))
    assert.equal(data.subarray(1, 4).toString(), 'PNG')
    assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`, icon.sizes)
  }
})
