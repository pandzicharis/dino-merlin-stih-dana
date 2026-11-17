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
 * Šta se zna o pjesmi osim naziva iz kataloga — da se nađe i zapis pod drugim
 * nazivom: `titles` drugi nazivi (sa sajta, i ono u zagradi: "Laku noć, moja
 * mala barbiko (Ja sam na te navik'o)"), `album` album sa sajta, a `lines`
 * tekst pjesme ili bar stih. Zapis koji se ne zove kao pjesma prihvati se samo
 * ako ima njene redove (`overlap`) — pjesma se prepozna po stihu.
 */
export type LrcHint = { titles?: string[]; album?: string; lines?: string[] }

/** dio naših redova koji mora biti u tuđem zapisu da bi to bila ista pjesma */
export const MATCH = 0.6

/**
 * Koliko naših redova (0…1) ima u `theirs` — bez kvačica, razmaka i
 * interpunkcije; njihovi redovi se spoje, pa ne smeta ni drugačiji prelom.
 */
export function overlap(theirs: string[], ours: string[]): number {
  const all = theirs.map(songKey).join('')
  const want = [...new Set(ours.map(songKey).filter((k) => k.length >= 6))]
  return want.length ? want.filter((k) => all.includes(k)).length / want.length : 0
}

const linesOf = (r: Entry) => [...(r.plainLyrics?.split(/\r?\n/) ?? []), ...(r.syncedLyrics ? parseLrc(r.syncedLyrics).map((s) => s.l) : [])]

/**
 * Tekst pjesme s LRCLIB-a. `duration`: trajanje snimka koji se pušta (0 = ne
 * zna se, pa nema ni vremena). `fresh`: pitaj iznova (admin → ponovo traži
 * vremena). `hint`: drugi nazivi i redovi pjesme (vidi LrcHint).
 * Baca grešku samo kad LRCLIB ne odgovori.
 */
export function lrcOf(song: string, duration: number, fresh = false, hint: LrcHint = {}): Promise<Lrc> {
  const key = `${songKey(song)}:${Math.round(duration)}`
  const hit = memo.get(key)
  // bez vremena se pita češće — LRCLIB zna vratiti manje kad je pretrpan
  if (!fresh && hit && Date.now() - hit.at < 3 * 3600_000) return hit.v
  const v = (async (): Promise<Lrc> => {
    // staro islandsko Ð ("Neka bude Ðula") LRCLIB ne nađe
    const fix = (t: string) => t.replace(/Ð/g, 'Đ').replace(/ð/g, 'đ').trim()
    // naziv iz kataloga, pa drugi nazivi — svaki ključ jednom
    const names = [...new Map([song, ...(hint.titles ?? [])].map(fix).filter((t) => songKey(t)).map((t) => [songKey(t), t] as const)).values()]
    const keys = new Set(names.map(songKey))
    const ours = hint.lines?.filter(Boolean) ?? []
    const fits = (r: Entry) => Boolean(r.syncedLyrics) && !r.instrumental && Math.abs(r.duration - duration) <= SLACK
    // ista pjesma: po nazivu (očišćenom), ili pod drugim nazivom — kad ima naše redove
    const same = (r: Entry) => keys.has(songKey(clean(r.trackName))) || (ours.length > 0 && overlap(linesOf(r), ours) >= MATCH)
    const list: Entry[] = []
    const done = () => duration > 0 && list.some(fits)
    for (const name of names) {
      // tačno po nazivu i trajanju (LRCLIB sam dozvoli ±2 s), pa pretraga — od svih se uzme najbliže trajanje
      if (duration) list.push(...(await get(`${API}/get?${new URLSearchParams({ artist_name: ARTIST, track_name: name, duration: String(Math.round(duration)) })}`)).filter(fits))
      list.push(...(await get(`${API}/search?${new URLSearchParams({ artist_name: ARTIST, track_name: name })}`)).filter((r) => /dino merlin/i.test(r.artistName) && same(r)))
      if (done()) break
    }
    // naziv s dodacima ("Bosnom (svuda)…") — opšta pretraga; pa pjesme s albuma, prepoznate po redovima
    if (!done()) list.push(...(await get(`${API}/search?${new URLSearchParams({ q: `${ARTIST} ${names[0] ?? song}` })}`)).filter(same))
    if (!done() && hint.album && ours.length) list.push(...(await get(`${API}/search?${new URLSearchParams({ q: `${ARTIST} ${hint.album}` })}`)).filter(same))
    // samo verzija našeg trajanja — drugo izdanje (duži uvod, drugi kraj) ima druga vremena redova
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
