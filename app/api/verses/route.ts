import { NextResponse } from 'next/server'
import { allVerses } from '@/lib/catalog'

/**
 * Svi stihovi (i arhivirani) — za panel sačuvanih na glavnom ekranu.
 * Isti odgovor za sve, pa ga drži CDN; glavna stranica ga ne nosi uz sebe.
 * Statičan (regeneriše se na sat i odmah kad admin nešto promijeni), pa
 * zahtjev ne pokreće funkciju — besplatni plan broji pozive.
 */
export const dynamic = 'force-static'
export const revalidate = 3600

export async function GET() {
  return NextResponse.json(await allVerses(), {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400' },
  })
}
