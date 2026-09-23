import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabase, type PushRow } from '@/lib/supabase'
import { todayInTz } from '@/lib/date'
import { pickVerse } from '@/lib/pickVerse'
import { oneLine, withPeriod } from '@/lib/text'

/**
 * Šalje stih dana. Radi SVAKI SAT, ne jednom dnevno — tako podržava
 * različita vremena po korisniku i preživljava prelazak na ljetno vrijeme.
 *
 * Okidač: GitHub Actions (besplatno) ili Vercel Cron (Pro).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH = 100

/**
 * PRIVREMENO — režim testiranja.
 *
 * `true` znači: svaki poziv rute šalje stih SVIMA, bez obzira na doba dana.
 * Tako "Test run" iz cron konzole uvijek stvarno pošalje.
 *
 * Za povratak na jednom dnevno, u korisnikovih 12h, vrati na `false`.
 * Dok je ovo `true`, satni raspored u .github/workflows/daily-push.yml MORA
 * ostati pauziran — inače svaki pretplatnik dobije stih svakih sat vremena.
 */
const ALWAYS_SEND = true

function hourIn(tz: string): number {
  try {
    return Number(
      new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date()),
    )
  } catch {
    return -1
  }
}

/**
 * Prihvata oba načina slanja tajne:
 *   x-cron-secret: <tajna>            (cron-job.org, curl)
 *   Authorization: Bearer <tajna>     (Vercel Cron)
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  if (req.headers.get('x-cron-secret') === secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

/** Vanjski cron servisi često šalju GET — isto radi. */
export async function GET(req: Request) {
  return POST(req)
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'neautorizovano' }, { status: 401 })
  }

  // ?force=1 preskače provjeru sata (za testiranje)
  // ?dry=1   ništa ne šalje, samo javi kome bi otišlo
  const q = new URL(req.url).searchParams
  const force = q.get('force') === '1'
  const dry = q.get('dry') === '1'

  const db = supabase()
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!db || !pub || !priv) {
    return NextResponse.json({ error: 'push nije konfigurisan' }, { status: 503 })
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:noreply@example.com', pub, priv)

  const { data, error } = await db.from('push_subscriptions').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const all = data as PushRow[]
  const today = todayInTz()

  /**
   * Nema pamćenja "već poslano danas". Dok je `ALWAYS_SEND` uključen, svaki
   * poziv šalje svima; inače šalje samo onima kojima je lokalno tačno njihov
   * sat, pa se u redovnom radu stih poklopi jednom dnevno.
   */
  const due = force || ALWAYS_SEND ? all : all.filter((s) => hourIn(s.tz) === s.send_hour)
  const verse = pickVerse(today)

  if (dry) {
    return NextResponse.json({
      dry: true,
      date: today,
      verse: verse.id,
      subscribers: all.length,
      due: due.length,
      hours: all.map((s) => ({ tz: s.tz, now: hourIn(s.tz), sendHour: s.send_hour })),
    })
  }

  if (due.length === 0) {
    return NextResponse.json({ sent: 0, due: 0, subscribers: all.length, date: today })
  }
  const payload = JSON.stringify({
    title: 'Stih dana — Dino Merlin',
    // Stih se prelama u više redova; u notifikaciji mora stati u jedan,
    // inače se vidi samo prva polovina.
    body: oneLine(withPeriod(verse.text)),
    url: '/',
    tag: `stih-${today}`,
  })

  let sent = 0
  const dead: string[] = []
  const ok: string[] = []

  for (let i = 0; i < due.length; i += BATCH) {
    const results = await Promise.allSettled(
      due.slice(i, i + BATCH).map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 12 * 3600 },
        ),
      ),
    )
    results.forEach((r, j) => {
      if (r.status === 'fulfilled') {
        sent++
        ok.push(due[i + j].endpoint)
      } else {
        const code = (r.reason as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) dead.push(due[i + j].endpoint)
      }
    })
  }

  // `last_ok` je samo dijagnostika — kad je uređaj zadnji put nešto primio.
  if (ok.length) {
    await db
      .from('push_subscriptions')
      .update({ last_ok: new Date().toISOString() })
      .in('endpoint', ok)
  }

  // mrtvi uređaji se brišu odmah — inače lista truli
  if (dead.length) await db.from('push_subscriptions').delete().in('endpoint', dead)

  return NextResponse.json({
    date: today,
    verse: verse.id,
    subscribers: all.length,
    due: due.length,
    sent,
    removed: dead.length,
  })
}
