/**
 * Titlovi pjesme na njenom YouTube videu — SAMO SERVER, gdje ima yt-dlp-a
 * (računar i GitHub; na Vercelu ga nema, pa tamo ovog izvora nema).
 *
 * Neke pjesme na zvaničnom kanalu imaju ručno dodane titlove na našem jeziku:
 * red po red, s vremenom — baš za video koji aplikacija pušta. Automatski
 * titlovi se ne uzimaju, a titl se prihvati samo ako ima redove pjesme (tekst
 * sa sajta, ili bar stih) — prevod ili nešto drugo pod našim jezikom otpadne.
 */

import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { MATCH, overlap, type SyncedLine } from './lrclib'
import { youtubeId } from './text'
import { watch, ytdlp } from './ytdlp'

/** bosanski, hrvatski, srpski, srpskohrvatski — i varijante ("bs-BA") */
const LANGS = 'bs.*,hr.*,sr.*,sh.*'

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** WEBVTT → redovi s vremenom početka; oznake (<i>, <c>…) i prazni redovi otpadnu. */
export function parseVtt(vtt: string): SyncedLine[] {
  const out: SyncedLine[] = []
  for (const block of vtt.replace(/\r/g, '').split(/\n{2,}/)) {
    const rows = block.split('\n')
    const at = rows.findIndex((r) => r.includes('-->'))
    const m = at < 0 ? null : rows[at].match(/(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/)
    if (!m) continue
    const t = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0')) / 1000
    const l = rows
      .slice(at + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&([a-z]+);/gi, (x, n: string) => ENTITIES[n.toLowerCase()] ?? x)
      .replace(/\s+/g, ' ')
      .trim()
    if (l) out.push({ t: Math.round(t * 100) / 100, l })
  }
  return out.sort((a, b) => a.t - b.t)
}

/**
 * Redovi s vremenom s titla na videu pjesme — null kad titla na našem jeziku
 * nema, kad to nije pjesma (`lines`: njen tekst ili stih) ili kad yt-dlp-a nema.
 * `duration`: trajanje videa (0 = ne zna se) — titl ne smije ići preko kraja.
 */
export async function captionsOf(link: string | undefined, lines: string[], duration = 0): Promise<SyncedLine[] | null> {
  const id = youtubeId(link)
  if (!id || process.env.VERCEL || !lines.length) return null
  const tmp = await mkdtemp(path.join(tmpdir(), 'stih-titl-'))
  try {
    await ytdlp(['--skip-download', '--write-subs', '--no-write-auto-subs', '--sub-langs', LANGS, '--sub-format', 'vtt', '--no-playlist', '-q', '-o', path.join(tmp, 'titl.%(ext)s'), watch(id)])
    let best: SyncedLine[] | null = null
    let score = 0
    for (const f of (await readdir(tmp)).filter((f) => f.endsWith('.vtt'))) {
      const cues = parseVtt(await readFile(path.join(tmp, f), 'utf8'))
      const s = overlap(
        cues.map((c) => c.l),
        lines,
      )
      const fits = cues.length >= 4 && (!duration || cues[cues.length - 1].t < duration + 1)
      if (fits && s >= MATCH && s > score) {
        best = cues
        score = s
      }
    }
    return best
  } catch {
    return null
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}
