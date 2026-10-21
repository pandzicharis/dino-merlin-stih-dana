/**
 * Lokalno stanje — samo zadnji viđeni dan. Bez logina, bez baze.
 * Svaki pristup je u try/catch: private mode i blokirani storage ne smiju srušiti ekran.
 */

import { addDays, getActiveDate } from './date'

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
  window.dispatchEvent(new Event('lovedchange'))
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
  if (on) dates[id] = getActiveDate()
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
  const day = getActiveDate()
  write(FAVORITE_DATES, { ...read<Record<string, string>>(FAVORITE_DATES, {}), [id]: day })
  return day
}

/** PRIVREMENO (test opterećenja plejera): sačuvaj sve — postojeći ostaju na vrhu. Vraća koliko je dodano. */
export function saveAllFavorites(ids: string[]): number {
  const list = getFavorites()
  const add = ids.filter((id) => !list.includes(id))
  write(FAVORITES, [...list, ...add])
  const day = getActiveDate()
  const dates = { ...read<Record<string, string>>(FAVORITE_DATES, {}) }
  for (const id of add) dates[id] ??= day
  write(FAVORITE_DATES, dates)
  window.dispatchEvent(new Event('favchange'))
  return add.length
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
