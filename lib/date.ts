/**
 * Vrijeme i datum.
 *
 * Timezone je FIKSAN na Europe/Sarajevo — namjerno. Svako izvlači svoj stih
 * (lib/draw.ts), ali dan se svima mijenja u isto vrijeme: DAN STIHA traje od
 * obavijesti do obavijesti — od 12:00 do sljedećeg dana u 12:00, po
 * sarajevskom satu (`verseDayInTz`). Ujutro je još jučerašnji stih.
 */

import { deckParam, deckVerseId, inDeck } from './deck'

export const TZ = 'Europe/Sarajevo'
export const EPOCH = '2026-01-01'

/**
 * Sat koji aplikacija OBEĆAVA korisniku ("stih stiže u 12:00h").
 *
 * Ovo je samo natpis. Kad stih stvarno stiže odlučuje raspored crona
 * (.github/workflows/daily-push.yml ili cron-job.org) — ruta za slanje ne
 * gleda sat nego šalje kad god je pozovu.
 *
 * Ako pomjeriš cron, pomjeri i ovaj broj, inače aplikacija govori jedno a
 * telefon radi drugo.
 */
export const SEND_HOUR = 12

/** "12:00h" — za ispis na ekranu. */
export const SEND_TIME = `${String(SEND_HOUR).padStart(2, '0')}:00h`

/** Današnji datum u Sarajevu, format YYYY-MM-DD. Radi i na serveru i u browseru. */
export function todayInTz(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now)
}

/** Sat (0–23) u Sarajevu. */
export function hourInTz(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(now))
}

/**
 * DAN STIHA (YYYY-MM-DD): od obavijesti u 12:00 do sljedeće. Prije podneva je
 * to još jučerašnji dan — stih se ne mijenja ujutro, nego kad stigne obavijest
 * (tad i tombola). Sat se čita iz zone, pa ljetno/zimsko vrijeme ne pomjera granicu.
 */
export function verseDayInTz(now: Date = new Date()): string {
  const today = todayInTz(now)
  return hourInTz(now) < SEND_HOUR ? addDays(today, -1) : today
}

/**
 * Pomak zone u milisekundama za dati trenutak. Čita se iz same zone, pa
 * ljetno/zimsko vrijeme nije poseban slučaj.
 */
function tzOffsetMs(at: Date, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  )
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUTC - Math.floor(at.getTime() / 1000) * 1000
}

/**
 * Koliko milisekundi do sljedećeg dana stiha — do idućih 12:00 u Sarajevu.
 *
 * Dva puta godišnje, oko prelaska na ljetno vrijeme, zna promašiti za sat.
 * To nije problem: ko god ovo koristi ponovo pita `verseDayInTz()` kad
 * istekne, pa rani okidač ne promijeni ništa i samo se zakaže idući.
 */
export function msUntilNextDay(now: Date = new Date()): number {
  const DAY = 86_400_000
  const local = now.getTime() + tzOffsetMs(now, TZ)
  const noon = Math.floor(local / DAY) * DAY + SEND_HOUR * 3_600_000
  return noon > local ? noon - local : noon + DAY - local
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

/**
 * Pročitaj sve dev override-e iz URL-a i localStorage-a. Prazno u produkciji —
 * osim u prezentaciji, gdje se smiju birati stih i paleta (datum ne).
 */
export function readDevParams(): DevParams {
  const empty: DevParams = { date: null, verseId: null, mood: null }
  if (typeof window === 'undefined') return empty
  if (!OVERRIDE_ON) {
    return inDeck() ? { date: null, verseId: deckVerseId(), mood: deckParam('mood') } : empty
  }

  const q = new URLSearchParams(window.location.search)

  let date: string | null = null
  const d = q.get('d')
  const off = q.get('offset')
  if (d && isValidISODate(d)) {
    date = d
  } else if (off !== null && off !== '' && !Number.isNaN(Number(off))) {
    date = addDays(verseDayInTz(), Number(off))
  } else {
    const stored = safeGet(KEY)
    if (stored && isValidISODate(stored)) date = stored
  }

  // u prezentaciji (i lokalno) telefon nosi stih prezentacije
  return { date, verseId: q.get('verse') ?? (inDeck() ? deckVerseId() : null), mood: q.get('mood') }
}

/** Dan stiha koji aplikacija smatra "danas" — jedini izvor istine u UI-ju. */
export function getActiveDate(): string {
  return readDevParams().date ?? verseDayInTz()
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
