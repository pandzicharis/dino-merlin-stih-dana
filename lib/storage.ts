/**
 * Lokalno stanje — samo zadnji viđeni dan. Bez logina, bez baze.
 * Svaki pristup je u try/catch: private mode i blokirani storage ne smiju srušiti ekran.
 */

import { addDays, getActiveDate, shownDay } from './date'
import { audioFile } from './audio-name'

const SEEN = 'stihdana:lastSeen'
const NOTIFY = 'stihdana:notify'

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

/**
 * Želi li korisnik obavijesti — prekidač u aplikaciji, odvojen od sistemske
 * dozvole. Dozvola se traži na uvodu i više se ne dira; ovo je ono što
 * korisnik pali i gasi, i po čemu se ekran crta ODMAH, bez čekanja mreže.
 *
 * Podrazumijeva se `true`: ko je dozvolu dao, taj je obavijesti i htio.
 */
export function getNotifyIntent(): boolean {
  return read<boolean>(NOTIFY, true)
}

export function setNotifyIntent(on: boolean) {
  write(NOTIFY, on)
  window.dispatchEvent(new Event('notifychange'))
}

export function getLastSeen(): string | null {
  return read<string | null>(SEEN, null)
}

export function setLastSeen(iso: string) {
  write(SEEN, iso)
}

/* ── niz: dana zaredom s otvorenim stihom ─────────────────────── */

const STREAK = 'stihdana:niz'

/**
 * Koliki je niz na dan `iso` — samo čita. Raste ako je stih otvoren i jučer,
 * inače kreće ispočetka. Ko je aplikaciju koristio i prije niza, a otvorio
 * je jučer (`lastSeen`), kreće od dva.
 */
export function peekStreak(iso: string): number {
  const s = read<{ last: string; n: number } | null>(STREAK, null)
  if (s?.last === iso) return s.n
  const yesterday = addDays(iso, -1)
  return s ? (s.last === yesterday ? s.n + 1 : 1) : getLastSeen() === yesterday ? 2 : 1
}

/** Stih otvoren na dan `iso` — zapamti niz. Zove se PRIJE `setLastSeen`. */
export function bumpStreak(iso: string) {
  write(STREAK, { last: iso, n: peekStreak(iso) })
}

/* ── dijeljenje: zadnji izabrani format ───────────────────────── */

const SHARE = 'stihdana:share'

export function getSharePrefs(): { format?: string } {
  return read<{ format?: string }>(SHARE, {})
}

export function setSharePrefs(prefs: { format: string }) {
  write(SHARE, prefs)
}

/* ── omiljene pjesme (zvjezdica u plejeru) i koliko je koja slušana ─── */

const LOVED = 'stihdana:omiljene'
const PLAYS = 'stihdana:slusano'

