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
import { altTitles, lyricsOf } from './dino-site'
import { lrcOf, type SyncedLine } from './lrclib'
import { captionsOf } from './yt-captions'

/**
 * `offset`: pomak teksta u sekundama (+ = redovi svijetle ranije) — admin ga podesi kad LRC kasni ili žuri.
 * `duration`: trajanje snimka za koji vrijede vremena redova (YouTube video) — plejer ga poredi s videom.
 */
export type StoredLyrics = { title: string; lines: string[]; url?: string; synced?: SyncedLine[]; duration?: number; offset?: number }

/**
 * Šta se zna o pjesmi osim naziva: `youtube` link (titlovi njenog videa) i
 * `verse` stih iz kataloga — po njemu se pjesma nađe kad je po nazivu nema, a
 * zapis pod drugim nazivom se prepozna po redovima.
 */
export type LyricsHint = { youtube?: string; verse?: string }

const FILE = path.join(process.cwd(), 'data', 'lyrics.json')

export async function readLyrics(): Promise<Record<string, StoredLyrics>> {
  try {
    return JSON.parse(await readFile(FILE, 'utf8')) as Record<string, StoredLyrics>
  } catch {
    return {}
  }
}

/**
 * Tekst iz svih izvora, redom — kad jedan nema, ide se na sljedeći:
 *   tekst     dinomerlin.com po nazivu, pa po stihu; inače LRCLIB
 *   vremena   LRCLIB po nazivu, pa po drugim nazivima sa sajta i po redovima
 *             pjesme; pa titlovi na videu pjesme (gdje ima yt-dlp-a)
 * `duration`: trajanje snimka koji se pušta (lib/yt-duration.ts); `fresh`: LRCLIB iznova.
 * null (pokuša se opet) kad LRCLIB ne odgovori, a vremena nema ni na titlu;
 * ne odgovori li sajt, redovi su s LRCLIB-a (ako ih ima).
 */
export async function fetchLyrics(song: string, duration: number, fresh = false, hint: LyricsHint = {}): Promise<StoredLyrics | null> {
  // undefined: sajt nije odgovorio; null: pjesme na sajtu nema
  const page = await lyricsOf(song, hint.verse).catch(() => undefined)
  const verse = hint.verse?.split('\n').filter(Boolean) ?? []
  const ours = page?.lines.length ? page.lines : verse
  const lrc = await lrcOf(song, duration, fresh, { titles: page ? [page.title, ...altTitles(page.title)] : [], album: page?.album, lines: ours }).catch(() => null)
  // vremena s titla videa — kad ih LRCLIB nema; titl se provjeri po tekstu pjesme
  const check = page?.lines.length ? page.lines : lrc?.plain?.length ? lrc.plain : verse
  const synced = lrc?.synced ?? (await captionsOf(hint.youtube, check, duration))
  if (!lrc && !synced) return null
  if (page === undefined && !synced && !lrc?.plain?.length) return null
  return {
    title: page?.title ?? song,
    lines: page?.lines.length ? page.lines : (lrc?.plain ?? []),
    ...(page ? { url: page.url } : {}),
    ...(synced ? { synced, ...(duration ? { duration: Math.round(duration * 10) / 10 } : {}) } : {}),
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

/** Preuzmi i spremi tekst pjesme `file` (ime fajla). false = izvor nije odgovorio. `fresh`: LRCLIB iznova; `hint`: link i stih. */
export async function storeLyrics(file: string, song: string, duration: number, fresh = false, hint: LyricsHint = {}): Promise<boolean> {
  pending.add(file)
  try {
    const l = await fetchLyrics(song, duration, fresh, hint)
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
