/**
 * "Sinhronizuj" u adminu — SAMO SERVER: svaka pjesma iz baze dobije zvuk
 * (public/audio + data/audio.json) i tekst (data/lyrics.json).
 *
 * Lokalno to radi ovdje, pjesmu po pjesmu (jedan posao u isto vrijeme), a
 * admin prati napredak. Na produkciji isto radi GitHub (`npm run audio` →
 * scripts/audio-sync.ts, .github/workflows/audio.yml).
 */

import { audioFile } from './audio-name'
import { prepareSong, readAlias, readDurations, songState } from './audio-files'
import { readLyrics, storeLyrics } from './lyrics-store'
import { audioSlug, youtubeId } from './text'

export type SyncState = {
  running: boolean
  done: number
  total: number
  /** pjesma koja se upravo sređuje */
  current: string | null
  /** pjesme kojima nešto nije stiglo (zvuk ili tekst) */
  failed: string[]
  at: number
}

const g = globalThis as typeof globalThis & { __stihSync?: SyncState }
const state = (g.__stihSync ??= { running: false, done: 0, total: 0, current: null, failed: [], at: 0 })

export const syncState = (): SyncState => ({ ...state, failed: [...state.failed] })

/** Pokreni sinhronizaciju za stihove iz baze. false = već radi. */
export function startSync(verses: { song: string; youtube?: string }[]): boolean {
  if (state.running) return false
  // pjesma jednom, s prvim linkom koji ima
  const songs = new Map<string, { song: string; youtube?: string }>()
  for (const v of verses) {
    const k = audioSlug(v.song)
    const s = songs.get(k)
    if (!s) songs.set(k, { song: v.song, youtube: v.youtube })
    else if (!youtubeId(s.youtube) && youtubeId(v.youtube)) s.youtube = v.youtube
  }
  Object.assign(state, { running: true, done: 0, total: songs.size, current: null, failed: [], at: Date.now() })
  void (async () => {
    for (const s of songs.values()) {
      state.current = s.song
      try {
        if ((await songState(s.song)).state !== 'ready' && youtubeId(s.youtube)) await prepareSong(s.song, s.youtube)
        const [alias, secs, stored] = await Promise.all([readAlias(), readDurations(), readLyrics()])
        const f = audioFile(s.song, alias)
        if (!(f in secs) || (!(f in stored) && !(await storeLyrics(f, s.song, secs[f])))) state.failed.push(s.song)
      } catch (e) {
        console.error('[sync]', s.song, (e as Error).message)
        state.failed.push(s.song)
      }
      state.done++
    }
    state.running = false
    state.current = null
  })()
  return true
}
