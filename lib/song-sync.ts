/**
 * Sinhronizacija izabranih pjesama (admin → Sinhronizacija), lokalno: pjesma
 * koja fali se preuzme (yt-dlp), pa se tekst pita iznova (dinomerlin.com +
 * LRCLIB — vremena redova po trajanju našeg fajla). Jedna po jedna, u
 * pozadini; admin čita napredak i rezultat svake pjesme (syncState). Što
 * LRCLIB tad ne odgovori, pokuša se još jednom na kraju.
 * Na produkciji isto radi GitHub (scripts/audio-sync.ts, SYNC_SONGS).
 */

import { prepareSong, readAlias, readDurations } from './audio-files'
import { audioFile } from './audio-name'
import { readLyrics, storeLyrics } from './lyrics-store'

/** rezultat pjesme: zvuk (ok, preuzet, greška) i tekst (prati, bez vremena, nema, greška) */
export type SyncItem = {
  song: string
  audio: 'wait' | 'run' | 'ok' | 'new' | 'fail'
  lyrics: 'wait' | 'run' | 'synced' | 'plain' | 'none' | 'fail'
  error?: string
}
export type SyncState = { running: boolean; items: SyncItem[]; at: number | null }

const g = globalThis as typeof globalThis & { __songSync?: SyncState }
const state: SyncState = (g.__songSync ??= { running: false, items: [], at: null })

export const syncState = (): SyncState => ({ ...state, items: state.items.map((i) => ({ ...i })) })

/** Pokreni za `list` (naziv + link pjesme). false = već radi. */
export function startSync(list: { song: string; youtube?: string }[]): boolean {
  if (state.running) return false
  state.running = true
  state.at = Date.now()
  state.items = list.map((s) => ({ song: s.song, audio: 'wait', lyrics: 'wait' }))
  void run(list).finally(() => {
    state.running = false
  })
  return true
}

async function lyricsOf(item: SyncItem, file: string) {
  const secs = await readDurations()
  if (!(file in secs)) return void (item.lyrics = 'fail')
  item.lyrics = 'run'
  const ok = await storeLyrics(file, item.song, secs[file], true).catch(() => false)
  const l = ok ? (await readLyrics())[file] : null
  item.lyrics = !ok ? 'fail' : l?.synced ? 'synced' : l?.lines.length ? 'plain' : 'none'
}

async function run(list: { song: string; youtube?: string }[]) {
  for (const [k, s] of list.entries()) {
    const item = state.items[k]
    const [alias, secs] = await Promise.all([readAlias(), readDurations()])
    const file = audioFile(s.song, alias)
    if (file in secs) item.audio = 'ok'
    else {
      item.audio = 'run'
      try {
        await prepareSong(s.song, s.youtube)
        item.audio = 'new'
      } catch (e) {
        item.audio = 'fail'
        item.error = (e as Error).message.split('\n').pop()
        item.lyrics = 'fail'
        continue
      }
    }
    await lyricsOf(item, file)
  }
  // LRCLIB zna biti pretrpan — što nije odgovorilo, još jednom, malo kasnije
  const again = state.items.filter((i) => i.lyrics === 'fail' && i.audio !== 'fail')
  if (!again.length) return
  await new Promise((r) => setTimeout(r, 15_000))
  const alias = await readAlias()
  for (const item of again) await lyricsOf(item, audioFile(item.song, alias))
}
