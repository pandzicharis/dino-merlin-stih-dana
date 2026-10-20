/**
 * Service worker — namjerno minimalan.
 *
 * Sadržaj se mijenja svaki dan, pa se stranica uvijek traži s mreže (početna
 * iz keša samo kad mreža kasni); offline fallback za zadnji viđeni ekran +
 * push notifikacije.
 * JS/CSS/fontovi (imena s hešom, nikad se ne mijenjaju) i logotipi idu iz
 * keša — aplikacija se otvori bez čekanja na njih. Pjesme (kad se slušaju) i
 * omoti albuma imaju svoje trajne keševe: pjesma se ne skida iznova pri
 * svakom puštanju, nastavku i povratku u aplikaciju.
 */

const CACHE = 'stihdana-v26'
const OFFLINE = ['/manifest.webmanifest', '/icons/icon-192.png?v=2']

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
 * Pjesme i omoti — trajni keševi, nova verzija ih ne briše (kao MARK).
 * Pjesma je pod ključem s `?v=<trajanje>` (lib/player.ts `sourceOf`): nova
 * pjesma pod istim imenom dobije novi ključ, a stara se obriše.
 */
const AUDIO = 'stihdana-audio-v1'
const IMG = 'stihdana-img-v1'
const KEEP = [CACHE, MARK, AUDIO, IMG]
/** najviše pjesama i omota u kešu — najstariji izlaze */
const SONGS = 30
const COVERS = 80

/**
 * NEMA `skipWaiting()` ovdje — nova verzija čeka.
 *
 * Aplikacija se otvara s početnog ekrana i zna stajati otvorena danima;
 * da nova verzija preuzme sama od sebe, stranica bi se promijenila pod
 * prstima. Umjesto toga se javi korisniku, a preuzima na njegovu potvrdu.
 */
self.addEventListener('install', (e) => {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE).then((c) =>
        Promise.all([
          c.addAll(OFFLINE),
          // početna samo sa svojim dijelovima (keepHome) — stari keš s njima nova verzija briše
          fetch('/').then((res) => (res.ok ? keepHome(c, res).catch(() => {}) : Promise.reject(new Error('/')))),
        ]),
      ),
      warmCovers(),
    ]),
  )
})

/** Potvrda iz aplikacije: preuzmi sad. */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting()
  // pjesme koje se slušaju (i sljedeća u redu) — lib/sw-cache.ts
  if (e.data && e.data.type === 'stihdana:warm-audio' && Array.isArray(e.data.urls)) {
    const keys = e.data.urls.slice(0, 3).map(songKey).filter(Boolean)
    keys.forEach((k) => wanted.add(k))
    // pjesmu koju plejer upravo traži od početka worker preuzme uz njega
    // (fetch, ispod) — inače je preuzme sam, malo kasnije
    e.waitUntil(
      wait(3000).then(() =>
        Promise.all(
          keys.map((k) =>
            caches
              .open(AUDIO)
              .then((c) => c.match(k))
              .then((hit) => {
                if (hit || loading.has(k)) return
                const { got, done } = download(k)
                // plejeru ne treba — drugi primjerak se odbaci, upis ide dalje
                return got.then((r) => r && r.body.cancel()).catch(() => {}).then(() => done)
              })
              .catch(() => {}),
          ),
        ),
      ),
    )
  }
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

/**
 * Cache-first samo za fajlove koji se pod istim imenom nikad ne mijenjaju:
 * `/_next/static/` (heš u imenu) i `/brand/` (immutable, next.config.ts).
 * Keš je vezan za verziju (CACHE), pa ga nova verzija očisti.
 */
const STATIC = /^\/(_next\/static|brand)\//
const SONG = /^\/audio\/[^/]+\.(m4a|mp3)$/
const COVER = /^\/albumi\/.+\.(webp|jpe?g|png|avif)$/i

/**
 * Navigacija — mreža prvo. Početna iz keša samo kad mreža ne odgovori za
 * 2,5 s (ili je nema); keširana poslije novog deploya zna tražiti fajlove
 * kojih više nema — zato je u kešu samo sa svojim dijelovima (`keepHome`),
 * lijeni se preuzmu unaprijed (components/DailyVerse.tsx), a stranica se
 * jednom sama osvježi (app/layout.tsx `CHUNK_SCRIPT`).
 */
self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  if (SONG.test(url.pathname) && url.searchParams.has('v')) return song(e, url.href)
  if (COVER.test(url.pathname)) return cover(e, url.href)

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
    // pod ključem "/" smije biti samo početna (ne prezentacija ni admin)
    const home = url.pathname === '/'
    let saved
    // otišla je keširana (mreža kasnila) — ova s mreže se nije prikazala
    let late = false
    const net = fetch(req).then((res) => {
      if (home && res.ok && res.type === 'basic' && !res.redirected) {
        const copy = res.clone()
        // prikazana: svoje dijelove traži sama (STATIC ih kešira)
        saved = caches.open(CACHE).then((c) => (late ? keepHome(c, copy) : c.put('/', copy)))
      }
      return res
    })
    // mreža osvježi keš i kad je početna već otišla iz keša
    e.waitUntil(net.then(() => saved, () => {}).catch(() => {}))
    const offline = () => caches.match('/').then((r) => r || Response.error())
    if (!home) return e.respondWith(net.catch(offline))
    e.respondWith(
      caches.match('/').then((hit) =>
        hit
          ? Promise.race([
              net.catch(() => hit),
              wait(2500).then(() => {
                late = true
                return hit
              }),
            ])
          : net.catch(offline),
      ),
    )
  }
})

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Početna u keš tek kad su u njemu i njeni dijelovi (`/_next/static/` iz
 * HTML-a) — poslije sljedećeg deploya ih na serveru nema. Ne stigne li neki,
 * ostaje stara (njeni su dijelovi tu).
 */
