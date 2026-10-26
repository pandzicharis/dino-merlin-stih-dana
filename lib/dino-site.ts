/**
 * Pjesme i tekstovi s dinomerlin.com — SAMO SERVER.
 *
 *   dinomerlin.com/tekstovi-pjesama        lista: naziv, album, stranica pjesme
 *   dinomerlin.com/tekst-pjesma/<s>/<id>   tekst i YouTube link pjesme
 *
 * Sajt se pita najviše jednom dnevno po stranici (keš podataka u Next-u), a
 * izvučeno se drži i u memoriji. Sajt zna odbiti vezu — pokuša se još jednom.
 *
 * Naziv sa sajta nije uvijek naziv iz kataloga ("Bosnom (svuda) behar
 * probeharao", "Neka bude Đula" naspram "Ðula"), a po nazivu ide i fajl
 * pjesme (lib/audio-name.ts). Zato se poredi labavo (`songKey`), a stih
 * zadrži naziv koji već ima.
 */

import { albumOf } from '../data/albums'
import { audioSlug, youtubeId } from './text'

export const SITE = 'https://dinomerlin.com'
const DAY = 86400

export type SiteSong = {
  /** naziv kako piše na sajtu */
  title: string
  /** album sa sajta (može ga i ne biti) */
  album: string
  /** `ako-izgovorim-ljubav/150` — stranica teksta */
  page: string
}

/**
 * Pjesma za izbor u formi stiha (admin): `song` je naziv koji stih dobije,
 * `album` album s liste aplikacije (data/albums.ts) ili prazno, a `siteAlbum`
 * album kako piše na sajtu.
 */
export type SitePick = { song: string; title: string; album: string; siteAlbum: string; year?: number; page: string }

export type SiteLyrics = { lines: string[]; youtube?: string; url: string }

/* ── poređenje naziva ───────────────────────────────────────── */

/** bez zagrada: "Bosnom (svuda) behar probeharao" → "Bosnom behar probeharao" */
const bare = (s: string) => s.replace(/\s*\([^)]*\)/g, ' ')

/** naziv bez kvačica, razmaka i interpunkcije; Ð (islandsko) kao Đ */
export const songKey = (s: string) => audioSlug(s.replace(/[ðÐ]/g, 'đ')).replace(/-/g, '')

/** Stranica pjesme na sajtu: prvo isti naziv, pa naziv bez zagrada. */
export function findSiteSong<T extends { title: string }>(song: string, list: T[]): T | undefined {
  const k = songKey(song)
  if (!k) return undefined
  return list.find((s) => songKey(s.title) === k) ?? list.find((s) => songKey(bare(s.title)) === k || songKey(s.title) === songKey(bare(song)))
}

/** Pjesme koje sajt vodi kao singl (album = naziv pjesme), a na albumu su (data/albums.ts). */
const ON_ALBUM: Record<string, string> = { [songKey('Zbog tebe')]: 'Mi' }

/**
 * Lista za izbor pjesme u adminu. Fajl pjesme ide po nazivu
 * (lib/audio-name.ts), pa pjesma koja je već u katalogu dobije naziv iz
 * kataloga, ne onaj sa sajta — isti fajl, isti zvuk. Nova dobije naziv sa
 * sajta, osim ako već postoji fajl pod nazivom bez zagrada (a na sajtu nema
 * pjesme tog naziva, kao "Prvi" uz "Prvi (acoustic)") ili sa starim Ð.
 *
 * `names`: nazivi pjesama iz kataloga; `has`: ima li pjesma tog naziva fajl.
 */
export function sitePicks(list: SiteSong[], names: string[], has: (song: string) => boolean): SitePick[] {
  const titles = new Set(list.map((s) => songKey(s.title)))
  // Đ upisano kao islandsko Ð — tako je u starim zapisima, a fajl je bez tog slova ("neka-bude-ula")
  const eth = (x: string) => x.replace(/Đ/g, 'Ð').replace(/đ/g, 'ð')
  // naziv pod kojim pjesma sa sajta već ima fajl: kako piše, bez zagrada, sa starim Ð
  const near = (s: SiteSong) => {
    const plain = bare(s.title).replace(/\s+/g, ' ').trim()
    return [s.title, plain, eth(s.title), eth(plain)].find((v) => has(v) && (songKey(v) === songKey(s.title) || !titles.has(songKey(v))))
  }
  // naziv iz kataloga — prvo oni čiji fajl postoji; naziv bez fajla ne preuzima pjesmu kojoj fajl postoji pod drugim
  const own = new Map<string, string>()
  for (const n of [...new Set(names)].sort((a, b) => Number(has(b)) - Number(has(a)))) {
    const hit = findSiteSong(n, list)
    if (hit && !own.has(hit.page) && (has(n) || !near(hit))) own.set(hit.page, n)
  }
  return list.map((s) => {
    const album = albumOf(s.album) ?? albumOf(bare(s.album)) ?? albumOf(ON_ALBUM[songKey(s.title)])
    return {
      song: own.get(s.page) ?? near(s) ?? s.title,
      title: s.title,
      album: album?.title ?? '',
      siteAlbum: s.album,
      ...(album ? { year: album.year } : {}),
      page: s.page,
    }
  })
}

