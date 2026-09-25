import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const db = supabase()
  if (!db) return NextResponse.json({ error: 'push nije konfigurisan' }, { status: 503 })

  const { endpoint } = await req.json().catch(() => ({}))
  if (typeof endpoint !== 'string' || !endpoint || endpoint.length > 800) {
    return NextResponse.json({ error: 'nedostaje endpoint' }, { status: 400 })
  }

  // Odjava se nikad ne prijavljuje kao greška: korisnik je isključio zvono i
  // to je gotovo bez obzira na to da li je red u bazi uopšte postojao.
  const { error } = await db.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) console.error('unsubscribe:', error.message)

  return NextResponse.json({ ok: true })
}
