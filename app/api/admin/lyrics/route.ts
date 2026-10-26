import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'
import { CAN_FETCH, readAlias, readDurations } from '@/lib/audio-files'
import { audioFile } from '@/lib/audio-name'
import { setLyricsOffset, storeLyrics } from '@/lib/lyrics-store'
import { GITHUB_TOKEN, dispatchAudio } from '@/lib/github'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Preuzmi tekst pjesme sada (admin → "Preuzmi tekst"), ili
 * sačuvaj pomak teksta (`offset`, kad LRC kasni ili žuri za pjesmom). Tekst ide
 * uz pjesmu (vrijeme redova po trajanju fajla), pa pjesma mora biti preuzeta.
 * Lokalno odmah, u pozadini (stanje u /api/admin/audio); na produkciji GitHub
 * (`npm run audio`, LYRICS_RESYNC).
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { song?: string; offset?: number } | null
  const song = String(body?.song ?? '').trim().slice(0, 120)

  if (!song) return NextResponse.json({ error: 'Nedostaje naziv pjesme.' }, { status: 400 })

  // pomak teksta (sekunde, + = ranije) — lokalno odmah, na produkciji preko GitHuba
  if (body && 'offset' in body) {
    const offset = Math.round(Math.max(-10, Math.min(10, Number(body.offset) || 0)) * 100) / 100
    if (CAN_FETCH) {
      await setLyricsOffset(audioFile(song, await readAlias()), offset)
      return NextResponse.json({ offset })
    }
    const fail = await dispatchAudio('lyrics-offset', { song, offset: String(offset) })
    if (fail) return NextResponse.json({ error: fail }, { status: GITHUB_TOKEN ? 502 : 409 })
    return NextResponse.json({ offset, note: 'Pomak stiže uz sljedeću objavu (~3 min).' })
  }

  if (CAN_FETCH) {
    const [alias, secs] = await Promise.all([readAlias(), readDurations()])
    const file = audioFile(song, alias)
    if (!(file in secs)) return NextResponse.json({ error: 'Prvo pjesma — tekst ide uz nju.' }, { status: 409 })
    storeLyrics(file, song, secs[file], true).catch(() => {})
    return NextResponse.json({ state: 'loading' })
  }
  const fail = await dispatchAudio('lyrics-sync', { song })
  if (fail) return NextResponse.json({ error: fail }, { status: GITHUB_TOKEN ? 502 : 409 })
  return NextResponse.json({ state: 'loading' })
}
