import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { SEND_HOUR, TZ, hourInTz, todayInTz } from '@/lib/date'
import { INVITE } from '@/lib/notify'
import { PROBA_PATH, bypassHeaders, isOznaka, probaDay, probaHour, probaOn } from '@/lib/proba'
import { addTally, emptyTally, sendAll, type Row, type SendResult, type Store, type Tally } from '@/lib/push-send'

/**
 * Šalje dnevni poziv: "Vrijeme je za stih dana! Uzmi svoj!".
 *
 * Svako izvlači svoj stih u aplikaciji (lib/draw.ts), pa obavijest ne nosi
 * stih nego poziv — ista poruka za sve, bez ijednog čitanja stihova
 * (lib/notify.ts).
 *
 * O VREMENU ODLUČUJE OKIDAČ — ruta samo pazi na sarajevski sat: šalje tek od
 * podneva (do 14h). Ljetno/zimsko vrijeme tako ne pomjera obavijest: okidač
 * smije zvati i u 10:00 i u 11:00 UTC (podne ljeti i zimi), raniji poziv samo
 * javi da nije vrijeme. Kad god se pozove u tom roku, šalje svima koji još
 * nisu dobili stih za taj dan. Raspored crona je jedino mjesto gdje se
 * podešava kad to biva — ranije je uslov stajao i u upitu, pa se vrijeme
 * mijenjalo na dva mjesta i lako razilazilo.
 *
 * Zato je ruta napravljena da se smije zvati koliko god puta: pozovi je
 * deset puta u toku dana i obavijest ode najviše jednom. To je i cijela
 * odbrana od propuštenog dana — okidač pokušava više puta, prvi uspjeh
 * zatvori dan, ostali zateknu prazan red.
 *
 * DAN ZATVARA SAMO USPJEH. `last_sent_on` se upisuje tek kad push servis
 * primi obavijest, nikad pri preuzimanju porcije. Ranije je oznaku
 * postavljalo preuzimanje — pa je svaki pad između preuzimanja i slanja, i
 * svaki test, značio da pravi prolaz zatekne prazan red i mirno javi da je
 * sve poslano. Ono što ne prođe ostaje neoznačeno i čeka sljedeći poziv.
 * `last_sent_on` je tako i dnevnik isporuka: jedan red po (pretplata, dan),
 * pa duplikat za isti dan ne može ni nastati.
 *
 * `?force=1` zato NE troši dan: obavijest ode, ali oznaka se ne upisuje, pa
 * pravo slanje u podne i dalje ima kome otići.
 *
 * Okidač: cron-job.org, GitHub Actions ili Vercel Cron (Pro).
 *
 * ── Oblik posla ──────────────────────────────────────────────────────
 * Jedan zahtjev ne može poslati desetak hiljada obavijesti: svaka je
 * zasebno šifrovanje plus zasebna HTTPS runda do Googlea ili Applea, a
 * serverless funkcija ima tvrd rok. Zato se posao dijeli:
 *
 *   dispatcher  uzme bravu, odredi koliko ih je na redu i podigne N
 *               paralelnih workera
 *   worker      bazen od 100 obavijesti u zraku, s timeoutom i ponovnim
 *               pokušajima (lib/push-send.ts)
 *
 * Ko šta šalje ne dogovara se ovdje nego u bazi: `claim_due_subscriptions`
 * u jednoj transakciji uzme porciju i posudi je (`for update skip locked`).
 * Dva workera zato ne mogu dobiti istog čovjeka, a ni dva cron prolaza koja
 * se preklope. Brava (`take_push_lock`) uz to drži da dva slanja ne idu
 * istovremeno — u produkciji "otvorenih vrata": ako brava ne radi, slanje
 * ide bez nje, jer bi propušten dan bio gori od dvostrukog posla.
 *
 * ── Proba opterećenja ───────────────────────────────────────────────
 * `?proba=<oznaka>&dan=2099-MM-DD&sat=12` (uz tajnu, kao svaki poziv) šalje
 * SAMO lažnim pretplatama te probe (scripts/proba-5000.mjs, lib/proba.ts),
 * za izmišljen dan i po glumljenom satu. Pravi korisnici tad ne dobiju
 * ništa, a pravo slanje lažne nikad ne dira — baza ih drži odvojeno.
 * Lokalno (`next dev`) se ti parametri ignorišu.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Iznad ovoliko na redu, dispatcher dijeli posao umjesto da ga radi sam. */
