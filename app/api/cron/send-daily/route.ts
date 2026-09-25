import { Agent } from 'node:https'
import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabase } from '@/lib/supabase'
import { todayInTz } from '@/lib/date'
import { pickVerse } from '@/lib/pickVerse'
import { oneLine, withPeriod } from '@/lib/text'

/**
 * Šalje stih dana. Radi SVAKI SAT, ne jednom dnevno — tako podržava
 * različita vremena po korisniku i preživljava prelazak na ljetno vrijeme.
 *
 * Okidač: GitHub Actions (besplatno) ili Vercel Cron (Pro).
 *
 * ── Oblik posla ──────────────────────────────────────────────────────
 * Jedan zahtjev ne može poslati desetak hiljada obavijesti: svaka je
 * zasebno šifrovanje plus zasebna HTTPS runda do Googlea ili Applea, a
 * serverless funkcija ima tvrd rok. Zato se posao dijeli:
 *
 *   dispatcher  odredi koliko ih je na redu i podigne N paralelnih workera
 *   worker      u petlji uzima porciju iz baze i šalje je
 *
 * Ko šta šalje ne dogovara se ovdje nego u bazi: `claim_due_subscriptions`
 * u jednoj transakciji uzme porciju i odmah je označi kao poslanu
 * (`for update skip locked`). Dva workera zato ne mogu dobiti istog
 * čovjeka, a ni dva cron prolaza koja se preklope.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Koliko pretplatnika worker uzme iz baze odjednom. */
const BATCH = 250

/** Koliko obavijesti jedan worker drži u zraku istovremeno. */
const CONCURRENCY = 40

/** Iznad ovoliko na redu, dispatcher dijeli posao umjesto da ga radi sam. */
const INLINE_LIMIT = 400

/** Ciljano opterećenje po workeru i gornja granica paralelizma. */
const PER_WORKER = 1500
const MAX_WORKERS = 8

/** Koliko sekundi ostaviti za uredan završetak prije `maxDuration`. */
const WORKER_BUDGET_MS = 45_000
const DISPATCH_BUDGET_MS = 52_000

/**
 * Bez ovoga svaka obavijest plaća novi TLS handshake prema push servisu.
 * Na deset hiljada poruka to je nekoliko minuta čistog čekanja na mrežu;
 * s održanom vezom isti posao stane u nekoliko sekundi.
 */
const agent = new Agent({ keepAlive: true, keepAliveMsecs: 10_000, maxSockets: CONCURRENCY })

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

function configureVapid(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:noreply@example.com', pub, priv)
  return true
}

/** Adresa preko koje ruta zove samu sebe kad dijeli posao. */
function selfOrigin(req: Request): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return new URL(req.url).origin
}

/**
 * N poslova, najviše `size` u zraku. Ne fiksni blokovi — kod blokova cijela
 * grupa čeka najsporiji zahtjev u njoj, a jedan uspavan push servis tako
 * lako udvostruči ukupno vrijeme.
 */
async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < items.length) await fn(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
}

type Row = { endpoint: string; p256dh: string; auth: string }
type Tally = { sent: number; removed: number; retry: number; failed: number; batches: number }

const emptyTally = (): Tally => ({ sent: 0, removed: 0, retry: 0, failed: 0, batches: 0 })

function add(a: Tally, b: Tally): Tally {
  return {
    sent: a.sent + b.sent,
    removed: a.removed + b.removed,
    retry: a.retry + b.retry,
    failed: a.failed + b.failed,
    batches: a.batches + b.batches,
  }
}

/**
 * Jedna porcija: pošalji i razvrstaj ishode.
 *
 *   404/410  uređaj više ne postoji  → briše se
 *   429/5xx  prolazno kod servisa    → oznaka slanja se povuče, ide u idući prolaz
 *   ostalo   naša greška (npr. pogrešan VAPID ključ) → ostaje označeno
 *
 * Zadnji slučaj je namjerno bez ponavljanja: da se i on vraća u red, jedna
 * pogrešna varijabla okoline značila bi da ruta u krug gađa sve pretplatnike.
 * Ovako greška stoji u `last_error` i u odgovoru, a niko ne dobije ništa dva puta.
 */
async function sendBatch(rows: Row[], payload: string): Promise<Tally> {
  const t = emptyTally()
  const ok: string[] = []
  const dead: string[] = []
  const retry: string[] = []
  let firstError: string | null = null

  await pool(rows, CONCURRENCY, async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 12 * 3600, agent, urgency: 'normal' },
      )
      ok.push(s.endpoint)
    } catch (e) {
      const err = e as { statusCode?: number; body?: string; message?: string }
      const code = err?.statusCode ?? 0
      if (code === 404 || code === 410) {
        dead.push(s.endpoint)
      } else if (code === 429 || code >= 500) {
        retry.push(s.endpoint)
        firstError ??= `${code} ${err.body ?? err.message ?? ''}`.trim().slice(0, 300)
      } else {
        t.failed++
        firstError ??= `${code} ${err.body ?? err.message ?? ''}`.trim().slice(0, 300)
      }
    }
  })

  t.sent = ok.length
  t.removed = dead.length
  t.retry = retry.length
  t.batches = 1

  const db = supabase()
  if (db && (ok.length || dead.length || retry.length)) {
    const { error } = await db.rpc('finish_push_batch', {
      p_ok: ok,
      p_dead: dead,
      p_retry: retry,
      p_error: firstError,
    })
    // Neuspjeh ovdje ne smije srušiti prolaz: obavijesti su već otišle.
    if (error) console.error('finish_push_batch:', error.message)
  }

  return t
}

