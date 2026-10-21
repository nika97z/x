// Lets the installed app open without a connection. Todos themselves live in
// localStorage, so only the app files need caching.
const CACHE = 'todos-v1'
const PAGE = './'

self.addEventListener('install', (event) => {
  event.waitUntil(precache())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // The page: network first so updates arrive, the cached copy when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(PAGE, copy))
          }
          return response
        })
        .catch(() => caches.match(PAGE, { ignoreVary: true }).then((cached) => cached ?? Response.error())),
    )
    return
  }

  // Built files have a content hash in their name and never change: cache first.
  // ignoreVary: script requests carry an Origin header that the precached copies lack.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})

/** Caches the page and every file it links to (scripts, styles, icons). */
async function precache() {
  const cache = await caches.open(CACHE)
  const response = await fetch(PAGE, { cache: 'reload' })
  if (!response.ok) return
  const html = await response.clone().text()
  await cache.put(PAGE, response)
  const urls = new Set(
    Array.from(html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g), (match) => new URL(match[1], self.registration.scope).href),
  )
  await Promise.allSettled(Array.from(urls, (url) => cache.add(url)))
}