const INLINE_LIMIT = 400

/** Ciljano opterećenje po workeru i gornja granica paralelizma (svaki drži 100 u zraku). */
const PER_WORKER = 2000
const MAX_WORKERS = 6

/** Rokovi, s rezervom za uredan završetak prije `maxDuration`. */
const WORKER_BUDGET_MS = 47_000
const DISPATCH_BUDGET_MS = 52_000

/** Brava: rok duži od `maxDuration`, pa je funkcija koja padne ne zaključa zauvijek. */
const LOCK = 'slanje'
const LOCK_TTL_S = 90
/** Koliko poziv čeka da drugo slanje završi prije nego odustane. */
const LOCK_WAIT_MS = 10_000

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

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

/**
 * Adresa preko koje ruta zove samu sebe kad dijeli posao. Prvo ona preko
 * koje je okidač stigao — javna, bez Vercelove zaštite. Adresa jednog
 * deploya (VERCEL_URL) zna biti iza prijave (401), pa workeri ne bi krenuli.
 */
function selfOrigin(req: Request): string {
  const own = new URL(req.url).origin
  if (!process.env.VERCEL || !/\/\/(localhost|127\.0\.0\.1)(:|$)/.test(own)) return own
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : own
}

const workersFor = (due: number) => (due <= INLINE_LIMIT ? (due ? 1 : 0) : Math.min(MAX_WORKERS, Math.ceil(due / PER_WORKER)))

/**
 * Baza iz ugla slanja.
 *
 *   uspjeh   → upisuje se `today` (sarajevski datum) i dan je zatvoren
 *   404/410  uređaj više ne postoji  → briše se
 *   ostalo   ostaje neoznačen; `last_run` ga drži van ovog prolaza, pa ga
 *            pokupi tek sljedeći poziv rute
 *
 * `p_proba` ide samo na probi: produkcija zove isti potpis kao prije, pa
 * radi i dok supabase/schema.sql još nije pokrenut ponovo.
 */
function dbStore(db: SupabaseClient, run: string, today: string, force: boolean, proba: string | null): Store {
  return {
    async claim(limit) {
      const { data, error } = await db.rpc('claim_due_subscriptions', {
        p_run: run,
        p_today: today,
        p_limit: limit,
        p_force: force,
        ...(proba ? { p_proba: proba } : {}),
      })
      if (error) throw new Error(error.message)
      return (data ?? []) as Row[]
    },
    async finish({ ok, dead, retry, error }) {
      const { error: e } = await db.rpc('finish_push_batch', {
        p_ok: ok,
        p_dead: dead,
        p_retry: retry,
        p_error: error,
        // `?force=1` ne troši dan — da test ne pojede pravo slanje
        p_today: force ? null : today,
      })
      if (e) throw new Error(e.message)
    },
  }
}

function runSend(
  db: SupabaseClient,
  run: string,
  today: string,
  force: boolean,
  proba: string | null,
  payload: string,
  deadline: number,
): Promise<SendResult> {
  return sendAll(dbStore(db, run, today, force, proba), {
    payload,
    deadline,
    // lažni push servis je na ovom (zaštićenom) preview deployu
    headersFor: (endpoint) => (endpoint.includes(`${PROBA_PATH}?`) ? bypassHeaders() : undefined),
  })
}

type Lock = { taken: boolean; busy?: boolean; skipped?: string; error?: string }

/**
 * Drugo slanje u toku → čekaj do `LOCK_WAIT_MS`. Greška same brave: u
 * produkciji se šalje bez nje (preuzimanje porcija ionako ne da duplikat),
 * na probi (`strict`) je to greška — proba i provjerava bravu.
 */
