import { createPublicKey, randomUUID, verify, type KeyObject } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { PROBA_PATH, TIPOVI, hasCronSecret, isOznaka, probaDay, probaOn, probaTip, type Tip } from '@/lib/proba'

/**
 * Lažni push servis za probu opterećenja (scripts/proba-5000.mjs). Radi na
 * Vercelu — proba ide direktno na produkciju — a lokalno (`next dev`) je
 * 404. Glumi FCM/Apple/Mozilla: lažna pretplata nosi ponašanje u adresi,
 *
 *   POST /api/proba-push?id=17&tip=prolazno&p=<oznaka>
 *
 * i dobije odgovor kakav bi dao pravi servis:
 *
 *   ok        201 za 50–400 ms
 *   sporo     201 za 2–4 s
 *   prolazno  503 ili 201, pola-pola
 *   gust      429 + Retry-After: 1, ili 201, pola-pola
 *   mrtva     410 — pošiljalac je mora obrisati
 *   visi      ne odgovara 9,5 s (pošiljalac odustaje na 8 s)
 *
 * Kao pravi servis traži `Authorization: vapid t=…, k=…` s potpisom našeg
 * VAPID ključa i `Content-Encoding: aes128gcm` — inače 400/403. Taj potpis
 * pravi samo naš server, pa niko drugi ne može natjerati prijemnik da radi.
 *
 * Uz tajnu za cron (x-cron-secret):
 *   GET  ?provjera=1                       je li deploy spreman za probu
 *   GET  ?izvjestaj=dan:2099-MM-DD&p=<o>   po tipu: koliko ih je u bazi, kome je stiglo
 *   POST ?ocisti=1[&p=<o>]                 briše lažne pretplate (bez `p`: sve probe)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const between = (a: number, b: number) => a + Math.random() * (b - a)

const status = (code: number, headers?: Record<string, string>) => new Response(null, { status: code, headers })
const notFound = () => status(404)

/** `like` uzorak za lažne pretplate — jedne probe ili svih. */
const pattern = (p?: string) => (p ? `%${PROBA_PATH}?%&p=${p}` : `%${PROBA_PATH}?%`)

export async function POST(req: Request) {
  if (!probaOn()) return notFound()
  const q = new URL(req.url).searchParams
  if (q.has('ocisti')) return cleanup(req, q)
  return pushService(req, q)
}

export async function GET(req: Request) {
  if (!probaOn()) return notFound()
  const q = new URL(req.url).searchParams
  if (!hasCronSecret(req)) return NextResponse.json({ error: 'neautorizovano' }, { status: 401 })
  if (q.has('izvjestaj')) return report(q)
  if (q.has('provjera')) return preflight()
  // pravi push servis prima samo POST
  return status(405, { Allow: 'POST' })
}

/* ── lažni push servis ─────────────────────────────────────────────── */

async function pushService(req: Request, q: URLSearchParams): Promise<Response> {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('vapid t=') || req.headers.get('content-encoding') !== 'aes128gcm') {
    return new Response('traži Authorization: vapid t=…, k=… i Content-Encoding: aes128gcm', { status: 400 })
  }
  if (!vapidOk(auth)) return new Response('VAPID potpis ne odgovara našem ključu', { status: 403 })

  const body = await req.arrayBuffer()
  // šifrovan sadržaj: zaglavlje aes128gcm je 86 bajtova; servisi primaju do 4 KB
  if (body.byteLength < 87 || body.byteLength > 4096) return new Response('neispravan sadržaj', { status: 400 })

  switch (q.get('tip') as Tip | null) {
    case 'mrtva':
      return status(410)
    case 'visi':
      await sleep(9_500)
      return status(201)
    case 'sporo':
      await sleep(between(2_000, 4_000))
      return status(201)
    case 'prolazno':
      await sleep(between(50, 300))
      return status(Math.random() < 0.5 ? 503 : 201)
    case 'gust':
      await sleep(between(50, 300))
      return Math.random() < 0.5 ? status(429, { 'Retry-After': '1' }) : status(201)
    default:
      await sleep(between(50, 400))
      return status(201)
  }
}

let vapidKey: { raw: string; key: KeyObject } | null = null

/** ES256 potpis JWT-a iz `vapid t=<jwt>, k=<javni ključ>`, kao kod pravog servisa. */
function vapidOk(auth: string): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!pub) return false
  const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w=-]+)$/.exec(auth)
  if (!m || m[4] !== pub) return false
  try {
    const claims = JSON.parse(Buffer.from(m[2], 'base64url').toString('utf8')) as { exp?: unknown }
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return false
    if (vapidKey?.raw !== pub) {
      // nekomprimovana P-256 tačka: 0x04 ‖ X (32) ‖ Y (32)
      const b = Buffer.from(pub, 'base64url')
      const key = createPublicKey({
        key: { kty: 'EC', crv: 'P-256', x: b.subarray(1, 33).toString('base64url'), y: b.subarray(33, 65).toString('base64url') },
        format: 'jwk',
      })
      vapidKey = { raw: pub, key }
    }
    return verify(
      'sha256',
      Buffer.from(`${m[1]}.${m[2]}`),
      { key: vapidKey.key, dsaEncoding: 'ieee-p1363' },
      Buffer.from(m[3], 'base64url'),
    )
  } catch {
    return false
  }
}

