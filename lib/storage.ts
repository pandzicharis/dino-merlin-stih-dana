/**
 * Lokalno stanje — samo zadnji viđeni dan. Bez logina, bez baze.
 * Svaki pristup je u try/catch: private mode i blokirani storage ne smiju srušiti ekran.
 */

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

/* ── dijeljenje: zadnji izabrani format ───────────────────────── */

const SHARE = 'stihdana:share'

export function getSharePrefs(): { format?: string } {
  return read<{ format?: string }>(SHARE, {})
}

export function setSharePrefs(prefs: { format: string }) {
  write(SHARE, prefs)
}

/* ── favoriti: lista id-eva, bez logina ──────────────────────── */

const FAVORITES = 'stihdana:favorites'

export function getFavorites(): string[] {
  const v = read<unknown>(FAVORITES, [])
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** Vraća novo stanje: je li stih sada sačuvan. Najnoviji ide na vrh liste. */
export function toggleFavorite(id: string): boolean {
  const list = getFavorites()
  const on = !list.includes(id)
  write(FAVORITES, on ? [id, ...list] : list.filter((x) => x !== id))
  window.dispatchEvent(new Event('favchange'))
  return on
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

/* ── niz dana zaredom ────────────────────────────────────────── */

const STREAK = 'stihdana:streak'

type Streak = { last: string; count: number }

export function getStreak(): Streak | null {
  return read<Streak | null>(STREAK, null)
}

/**
 * Upiši posjetu za dati dan (uvijek stvarni dan u Sarajevu, nikad dev datum).
 * Jučer → niz raste; danas → ništa; rupa → kreće ispočetka.
 */
export function recordVisit(today: string, yesterday: string) {
  const s = getStreak()
  if (s?.last === today) return
  const count = s?.last === yesterday ? s.count + 1 : 1
  write(STREAK, { last: today, count })
  window.dispatchEvent(new Event('streakchange'))
}
