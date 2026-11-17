import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'
import { readCatalog } from '@/lib/catalog'
import { CAN_FETCH } from '@/lib/audio-files'
import { audioFile } from '@/lib/audio-name'
import { OWN_AUDIO } from '@/lib/flags'
import { fetchLyrics } from '@/lib/lyrics-store'
import { lyricsDuration } from '@/lib/yt-duration'
import { startSync, syncState, type SyncItem } from '@/lib/song-sync'
import { GITHUB_TOKEN, dispatchAudio } from '@/lib/github'
import { audioSlug } from '@/lib/text'
import DURATIONS from '@/data/audio.json'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// provjera tekstova na produkciji ide pjesma po pjesma (LRCLIB)
export const maxDuration = 60

const denied = () => NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })

/** Napredak sinhronizacije (lokalno) — rezultat svake pjesme. */
export async function GET() {
  if (!(await isAdmin())) return denied()
  return NextResponse.json({ mode: CAN_FETCH ? 'local' : GITHUB_TOKEN ? 'github' : 'off', ...syncState() }, { headers: { 'Cache-Control': 'no-store' } })
}

/**
 * Sinhronizuj izabrane pjesme (admin → Sinhronizacija): tekst s vremenima
 * redova (uz vlastite pjesme, lib/flags.ts, i zvuk koji fali). Lokalno odmah,
 * u pozadini (napredak u GET). Na produkciji spremi GitHub (SYNC_SONGS →
 * scripts/audio-sync.ts), a tekst se ovdje odmah provjeri, pa admin vidi šta će stići.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return denied()
  const body = (await req.json().catch(() => null)) as { songs?: unknown } | null
  const names = Array.isArray(body?.songs) ? body.songs.map((s) => String(s).trim().slice(0, 120)).filter(Boolean).slice(0, 60) : []
  if (!names.length) return NextResponse.json({ error: 'Nije izabrana nijedna pjesma.' }, { status: 400 })

  // link pjesme iz baze (vremena redova po videu, titlovi, zvuk) i njen stih (pjesma po stihu)
  const cat = await readCatalog()
  const list = names.map((song) => {
    const of = cat.verses.filter((v) => audioSlug(v.song) === audioSlug(song))
    return { song, youtube: of.find((v) => v.youtube)?.youtube, verse: of[0]?.text }
  })

  if (CAN_FETCH) {
    if (!startSync(list)) return NextResponse.json({ error: 'Sinhronizacija već radi.' }, { status: 409 })
    return NextResponse.json({ state: 'started' })
  }

  const fail = await dispatchAudio('sync', { songs: names.join('\n') })
  if (fail) return NextResponse.json({ error: fail }, { status: GITHUB_TOKEN ? 502 : 409 })
  // tekst odmah, po trajanju YouTube videa (uz vlastite pjesme: fajla iz ovog builda) — isto će GitHub spremiti
  const secs = DURATIONS as Record<string, number>
  const items: SyncItem[] = []
  for (const { song, youtube, verse } of list) {
    const d = await lyricsDuration(audioFile(song), youtube, secs)
    if (!d && OWN_AUDIO) {
      items.push({ song, audio: 'wait', lyrics: 'wait' })
      continue
    }
    const l = await fetchLyrics(song, d, true, { youtube, verse }).catch(() => null)
    items.push({ song, audio: 'ok', lyrics: !l ? 'fail' : l.synced ? 'synced' : l.lines.length ? 'plain' : 'none' })
  }
  return NextResponse.json({ state: 'github', items, note: `${OWN_AUDIO ? 'Zvuk i tekst spremi' : 'Tekst spremi'} GitHub — stiže uz sljedeću objavu (~3 min).` })
}