function keepHome(c, res) {
  const type = res.headers.get('content-type') || 'text/html; charset=utf-8'
  return res.text().then((html) => {
    const urls = [...new Set(html.match(/\/_next\/static\/[^"'\\\s)]+/g) || [])]
    return Promise.all(
      // već preuzet (i u kešu stare verzije) se ne skida ponovo
      urls.map((u) => c.match(u).then((own) => own || caches.match(u).then((hit) => (hit ? c.put(u, hit) : c.add(u))))),
    ).then(() => c.put('/', new Response(html, { headers: { 'Content-Type': type } })))
  })
}

/* ── pjesme ── */

/**
 * WebKit dijelove zvuka (206) ne pamti, pa bi svako puštanje, nastavak i
 * povratak iz pozadine skidao pjesmu iznova. Ovdje je pjesma jednom, cijela;
 * plejer dobije tačno dio koji traži.
 *
 * U keš ide samo ono što aplikacija javi da se sluša (`wanted`, poruka
 * `stihdana:warm-audio`) — priprema pjesme ispod stiha (preload) ne skida
 * cijelu pjesmu svakome ko otvori aplikaciju (Vercel: ograničen prenos).
 */
const wanted = new Set()
/** preuzimanja u toku: ključ → upis u keš */
const loading = new Map()
/** zahtjev kraći od ovoga je proba (Safari `bytes=0-1`), ne slušanje */
const SMALL = 65535
/** "od početka": i odmah iza zaglavlja pjesme (iPhone poslije pripreme) */
const NEAR = 131072

/** Puni URL pjesme s `?v=`, istog sajta — inače ništa. */
function songKey(u) {
  try {
    const url = new URL(u, self.location.origin)
    return url.origin === self.location.origin && SONG.test(url.pathname) && url.searchParams.has('v') ? url.href : null
  } catch {
    return null
  }
}

const typeOf = (key) => (/\.mp3(\?|$)/.test(key) ? 'audio/mpeg' : 'audio/mp4')

function head(type, length, range) {
  const h = { 'Content-Type': type, 'Content-Length': String(length), 'Accept-Ranges': 'bytes' }
  if (range) h['Content-Range'] = range
  return h
}

/** `bytes=a-b`, `bytes=a-`, `bytes=-n` → [od, do] unutar `size`; null ako se ne da ispuniti. */
function span(range, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
  if (!m || (m[1] === '' && m[2] === '')) return null
  let a
  let b
  if (m[1] === '') {
    const n = Number(m[2])
    if (!n) return null
    a = Math.max(0, size - n)
    b = size - 1
  } else {
    a = Number(m[1])
    b = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  return a <= b && a < size ? [a, b] : null
}

/** Pjesma iz keša: cijela (200) ili tačno traženi dio (206) — Safari bez ispravnog 206 ne svira. */
function part(hit, range, key) {
  const type = hit.headers.get('content-type') || typeOf(key)
  return hit.blob().then((b) => {
    const size = b.size
    if (!range) return new Response(b, { status: 200, headers: head(type, size) })
    const r = span(range, size)
    if (!r)
      return new Response(null, { status: 416, statusText: 'Range Not Satisfiable', headers: { 'Content-Range': `bytes */${size}` } })
    return new Response(b.slice(r[0], r[1] + 1), {
      status: 206,
      statusText: 'Partial Content',
      headers: head(type, r[1] - r[0] + 1, `bytes ${r[0]}-${r[1]}/${size}`),
    })
  })
}

/** Dužina ispravnog cijelog fajla (200, istog sajta, nekomprimovan), ili 0. */
function whole(r) {
  const enc = r.headers.get('content-encoding')
  const len = Number(r.headers.get('content-length'))
  return r.status === 200 && r.type === 'basic' && r.body && (!enc || enc === 'identity') && len > 0 ? len : 0
}

/**
 * Cijela pjesma s mreže (bez Range) → keš. `got`: odgovor s mreže (njegov
 * drugi primjerak se upisuje), ili null kad se ne da upisati; `done`: upis
 * gotov (ili odbačen).
 */
function download(key) {
  let put = null
  const got = fetch(key).then((r) => {
    const len = whole(r)
    if (!len) {
      if (r.body) r.body.cancel().catch(() => {})
      return null
    }
    const copy = r.clone()
    put = caches.open(AUDIO).then((c) => save(c, key, copy, len))
    return r
  })
  const done = got
    .then(() => put)
    .catch(() => {})
    .finally(() => loading.delete(key))
  loading.set(key, done)
  return { got, done }
}

/**
 * Upis pjesme; prekinuto preuzimanje ne ostaje (put odbije, a kraći fajl se
 * obriše). Poslije: druge verzije iste pjesme van, i najviše SONGS pjesama.
 */
function save(c, key, res, len) {
  return c
    .put(key, res)
    .then(() => c.match(key))
    .then((hit) => (hit ? hit.blob() : null))
    .then((b) => {
      if (!b || b.size !== len) return c.delete(key)
      const path = new URL(key).pathname
      return c
        .keys()
        .then((reqs) => Promise.all(reqs.filter((q) => q.url !== key && new URL(q.url).pathname === path).map((q) => c.delete(q))))
        .then(() => trim(c, SONGS))
    })
}

/** Najviše `max` unosa — najstariji (prvi upisani) izlaze. */
function trim(c, max) {
  return c.keys().then((reqs) => Promise.all(reqs.slice(0, Math.max(0, reqs.length - max)).map((q) => c.delete(q))))
}

/** Od toka propusti samo bajtove [from, to) — dio koji je plejer tražio. */
function cut(from, to) {
  let at = 0
  return new TransformStream({
    transform(chunk, ctl) {
      const a = Math.max(from - at, 0)
      const b = Math.min(to - at, chunk.byteLength)
      at += chunk.byteLength
      if (b > a) ctl.enqueue(a === 0 && b === chunk.byteLength ? chunk : chunk.subarray(a, b))
      if (at >= to) ctl.terminate()
    },
  })
}

/**
 * Keš prvo. Promašaj: prvi pravi zahtjev plejera za pjesmu koja se sluša
 * (od početka, ne proba) skine CIJELU pjesmu — jedan primjerak u keš, drugi
 * plejeru kao traženi dio. Sve ostalo (proba, sredina pjesme, preuzimanje
 * već u toku, pjesma se ne sluša) ide na mrežu kao i prije.
 */
function song(e, key) {
  const req = e.request
  const range = req.headers.get('range')
  e.respondWith(
    caches
      .open(AUDIO)
      .then((c) => c.match(key))
      .catch(() => null)
      .then((hit) => {
        if (hit) return part(hit, range, key).catch(() => fetch(req))
        const m = range && /^bytes=(\d+)-(\d*)$/.exec(range.trim())
        const from = m ? Number(m[1]) : -1
        const to = m && m[2] !== '' ? Number(m[2]) : Infinity
        if (!wanted.has(key) || from < 0 || from > NEAR || to - from < SMALL || loading.has(key)) return fetch(req)
        const { got, done } = download(key)
        e.waitUntil(done)
        return got.then(
          (r) => {
            if (!r) return fetch(req)
            const len = whole(r)
            if (from >= len) {
              r.body.cancel().catch(() => {})
              return fetch(req)
            }
            const end = Math.min(to, len - 1)
            const body = from > 0 || end < len - 1 ? r.body.pipeThrough(cut(from, end + 1)) : r.body
            return new Response(body, {
              status: 206,
              statusText: 'Partial Content',
              headers: head(r.headers.get('content-type') || typeOf(key), end - from + 1, `bytes ${from}-${end}/${len}`),
            })
          },
          () => fetch(req),
        )
      }),
  )
}

/* ── omoti ── */

/** omoti već osvježeni s mreže dok ovaj worker živi — ne pita se za svaki prikaz */
const fresh = new Set()

/** Omot odmah iz keša, a u pozadini se osvježi (omot se zna zamijeniti istim imenom). */
function cover(e, key) {
  const net = () =>
    fetch(e.request).then((res) => {
      if (res.status === 200 && res.type === 'basic') {
        const copy = res.clone()
        e.waitUntil(
          caches
            .open(IMG)
            .then((c) => c.put(key, copy).then(() => trim(c, COVERS)))
            .catch(() => {}),
        )
      }
      return res
    })
  e.respondWith(
    caches
      .open(IMG)
      .then((c) => c.match(key))
      .catch(() => null)
      .then((hit) => {
        if (!hit) return net()
        if (!fresh.has(key)) {
          fresh.add(key)
          e.waitUntil(net().catch(() => {}))
        }
        return hit
      }),
  )
}

/** Mali omoti (spisak pravi build, public/albumi/precache.json) — pri instalaciji; nikad ne obori instalaciju. */
function warmCovers() {
  return fetch('/albumi/precache.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : []))
    .then((list) =>
      caches.open(IMG).then((c) =>
        Promise.all(
          (Array.isArray(list) ? list : [])
            .filter((u) => typeof u === 'string' && u.startsWith('/albumi/'))
            .slice(0, COVERS)
            .map((u) => {
              const key = new URL(u, self.location.origin).href
              return c
                .match(key)
                .then((hit) => hit || fetch(key).then((res) => (res.status === 200 && res.type === 'basic' ? c.put(key, res) : undefined)))
                .catch(() => {})
            }),
        ),
      ),
    )
    .catch(() => {})
}

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
