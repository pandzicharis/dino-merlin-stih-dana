import { NextResponse } from 'next/server'
import { findVerse } from '@/lib/catalog'

/**
 * Jedan stih po id-u — za dev parametar `?verse=` i telefon u prezentaciji,
 * kad traženi stih nije u listi koju je stranica donijela. Odgovor je isti
 * za sve, pa ga drži CDN.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  const verse = id ? await findVerse(id) : null
  if (!verse) return NextResponse.json({ error: 'nepoznat stih' }, { status: 404 })
  return NextResponse.json(verse, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400' },
  })
}
