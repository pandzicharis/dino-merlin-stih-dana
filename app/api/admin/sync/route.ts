import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'
import { readCatalog } from '@/lib/catalog'
import { CAN_FETCH, readAlias, readDurations } from '@/lib/audio-files'
import { audioFile } from '@/lib/audio-name'
import { readLyrics, type StoredLyrics } from '@/lib/lyrics-store'
import { startSync, syncState } from '@/lib/catalog-sync'
import { GITHUB_TOKEN, dispatchAudio } from '@/lib/github'
import BUNDLED from '@/data/lyrics.json'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const denied = () => NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })

/** Koliko pjesama iz baze ima zvuk i tekst, i napredak sinhronizacije (lokalno). */
export async function GET() {
  if (!(await isAdmin())) return denied()
  const [cat, alias, secs, stored] = await Promise.all([
    readCatalog(),
    readAlias(),
    readDurations(),
    CAN_FETCH ? readLyrics() : (BUNDLED as Record<string, StoredLyrics>),
  ])
  const files = [...new Set(cat.verses.map((v) => audioFile(v.song, alias)))]
  return NextResponse.json(
    {
      mode: CAN_FETCH ? 'local' : GITHUB_TOKEN ? 'github' : 'off',
      songs: files.length,
      audio: files.filter((f) => f in secs).length,
      lyrics: files.filter((f) => f in stored).length,
      synced: files.filter((f) => stored[f]?.synced).length,
      ...syncState(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/**
 * Sinhronizuj sve iz baze: pjesme koje fale se preuzmu, tekstovi koji fale
 * se spreme. Lokalno odmah (napredak u GET); na produkciji GitHub.
 */
export async function POST() {
  if (!(await isAdmin())) return denied()
  if (CAN_FETCH) {
    const started = startSync((await readCatalog()).verses)
    return NextResponse.json({ state: started ? 'started' : 'running' })
  }
  const fail = await dispatchAudio('audio', {})
  if (fail) return NextResponse.json({ error: fail }, { status: GITHUB_TOKEN ? 502 : 409 })
  return NextResponse.json({ state: 'github' })
}
