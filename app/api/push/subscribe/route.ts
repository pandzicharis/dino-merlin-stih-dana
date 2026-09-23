import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { SEND_HOUR } from '@/lib/date'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const db = supabase()
  if (!db) return NextResponse.json({ error: 'push nije konfigurisan' }, { status: 503 })

  let body: {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    sendHour?: number
    tz?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'neispravan JSON' }, { status: 400 })
  }

  const { endpoint, keys } = body.subscription ?? {}
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'nepotpun subscription' }, { status: 400 })
  }

  const hour = Number(body.sendHour)
  const { error } = await db.from('push_subscriptions').upsert(
    {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      send_hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : SEND_HOUR,
      tz: typeof body.tz === 'string' && body.tz ? body.tz : 'Europe/Sarajevo',
    },
    { onConflict: 'endpoint' },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
