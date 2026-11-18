/**
 * Trajanje pjesme za vremena redova teksta — SAMO SERVER (i skripte).
 *
 * LRC (lib/lrclib.ts) vrijedi samo za snimak svog trajanja. Pjesme idu preko
 * YouTubea (lib/flags.ts), pa je mjera baš taj video: trajanje se pročita sa
 * stranice videa (bez ključa). Uz vlastite pjesme (OWN_AUDIO) mjera je naš
 * fajl, kao i do sad. 0 = ne zna se — tad tekst ostaje bez vremena.
 */

import { OWN_AUDIO } from './flags'
import { youtubeId } from './text'
import { watch, ytdlp } from './ytdlp'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

const g = globalThis as typeof globalThis & { __ytDuration?: Map<string, number> }
const memo = (g.__ytDuration ??= new Map())

/**
 * Trajanje YouTube videa u sekundama; 0 kad se ne zna (nema linka, YouTube ne
 * odgovori). Prvo sa stranice videa; serverima GitHuba YouTube stranicu ne da
 * ("nisi robot"), pa tamo (i na računaru) trajanje kaže yt-dlp, s kolačićima.
 */
export async function youtubeDuration(link: string | null | undefined): Promise<number> {
  const id = youtubeId(link ?? undefined)
  if (!id) return 0
  const hit = memo.get(id)
  if (hit) return hit
  const secs = (await fromPage(id)) || (process.env.VERCEL ? 0 : await fromYtdlp(id))
  if (secs > 0) memo.set(id, secs)
  return secs
}

async function fromPage(id: string): Promise<number> {
  try {
    const r = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    })
    if (!r.ok) return 0
    const html = await r.text()
    // tačno na milisekundu (format zvuka); inače zaokruženo na sekundu
    const ms = html.match(/"approxDurationMs":"(\d+)"/)?.[1]
    return ms ? Number(ms) / 1000 : Number(html.match(/"lengthSeconds":"(\d+)"/)?.[1] ?? 0)
  } catch {
    return 0
  }
}

async function fromYtdlp(id: string): Promise<number> {
  try {
    const out = await ytdlp(['--skip-download', '--no-playlist', '--no-warnings', '--print', 'duration', watch(id)])
    const secs = Number(out.trim().split('\n').pop())
    return Number.isFinite(secs) && secs > 0 ? secs : 0
  } catch {
    return 0
  }
}

/**
 * Trajanje za tekst pjesme: `file` je ime fajla (data/audio.json → `secs`),
 * `youtube` link pjesme. Bez vlastitih pjesama prvo YouTube video, pa fajl
 * ako ga ima; s vlastitim samo fajl.
 */
export async function lyricsDuration(file: string, youtube: string | null | undefined, secs: Record<string, number>): Promise<number> {
  if (OWN_AUDIO) return secs[file] ?? 0
  return (await youtubeDuration(youtube)) || secs[file] || 0
}