/**
 * Worker: uzimaj porciju i šalji dok ima posla ili dok ima vremena.
 * Prekid po budžetu nije gubitak — neposlani ostaju neoznačeni i pokupi ih
 * sljedeći prolaz, jer je uslov "kome je vrijeme" `>=` a ne `=`.
 */
async function runWorker(run: string, force: boolean, payload: string, deadline: number) {
  const db = supabase()
  if (!db) return { ...emptyTally(), error: 'baza nije konfigurisana' }

  let total = emptyTally()
  let truncated = false

  for (;;) {
    if (Date.now() > deadline) {
      truncated = true
      break
    }

    const { data, error } = await db.rpc('claim_due_subscriptions', {
      p_run: run,
      p_limit: BATCH,
      p_force: force,
    })
    if (error) return { ...total, error: error.message }

    // Prekid ide isključivo na praznu porciju. Manja porcija od tražene ne
    // znači da je red prazan — znači i da drugi worker trenutno drži te redove
    // zaključanim. Da se tu stalo, posao bi pod paralelizmom znao ostati
    // nedovršen tačno onda kad je najviše ljudi na redu.
    const rows = (data ?? []) as Row[]
    if (rows.length === 0) break

    total = add(total, await sendBatch(rows, payload))
  }

  return { ...total, truncated }
}

/** Vanjski cron servisi često šalju GET — isto radi. */
export async function GET(req: Request) {
  return POST(req)
}

export async function POST(req: Request) {
  const started = Date.now()

  if (!authorized(req)) {
    return NextResponse.json({ error: 'neautorizovano' }, { status: 401 })
  }

  const db = supabase()
  if (!db) return NextResponse.json({ error: 'baza nije konfigurisana' }, { status: 503 })
  if (!configureVapid()) {
    return NextResponse.json({ error: 'push nije konfigurisan' }, { status: 503 })
  }

  // ?force=1  preskače provjeru sata (za testiranje)
  // ?dry=1    ništa ne šalje, samo javi kome bi otišlo
  // ?worker=  interno: ovaj zahtjev je jedan od podignutih workera
  const q = new URL(req.url).searchParams
  const force = q.get('force') === '1'
  const dry = q.get('dry') === '1'
  const workerRun = q.get('worker')

  const today = todayInTz()
  const verse = pickVerse(today)
  const payload = JSON.stringify({
    title: 'Stih dana — Dino Merlin',
    // Stih se prelama u više redova; u notifikaciji mora stati u jedan,
    // inače se vidi samo prva polovina.
    body: oneLine(withPeriod(verse.text)),
    url: '/',
    tag: `stih-${today}`,
  })

  /* ── worker ──────────────────────────────────────────────────────── */

  if (workerRun) {
    const out = await runWorker(workerRun, force, payload, started + WORKER_BUDGET_MS)
    return NextResponse.json({ worker: workerRun, ...out, ms: Date.now() - started })
  }

  /* ── dispatcher ──────────────────────────────────────────────────── */

  const run = randomUUID()

  const { data: dueRaw, error: countError } = await db.rpc('count_due_subscriptions', {
    p_run: run,
    p_force: force,
  })
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
  const due = Number(dueRaw ?? 0)

  if (dry) {
    const { count } = await db
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })
    return NextResponse.json({
      dry: true,
      date: today,
      verse: verse.id,
      subscribers: count ?? 0,
      due,
      workers: due <= INLINE_LIMIT ? (due ? 1 : 0) : Math.min(MAX_WORKERS, Math.ceil(due / PER_WORKER)),
    })
  }

  if (due === 0) {
    return NextResponse.json({ date: today, verse: verse.id, due: 0, sent: 0, ms: Date.now() - started })
  }

  // Mali broj na redu se odradi odmah — dijeljenje posla bi tu koštalo više
  // nego što donese.
  if (due <= INLINE_LIMIT) {
    const out = await runWorker(run, force, payload, started + DISPATCH_BUDGET_MS)
    return NextResponse.json({
      date: today,
      verse: verse.id,
      due,
      workers: 1,
      ...out,
      ms: Date.now() - started,
    })
  }

  const workers = Math.min(MAX_WORKERS, Math.ceil(due / PER_WORKER))
  const origin = selfOrigin(req)
  const secret = process.env.CRON_SECRET as string

  const url = new URL('/api/cron/send-daily', origin)
  url.searchParams.set('worker', run)
  if (force) url.searchParams.set('force', '1')

  const results = await Promise.allSettled(
    Array.from({ length: workers }, () =>
      fetch(url, {
        method: 'POST',
        headers: { 'x-cron-secret': secret },
        cache: 'no-store',
      }).then((r) => r.json() as Promise<Tally & { error?: string; truncated?: boolean }>),
    ),
  )

  let total = emptyTally()
  const errors: string[] = []
  let truncated = false

  for (const r of results) {
    if (r.status === 'fulfilled') {
      total = add(total, { ...emptyTally(), ...r.value })
      if (r.value.error) errors.push(r.value.error)
      if (r.value.truncated) truncated = true
    } else {
      errors.push(String((r.reason as Error)?.message ?? r.reason))
    }
  }

  return NextResponse.json({
    date: today,
    verse: verse.id,
    due,
    workers,
    ...total,
    ...(truncated ? { truncated: true } : {}),
    ...(errors.length ? { errors } : {}),
    ms: Date.now() - started,
  })
}
