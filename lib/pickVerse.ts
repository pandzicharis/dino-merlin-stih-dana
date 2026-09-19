/**
 * Deterministički izbor stiha iz datuma.
 *
 * Stih se NE bira u bazi — računa se. Posljedica: stranica je statična,
 * CDN-cache-ana i identična za sve, pa 500 i 500.000 korisnika koštaju isto.
 *
 * Isti datum -> uvijek isti stih (share link radi zauvijek),
 * ali svaki prolaz kroz cijelu bazu ima drugačiji redoslijed.
 */

import { VERSES, VERSE_BY_ID, type Verse } from '@/data/verses'
import { daysSinceEpoch } from './date'

/** mulberry32 — mali deterministički PRNG */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher–Yates sa sjemenom = broj ciklusa. */
function orderForCycle(cycle: number, n: number): number[] {
  const idx = [...Array(n).keys()]
  const rand = rng((cycle + 1) * 2654435761)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx
}

export function pickVerse(dateISO: string, pool: Verse[] = VERSES): Verse {
  const n = pool.length
  if (n === 0) throw new Error('data/verses.ts je prazan')

  const d = daysSinceEpoch(dateISO)
  const cycle = Math.floor(d / n)
  const pos = ((d % n) + n) % n
  return pool[orderForCycle(cycle, n)[pos]]
}

/** Za dev: koji je ovo dan i ciklus. */
export function verseMeta(dateISO: string, pool: Verse[] = VERSES) {
  const d = daysSinceEpoch(dateISO)
  return { day: d, cycle: Math.floor(d / pool.length), pos: ((d % pool.length) + pool.length) % pool.length }
}

export function verseById(id: string): Verse | undefined {
  return VERSE_BY_ID.get(id)
}
