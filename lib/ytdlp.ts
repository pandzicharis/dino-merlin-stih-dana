/**
 * yt-dlp i pokretanje alata — SAMO SERVER, gdje ih ima (računar, GitHub; na
 * Vercelu ne). Koriste ga pjesme (lib/audio-files.ts) i tekst — titlovi
 * videa pjesme (lib/yt-captions.ts).
 */

import { spawn } from 'node:child_process'

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
