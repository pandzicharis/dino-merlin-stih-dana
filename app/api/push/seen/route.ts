import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { todayInTz } from '@/lib/date'
import { isPushEndpoint } from '@/lib/push-endpoint'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Današnji stih je izvučen prije obavijesti (npr. ujutro) — obavijest u podne
 * tom uređaju više ne treba. Upiše se `last_sent_on = danas`, pa ga slanje
 * (app/api/cron/send-daily) preskoči kao da je već dobio poziv; sutra je sve
 * kao i inače.
 *
 * Trošak: jedan mali upis po uređaju dnevno, samo za one koji otvore prije
 * podneva — klijent zove jednom (lib/push-client.ts `reportSeen`). Slanje
 * ostaje isti posao, samo s manje adresa.
 */
export async function POST(req: Request) {
  const db = supabase()
  if (!db) return NextResponse.json({ error: 'push nije konfigurisan' }, { status: 503 })

  const { endpoint, date } = (await req.json().catch(() => ({}))) as { endpoint?: unknown; date?: unknown }
  if (!isPushEndpoint(endpoint)) return NextResponse.json({ error: 'neispravan endpoint' }, { status: 400 })

  // samo današnji dan po Sarajevu — pogrešan sat na telefonu (ili dev datum)
  // ne može zatvoriti neki drugi dan
  const today = todayInTz()
  if (date !== today) return NextResponse.json({ ok: true, skipped: 'nije danas' })

  const { error } = await db
    .from('push_subscriptions')
    .update({ last_sent_on: today })
    .eq('endpoint', endpoint)
    .or(`last_sent_on.is.null,last_sent_on.neq.${today}`)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