export function getLoved(): string[] {
  const v = read<unknown>(LOVED, [])
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** Zvjezdica na pjesmi — dodaj/makni iz omiljenih. Vraća novo stanje. */
export function toggleLoved(id: string): boolean {
  const list = getLoved()
  const on = !list.includes(id)
  write(LOVED, on ? [id, ...list] : list.filter((x) => x !== id))
  window.dispatchEvent(new Event('lovedchange'))
  return on
}

/** Koliko je puta koja pjesma puštena (id stiha → broj). */
export function getPlays(): Record<string, number> {
  return read<Record<string, number>>(PLAYS, {})
}

/** Pjesma krenula — jedan više (malo, lokalno; za "Omiljene" redom slušanja). */
export function countPlay(id: string) {
  const all = getPlays()
  all[id] = (all[id] ?? 0) + 1
  write(PLAYS, all)
  bumpMonth('plays', id)
  window.dispatchEvent(new Event('lovedchange'))
}

/* ── mjesec: koliko je čega bilo (pregled mjeseca), samo na ovom telefonu ── */

const MONTH = 'stihdana:mjesec'
type MonthCount = { plays?: number; shared?: number; /** pjesma (fajl) → koliko puta puštena */ songs?: Record<string, number> }

/**
 * Jedno više u ovom mjesecu: pjesma puštena (`plays`, uz `song` — koja) ili
 * stih podijeljen (`shared`).
 */
export function bumpMonth(k: 'plays' | 'shared', song?: string) {
  const ym = shownDay(getActiveDate()).slice(0, 7)
  const all = read<Record<string, MonthCount>>(MONTH, {})
  const m: MonthCount = { ...all[ym], [k]: (all[ym]?.[k] ?? 0) + 1 }
  if (song) m.songs = { ...m.songs, [song]: (m.songs?.[song] ?? 0) + 1 }
  all[ym] = m
  write(MONTH, all)
}

/* ── otvaranje stiha po danima: kad i kako (pregled mjeseca) ─── */

const OPENED = 'stihdana:otvoreno'
type Opened = { t: string; push?: 1 }

/** Stih dana `day` otvoren — zapamti prvo otvaranje: vrijeme i je li iz obavijesti. */
export function noteOpen(day: string, push: boolean) {
  const all = read<Record<string, Opened>>(OPENED, {})
  if (all[day]) return
  const now = new Date()
  const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  all[day] = push ? { t, push: 1 } : { t }
  write(OPENED, all)
}

/** Otvaranja u mjesecu `ym`: dan → vrijeme i je li iz obavijesti. */
export function openedIn(ym: string): Record<string, Opened> {
  return Object.fromEntries(Object.entries(read<Record<string, Opened>>(OPENED, {})).filter(([d]) => d.startsWith(ym)))
}

/** Brojevi mjeseca `ym` ("2026-10"). */
export function monthCount(ym: string): MonthCount {
  return read<Record<string, MonthCount>>(MONTH, {})[ym] ?? {}
}

/* ── favoriti: lista id-eva, bez logina ──────────────────────── */

const FAVORITES = 'stihdana:favorites'
/** kad je koji stih sačuvan: id → YYYY-MM-DD */
const FAVORITE_DATES = 'stihdana:favoriteDates'

export function getFavorites(): string[] {
  const v = read<unknown>(FAVORITES, [])
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** Vraća novo stanje: je li stih sada sačuvan. Najnoviji ide na vrh liste. */
export function toggleFavorite(id: string): boolean {
  const list = getFavorites()
  const on = !list.includes(id)
  write(FAVORITES, on ? [id, ...list] : list.filter((x) => x !== id))
  const dates = { ...read<Record<string, string>>(FAVORITE_DATES, {}) }
  // dan kad je sačuvan — pravi datum (lib/date.ts shownDay), i ujutro
  if (on) dates[id] = shownDay(getActiveDate())
  else delete dates[id]
  write(FAVORITE_DATES, dates)
  window.dispatchEvent(new Event('favchange'))
  return on
}

/**
 * Dan kad je stih sačuvan. Za one sačuvane prije nego se ovo pamtilo —
 * zadnji dan kad je bio izvučen na ovom uređaju (lib/draw.ts), ako ga ima.
 */
export function favoriteDate(id: string): string | undefined {
  const dates = read<Record<string, string> | null>(FAVORITE_DATES, {})
  if (typeof dates?.[id] === 'string') return dates[id]
  const draw = read<{ days?: Record<string, { id?: string }> } | null>('stihdana:draw', {})
  return Object.keys(draw?.days ?? {})
    .filter((d) => draw?.days?.[d]?.id === id)
    .sort()
    .at(-1)
}

/**
 * Dan sačuvanog stiha, uvijek: ako se ne zna (sačuvan davno, prije nego se
 * pamtilo, a nije ni u izvlačenjima), zapiše se današnji — od tad stoji isti.
 */
export function savedDay(id: string): string {
  const known = favoriteDate(id)
  if (known) return known
  const day = shownDay(getActiveDate())
  write(FAVORITE_DATES, { ...read<Record<string, string>>(FAVORITE_DATES, {}), [id]: day })
  return day
}

/** Samo localhost (dev traka): sačuvaj sve stihove iz baze — postojeći ostaju na vrhu. Vraća koliko je dodano. */
export function saveAllFavorites(ids: string[]): number {
  const list = getFavorites()
  const add = ids.filter((id) => !list.includes(id))
  write(FAVORITES, [...list, ...add])
  const day = shownDay(getActiveDate())
  const dates = { ...read<Record<string, string>>(FAVORITE_DATES, {}) }
  for (const id of add) dates[id] ??= day
  write(FAVORITE_DATES, dates)
  window.dispatchEvent(new Event('favchange'))
  return add.length
}

/**
 * Probni podaci za pregled mjeseca `ym` ("2026-10"), dani 1…`upto`: izvučeni
 * stihovi po danima (poneki dan preskočen), kad i kako su otvoreni, sačuvani,
 * puštene pjesme, podijeljeni. Isti rezultat svaki put za isti mjesec
 * (prezentacija), postojeći dani se ne diraju. Za razvojnu traku i prezentaciju
 * — pa i na produkciji, gdje telefon prezentacije nema svoju istoriju.
 */
export function seedMonth(list: { id: string; song: string }[], ym: string, upto: number, savedTarget = 18) {
  if (!list.length || upto < 1) return
  // isti niz brojeva za isti mjesec
  let h = [...ym].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  const rnd = (n: number) => {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0
    return (h >>> 8) % n
  }
  const draw = read<{ days?: Record<string, { id: string; r: number; seen?: 1 }> }>('stihdana:draw', {})
  const days = { ...draw.days }
  const r = Object.values(days).at(-1)?.r ?? 0
  const opened = read<Record<string, Opened>>(OPENED, {})
  const favs = getFavorites()
  const dates = read<Record<string, string>>(FAVORITE_DATES, {})
  const songs: Record<string, number> = {}
  for (let d = 1; d <= upto; d++) {
    const iso = `${ym}-${String(d).padStart(2, '0')}`
    // poneki dan bez stiha — niz se prekine
    if (!days[iso] && d % 9 === 4) continue
    const v = list.find((x) => x.id === days[iso]?.id) ?? list[rnd(list.length)]
    days[iso] ??= { id: v.id, r, seen: 1 }
    opened[iso] ??= rnd(10) < 6 ? { t: `12:0${rnd(10)}`, push: 1 } : { t: `${13 + rnd(10)}:${String(rnd(60)).padStart(2, '0')}` }
    if (rnd(10) < 7 && !favs.includes(v.id)) {
      favs.push(v.id)
      dates[v.id] = iso
    }
    const k = audioFile(v.song)
    songs[k] = (songs[k] ?? 0) + 1 + rnd(5)
  }
  // sačuvanih ovog mjeseca ima barem ~18 (ili koliko ima stihova): ostali, na nasumične dane
  const target = Math.min(list.length, savedTarget)
  let have = favs.filter((id) => dates[id]?.startsWith(ym)).length
  for (const v of list) {
    if (have >= target) break
    if (favs.includes(v.id)) continue
    favs.push(v.id)
    dates[v.id] = `${ym}-${String(1 + rnd(upto)).padStart(2, '0')}`
    have++
  }
  write('stihdana:draw', { ...draw, days })
  write(OPENED, opened)
  write(FAVORITES, favs)
  write(FAVORITE_DATES, dates)
  const all = read<Record<string, MonthCount>>(MONTH, {})
  all[ym] = { plays: Object.values(songs).reduce((a, b) => a + b, 0), shared: 3 + rnd(6), songs }
  write(MONTH, all)
  window.dispatchEvent(new Event('favchange'))
}

/** Izbaci sačuvane id-eve kojih više nema (obrisan stih, stari test). */
export function pruneFavorites(valid: Set<string>) {
  const list = getFavorites()
  const kept = list.filter((id) => valid.has(id))
  if (kept.length !== list.length) {
    write(FAVORITES, kept)
    window.dispatchEvent(new Event('favchange'))
  }
}
