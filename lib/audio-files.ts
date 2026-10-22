/**
 * Pjesme u aplikaciji — SAMO SERVER (i skripte).
 *
 * Pjesma je spremna za brzo puštanje kad su oba tu:
 *   public/audio/<pjesma>.m4a   HE-AAC 64 kbps — sa CDN-a, pola prenosa AAC-a 128
 *   data/audio.json             trajanje — plejer po njemu zna da pjesma postoji
 *
 * Bez trajanja plejer na produkciji pjesmu ne pušta (nego YouTube znak), pa
 * se fajl i trajanje uvijek pišu zajedno, ovdje. Preuzimanje (yt-dlp) i
 * kodiranje rade na računaru: admin u `npm run dev` ih pokrene čim se stih
 * sačuva, a `npm run audio` sredi sve pjesme odjednom. Na Vercelu ne može —
 * nema yt-dlp-a, a public/ je zaključan poslije builda.
 */

import { spawn } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { audioSlug, youtubeId } from './text'
import BUNDLED from '../data/audio.json'
import BUNDLED_ALIAS from '../data/audio-alias.json'
import { audioFile } from './audio-name'

const ROOT = process.cwd()
export const AUDIO_DIR = path.join(ROOT, 'public', 'audio')
const DURATIONS = path.join(ROOT, 'data', 'audio.json')
const ALIAS = path.join(ROOT, 'data', 'audio-alias.json')
export const YT_FORMAT = 'bestaudio[ext=m4a]/bestaudio'

/** Preuzimanje i kodiranje: lokalno (dev), `npm run audio` i GitHub (.github/workflows/audio.yml). */
// i produkcijski build na računaru (localhost) — tu ima yt-dlp-a; na Vercelu nikad
export const CAN_FETCH = process.env.NODE_ENV === 'development' || process.env.STIH_AUDIO_FETCH === '1' || !process.env.VERCEL

export type SongState = 'ready' | 'loading' | 'missing' | 'error'

/* jedan posao po pjesmi, i kad ga traže dvije rute (u devu su to zasebni moduli) */
const g = globalThis as typeof globalThis & {
  __stihAudio?: { jobs: Map<string, Promise<void>>; errors: Map<string, string> }
}
const state = (g.__stihAudio ??= { jobs: new Map(), errors: new Map() })

const exists = (f: string) => stat(f).then(() => true, () => false)

/**
 * Trajanja. Na produkciji ona iz builda — po njima i plejer odlučuje šta se
 * pušta (public/ ionako nije uz serversku funkciju). Lokalno sa diska, svježe.
 */
export async function readDurations(): Promise<Record<string, number>> {
  if (!CAN_FETCH) return BUNDLED as Record<string, number>
  try {
    return JSON.parse(await readFile(DURATIONS, 'utf8')) as Record<string, number>
  } catch {
    return {}
  }
}

