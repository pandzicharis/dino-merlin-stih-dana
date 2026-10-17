import { createReadStream } from 'node:fs'
import { mkdir, readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { AUDIO_DIR, YT_FORMAT as FORMAT, watch, ytdlp } from '@/lib/audio-files'

/**
 * Zvuk pjesme s YouTubea, bez videa — redom, od najbržeg:
 *
 * 1. `public/audio/<s>.m4a|mp3` → preusmjerenje na statični fajl (CDN, server ne radi ništa)
 * 2. fajl u tmp-u → odavde, s Range podrškom (Safari bez 206 ne pušta audio)
 * 3. prvi put: yt-dlp nađe direktan audio link (~2 s) i zvuk se odmah
 *    prosljeđuje, a u pozadini se cijeli fajl spremi u tmp za sljedeći put.
 *    U projekat (public/audio) pjesmu upisuje samo admin pri čuvanju stiha,
 *    `npm run audio` ili GitHub (lib/audio-files.ts) — uvijek s tačnim parom
 *    naziv–link. Pregled u adminu ovdje šalje i pola otkucan link.
 *
 * `?warm=1` (ekran sa stihom ga pošalje čim se pojavi) samo pokrene pripremu —
 * dok korisnik dođe do dugmeta, pjesma je obično već tu.
 */
const DIR = path.join(tmpdir(), 'stih-audio')
const TYPES: Record<string, string> = { '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.webm': 'audio/webm', '.opus': 'audio/ogg' }

const downloads = new Map<string, Promise<string>>()
const links = new Map<string, Promise<{ url: string; exp: number }>>()
const expires = new Map<string, number>()

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!/^[\w-]{11}$/.test(id)) return new Response('Bad id', { status: 400 })
  const q = new URL(req.url).searchParams
  const slug = /^[a-z0-9-]+$/.test(q.get('s') ?? '') ? q.get('s')! : ''

  try {
    const pub = slug && (await staticFile(slug))
    if (pub) return Response.redirect(new URL(`/audio/${pub}`, req.url), 307)

    const file = await cached(id)
    if (q.has('warm')) {
      if (!file) {
        download(id).catch(() => {})
        link(id).catch(() => {})
      }
      return new Response(null, { status: 204 })
    }
    if (file) return serve(req, file)

    download(id).catch((e) => console.error('[audio]', id, e))
    return proxy(req, await link(id))
  } catch (e) {
    console.error('[audio]', id, e)
    return new Response('Audio nije dostupan', { status: 502 })
  }
}

async function staticFile(slug: string): Promise<string | null> {
  for (const ext of ['.m4a', '.mp3']) {
    if (await stat(path.join(AUDIO_DIR, slug + ext)).then(() => true, () => false)) return slug + ext
  }
  return null
}

async function cached(id: string): Promise<string | null> {
  const hit = (await readdir(DIR).catch(() => [] as string[])).find((f) => f.startsWith(`${id}.`) && f.slice(id.length) in TYPES)
  return hit ? path.join(DIR, hit) : null
}

function once<T>(map: Map<string, Promise<T>>, key: string, make: () => Promise<T>): Promise<T> {
  let p = map.get(key)
  if (!p) {
    p = make()
    map.set(key, p)
    p.catch(() => map.delete(key))
  }
  return p
}

/** Direktan link na audio (googlevideo) — važi ~6 sati, čuva se u memoriji. */
function link(id: string): Promise<{ url: string; exp: number }> {
  if ((expires.get(id) ?? Infinity) < Date.now()) links.delete(id)
  return once(links, id, async () => {
    const url = (await ytdlp(['-g', '-f', FORMAT, '--no-playlist', watch(id)])).trim().split('\n')[0]
    const exp = Number(new URL(url).searchParams.get('expire') ?? 0) * 1000 - 10 * 60_000
    expires.set(id, exp || Date.now() + 60 * 60_000)
    return { url, exp: expires.get(id)! }
  })
}

function download(id: string): Promise<string> {
  return once(downloads, id, async () => {
    await mkdir(DIR, { recursive: true })
    await ytdlp(['-f', FORMAT, '--no-playlist', '-q', '-N', '4', '-o', path.join(DIR, `${id}.%(ext)s`), watch(id)])
    const file = await cached(id)
    if (!file) throw new Error('yt-dlp nije napravio fajl')
    return file
  })
}

/** Prvo slušanje: bajtovi idu ravno s YouTubea, Range se prosljeđuje. */
async function proxy(req: Request, { url }: { url: string }): Promise<Response> {
  const up = await fetch(url, { headers: { Range: req.headers.get('range') ?? 'bytes=0-' }, signal: req.signal })
  if (!up.ok || !up.body) throw new Error(`googlevideo ${up.status}`)
  const headers = new Headers({ 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' })
  for (const h of ['content-type', 'content-length', 'content-range']) {
    const v = up.headers.get(h)
    if (v) headers.set(h, v)
  }
  return new Response(up.body, { status: up.status, headers })
}

async function serve(req: Request, file: string): Promise<Response> {
  const { size } = await stat(file)
  const headers: Record<string, string> = {
    'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
  }
  const m = req.headers.get('range')?.match(/bytes=(\d*)-(\d*)/)
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(size - Number(m[2]), 0)
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream
    return new Response(body, {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
    })
  }
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream
  return new Response(body, { headers: { ...headers, 'Content-Length': String(size) } })
}
