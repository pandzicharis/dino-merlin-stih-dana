import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { SEND_HOUR, TZ } from '@/lib/date'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Adrese na koje se uopšte može slati push. Sve ostalo je ili greška ili
 * pokušaj da nam se u tabelu ubaci tuđi URL — ruta ima servisni ključ, pa
 * bi bez ove provjere bila mali generator zahtjeva na adresu po izboru.
 */
const PUSH_HOSTS = [
  'googleapis.com', // fcm / android — Chrome, Edge, Android
  'push.apple.com', // Safari, iOS PWA
  'mozilla.com', // Firefox (push.services.mozilla.com)
  'notify.windows.com', // WNS
  'pushservice.mozilla.com',
]

const MAX_ENDPOINT = 800
const MAX_KEY = 200

function isPushEndpoint(raw: string): boolean {
  if (raw.length > MAX_ENDPOINT) return false
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  return PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
}

const isKey = (s: string) => s.length > 0 && s.length <= MAX_KEY && /^[A-Za-z0-9_\-=]+$/.test(s)

/** Lokalni datum i sat korisnika. `null` ako zona nije poznata ovom runtimeu. */
function localParts(tz: string): { date: string; hour: number } | null {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date())
        .map((p) => [p.type, p.value]),
    )
    return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) }
  } catch {
    return null
  }
}

/**
 * Gruba brana po IP-u. Instanca funkcije je kratkog vijeka i ima ih više, pa
 * ovo ne zamjenjuje pravi rate limit — zaustavlja samo najgluplji slučaj, da
 * jedan klijent u petlji ne zaspe bazu. Stvarna zaštita je `isPushEndpoint`:
 * validan FCM endpoint se ne može izmisliti.
 */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 20
const hits = new Map<string, { n: number; until: number }>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  if (hits.size > 5000) hits.clear() // ne dozvoli da mapa raste bez kraja
  const cur = hits.get(ip)
  if (!cur || cur.until < now) {
    hits.set(ip, { n: 1, until: now + WINDOW_MS })
    return false
  }
  cur.n++
  return cur.n > MAX_PER_WINDOW
}

export async function POST(req: Request) {
  const db = supabase()
  if (!db) return NextResponse.json({ error: 'push nije konfigurisan' }, { status: 503 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'nepoznat'
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'previše zahtjeva' }, { status: 429 })
  }

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
  if (!isPushEndpoint(endpoint) || !isKey(keys.p256dh) || !isKey(keys.auth)) {
    return NextResponse.json({ error: 'neispravan subscription' }, { status: 400 })
  }

  const rawHour = Number(body.sendHour)
  const hour = Number.isInteger(rawHour) && rawHour >= 0 && rawHour <= 23 ? rawHour : SEND_HOUR

  // Nepoznata zona se svede na Sarajevo. Isto radi i okidač u bazi — ovdje
  // zato što lokalni sat treba i za `alreadyPast` ispod.
  const wanted = typeof body.tz === 'string' ? body.tz.slice(0, 64) : ''
  const wantedParts = wanted ? localParts(wanted) : null
  const tz = wantedParts ? wanted : TZ
  const local = wantedParts ?? localParts(TZ)

  /**
   * Ko se pretplati poslije svog sata, danas ne dobije ništa — počinje sutra.
   *
   * Uslov slanja je "lokalni sat >= izabrani", da propušten cron prolaz ne
   * pojede cijeli dan. Bez ove linije bi ta ista popustljivost značila da
   * neko ko se u 20h prijavi na 12h dobije obavijest za par minuta.
   */
  const alreadyPast = local ? local.hour >= hour : false

  const { error } = await db.from('push_subscriptions').upsert(
    {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      send_hour: hour,
      tz,
      ...(alreadyPast && local ? { last_sent_on: local.date } : {}),
    },
    { onConflict: 'endpoint' },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