/* ── HTML ───────────────────────────────────────────────────── */

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', hellip: '…', ndash: '–', mdash: '—' }

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
}

const text = (html: string) => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

export function parseList(html: string): SiteSong[] {
  const out: SiteSong[] = []
  const item = /<div class="table-item-title">[\s\S]*?<a href="[^"]*\/tekst-pjesma\/([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<div class="table-item-album">([\s\S]*?)<\/div>/g
  for (const m of html.matchAll(item)) {
    const title = text(m[2])
    if (title) out.push({ title, album: text(m[3]), page: m[1] })
  }
  return out
}

/**
 * Tekst sa stranice pjesme: red po `<p>` ili po `<br>` (sajt ima oba
 * zapisa). Prazan red je razmak između strofa — najviše jedan zaredom.
 */
export function parseLyrics(html: string): Omit<SiteLyrics, 'url'> {
  const at = html.indexOf('class="text-content"')
  if (at < 0) return { lines: [] }
  const from = html.indexOf('>', at) + 1
  const to = html.indexOf('<div class="share">', from)
  let body = html.slice(from, to < 0 ? undefined : to)
  const youtube = youtubeId(body.match(/href="([^"]*youtu[^"]*)"/)?.[1]) ?? undefined
  // "Poslušaj na" (linkovi) prije teksta
  body = body.replace(/<div class="share[^"]*">[\s\S]*?<\/div>\s*<\/div>/, '')
  const lines: string[] = []
  // prelomi u HTML-u ne znače ništa — redove prave samo <br> i <p>
  for (const raw of body
    .replace(/\s+/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')) {
    const l = decode(raw).replace(/\s+/g, ' ').trim()
    if (l || (lines.length && lines[lines.length - 1])) lines.push(l)
  }
  while (lines.length && !lines[lines.length - 1]) lines.pop()
  return { lines, ...(youtube ? { youtube } : {}) }
}

/* ── sajt ───────────────────────────────────────────────────── */

async function page(url: string): Promise<string> {
  let last: unknown
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { next: { revalidate: DAY }, headers: { 'User-Agent': 'Mozilla/5.0 (Stih dana)' } })
      if (!r.ok) throw new Error(`${url} → ${r.status}`)
      return await r.text()
    } catch (e) {
      last = e
    }
  }
  throw last
}

/* izvučeno, u memoriji — sat vremena; greška se ne pamti */
const g = globalThis as typeof globalThis & { __dinoSite?: Map<string, { at: number; v: Promise<unknown> }> }
const memo = (g.__dinoSite ??= new Map())

function remember<T>(key: string, run: () => Promise<T>): Promise<T> {
  const hit = memo.get(key)
  if (hit && Date.now() - hit.at < 3600_000) return hit.v as Promise<T>
  const v = run()
  memo.set(key, { at: Date.now(), v })
  v.catch(() => memo.delete(key))
  return v
}

/** Sve pjesme s liste tekstova. */
export function siteSongs(): Promise<SiteSong[]> {
  return remember('list', async () => {
    const list = parseList(await page(`${SITE}/tekstovi-pjesama`))
    if (!list.length) throw new Error('Lista pjesama na dinomerlin.com je prazna')
    return list
  })
}

/** Tekst (i YouTube link) pjesme sa stranice s liste. */
export function siteLyrics(p: string): Promise<SiteLyrics> {
  if (!/^[a-z0-9-]+\/\d+$/.test(p)) return Promise.reject(new Error('Neispravna stranica pjesme'))
  const url = `${SITE}/tekst-pjesma/${p}`
  return remember(`page:${p}`, async () => ({ ...parseLyrics(await page(url)), url }))
}

/** Tekst pjesme po nazivu iz kataloga — null ako je nema na sajtu. */
export async function lyricsOf(song: string): Promise<(SiteLyrics & { title: string }) | null> {
  const hit = findSiteSong(song, await siteSongs())
  if (!hit) return null
  return { ...(await siteLyrics(hit.page)), title: hit.title }
}
