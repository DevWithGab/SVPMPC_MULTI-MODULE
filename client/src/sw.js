// Vite injects content revisions so an offline-page change updates this worker.
const precacheEntries = self.__WB_MANIFEST
const CACHE_PREFIX = 'svpmpc-offline-'
const CACHE_NAME = `${CACHE_PREFIX}${precacheEntries.map((entry) => entry.revision).join('-')}`
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(precacheEntries.map((entry) =>
        new Request(new URL(entry.url, self.location.origin), { cache: 'reload' })))),
  )
  // Updates activate after existing app windows close; never interrupt a form.
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  // Never cache API responses, member records, authenticated pages or writes.
  if (request.method !== 'GET' || request.mode !== 'navigate' ||
      url.origin !== self.location.origin ||
      url.pathname === '/api' || url.pathname.startsWith('/api/')) return

  event.respondWith((async () => {
    try {
      return await fetch(request)
    } catch {
      const cache = await caches.open(CACHE_NAME)
      return (await cache.match(OFFLINE_URL)) || new Response(
        'You are offline. Reconnect and reload to continue using SVPMPC.',
        { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
      )
    }
  })())
})
