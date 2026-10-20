/**
 * Service worker — namjerno minimalan.
 *
 * Sadržaj se mijenja svaki dan, pa se stranica uvijek traži s mreže;
 * offline fallback za zadnji viđeni ekran + push notifikacije.
 * Jedino JS/CSS/fontovi (imena s hešom, nikad se ne mijenjaju) i logotipi
 * idu iz keša — aplikacija se otvori bez čekanja na njih.
 */

const CACHE = 'stihdana-v23'
const OFFLINE = ['/', '/manifest.webmanifest', '/icons/icon-192.png?v=2']

/**
 * Oznaka "stigla je obavijest" — aplikacija je pročita pri otvaranju i
 * pokaže tombolu i kad je stih danas već viđen (npr. otvorena ujutro, ili
 * prvi dan poslije instalacije). Zaseban keš, da ga nova verzija ne obriše.
 * Ime i ključ moraju se slagati s lib/push-client.ts.
 */
const MARK = 'stihdana-izvuci'
const MARK_KEY = '/__izvuci'
const markDraw = () =>
  caches.open(MARK).then((c) => c.put(MARK_KEY, new Response('1'))).catch(() => {})

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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MARK).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

/**
 * Cache-first samo za fajlove koji se pod istim imenom nikad ne mijenjaju:
 * `/_next/static/` (heš u imenu) i `/brand/` (immutable, next.config.ts).
 * Keš je vezan za verziju (CACHE), pa ga nova verzija očisti.
 */
const STATIC = /^\/(_next\/static|brand)\//

/** Network-first za navigaciju: uvijek svjež stih, cache samo kad nema mreže. */
self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  if (STATIC.test(url.pathname)) {
    e.respondWith(
      caches.open(CACHE).then((c) =>
        c.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok && res.type === 'basic') c.put(req, res.clone())
              return res
            }),
        ),
      ),
    )
    return
  }

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

  // Tačka na ikonici aplikacije dok stih nije pročitan (iOS 16.4+ u PWA-u,
  // Chrome/Edge). Briše je aplikacija kad se stih izvuče, zajedno s oznakom.
  const badge =
    'setAppBadge' in self.navigator ? self.navigator.setAppBadge(1).catch(() => {}) : Promise.resolve()

  // otvorena aplikacija (i u pozadini) sazna odmah — ne tek na dodir
  const tell = () =>
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => list.forEach((c) => c.postMessage({ type: 'stihdana:izvuci' })))
      .catch(() => {})

  e.waitUntil(
    Promise.all([badge, markDraw()]).then(tell).then(() => self.registration.showNotification(d.title || 'Stih dana', {
      body: d.body || '',
      tag: d.tag || 'stih-dana',
      renotify: true,
      icon: '/icons/icon-192.png?v=2',
      // Android: mali znak u statusnoj traci mora biti jednobojan i proziran
      badge: '/icons/badge-96.png?v=2',
      data: { url: d.url || '/' },
    })),
  )
})

self.addEventListener('notificationclick', (e) => {
  // tačku na ikonici ne dira — briše je aplikacija kad se stih izvuče
  e.notification.close()
  // `?izvuci`: aplikacija od prvog kadra zna da je tombola (zastor iz <head>)
  const target = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin)
  target.searchParams.set('izvuci', '1')
  const url = target.href
  const path = target.pathname
  e.waitUntil(
    markDraw()
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then((list) => {
        for (const c of list) {
          if (!c.url.startsWith(self.location.origin) || !('focus' in c)) continue
          // već na stihu: bez ponovnog učitavanja — aplikacija sama pokrene tombolu
          if (new URL(c.url).pathname === path) {
            c.postMessage({ type: 'stihdana:izvuci' })
            return c.focus()
          }
          return c.focus().then(() => c.navigate(url)).catch(() => self.clients.openWindow(url))
        }
        return self.clients.openWindow(url)
      }),
  )
})