/* ── izvještaj ─────────────────────────────────────────────────────── */

async function report(q: URLSearchParams): Promise<Response> {
  const dan = probaDay(q.get('izvjestaj')?.replace(/^dan:/, ''))
  const p = q.get('p')
  if (!dan || !isOznaka(p)) {
    return NextResponse.json({ error: 'treba izvjestaj=dan:2099-MM-DD i p=<oznaka>' }, { status: 400 })
  }
  const db = supabase()
  if (!db) return NextResponse.json({ error: 'baza nije konfigurisana' }, { status: 503 })

  const tipovi = Object.fromEntries(TIPOVI.map((t) => [t, { pretplata: 0, stiglo: 0 }])) as Record<
    Tip,
    { pretplata: number; stiglo: number }
  >
  const greske: Record<string, number> = {}
  let posudjeno = 0

  // Supabase vraća najviše `db-max-rows` redova po upitu (obično 1000), bez
  // greške — zato stranice, do prve prazne.
  for (let from = 0; ; ) {
    const { data, error } = await db
      .from('push_subscriptions')
      .select('endpoint,last_sent_on,claimed_at,last_error')
      .like('endpoint', pattern(p))
      .order('endpoint')
      .range(from, from + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const rows = (data ?? []) as { endpoint: string; last_sent_on: string | null; claimed_at: string | null; last_error: string | null }[]
    if (!rows.length) break
    for (const r of rows) {
      const tip = probaTip(r.endpoint)
      if (!tip) continue
      tipovi[tip].pretplata++
      if (r.last_sent_on === dan) {
        tipovi[tip].stiglo++
        continue
      }
      if (r.last_error) {
        const k = `${tip}: ${r.last_error.slice(0, 60)}`
        greske[k] = (greske[k] ?? 0) + 1
      }
      // neisporučen, a još posuđen: slanje je prekinuto usred porcije
      if (r.claimed_at && Date.now() - Date.parse(r.claimed_at) < 120_000) posudjeno++
    }
    from += rows.length
  }

  return NextResponse.json({ dan, p, tipovi, posudjeno, greske })
}

/* ── čišćenje ──────────────────────────────────────────────────────── */

async function cleanup(req: Request, q: URLSearchParams): Promise<Response> {
  if (!hasCronSecret(req)) return NextResponse.json({ error: 'neautorizovano' }, { status: 401 })
  const p = q.get('p')
  if (p !== null && !isOznaka(p)) return NextResponse.json({ error: 'neispravna oznaka' }, { status: 400 })
  const db = supabase()
  if (!db) return NextResponse.json({ error: 'baza nije konfigurisana' }, { status: 503 })

  // samo adrese ovog prijemnika — prave pretplate ne mogu ni odgovarati uzorku
  const { error, count } = await db
    .from('push_subscriptions')
    .delete({ count: 'exact' })
    .like('endpoint', pattern(p ?? undefined))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ obrisano: count ?? 0, p: p ?? 'sve probe' })
}

/* ── je li deploy spreman ──────────────────────────────────────────── */

async function preflight(): Promise<Response> {
  const db = supabase()
  const out = {
    ok: false,
    env: process.env.VERCEL_ENV ?? null,
    baza: Boolean(db),
    vapid: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    zaobilaznica: Boolean(process.env.VERCEL_AUTOMATION_BYPASS_SECRET),
    shema: false,
    brava: false,
    zaostale: 0,
    greska: undefined as string | undefined,
  }
  if (db) {
    // novi potpisi iz supabase/schema.sql (p_proba, brava)
    const c = await db.rpc('count_due_subscriptions', {
      p_run: randomUUID(),
      p_today: '2099-01-01',
      p_force: false,
      p_proba: 'provjera',
    })
    out.shema = !c.error
    const l = await db.rpc('release_push_lock', { p_name: 'provjera', p_holder: randomUUID() })
    out.brava = !l.error
    out.greska = c.error?.message ?? l.error?.message
    const z = await db.from('push_subscriptions').select('*', { count: 'exact', head: true }).like('endpoint', pattern())
    out.zaostale = z.count ?? 0
  }
  out.ok = out.baza && out.vapid && out.shema && out.brava
  return NextResponse.json(out)
}
