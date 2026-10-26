/**
 * Tekst koji prati pjesmu — LRCLIB (lrclib.net, otvoren, bez ključa) — SAMO SERVER.
 *
 * LRC je tekst s vremenom svakog reda (`[01:23.45] red`). Vrijeme vrijedi
 * samo za snimak tog trajanja, pa se uzima samo zapis čije trajanje je
 * unutar par sekundi od našeg fajla (data/audio.json) — inače ostaje običan
 * tekst (lib/dino-site.ts). Naziv na LRCLIB-u je često naslov s YouTubea
 * ("01 Ruza", "(10)Dino Merlin - Hitna"), pa se poredi očišćen.
 *
 * Server zna odgovoriti 503 (pretrpan) — pokuša se još tri puta; nađeno se
 * pamti u memoriji, a odgovor rute drži CDN.
 */

import { songKey } from './dino-site'

const API = 'https://lrclib.net/api'
const ARTIST = 'Dino Merlin'
/** koliko trajanje LRC zapisa smije odstupati od našeg fajla (s) */
const SLACK = 3

export type SyncedLine = { t: number; l: string }

type Entry = {
  trackName: string
  artistName: string
  duration: number
  instrumental?: boolean
  syncedLyrics?: string | null
  plainLyrics?: string | null
}

export type Lrc = {
  /** redovi s vremenom — samo ako trajanje odgovara našem fajlu */
  synced: SyncedLine[] | null
  /** običan tekst (rezerva kad ga dinomerlin.com nema) */
  plain: string[] | null
}

/** "[00:12.34][01:02.00] red" → redovi po vremenu; oznake ([ar:…]) se preskaču */
export function parseLrc(lrc: string): SyncedLine[] {
  const out: SyncedLine[] = []
  for (const row of lrc.split(/\r?\n/)) {
    const stamps = [...row.matchAll(/\[(\d+):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)]
    if (!stamps.length) continue
    const l = row.replace(/\[[^\]]*\]/g, '').trim()
    for (const s of stamps) out.push({ t: Number(s[1]) * 60 + Number(s[2].replace(':', '.')), l })
  }
  return out.sort((a, b) => a.t - b.t)
}

/** "(10)Dino Merlin - Hitna (Official Audio) [2000]" → "Hitna" */
function clean(track: string): string {
  return track
    .replace(/[([][^)\]]*[)\]]/g, ' ')
    .replace(/^\s*\d+[\s.-]+/, '')
    .replace(/^\s*dino merlin\s*[-–—:]\s*/i, '')
    .trim()
}

async function get(url: string): Promise<Entry[]> {
  let last: unknown
  for (let i = 0; i < 4; i++) {
    if (i) await new Promise((r) => setTimeout(r, [0, 400, 1200, 2500][i] + Math.random() * 300))
    try {
      const r = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'Stih dana (dino-merlin-stih-dana.vercel.app)' } })
      if (r.status === 404) return []
      if (!r.ok) throw new Error(`lrclib ${r.status}`)
      const body = (await r.json()) as Entry[] | Entry
      return Array.isArray(body) ? body : [body]
    } catch (e) {
      last = e
    }
  }
  throw last
}

const g = globalThis as typeof globalThis & { __lrc?: Map<string, { at: number; v: Promise<Lrc> }> }
const memo = (g.__lrc ??= new Map())

/**
 * Tekst pjesme s LRCLIB-a. `duration`: trajanje našeg fajla (0 = ne zna se,
 * pa nema ni vremena). Baca grešku samo kad LRCLIB ne odgovori.
 */
export function lrcOf(song: string, duration: number): Promise<Lrc> {
  const key = `${songKey(song)}:${Math.round(duration)}`
  const hit = memo.get(key)
  // bez vremena se pita češće — LRCLIB zna vratiti manje kad je pretrpan
  if (hit && Date.now() - hit.at < 3 * 3600_000) return hit.v
  const v = (async (): Promise<Lrc> => {
    const k = songKey(song)
    // staro islandsko Ð ("Neka bude Ðula") LRCLIB ne nađe
    song = song.replace(/Ð/g, 'Đ').replace(/ð/g, 'đ')
    const fits = (r: Entry) => Boolean(r.syncedLyrics) && !r.instrumental && Math.abs(r.duration - duration) <= SLACK
    // tačno po nazivu i trajanju (LRCLIB sam dozvoli ±2 s)
    const exact = duration
      ? (await get(`${API}/get?${new URLSearchParams({ artist_name: ARTIST, track_name: song, duration: String(Math.round(duration)) })}`)).filter(fits)
      : []
    let list: Entry[] = exact
    if (!exact.length) {
      list = (await get(`${API}/search?${new URLSearchParams({ artist_name: ARTIST, track_name: song })}`)).filter(
        (r) => songKey(clean(r.trackName)) === k && /dino merlin/i.test(r.artistName),
      )
      // naziv s dodacima ("Bosnom (svuda)…") — opšta pretraga
      if (!list.length) list = (await get(`${API}/search?${new URLSearchParams({ q: `${ARTIST} ${song}` })}`)).filter((r) => songKey(clean(r.trackName)) === k)
    }
    const close = duration ? list.filter(fits).sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration)) : []
    const synced = close.length ? parseLrc(close[0].syncedLyrics!) : null
    const plain = list.find((r) => r.plainLyrics)?.plainLyrics
    return {
      synced: synced && synced.filter((s) => s.l).length >= 4 ? synced : null,
      plain: plain ? plain.split(/\r?\n/).map((l) => l.trim()) : null,
    }
  })()
  memo.set(key, { at: Date.now(), v })
  v.catch(() => memo.delete(key))
  return v
}
