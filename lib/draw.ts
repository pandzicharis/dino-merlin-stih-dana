'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { Verse } from '@/data/verses'
import { addDays } from './date'

/**
 * SVAKOM SVOJ STIH — izvlačenje na uređaju.
 *
 * Kao papirić s pulta u Magazi: svako izvuče svoj. Server o tome ne zna
 * ništa — stranica je i dalje ista za sve i dolazi s CDN-a, samo nosi listu
 * stihova, a izvlači se ovdje. 10 i 100.000 ljudi i dalje koštaju isto.
 *
 * ── Pravila ────────────────────────────────────────────────────────────
 *
 *   špil      nasumično, ali bez ponavljanja: dok ne prođeš kroz sve aktivne
 *             stihove, nijedan se ne vrati. Onda novi krug, a zadnjih
 *             nekoliko iz starog ne mogu odmah opet.
 *   dan       izvučen stih se zapamti za taj datum — isti dan je uvijek isti
 *             stih, i izmjena u adminu ga ne dira.
 *   obavijest ne nosi stih nego poziv "Izvuci svoj stih" (lib/notify.ts) —
 *             stih se otkriva tek kad se izvuče, pa nema šta da se razilazi.
 *
 * Gdje se čuva: localStorage — čita se sinhrono, bez treptanja.
 */

export type ListVerse = Verse & { active?: boolean }

type Entry = {
  id: string
  /** krug špila */
  r: number
  /** otvoren u aplikaciji — do tad je samo izvučen (plan ili obavijest) */
  seen?: 1
}
type State = { days: Record<string, Entry> }

const KEY = 'stihdana:draw'
const EVENT = 'stihdana:draw'
/** Koliko dana istorije se pamti. */
const KEEP = 500
/** Zadnjih ovoliko iz starog kruga ne može odmah u novi. */
const GAP = 7

/* ── stanje ─────────────────────────────────────────────────── */

// Ako je localStorage zaključan (privatni prozor), stanje živi u memoriji:
// stih se i dalje izvuče i drži dok je stranica otvorena.
let current: string | null = null

function snapshot(): string {
  if (current == null) {
    try {
      current = localStorage.getItem(KEY) ?? ''
    } catch {
      current = ''
    }
  }
  return current
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return
    current = null
    cb()
  }
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', onStorage)
  }
}

function parse(raw: string | null): State {
  if (!raw) return { days: {} }
  try {
    const s = JSON.parse(raw) as State
    return s && typeof s.days === 'object' && s.days ? s : { days: {} }
  } catch {
    return { days: {} }
  }
}

function save(s: State) {
  current = JSON.stringify(s)
  try {
    localStorage.setItem(KEY, current)
  } catch {
    /* privatni prozor ili pun storage — ostaje u memoriji */
  }
  window.dispatchEvent(new Event(EVENT))
}

/* ── izvlačenje ─────────────────────────────────────────────── */

function rand(n: number): number {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0] % n
  } catch {
    return Math.floor(Math.random() * n)
  }
}

/** Sljedeći stih poslije dana `past` (sortirani datumi, svi raniji). */
function next(days: State['days'], past: string[], pool: string[]): Entry {
  const last = past.length ? days[past[past.length - 1]] : undefined
  let r = last?.r ?? 0
  // ovaj krug: od zadnjeg dana unazad, dok je krug isti
  const round = new Set<string>()
  for (let i = past.length - 1; i >= 0 && days[past[i]].r === r; i--) round.add(days[past[i]].id)
  let cand = pool.filter((id) => !round.has(id))
  if (!cand.length) {
    // špil je prošao — novi krug, bez zadnjih nekoliko iz starog
    r += 1
    const recent = new Set(past.slice(-Math.min(GAP, Math.floor(pool.length / 2))).map((d) => days[d].id))
    cand = pool.filter((id) => !recent.has(id))
    if (!cand.length) cand = pool
  }
  return { id: cand[rand(cand.length)], r }
}

/**
 * Sredi stanje za `today`: današnji stih ostaje kakav je, a ako ga nema —
 * izvuče se. Istorija starija od KEEP dana se zaboravi.
 */
function settle(s: State, today: string, pool: string[], known: Set<string>): State {
  const days: State['days'] = {}
  const oldest = addDays(today, -KEEP)
  for (const [d, e] of Object.entries(s.days)) {
    // budućnost se ne čuva (dev pomjeranje datuma), a stih kojeg više nema
    // nigdje (druga baza, stari test) — dan se izvuče ponovo
    if (d < oldest || d > today || !known.has(e.id)) continue
    days[d] = e
  }
  if (!days[today]) days[today] = next(days, Object.keys(days).sort(), pool)
  return { days }
}

/** Datumi za koje je izvlačenje u ovoj sesiji bilo novo — animacija ih prati. */
const fresh = new Set<string>()

/**
 * Stih koji ovaj uređaj ima za `date`. `null` dok se ne zna (server, prvi
 * frejm). `fresh`: prvi put otvoren danas — vrijeme za animaciju izvlačenja.
 */
export function useDraw(date: string, verses: ListVerse[], on = true): { verse: Verse; fresh: boolean } | null {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null)
  const byId = useMemo(() => new Map<string, Verse>(verses.map((v) => [v.id, v])), [verses])
  const pool = useMemo(() => {
    const a = verses.filter((v) => v.active !== false)
    return (a.length ? a : verses).map((v) => v.id)
  }, [verses])

  const entry = raw == null ? undefined : parse(raw).days[date]
  const verse = entry ? byId.get(entry.id) : undefined
  const ready = raw != null
  const missing = ready && !verse

  // novi dan (i "izvuci ponovo" u dev traci): izvuci današnji
  useEffect(() => {
    if (!on || !missing) return
    save(settle(parse(snapshot()), date, pool, new Set(byId.keys())))
  }, [on, missing, date, pool, byId])

  // otvoren = viđen; animacija ostaje upamćena za ovu sesiju
  const id = verse?.id
  const seen = entry?.seen
  useEffect(() => {
    if (!on || !id || seen) return
    fresh.add(date)
    const s = parse(snapshot())
    if (s.days[date]?.id === id) {
      s.days[date] = { ...s.days[date], seen: 1 }
      save(s)
    }
  }, [on, id, seen, date])

  if (!on || !verse || !entry) return null
  return { verse, fresh: !entry.seen || fresh.has(date) }
}

/**
 * "Izvuci ponovo" na ekranu stiha: današnji stih se zamijeni drugim (nikad
 * istim), u istom potezu — ekran ne ostane prazan — i izvlačenje se odigra.
 */
export function drawAgain(date: string, verses: ListVerse[]) {
  const active = verses.filter((v) => v.active !== false)
  const pool = (active.length ? active : verses).map((v) => v.id)
  const s = parse(snapshot())
  const cur = s.days[date]?.id
  delete s.days[date]
  const out = settle(s, date, pool, new Set(verses.map((v) => v.id)))
  const others = pool.filter((id) => id !== cur)
  if (out.days[date].id === cur && others.length) out.days[date] = { ...out.days[date], id: others[rand(others.length)] }
  fresh.delete(date)
  save(out)
}

/** Dev: zaboravi stih za `date` i dalje — izvuče se ponovo, s animacijom. */
export function redraw(date: string) {
  const s = parse(snapshot())
  for (const d of Object.keys(s.days)) if (d >= date) delete s.days[d]
  fresh.delete(date)
  save(s)
}
