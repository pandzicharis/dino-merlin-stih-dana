import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const db = supabase()
  if (!db) return NextResponse.json({ error: 'push nije konfigurisan' }, { status: 503 })

  const { endpoint } = await req.json().catch(() => ({}))
  if (!endpoint) return NextResponse.json({ error: 'nedostaje endpoint' }, { status: 400 })

  await db.from('push_subscriptions').delete().eq('endpoint', endpoint)
  return NextResponse.json({ ok: true })
}
