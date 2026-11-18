import { getCatalog } from '@/lib/catalog'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

const KINDS = ['open', 'save', 'share'] as const

/**
 * Statistika stiha (lib/stats-client.ts): `{ id, kind }` → +1 za taj stih i
 * današnji dan (supabase/schema.sql `bump_verse_stat`). Bez ličnih podataka.
 * Samo postojeći stihovi i samo s ovog sajta; bez baze (lokalno) ne radi ništa.
 */
export async function POST(req: Request) {
  const origin = req.headers.get('origin')
  if (origin && new URL(origin).host !== new URL(req.url).host) return new Response(null, { status: 403 })
  const body = (await req.json().catch(() => null)) as { id?: unknown; kind?: unknown } | null
  const id = typeof body?.id === 'string' ? body.id.slice(0, 120) : ''
  const kind = KINDS.find((k) => k === body?.kind)
  if (!id || !kind) return new Response(null, { status: 400 })

  const db = supabase()
  if (!db) return new Response(null, { status: 204 })
  if (!(await getCatalog()).verses.some((v) => v.id === id)) return new Response(null, { status: 204 })
  // tabele još nema (SQL nije pokrenut) — tiho, aplikacija ništa ne čeka
  const { error } = await db.rpc('bump_verse_stat', { vid: id, kind })
  if (error) console.warn('[statistika]', error.message)
  return new Response(null, { status: 204 })
}
