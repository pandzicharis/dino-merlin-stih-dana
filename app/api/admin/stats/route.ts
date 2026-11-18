import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'
import { readCatalog } from '@/lib/catalog'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** stih sa zbirom za period */
export type StatRow = { id: string; text: string; song: string; album: string; mood: string; opens: number; saves: number; shares: number }

/**
 * Statistika za admina (admin → Statistika): zbir otvaranja, čuvanja i
 * dijeljenja po stihu za zadnjih `days` dana (supabase/schema.sql `verse_stats`).
 * `state`: ok, off (nema baze — lokalno), setup (tabela još nije napravljena).
 */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })
  const days = Math.max(1, Math.min(365, Math.round(Number(new URL(req.url).searchParams.get('days')) || 30)))
  const db = supabase()
  if (!db) return NextResponse.json({ state: 'off', days })

  const from = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await db.from('verse_stats').select('verse_id, opens, saves, shares').gte('day', from).limit(50_000)
  if (error) {
    const setup = ['PGRST205', '42P01', 'PGRST202', '42883'].includes(error.code ?? '')
    return NextResponse.json({ state: setup ? 'setup' : 'error', days, message: error.message })
  }

  const sum = new Map<string, { opens: number; saves: number; shares: number }>()
  for (const r of (data ?? []) as { verse_id: string; opens: number; saves: number; shares: number }[]) {
    const s = sum.get(r.verse_id) ?? { opens: 0, saves: 0, shares: 0 }
    s.opens += r.opens
    s.saves += r.saves
    s.shares += r.shares
    sum.set(r.verse_id, s)
  }
  const cat = await readCatalog()
  const rows: StatRow[] = cat.verses
    .filter((v) => sum.has(v.id))
    .map((v) => ({ id: v.id, text: v.text, song: v.song, album: v.album, mood: v.mood, ...sum.get(v.id)! }))
  const totals = rows.reduce((t, r) => ({ opens: t.opens + r.opens, saves: t.saves + r.saves, shares: t.shares + r.shares }), { opens: 0, saves: 0, shares: 0 })
  return NextResponse.json({ state: 'ok', days, totals, rows }, { headers: { 'Cache-Control': 'no-store' } })
}
