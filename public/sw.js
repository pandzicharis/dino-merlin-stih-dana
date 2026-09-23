/**
 * Service worker — namjerno minimalan.
 *
 * Sadržaj se mijenja svaki dan, pa nema agresivnog keširanja:
 * samo offline fallback za zadnji viđeni ekran + push notifikacije.
 */

const CACHE = 'stihdana-v2'
const OFFLINE = ['/', '/manifest.webmanifest', '/icons/icon-192.png']

/**
 * NEMA `skipWaiting()` ovdje — nova verzija čeka.
 *
 * Aplikacija se otvara s početnog ekrana i zna stajati otvorena danima;
 * da nova verzija preuzme sama od sebe, stranica bi se promijenila pod
 * prstima. Umjesto toga se javi korisniku, a preuzima na njegovu potvrdu.
 */
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE)))
})

/** Potvrda iz aplikacije: preuzmi sad. */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

/** Network-first za navigaciju: uvijek svjež stih, cache samo kad nema mreže. */
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    )
  }
})

self.addEventListener('push', (e) => {
  let d = {}
  try {
    d = e.data ? e.data.json() : {}
  } catch {
    d = { body: e.data ? e.data.text() : '' }
  }

  e.waitUntil(
    self.registration.showNotification(d.title || 'Stih dana', {
      body: d.body || '',
      tag: d.tag || 'stih-dana',
      renotify: true,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: d.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
