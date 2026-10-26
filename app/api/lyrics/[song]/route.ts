import { NextResponse } from 'next/server'
import { lyricsOf } from '@/lib/dino-site'
import { lrcOf } from '@/lib/lrclib'
import { audioFile } from '@/lib/audio-name'
import DURATIONS from '@/data/audio.json'
import STORED from '@/data/lyrics.json'
import type { StoredLyrics } from '@/lib/lyrics-store'

/**
 * Tekst pjesme — panel s tekstom uz plejer (components/Lyrics.tsx):
 *   lines   tekst s dinomerlin.com (ili s LRCLIB-a kad ga sajt nema)
 *   synced  redovi s vremenom (LRCLIB) — samo kad trajanje odgovara našem fajlu
 * Prvo spremljen tekst (data/lyrics.json — uz pjesmu, lib/lyrics-store.ts),
 * bez ijednog sajta. Pjesma čiji tekst još nije spremljen pita sajtove.
 * Isti odgovor za sve, pa ga drži CDN. Ako jedan izvor ne odgovori, CDN ga
 * drži kratko — da se drugi put pokuša opet.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ song: string }> }) {
  const { song: raw } = await ctx.params
  let song = raw
  try {
    song = decodeURIComponent(raw)
  } catch {}
  song = song.slice(0, 120)
  const stored = (STORED as Record<string, StoredLyrics>)[audioFile(song)]
  // telefon kratko (ispravka iz admina stigne brzo), CDN sedmicu — nova objava ga ionako očisti
  if (stored) return NextResponse.json(stored, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=604800, stale-while-revalidate=2592000' } })
  const duration = (DURATIONS as Record<string, number>)[audioFile(song)] ?? 0
  // LRCLIB zna kasniti — tekst ne čeka duže od 5 s (posao ide dalje i zapamti se za sljedeći put)
  const late = new Promise<never>((_, no) => setTimeout(() => no(new Error('lrclib kasni')), 5000))
  const [site, lrc] = await Promise.allSettled([lyricsOf(song), Promise.race([lrcOf(song, duration), late])])
  if (site.status === 'rejected') console.error('[dinomerlin.com]', (site.reason as Error).message)
  if (lrc.status === 'rejected') console.error('[lrclib]', (lrc.reason as Error).message)

  const page = site.status === 'fulfilled' ? site.value : null
  const l = lrc.status === 'fulfilled' ? lrc.value : null
  const lines = page?.lines.length ? page.lines : (l?.plain ?? [])
  const partial = site.status === 'rejected' || lrc.status === 'rejected'
  if (!lines.length && !l?.synced) {
    return NextResponse.json(
      { error: partial ? 'Tekst nije stigao.' : 'Nema teksta.' },
      { status: partial ? 502 : 404, headers: { 'Cache-Control': partial ? 'no-store' : 'public, max-age=3600, s-maxage=3600' } },
    )
  }
  return NextResponse.json(
    { title: page?.title ?? song, lines, ...(page ? { url: page.url } : {}), ...(l?.synced ? { synced: l.synced } : {}) },
    {
      headers: {
        // bez vremena: dan, pa opet (možda se pojavi na LRCLIB-u); s vremenom: sedmica
        'Cache-Control': partial
          ? 'public, max-age=300, s-maxage=600'
          : l?.synced
            ? 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000'
            : 'public, max-age=3600, s-maxage=86400',
      },
    },
  )
}
