import { NextResponse } from 'next/server'
import { allVerses } from '@/lib/catalog'

/**
 * Svi stihovi (i arhivirani) — za panel sačuvanih na glavnom ekranu.
 * Isti odgovor za sve, pa ga drži CDN; glavna stranica ga ne nosi uz sebe.
 */
export async function GET() {
  return NextResponse.json(await allVerses(), {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400' },
  })
}
