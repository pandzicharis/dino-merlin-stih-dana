import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'
import { CatalogError, mutateCatalog, readCatalog, writable } from '@/lib/catalog'
import { CAN_FETCH, readAlias, readDurations, renameSong } from '@/lib/audio-files'
import { audioFile } from '@/lib/audio-name'
import { audioSlug } from '@/lib/text'
import { dispatchAudio } from '@/lib/github'
import { siteLyrics, siteSongs, sitePicks } from '@/lib/dino-site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Pjesme s dinomerlin.com/tekstovi-pjesama — izbor pjesme u formi stiha
 * (nazivi usklađeni s katalogom i fajlovima — lib/dino-site.ts `sitePicks`).
 * `?page=<stranica>` vrati YouTube link te pjesme (za novu pjesmu).
 */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })
  const page = new URL(req.url).searchParams.get('page')
  try {
    if (page) {
      const { youtube } = await siteLyrics(page)
      return NextResponse.json({ youtube: youtube ?? null })
    }
    const [list, cat, durations, alias] = await Promise.all([siteSongs(), readCatalog(), readDurations(), readAlias()])
    const songs = sitePicks(
      list,
      cat.verses.map((v) => v.song),
      (song) => audioFile(song, alias) in durations,
    )
    return NextResponse.json({ songs }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[dinomerlin.com]', (e as Error).message)
    return NextResponse.json({ error: 'dinomerlin.com se ne javlja.' }, { status: 502 })
  }
}

/**
 * Uredi pjesmu (admin → lista pjesama → olovka): novi naziv u svim njenim
 * stihovima i, po želji, novo ime fajla. Stihovi se mijenjaju odmah; fajl
 * lokalno odmah, a na produkciji preko GitHuba (~3 min do objave).
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { from?: string; to?: string; file?: string } | null
  const from = String(body?.from ?? '').trim()
  const to = String(body?.to ?? '').trim().slice(0, 120)
  const file = String(body?.file ?? '').trim()
  if (!from || !to) return NextResponse.json({ error: 'Nedostaje naziv pjesme.' }, { status: 400 })
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(file) || file.length > 80) {
    return NextResponse.json({ error: 'Ime fajla: mala slova, brojevi i crtice (npr. laku-noc-moja-mala-barbiko).' }, { status: 400 })
  }

  try {
    // fajl prvo — ako ime već postoji, stihovi ostaju netaknuti
    const alias = await readAlias()
    let note: string | null = null
    if (CAN_FETCH) await renameSong(from, to, file)
    else if (audioFile(from, alias) !== file || audioFile(to, alias) !== file) {
      note = await dispatchAudio('audio-rename', { from, to, file })
    }
    const cat = await mutateCatalog((c) => {
      for (const v of c.verses) if (audioSlug(v.song) === audioSlug(from)) v.song = to
    })
    return NextResponse.json({ verses: cat.verses, source: cat.source, writable: await writable().catch(() => null), note })
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json({ error: e instanceof CatalogError ? msg : msg || 'Pjesma nije sačuvana.' }, { status: 400 })
  }
}
