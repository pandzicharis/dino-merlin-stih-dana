import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'
import {
  CatalogError,
  mutateCatalog,
  nearGap,
  nextDate,
  readCatalog,
  resolveId,
  slugify,
  validateVerse,
  writable,
  type Catalog,
} from '@/lib/catalog'
import { EPOCH, addDays, isValidISODate, todayInTz } from '@/lib/date'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Najviše ovoliko dana po jednom zahtjevu — kalendar traži mjesec po mjesec. */
const MAX_RANGE = 62

/**
 * Stanje za admin ekran: svi stihovi, raspored za traženi raspon (mjesec u
 * kalendaru, bilo koje godine) i kad koji stih sljedeći put dolazi.
 */
function snapshot(cat: Catalog, from: string, to: string, w: 'supabase' | 'file' | null) {
  const today = todayInTz()
  const days: { date: string; verseId: string; manual: boolean; past: boolean; gap: number | null }[] = []
  for (let d = from < EPOCH ? EPOCH : from, i = 0; d <= to && i < MAX_RANGE; d = addDays(d, 1), i++) {
    days.push({
      date: d,
      verseId: resolveId(d, cat),
      // ručno = admin ga postavio u dijelu rasporeda koji se inače računa
      manual: cat.manual.includes(d),
      past: d < today,
      gap: nearGap(d, cat),
    })
  }
  const next: Record<string, string | null> = {}
  for (const v of cat.verses) next[v.id] = v.active ? nextDate(v.id, cat, today) : null
  return {
    verses: cat.verses,
    days,
    next,
    today,
    lockedUntil: cat.planStart,
    source: cat.source,
    writable: w,
  }
}

function range(q: URLSearchParams | Record<string, unknown>) {
  const get = (k: string) => (q instanceof URLSearchParams ? q.get(k) : (q[k] as string | undefined))
  const today = todayInTz()
  const from = get('from')
  const to = get('to')
  const f = from && isValidISODate(from) ? from : `${today.slice(0, 7)}-01`
  const t = to && isValidISODate(to) && to >= f ? to : addDays(f, 41)
  return [f, t] as const
}

async function canWrite() {
  try {
    return await writable()
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })
  const [from, to] = range(new URL(req.url).searchParams)
  return NextResponse.json(snapshot(await readCatalog(), from, to, await canWrite()), {
    headers: { 'Cache-Control': 'no-store' },
  })
}

type Op =
  | { op: 'add'; verse: Record<string, unknown>; date?: string }
  | { op: 'update'; id: string; verse: Record<string, unknown> }
  | { op: 'archive'; id: string }
  | { op: 'restore'; id: string }
  | { op: 'assign'; date: string; id: string }
  | { op: 'swap'; a: string; b: string }

/**
 * Sve izmjene idu kroz jednu rutu, kao operacije. Svaka prolazi
 * `mutateCatalog`: zaključa prošlost i najavljenu sedmicu, primijeni,
 * upiše, osvježi sajt. Odgovor je novo stanje za mjesec koji admin gleda.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as (Op & { from?: string; to?: string }) | null
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Neispravan zahtjev.' }, { status: 400 })

  const today = todayInTz()
  const future = (d: unknown): d is string => typeof d === 'string' && isValidISODate(d) && d >= today
  const bad = (error: string) => NextResponse.json({ error }, { status: 400 })

  let cat: Catalog
  let placed: string | null = null
  try {
    switch (body.op) {
      case 'add': {
        const { verse, error } = validateVerse(body.verse)
        if (!verse) return bad(error!)
        if (body.date && !future(body.date)) return bad('Datum je u prošlosti.')
        let id = ''
        cat = await mutateCatalog((c) => {
          const base = slugify(verse.text) || 'stih'
          id = base
          for (let n = 2; c.verses.some((v) => v.id === id); n++) id = `${base}-${n}`
          c.verses.push({ id, ...verse, active: true })
          // novi stih ide na kraj reda; s datumom još i tačno taj dan
          if (body.date) {
            c.pins[body.date] = id
            c.manual.push(body.date)
          }
        })
        placed = nextDate(id, cat, today)
        break
      }
      case 'update': {
        const { verse, error } = validateVerse(body.verse)
        if (!verse) return bad(error!)
        cat = await mutateCatalog((c) => {
          const i = c.verses.findIndex((v) => v.id === body.id)
          if (i < 0) throw new CatalogError('Stih ne postoji.')
          // id ostaje isti — po njemu idu share linkovi i favoriti
          c.verses[i] = { id: body.id, ...verse, active: c.verses[i].active }
        })
        break
      }
      case 'archive': {
        cat = await mutateCatalog((c, t) => {
          const v = c.verses.find((x) => x.id === body.id)
          if (!v) throw new CatalogError('Stih ne postoji.')
          if (c.verses.filter((x) => x.active).length <= 1) throw new CatalogError('Mora ostati bar jedan stih.')
          v.active = false
          // prošli dani ostaju; budući ručni dani s ovim stihom se vraćaju u red
          for (const [d, id] of Object.entries(c.pins)) {
            if (id === body.id && d > t) {
              delete c.pins[d]
              c.manual = c.manual.filter((x) => x !== d)
            }
          }
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
      case 'assign': {
        if (!future(body.date)) return bad('Datum je u prošlosti.')
        cat = await mutateCatalog((c) => {
          if (!c.verses.some((v) => v.id === body.id && v.active)) throw new CatalogError('Stih ne postoji.')
          c.pins[body.date] = body.id
          c.manual.push(body.date)
        })
        break
      }
      case 'swap': {
        if (!future(body.a) || !future(body.b)) return bad('Datum je u prošlosti.')
        const before = await readCatalog()
        const a = resolveId(body.a, before)
        const b = resolveId(body.b, before)
        cat = await mutateCatalog((c) => {
          c.pins[body.a] = b
          c.pins[body.b] = a
          c.manual.push(body.a, body.b)
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

  const [from, to] = range(body)
  return NextResponse.json({ ...snapshot(cat, from, to, await canWrite()), placed })
}
