/**
 * Sinhronizacija izabranih pjesama (admin → Sinhronizacija), lokalno: tekst
 * se pita iznova (dinomerlin.com + LRCLIB — vremena redova po trajanju
 * YouTube videa, lib/yt-duration.ts). Samo uz vlastite pjesme (lib/flags.ts)
 * se prvo preuzme pjesma koja fali (yt-dlp), a vremena idu po našem fajlu.
 * Jedna po jedna, u pozadini; admin čita napredak i rezultat svake pjesme
 * (syncState). Što LRCLIB tad ne odgovori, pokuša se još jednom na kraju.
 * Na produkciji isto radi GitHub (scripts/audio-sync.ts, SYNC_SONGS).
 */

import { prepareSong, readAlias, readDurations } from './audio-files'
import { audioFile } from './audio-name'
import { OWN_AUDIO } from './flags'
import { readLyrics, storeLyrics } from './lyrics-store'
import { lyricsDuration } from './yt-duration'

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

/** pjesma za sinhronizaciju: naziv, link (video, titlovi) i stih iz kataloga (pjesma po stihu) */
type SyncSong = { song: string; youtube?: string; verse?: string }

/** Pokreni za `list`. false = već radi. */
export function startSync(list: SyncSong[]): boolean {
  if (state.running) return false
  state.running = true
  state.at = Date.now()
  state.items = list.map((s) => ({ song: s.song, audio: 'wait', lyrics: 'wait' }))
  void run(list).finally(() => {
    state.running = false
  })
  return true
}

async function lyricsOf(item: SyncItem, file: string, s?: SyncSong) {
  item.lyrics = 'run'
  // bez trajanja (nema ni videa ni fajla) tekst ide bez vremena; uz vlastite pjesme pjesma mora biti tu
  const duration = await lyricsDuration(file, s?.youtube, await readDurations())
  if (OWN_AUDIO && !duration) return void (item.lyrics = 'fail')
  const ok = await storeLyrics(file, item.song, duration, true, { youtube: s?.youtube, verse: s?.verse }).catch(() => false)
  const l = ok ? (await readLyrics())[file] : null
  item.lyrics = !ok ? 'fail' : l?.synced ? 'synced' : l?.lines.length ? 'plain' : 'none'
}

async function run(list: SyncSong[]) {
  for (const [k, s] of list.entries()) {
    const item = state.items[k]
    const [alias, secs] = await Promise.all([readAlias(), readDurations()])
    const file = audioFile(s.song, alias)
    // pjesme idu preko YouTubea — samo tekst
    if (!OWN_AUDIO || file in secs) item.audio = 'ok'
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
    await lyricsOf(item, file, s)
  }
  // LRCLIB zna biti pretrpan — što nije odgovorilo, još jednom, malo kasnije
  const again = state.items.filter((i) => i.lyrics === 'fail' && i.audio !== 'fail')
  if (!again.length) return
  await new Promise((r) => setTimeout(r, 15_000))
  const alias = await readAlias()
  const of = new Map(list.map((s) => [s.song, s]))
  for (const item of again) await lyricsOf(item, audioFile(item.song, alias), of.get(item.song))
}