async function takeLock(db: SupabaseClient, holder: string, strict: boolean): Promise<Lock> {
  const giveUp = Date.now() + LOCK_WAIT_MS
  for (;;) {
    const { data, error } = await db.rpc('take_push_lock', { p_name: LOCK, p_holder: holder, p_seconds: LOCK_TTL_S })
    if (error) {
      if (strict) return { taken: false, error: `brava: ${error.message} — pokreni supabase/schema.sql` }
      console.error('take_push_lock:', error.message)
      return { taken: false, skipped: error.message }
    }
    if (data === true) return { taken: true }
    if (Date.now() + 1_500 > giveUp) return { taken: false, busy: true }
    await sleep(1_500)
  }
}

async function releaseLock(db: SupabaseClient, holder: string) {
  const { error } = await db.rpc('release_push_lock', { p_name: LOCK, p_holder: holder })
  if (error) console.error('release_push_lock:', error.message)
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

  // ?force=1  šalje i onima koji su stih za ovaj dan već dobili; NE upisuje
  //           oznaku dana, pa test ne može pojesti pravo slanje
  // ?dry=1    ništa ne šalje, samo javi kome bi otišlo
  // ?worker=  interno: ovaj zahtjev je jedan od podignutih workera (&rok= ms)
  // ?now=1    ručni test (GitHub → Run workflow) — bez provjere sata
  const q = new URL(req.url).searchParams
  const dry = q.get('dry') === '1'
  const workerRun = q.get('worker')

  // ?proba=<oznaka>&dan=2099-MM-DD&sat=12 — proba opterećenja (vidi gore)
  const probaParam = probaOn() ? q.get('proba') : null
  const proba = isOznaka(probaParam) ? probaParam : null
  if (probaParam !== null && !proba) {
    return NextResponse.json({ error: 'neispravna oznaka probe' }, { status: 400 })
  }
  const fakeDay = proba ? probaDay(q.get('dan')) : null
  if (proba && !fakeDay) {
    return NextResponse.json({ error: 'proba traži izmišljen dan: dan=2099-MM-DD' }, { status: 400 })
  }
  const fakeHour = proba ? probaHour(q.get('sat')) : null
  const force = !proba && q.get('force') === '1'

  // podne po sarajevskom satu — ljeti i zimi isto (vidi gore)
  if (!workerRun && !force && !dry && q.get('now') !== '1') {
    const h = fakeHour ?? hourInTz()
    // par minuta ranije je isto podne — okidač čiji sat malo žuri ne preskoči dan
    const m =
      fakeHour !== null
        ? 0
        : Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, minute: '2-digit' }).format(new Date()))
    const early = h === SEND_HOUR - 1 && m >= 55
    if (!early && (h < SEND_HOUR || h > SEND_HOUR + 2)) {
      return NextResponse.json({ skipped: `U Sarajevu je ${h}h — obavijest ide u ${SEND_HOUR}h`, due: 0 })
    }
  }

  const today = fakeDay ?? todayInTz()
  // poziv, ne stih — dodir otvara aplikaciju, a stih se tamo izvlači
  const payload = JSON.stringify({
    ...INVITE,
    url: '/',
    tag: `stih-${today}`,
  })

  /* ── worker ──────────────────────────────────────────────────────── */

  if (workerRun) {
    // rok dispatchera, da njegov odgovor stigne prije njegovog `maxDuration`
    const rok = Number(q.get('rok'))
    const deadline = Math.min(started + WORKER_BUDGET_MS, Number.isFinite(rok) && rok > started ? rok : Infinity)
    const out = await runSend(db, workerRun, today, force, proba, payload, deadline)
    return NextResponse.json({ worker: workerRun, ...out, ms: Date.now() - started })
  }

  /* ── dispatcher ──────────────────────────────────────────────────── */

  const run = randomUUID()

  const countDue = async () => {
    const { data, error } = await db.rpc('count_due_subscriptions', {
      p_run: run,
      p_today: today,
      p_force: force,
      ...(proba ? { p_proba: proba } : {}),
    })
    return { due: Number(data ?? 0), error }
  }

  if (dry) {
    const { due, error } = await countDue()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const { count } = await db.from('push_subscriptions').select('*', { count: 'exact', head: true })
    return NextResponse.json({ dry: true, date: today, subscribers: count ?? 0, due, workers: workersFor(due) })
  }

  const lock = await takeLock(db, run, proba !== null)
  if (lock.error) return NextResponse.json({ error: lock.error }, { status: 503 })
  if (lock.busy) {
    // nije greška: drugo slanje radi isti posao
    return NextResponse.json({
      date: today,
      busy: true,
      note: 'drugo slanje je u toku — ovaj poziv ne šalje ništa',
      ms: Date.now() - started,
    })
  }
  const lockNote = lock.skipped ? { brava: `bez brave (${lock.skipped.slice(0, 120)})` } : {}

  try {
    const { due, error: countError } = await countDue()
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })

    if (due === 0) {
      // Odgovor sam kaže zašto je prazan — inače `due: 0` izgleda kao kvar,
      // a najčešće znači da je stih za ovaj dan već otišao.
      return NextResponse.json({
        date: today,
        due: 0,
        sent: 0,
        note: force
          ? 'nema nijedne pretplate u bazi'
          : 'stih za ovaj dan je već poslan svima — ?force=1 šalje ponovo, bez diranja oznake dana',
        ...lockNote,
        ms: Date.now() - started,
      })
    }

    const deadline = started + DISPATCH_BUDGET_MS

    // Mali broj na redu se odradi odmah — dijeljenje posla bi tu koštalo više
    // nego što donese.
    if (due <= INLINE_LIMIT) {
      const out = await runSend(db, run, today, force, proba, payload, deadline)
      return NextResponse.json({
        date: today,
        ...(proba ? { proba } : {}),
        due,
        workers: 1,
        ...out,
        ...lockNote,
        ms: Date.now() - started,
      })
    }

    const workers = workersFor(due)
    const url = new URL('/api/cron/send-daily', selfOrigin(req))
    url.searchParams.set('worker', run)
    url.searchParams.set('rok', String(deadline - 2_000))
    if (force) url.searchParams.set('force', '1')
    if (proba) {
      url.searchParams.set('proba', proba)
      url.searchParams.set('dan', today)
    }

    const results = await Promise.allSettled(
      Array.from({ length: workers }, () =>
        fetch(url, {
          method: 'POST',
          headers: { 'x-cron-secret': process.env.CRON_SECRET as string, ...bypassHeaders() },
          cache: 'no-store',
          signal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())),
        }).then((r) => r.json() as Promise<Partial<Tally> & { error?: string; truncated?: boolean }>),
      ),
    )

    let total = emptyTally()
    const errors: string[] = []
    let truncated = false

    for (const r of results) {
      if (r.status === 'fulfilled') {
        total = addTally(total, r.value)
        if (r.value.error) errors.push(r.value.error)
        if (r.value.truncated) truncated = true
      } else {
        errors.push(String((r.reason as Error)?.message ?? r.reason))
      }
    }

    // Nijedan worker nije ništa poslao (adresa iza zaštite, mreža, rok) —
    // dispatcher šalje sam, koliko stigne do svog roka. Ostatak (ako ga ima)
    // pokupi sljedeći poziv okidača: ruta se smije zvati više puta.
    if (!total.sent && errors.length) {
      const out = await runSend(db, run, today, force, proba, payload, deadline)
      total = addTally(total, out)
      if (out.error) errors.push(out.error)
      if (out.truncated) truncated = true
    }

    return NextResponse.json({
      date: today,
      ...(proba ? { proba } : {}),
      due,
      workers,
      ...total,
      ...(truncated ? { truncated: true } : {}),
      ...(errors.length ? { errors } : {}),
      ...lockNote,
      ms: Date.now() - started,
    })
  } finally {
    if (lock.taken) await releaseLock(db, run)
  }
}
