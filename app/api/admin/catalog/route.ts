import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'
import { CatalogError, mutateCatalog, readCatalog, slugify, validateVerse, writable, type Catalog } from '@/lib/catalog'
import { sameVerse } from '@/lib/text'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Stanje za admin ekran: lista stihova i može li se pisati. */
function snapshot(cat: Catalog, w: 'supabase' | 'file' | null) {
  return { verses: cat.verses, source: cat.source, writable: w }
}

async function canWrite() {
  try {
    return await writable()
  } catch {
    return null
  }
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })
  return NextResponse.json(snapshot(await readCatalog(), await canWrite()), {
    headers: { 'Cache-Control': 'no-store' },
  })
}

/** Isti stih se ne dodaje dva puta. */
function duplicate(c: Pick<Catalog, 'verses'>, v: { text: string; song: string; album: string; youtube?: string }, except?: string) {
  if (c.verses.some((x) => x.id !== except && sameVerse(x, v))) throw new CatalogError('Ovaj stih već postoji')
}

type Op =
  | { op: 'add'; verse: Record<string, unknown> }
  | { op: 'update'; id: string; verse: Record<string, unknown> }
  | { op: 'archive'; id: string }
  | { op: 'restore'; id: string }

/**
 * Sve izmjene idu kroz jednu rutu, kao operacije. Svaka prolazi
 * `mutateCatalog`: primijeni, upiše, osvježi sajt. Odgovor je nova lista.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as Op | null
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Neispravan zahtjev.' }, { status: 400 })

  const bad = (error: string) => NextResponse.json({ error }, { status: 400 })

  let cat: Catalog
  try {
    switch (body.op) {
      case 'add': {
        const { verse, error } = validateVerse(body.verse)
        if (!verse) return bad(error!)
        cat = await mutateCatalog((c) => {
          duplicate(c, verse)
          const base = slugify(verse.text) || 'stih'
          let id = base
          for (let n = 2; c.verses.some((v) => v.id === id); n++) id = `${base}-${n}`
          c.verses.push({ id, ...verse, active: true })
        })
        break
      }
      case 'update': {
        const { verse, error } = validateVerse(body.verse)
        if (!verse) return bad(error!)
        cat = await mutateCatalog((c) => {
          const i = c.verses.findIndex((v) => v.id === body.id)
          if (i < 0) throw new CatalogError('Stih ne postoji.')
          duplicate(c, verse, body.id)
          // id ostaje isti — po njemu idu share linkovi i favoriti
          c.verses[i] = { id: body.id, ...verse, active: c.verses[i].active }
        })
        break
      }
      case 'archive': {
        cat = await mutateCatalog((c) => {
          const v = c.verses.find((x) => x.id === body.id)
          if (!v) throw new CatalogError('Stih ne postoji.')
          if (c.verses.filter((x) => x.active).length <= 1) throw new CatalogError('Mora ostati bar jedan stih.')
          v.active = false
        })
        break
      }
      case 'restore': {
        cat = await mutateCatalog((c) => {
          const v = c.verses.find((x) => x.id === body.id)
          if (!v) throw new CatalogError('Stih ne postoji.')
          v.active = true
        })
        break
      }
      default:
        return bad('Nepoznata operacija.')
    }
  } catch (e) {
    const msg = e instanceof CatalogError ? e.message : 'Upis nije uspio.'
    if (!(e instanceof CatalogError)) console.error('[admin]', e)
    return NextResponse.json({ error: msg }, { status: e instanceof CatalogError ? 400 : 500 })
  }

  return NextResponse.json(snapshot(cat, await canWrite()))
}
