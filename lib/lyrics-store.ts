/**
 * Tekstovi pjesama kod nas — SAMO SERVER (i skripte).
 *
 *   data/lyrics.json   { ime-fajla: { title, lines, url?, synced? } }
 *
 * Kao pjesma (public/audio) i trajanje (data/audio.json): kad se pjesma
 * preuzme — admin lokalno, `npm run audio`, GitHub (.github/workflows/audio.yml)
 * — uz nju se jednom spremi i tekst: s dinomerlin.com (lib/dino-site.ts) i,
 * ako LRCLIB ima zapis našeg trajanja, s vremenom redova (lib/lrclib.ts).
 * Spremljen tekst /api/lyrics daje odmah, bez ijednog sajta.
 *
 * Spremi se samo kad su oba izvora odgovorila — inače drugi put. Novi pokušaj
 * za spremljenu pjesmu (npr. LRCLIB je dobio zapis): obriši njen ključ, pa
 * `npm run audio -- --lyrics`.
 */

import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { lyricsOf } from './dino-site'
import { lrcOf, type SyncedLine } from './lrclib'

/** `offset`: pomak teksta u sekundama (+ = redovi svijetle ranije) — admin ga podesi kad LRC kasni ili žuri */
export type StoredLyrics = { title: string; lines: string[]; url?: string; synced?: SyncedLine[]; offset?: number }

const FILE = path.join(process.cwd(), 'data', 'lyrics.json')

export async function readLyrics(): Promise<Record<string, StoredLyrics>> {
  try {
    return JSON.parse(await readFile(FILE, 'utf8')) as Record<string, StoredLyrics>
  } catch {
    return {}
  }
}

/**
 * Tekst iz oba izvora. `duration`: trajanje našeg fajla; `fresh`: LRCLIB iznova.
 * null (pokuša se opet) kad LRCLIB ne odgovori — bez njega nema vremena redova;
 * ne odgovori li sajt, redovi su s LRCLIB-a (ako ih ima).
 */
export async function fetchLyrics(song: string, duration: number, fresh = false): Promise<StoredLyrics | null> {
  const [site, lrc] = await Promise.allSettled([lyricsOf(song), lrcOf(song, duration, fresh)])
  if (lrc.status === 'rejected') return null
  if (site.status === 'rejected' && !lrc.value.synced && !lrc.value.plain?.length) return null
  const page = site.status === 'fulfilled' ? site.value : null
  const lines = page?.lines.length ? page.lines : (lrc.value.plain ?? [])
  return {
    title: page?.title ?? song,
    lines,
    ...(page ? { url: page.url } : {}),
    ...(lrc.value.synced ? { synced: lrc.value.synced } : {}),
  }
}

/* upisi jedan za drugim — dvije pjesme odjednom ne pregaze jedna drugu */
let queue: Promise<unknown> = Promise.resolve()

/** Izmijeni data/lyrics.json (atomski, ključevi po abecedi, pjesma u jednom redu). */
export function updateLyrics(fn: (d: Record<string, StoredLyrics>) => void): Promise<void> {
  const job = queue.then(async () => {
    const d = await readLyrics()
    fn(d)
    const body = Object.keys(d)
      .sort()
      .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(d[k])}`)
      .join(',\n')
    const tmp = `${FILE}.${process.pid}.tmp`
    await writeFile(tmp, body ? `{\n${body}\n}\n` : '{}\n')
    await rename(tmp, FILE)
  })
  queue = job.catch(() => {})
  return job
}

/** Pomak teksta pjesme (0 = bez pomaka). */
export function setLyricsOffset(file: string, offset: number): Promise<void> {
  return updateLyrics((d) => {
    if (!d[file]) return
    if (offset) d[file].offset = offset
    else delete d[file].offset
  })
}

/* tekstovi koji se upravo preuzimaju (admin pokazuje "preuzimam tekst…") */
const g = globalThis as typeof globalThis & { __stihLyrics?: Set<string> }
const pending = (g.__stihLyrics ??= new Set())
export const lyricsLoading = (file: string) => pending.has(file)

/** Stanje teksta pjesme za admina. */
export type LyricsState = 'synced' | 'plain' | 'missing' | 'loading'
export function lyricsState(file: string, stored: Record<string, StoredLyrics>): LyricsState {
  if (pending.has(file)) return 'loading'
  const l = stored[file]
  return !l ? 'missing' : l.synced ? 'synced' : 'plain'
}

/** Preuzmi i spremi tekst pjesme `file` (ime fajla). false = izvor nije odgovorio. `fresh`: LRCLIB iznova. */
export async function storeLyrics(file: string, song: string, duration: number, fresh = false): Promise<boolean> {
  pending.add(file)
  try {
    const l = await fetchLyrics(song, duration, fresh)
    if (!l) return false
    await updateLyrics((d) => {
      // tekst koji prati pjesmu ne zamijeni slabiji (LRCLIB zna vratiti manje kad je pretrpan)
      if (d[file]?.synced && !l.synced) return
      // podešen pomak ostaje i kad se tekst preuzme iznova
      d[file] = d[file]?.offset ? { ...l, offset: d[file].offset } : l
    })
    return true
  } finally {
    pending.delete(file)
  }
}
