/**
 * Vrijeme i datum.
 *
 * Timezone je FIKSAN na Europe/Sarajevo — namjerno. Svi korisnici moraju
 * vidjeti isti stih istog dana, inače share i razgovor o stihu nemaju smisla.
 */

export const TZ = 'Europe/Sarajevo'
export const EPOCH = '2026-01-01'

/** Današnji datum u Sarajevu, format YYYY-MM-DD. Radi i na serveru i u browseru. */
export function todayInTz(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now)
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function daysSinceEpoch(iso: string): number {
  // podne u UTC izbjegava svaki DST edge-case
  const a = new Date(`${iso}T12:00:00Z`).getTime()
  const b = new Date(`${EPOCH}T12:00:00Z`).getTime()
  return Math.round((a - b) / 86_400_000)
}

export function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`))
}

/** Čitljiv datum: "31. decembar 2026." */
const MJESECI = [
  'januar', 'februar', 'mart', 'april', 'maj', 'juni',
  'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar',
]
const DANI = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota']

export function formatDateBs(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d}. ${MJESECI[m - 1]} ${y}.`
}

/** Dan u sedmici: "petak". Računa se iz UTC podneva, bez DST iznenađenja. */
export function formatDayBs(iso: string): string {
  return DANI[new Date(`${iso}T12:00:00Z`).getUTCDay()]
}

/** Puna linija iznad stiha: "Petak · 18. septembar 2026." */
export function formatFullDateBs(iso: string): string {
  const day = formatDayBs(iso)
  return `${day[0].toUpperCase()}${day.slice(1)} · ${formatDateBs(iso)}`
}

/* ─────────────────────────────────────────────────────────────
   DEV OVERRIDE — ručno pomjeranje datuma
   ───────────────────────────────────────────────────────────── */

export const OVERRIDE_ON =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_DATE_OVERRIDE === '1'

const KEY = 'stihdana:devDate'

export type DevParams = {
  date: string | null
  verseId: string | null
  mood: string | null
}

/** Pročitaj sve dev override-e iz URL-a i localStorage-a. Prazno u produkciji. */
export function readDevParams(): DevParams {
  const empty: DevParams = { date: null, verseId: null, mood: null }
  if (!OVERRIDE_ON || typeof window === 'undefined') return empty

  const q = new URLSearchParams(window.location.search)

  let date: string | null = null
  const d = q.get('d')
  const off = q.get('offset')
  if (d && isValidISODate(d)) {
    date = d
  } else if (off !== null && off !== '' && !Number.isNaN(Number(off))) {
    date = addDays(todayInTz(), Number(off))
  } else {
    const stored = safeGet(KEY)
    if (stored && isValidISODate(stored)) date = stored
  }

  return { date, verseId: q.get('verse'), mood: q.get('mood') }
}

/** Datum koji aplikacija smatra "danas" — jedini izvor istine u UI-ju. */
export function getActiveDate(): string {
  return readDevParams().date ?? todayInTz()
}

export function setDevDate(iso: string | null) {
  if (!OVERRIDE_ON || typeof window === 'undefined') return
  try {
    if (iso) localStorage.setItem(KEY, iso)
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode */
  }
  // ?d= i ?offset= imaju prioritet nad localStorage-om — makni ih da dugmad rade
  const url = new URL(window.location.href)
  url.searchParams.delete('d')
  url.searchParams.delete('offset')
  window.history.replaceState(null, '', url)
  window.dispatchEvent(new Event('devdatechange'))
}

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
