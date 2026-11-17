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
 *
 * Trajanje: vremena redova vrijede samo za snimak te dužine. Za pjesmu čiji
 * fajl imamo zna se (data/audio.json) i ide uz odgovor (`duration`) — YouTube
 * ladica (components/tube/TubeLyrics.tsx) ga poredi s videom. Pjesma koja ide
 * samo preko YouTubea ga nema: odgovor nosi `open`, a ladica pita opet s
 * trajanjem videa (`?d=sekunde`) — tako i ona dobije tekst koji prati.
 */
export async function GET(req: Request, ctx: { params: Promise<{ song: string }> }) {
  const { song: raw } = await ctx.params
  let song = raw
  try {
    song = decodeURIComponent(raw)
  } catch {}
  song = song.slice(0, 120)
  const stored = (STORED as Record<string, StoredLyrics>)[audioFile(song)]
  const known = (DURATIONS as Record<string, number>)[audioFile(song)] ?? 0
  // vremena redova vrijede za snimak uz koji su nađena (spremljeno trajanje, npr. YouTube video), inače za naš fajl
  const ref = stored?.duration ?? known
  // telefon kratko (ispravka iz admina stigne brzo), CDN sedmicu — nova objava ga ionako očisti
  if (stored)
    return NextResponse.json(
      { ...stored, ...(stored.synced && ref ? { duration: ref } : {}) },
      { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=604800, stale-while-revalidate=2592000' } },
    )
  // trajanje videa s telefona — samo cijele sekunde u razumnim granicama (ključ CDN-a)
  const asked = Math.round(Number(new URL(req.url).searchParams.get('d')))
  const duration = known || (asked >= 30 && asked <= 1200 ? asked : 0)
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
    {
      title: page?.title ?? song,
      lines,
      ...(page ? { url: page.url } : {}),
      ...(l?.synced ? { synced: l.synced, duration } : {}),
      // trajanje se ne zna — s trajanjem videa se možda nađu vremena redova
      ...(!duration ? { open: true } : {}),
    },
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