/** Nadimci fajlova (data/audio-alias.json) — kao trajanja: na produkciji iz builda, lokalno svježe. */
export async function readAlias(): Promise<Record<string, string>> {
  if (!CAN_FETCH) return BUNDLED_ALIAS as Record<string, string>
  try {
    return JSON.parse(await readFile(ALIAS, 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
}

/** Stanje pjesme — iz fajlova, ne iz memorije (fajl je mogao doći i gitom). */
export async function songState(song: string, durations?: Record<string, number>): Promise<{ state: SongState; error?: string }> {
  const slug = audioFile(song, await readAlias())
  if (state.jobs.has(slug)) return { state: 'loading' }
  const d = durations ?? (await readDurations())
  if (slug in d && (!CAN_FETCH || (await exists(path.join(AUDIO_DIR, `${slug}.m4a`))))) return { state: 'ready' }
  const error = state.errors.get(slug)
  return error ? { state: 'error', error } : { state: 'missing' }
}

/**
 * Pripremi pjesmu: preuzmi (ako fajla nema), kodiraj u HE-AAC, upiši trajanje.
 * Pjesma bez YouTube linka se traži kao "Dino Merlin <naziv>".
 */
export function prepareSong(song: string, youtube?: string): Promise<void> {
  if (!audioSlug(song)) return Promise.reject(new Error('Pjesma nema naziv.'))
  return readAlias().then((alias) => prepareFile(audioFile(song, alias), song, youtube))
}

function prepareFile(slug: string, song: string, youtube?: string): Promise<void> {
  let job = state.jobs.get(slug)
  if (!job) {
    state.errors.delete(slug)
    job = (async () => {
      const target = path.join(AUDIO_DIR, `${slug}.m4a`)
      const tmp = await mkdtemp(path.join(tmpdir(), 'stih-song-'))
      try {
        let src = (await exists(target)) ? target : null
        if (!src) {
          const id = youtubeId(youtube)
          await ytdlp(['-f', YT_FORMAT, '--no-playlist', '-q', '-N', '4', '-o', path.join(tmp, 'in.%(ext)s'), id ? watch(id) : `ytsearch1:Dino Merlin ${song}`])
          const got = (await readdir(tmp)).find((f) => f.startsWith('in.'))
          if (!got) throw new Error('yt-dlp nije napravio fajl')
          src = path.join(tmp, got)
        }
        await finalizeSong(slug, src, tmp)
      } finally {
        await rm(tmp, { recursive: true, force: true })
      }
    })()
    state.jobs.set(slug, job)
    job.then(
      () => state.jobs.delete(slug),
      (e: Error) => {
        state.jobs.delete(slug)
        state.errors.set(slug, e.message.split('\n').pop()?.slice(0, 200) || 'Preuzimanje nije uspjelo')
        console.error('[audio]', slug, e.message)
      },
    )
  }
  return job
}

/** Fajl pjesme → public/audio/<slug>.m4a (HE-AAC) + trajanje u data/audio.json. */
export async function finalizeSong(slug: string, src: string, work?: string) {
  const tmp = work ?? (await mkdtemp(path.join(tmpdir(), 'stih-song-')))
  try {
    await mkdir(AUDIO_DIR, { recursive: true })
    const out = path.join(tmp, 'out.m4a')
    if ((await profile(src)) === 'HE-AAC') await copyFile(src, out)
    else await encode(src, out, tmp)
    await rename(out, path.join(AUDIO_DIR, `${slug}.m4a`)).catch(async () => {
      // drugi disk (tmp) — rename ne radi preko granice
      await copyFile(out, path.join(AUDIO_DIR, `${slug}.m4a`))
    })
    const secs = await duration(path.join(AUDIO_DIR, `${slug}.m4a`))
    await writeDuration(slug, secs)
  } finally {
    if (!work) await rm(tmp, { recursive: true, force: true })
  }
}

/** HE-AAC 64 kbps: afconvert (macOS) je jedini besplatni HE-AAC enkoder; drugdje AAC 96. */
async function encode(src: string, out: string, tmp: string) {
  if (process.platform === 'darwin') {
    // afconvert ne čita webm/opus — takav ide prvo u wav
    let input = src
    if (!/\.(m4a|mp4|aac|mp3|wav|aif+)$/i.test(src)) {
      input = path.join(tmp, 'mid.wav')
      await run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vn', input])
    }
    await run('afconvert', ['-f', 'm4af', '-d', 'aach', '-b', '64000', input, out])
    return
  }
  await run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vn', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out])
}

/* ffprobe, a na macOS-u bez ffmpeg-a (GitHub) afinfo */

async function profile(f: string): Promise<string> {
  try {
    return (await run('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=profile', '-of', 'default=nw=1:nk=1', f])).trim()
  } catch {
    // afinfo HE-AAC prijavi kao jezgru: aac na pola frekvencije (22/24 kHz)
    const fmt = (await run('afinfo', [f]).catch(() => '')).match(/Data format:\s+\d+ ch,\s+(\d+) Hz, (\w+)/)
    return fmt && (fmt[2] === 'aach' || (fmt[2] === 'aac' && Number(fmt[1]) <= 24000)) ? 'HE-AAC' : ''
  }
}

async function duration(f: string): Promise<number> {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f]).catch(async () =>
    ((await run('afinfo', [f]).catch(() => '')).match(/estimated duration: ([\d.]+)/) ?? [])[1] ?? '',
  )
  const s = Number(String(out).trim())
  if (!(s > 0)) throw new Error('Trajanje pjesme nije očitano')
  return s
}

