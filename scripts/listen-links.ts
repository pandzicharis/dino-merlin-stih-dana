/**
 * Gdje se pjesma sluša — linkovi sa dinomerlin.com (Muzika → izdanje →
 * "Poslušaj na"): Apple Music, Spotify, Deezer, Amazon Music i YouTube
 * playlista izdanja. Sajt ih ima po izdanju (album, singl, kompilacija), pa
 * se svaka pjesma veže za izdanja na kojima je.
 *
 *   npx -y tsx@4.23.13 scripts/listen-links.ts   → data/listen.json
 *
 * Pokrene se ručno kad izađe novo izdanje. Pjesma koje nema u fajlu ide na
 * pretragu platforme (components/tube/Listen.tsx).
 */

import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { songKey } from '../lib/dino-site'

const SITE = 'https://dinomerlin.com'
const PLATFORMS = ['apple', 'spotify', 'deezer', 'amazon', 'youtube'] as const
type Platform = (typeof PLATFORMS)[number]
type Release = { t: string; y: number; k: string } & Partial<Record<Platform, string>>

async function page(url: string): Promise<string> {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Stih dana)' } })
      if (r.ok) return await r.text()
    } catch {
      /* pokuša opet */
    }
    await new Promise((r) => setTimeout(r, 800 * (i + 1)))
  }
  throw new Error(`${url} ne odgovara`)
}

const unescape = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()

/** izdanja na stranici liste: `slug/id` */
const releasesOn = (html: string) => [...new Set([...html.matchAll(/dinomerlin\.com\/album\/([a-z0-9-]+\/\d+)/g)].map((m) => m[1]))]

async function main() {
  // vrsta izdanja (po njoj se bira kad je pjesma na više izdanja)
  const kind = new Map<string, string>()
  for (const k of ['single', 'album', 'kompilacije', 'dvd', 'bluray']) for (const r of releasesOn(await page(`${SITE}/muzika/${k}`))) kind.set(r, k)
  const all = releasesOn(await page(`${SITE}/muzika`))

  const releases: Record<string, Release> = {}
  const songs = new Map<string, string[]>()
  for (const r of all) {
    const html = await page(`${SITE}/album/${r}`)
    const id = r.split('/')[1]
    const head = html.slice(html.indexOf('class="album-title"'))
    const t = unescape(head.match(/<h3>([^<]*)<\/h3>/)?.[1] ?? r)
    const y = Number(head.match(/<span>(\d{4})<\/span>/)?.[1] ?? 0)
    // "Poslušaj na" izdanja (ne linkovi izvođača u zaglavlju — `listen-nav`)
    const at = html.indexOf('class="listen listen-flex"')
    const listen = at < 0 ? '' : html.slice(at, at + 3000)
    const links: Partial<Record<Platform, string>> = {}
    for (const m of listen.matchAll(/<a href="([^"]+)"[^>]*>\s*<i class="icon icon-(\w+)/g)) {
      const p = m[2] as Platform
      if (PLATFORMS.includes(p) && !links[p]) links[p] = unescape(m[1])
    }
    if (!Object.keys(links).length) continue
    releases[id] = { t, y, k: kind.get(r) ?? 'album', ...links }
    for (const m of html.matchAll(/class="song-title"[^>]*title="([^"]+)"/g)) {
      const title = unescape(m[1])
      // i bez zagrada — "Bosnom (svuda) behar probeharao" je u katalogu "Bosnom behar probeharao"
      for (const key of new Set([songKey(title), songKey(title.replace(/\s*\([^)]*\)/g, ' '))])) {
        if (!key) continue
        const list = songs.get(key) ?? []
        if (!list.includes(id)) songs.set(key, [...list, id])
      }
    }
    console.log(`✓ ${t} (${y}) — ${Object.keys(links).join(', ')}`)
  }

  // izdanja pjesme po redu: singl istog naziva, pa album (najstariji — prvo izdanje), pa ostalo
  const rank = (key: string, id: string) => {
    const r = releases[id]
    const single = r.k === 'single' && songKey(r.t) === key
    return (single ? 0 : r.k === 'album' ? 1e4 : r.k === 'single' ? 2e4 : 3e4) + r.y
  }
  const out = {
    releases,
    songs: Object.fromEntries([...songs].sort(([a], [b]) => a.localeCompare(b)).map(([k, ids]) => [k, ids.sort((a, b) => rank(k, a) - rank(k, b))])),
  }
  await writeFile(path.join(process.cwd(), 'data', 'listen.json'), `${JSON.stringify(out)}\n`)
  console.log(`\n${Object.keys(releases).length} izdanja, ${songs.size} pjesama → data/listen.json`)
}

main().catch((e: Error) => {
  console.error(`✖ ${e.message}`)
  process.exit(1)
})
