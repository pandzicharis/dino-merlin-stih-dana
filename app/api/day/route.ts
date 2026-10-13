import { NextResponse } from 'next/server'
import { findVerse, verseForDay } from '@/lib/catalog'
import { isValidISODate } from '@/lib/date'

/**
 * Stih za jedan dan — samo za slučaj kad aplikacija stoji otvorena duže od
 * dana koje joj je stranica donijela, ili za dev pomjeranje datuma.
 * Odgovor je isti za sve, pa ga drži CDN.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const d = q.get('d')
  const id = q.get('id')
  // ?id= služi dev parametru ?verse=, ?d= svemu ostalom
  const verse = id ? await findVerse(id) : d && isValidISODate(d) ? await verseForDay(d) : null
  if (!verse) return NextResponse.json({ error: 'nepoznat dan ili stih' }, { status: 404 })
  return NextResponse.json(verse, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400' },
  })
}