async function writeDuration(slug: string, secs: number) {
  await writeDurations({ ...(await readDurations()), [slug]: secs })
}

/** Isti zapis kao encode-audio.sh: ključevi po abecedi, jedna decimala. */
async function writeDurations(d: Record<string, number>) {
  const body = Object.keys(d)
    .sort()
    .map((k) => `  "${k}": ${d[k].toFixed(1)}`)
    .join(',\n')
  await writeAtomic(DURATIONS, `{\n${body}\n}\n`)
}

/** atomski: dev server (i plejer) nikad ne vidi pola upisanog fajla */
async function writeAtomic(file: string, body: string) {
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, body)
  await rename(tmp, file)
}

/**
 * Pjesma dobija novi naziv i/ili ime fajla: fajl i trajanje se preimenuju,
 * a nadimak (naziv → fajl) se upiše samo kad se ime fajla ne poklapa s
 * nazivom. Lokalno odmah; na produkciji isto radi GitHub (audio-rename).
 */
export async function renameSong(from: string, to: string, file: string): Promise<{ changed: boolean }> {
  const alias = await readAlias()
  const oldFile = audioFile(from, alias)
  let changed = false
  if (oldFile !== file) {
    const src = path.join(AUDIO_DIR, `${oldFile}.m4a`)
    const dst = path.join(AUDIO_DIR, `${file}.m4a`)
    if (await exists(dst)) throw new Error(`Fajl ${file}.m4a već postoji — izaberi drugo ime.`)
    if (await exists(src)) {
      await rename(src, dst)
      changed = true
    }
    const d = await readDurations()
    if (oldFile in d) {
      d[file] = d[oldFile]
      delete d[oldFile]
      await writeDurations(d)
      changed = true
    }
  }
  const next = { ...alias }
  delete next[audioSlug(from)]
  if (file !== audioSlug(to)) next[audioSlug(to)] = file
  else delete next[audioSlug(to)]
  const sorted = (o: Record<string, string>) => JSON.stringify(Object.fromEntries(Object.entries(o).sort()))
  if (sorted(next) !== sorted(alias)) {
    await writeAtomic(ALIAS, `${JSON.stringify(Object.fromEntries(Object.entries(next).sort()), null, 2)}\n`)
    changed = true
  }
  return { changed }
}

/* ── yt-dlp ─────────────────────────────────────────────────── */

export const watch = (id: string) => `https://www.youtube.com/watch?v=${id}`

export async function ytdlp(args: string[]): Promise<string> {
  // GitHub: YouTube servere bez prijave zna odbiti ("not a bot") — kolačići naloga (YT_COOKIES)
  const cookies = process.env.YTDLP_COOKIES
  if (!cookies) return ytdlpRun(args)
  try {
    return await ytdlpRun(['--cookies', cookies, ...args])
  } catch (e) {
    // istekli kolačići znaju biti gori od nikakvih (okrnjeni formati) — još jednom bez njih
    try {
      return await ytdlpRun(args)
    } catch {
      throw e
    }
  }
}

async function ytdlpRun(args: string[]): Promise<string> {
  try {
    return await run(process.env.YTDLP_PATH || 'yt-dlp', args)
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return run('python3', ['-m', 'yt_dlp', ...args])
    throw e
  }
}

export function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err.trim() || `${cmd} exit ${code}`))))
  })
}
