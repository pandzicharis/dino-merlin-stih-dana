import { Agent, request, type AgentOptions } from 'node:https'
import webpush from 'web-push'

/**
 * Slanje push obavijesti — jedan poziv rute (app/api/cron/send-daily).
 *
 *   BAZEN      `POOL` obavijesti u zraku. Čim jedna završi, kreće sljedeća —
 *              ne serije, jer kod serija cijela grupa čeka najsporiji uređaj.
 *              Porcije iz baze se dopunjavaju unaprijed, prije nego red
 *              presuši, pa bazen ne stoji dok čeka bazu.
 *   TIMEOUT    svaki pokušaj ima tvrd rok (`TIMEOUT_MS`), računajući i
 *              čekanje na vezu. Bez toga jedan zaglavljen push servis pojede
 *              cijelu funkciju.
 *   POKUŠAJI   prolazna greška (mreža, 429, 5xx) se ponovi do `ATTEMPTS`
 *              puta; 429 čeka koliko servis kaže (`Retry-After`). Ko i
 *              poslije toga ne prođe, dobije DRUGI KRUG na kraju poziva —
 *              tad je servis obično već došao sebi. Uređaj koji ne odgovara
 *              dobije samo jedan ponovni pokušaj: svaki košta `TIMEOUT_MS`.
 *   404/410    uređaja više nema — briše se odmah.
 *   ROK        ništa ne počinje ako ne može završiti prije `deadline`.
 *              Neposlano ostaje neoznačeno i pušta se odmah, pa ga sljedeći
 *              poziv rute pokupi (dan zatvara samo uspjeh).
 *
 * Ishodi se upisuju u bazu u hodu (`FLUSH_AT`), ne tek na kraju: funkcija
 * koja istekne ne odnese sa sobom stotine već poslanih.
 */

export type Row = { endpoint: string; p256dh: string; auth: string }

export type Tally = {
  /** primljeno kod push servisa — dan zatvoren */
  sent: number
  /** 404/410 — uređaj obrisan */
  removed: number
  /** prolazno (mreža, 429, 5xx, bez odgovora) — ostaje za sljedeći poziv */
  retry: number
  /** naša greška (ostali 4xx, neispravni ključevi) — ostaje, ali traži pogled */
  failed: number
  /** od `retry`: koliko uređaja nije odgovorilo na vrijeme */
  timeouts: number
  /** ukupno HTTP pokušaja */
  attempts: number
  /** preuzetih porcija iz baze */
  batches: number
}

export const emptyTally = (): Tally => ({
  sent: 0,
  removed: 0,
  retry: 0,
  failed: 0,
  timeouts: 0,
  attempts: 0,
  batches: 0,
})

export function addTally(a: Tally, b: Partial<Tally>): Tally {
  return {
    sent: a.sent + (b.sent ?? 0),
    removed: a.removed + (b.removed ?? 0),
    retry: a.retry + (b.retry ?? 0),
    failed: a.failed + (b.failed ?? 0),
    timeouts: a.timeouts + (b.timeouts ?? 0),
    attempts: a.attempts + (b.attempts ?? 0),
    batches: a.batches + (b.batches ?? 0),
  }
}

/** Baza iz ugla slanja (u ruti: claim_due_subscriptions / finish_push_batch). */
export type Store = {
  /** Porcija disjunktna sa svim drugim uzetim; prazna = nema više. Greška baca. */
  claim(limit: number): Promise<Row[]>
  /** Upis ishoda. Greška baca — slanje je zabilježi i ide dalje. */
  finish(r: { ok: string[]; dead: string[]; retry: string[]; error: string | null }): Promise<void>
}

export type SendConfig = {
  payload: string
  /** ms (Date.now()) — poslije ovoga ništa novo ne počinje */
  deadline: number
  /** dodatna zaglavlja po adresi (zaobilaznica Vercelove prijave na probi) */
  headersFor?: (endpoint: string) => Record<string, string> | undefined
  /** samo za lokalnu provjeru (npr. self-signed certifikat) */
  agentOptions?: AgentOptions
  pool?: number
  batch?: number
  timeoutMs?: number
}

export type SendResult = Tally & { truncated: boolean; error?: string }

export const POOL = 100
export const BATCH = 250
export const TIMEOUT_MS = 8_000
const ATTEMPTS = 3
/** Uređaj bez odgovora: ukupno ovoliko pokušaja u jednom pozivu. */
const TIMEOUT_ATTEMPTS = 2
/** Duže od ovoga se ne čeka — uređaj ide u sljedeći poziv. */
const RETRY_AFTER_MAX_MS = 2_000
const BACKOFF_MS = [300, 1_000]
const ROUND2_PAUSE_MS = 1_000
/** Rezerva za zadnji upis u bazu. */
const FINISH_RESERVE_MS = 3_000
/** Kraći pokušaj od ovoga nema smisla. */
const MIN_ATTEMPT_MS = 1_500
const FLUSH_AT = 250

type Attempt =
  | { kind: 'ok' }
  | { kind: 'dead' }
  | { kind: 'transient'; code: number; msg: string; retryAfterMs?: number; timeout?: boolean }
  | { kind: 'fatal'; code: number; msg: string }
  | { kind: 'unsent' }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

function retryAfterMs(h: string | string[] | undefined): number | undefined {
  const v = Array.isArray(h) ? h[0] : h
  if (!v) return undefined
  const s = Number(v)
  const ms = Number.isFinite(s) ? s * 1000 : Date.parse(v) - Date.now()
  return Number.isFinite(ms) ? Math.max(0, ms) : undefined
}

function classify(code: number, retryAfter: string | string[] | undefined, body: string): Attempt {
  if (code >= 200 && code < 300) return { kind: 'ok' }
  if (code === 404 || code === 410) return { kind: 'dead' }
  const msg = `${code} ${body}`.trim().slice(0, 300)
  if (code === 429 || code >= 500) return { kind: 'transient', code, msg, retryAfterMs: retryAfterMs(retryAfter) }
  return { kind: 'fatal', code, msg }
}

/**
 * Jedan pokušaj. Zahtjev se pravi ovdje, a ne preko `sendNotification`, jer
 * njen `timeout` je samo rok mirovanja utičnice: ne broji čekanje na vezu i
 * ne hvata servis koji odgovara kap po kap.
 */
function sendOnce(
  row: Row,
  payload: string,
  timeoutMs: number,
  agent: Agent,
  headers: Record<string, string> | undefined,
): Promise<Attempt> {
  let d: ReturnType<typeof webpush.generateRequestDetails>
  try {
    d = webpush.generateRequestDetails(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      payload,
      // `high`: Android (posebno Samsung) inače drži obavijest dok telefon
      // miruje i isporuči je tek kad se probudi — stih stigne sat-dva kasnije
      { TTL: 12 * 3600, urgency: 'high', ...(headers ? { headers } : {}) },
    )
  } catch (e) {
    // neispravni ključevi pretplate ili VAPID — ponavljanje ne pomaže
    return Promise.resolve({ kind: 'fatal', code: 0, msg: errMsg(e).slice(0, 300) })
  }

  return new Promise<Attempt>((resolve) => {
    let settled = false
    const done = (a: Attempt) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(a)
    }
    const req = request(
      d.endpoint,
      { method: d.method, headers: d.headers as Record<string, string | number>, agent },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (c: string) => {
          if (body.length < 300) body += c
        })
        res.on('end', () => done(classify(res.statusCode ?? 0, res.headers['retry-after'], body)))
        res.on('error', (e) => done({ kind: 'transient', code: 0, msg: errMsg(e) }))
      },
    )
    const timer = setTimeout(() => {
      done({ kind: 'transient', code: 0, timeout: true, msg: `bez odgovora ${Math.round(timeoutMs / 100) / 10} s` })
      req.destroy()
    }, timeoutMs)
    req.on('error', (e) => done({ kind: 'transient', code: 0, msg: errMsg(e) }))
    req.end(d.body ?? undefined)
  })
}

export async function sendAll(store: Store, cfg: SendConfig): Promise<SendResult> {
  const pool = cfg.pool ?? POOL
  const batch = cfg.batch ?? BATCH
  const timeoutMs = cfg.timeoutMs ?? TIMEOUT_MS
  const { deadline, payload } = cfg
  const agent = new Agent({ keepAlive: true, maxSockets: pool, ...cfg.agentOptions })

  const t = emptyTally()
  let truncated = false
  let error: string | undefined

  /* ── red i dopuna iz baze ─────────────────────────────────────────── */

  const queue: Row[] = []
  let exhausted = false
  let refilling: Promise<void> | null = null

  // Nova porcija samo ako ima vremena da se i pošalje.
  const claimReserve = timeoutMs + FINISH_RESERVE_MS

  const doRefill = async () => {
    if (deadline - Date.now() < claimReserve) {
      truncated = true
      exhausted = true
      return
    }
    try {
      const rows = await store.claim(batch)
      if (rows.length === 0) exhausted = true
      else {
        t.batches++
        queue.push(...rows)
      }
    } catch (e) {
      error ??= errMsg(e)
      exhausted = true
    }
  }

  const refill = () => (refilling ??= doRefill().finally(() => (refilling = null)))

  const next = async (): Promise<Row | null> => {
    for (;;) {
      if (queue.length) {
        // dopuni prije nego presuši
        if (queue.length <= pool && !exhausted) void refill()
        return queue.shift()!
      }
      if (exhausted) return null
      await refill()
    }
  }

  /* ── upis ishoda u hodu ────────────────────────────────────────────── */

  const ok: string[] = []
  const dead: string[] = []
  const again: string[] = []
  let chunkError: string | null = null
  let flushing: Promise<void> = Promise.resolve()

  const flush = (all: boolean) => {
    if (!all && ok.length + dead.length + again.length < FLUSH_AT) return
    if (!ok.length && !dead.length && !again.length) return
    const chunk = { ok: ok.splice(0), dead: dead.splice(0), retry: again.splice(0), error: chunkError }
    chunkError = null
    // Neuspjeh ovdje ne smije srušiti slanje: obavijesti su već otišle. Dan
    // tad ostaje otvoren i sljedeći poziv ih pošalje još jednom — ista `tag`
    // oznaka na telefonu samo zamijeni staru obavijest.
    flushing = flushing.then(() => store.finish(chunk)).catch((e) => {
      error ??= `upis ishoda: ${errMsg(e)}`
    })
  }

  /* ── jedan uređaj ──────────────────────────────────────────────────── */

  const timeoutsOf = new Map<string, number>()

  const deliver = async (row: Row): Promise<Attempt> => {
    let last: Attempt = { kind: 'unsent' }
    for (let i = 0; i < ATTEMPTS; i++) {
      const left = deadline - Date.now() - FINISH_RESERVE_MS
      if (left < MIN_ATTEMPT_MS) return last
      t.attempts++
      // sinhrona greška pri pravljenju zahtjeva ne smije srušiti cijeli bazen
      last = await sendOnce(row, payload, Math.min(timeoutMs, left), agent, cfg.headersFor?.(row.endpoint)).catch(
        (e: unknown): Attempt => ({ kind: 'fatal', code: 0, msg: errMsg(e).slice(0, 300) }),
      )
      if (last.kind !== 'transient') return last
      if (last.timeout) {
        const n = (timeoutsOf.get(row.endpoint) ?? 0) + 1
        timeoutsOf.set(row.endpoint, n)
        if (n >= TIMEOUT_ATTEMPTS) return last
      }
      if (i === ATTEMPTS - 1) break
      if (last.retryAfterMs !== undefined && last.retryAfterMs > RETRY_AFTER_MAX_MS) return last
      const wait = (last.retryAfterMs ?? BACKOFF_MS[i]) + Math.random() * 200
      if (Date.now() + wait + MIN_ATTEMPT_MS + FINISH_RESERVE_MS > deadline) return last
      await sleep(wait)
    }
    return last
  }

  /** drugi krug: prolazna greška i vrijeme kad je pala */
  const later: { row: Row; at: number }[] = []

  const settle = (row: Row, a: Attempt, firstRound: boolean) => {
    switch (a.kind) {
      case 'ok':
        ok.push(row.endpoint)
        t.sent++
        break
      case 'dead':
        dead.push(row.endpoint)
        t.removed++
        break
      case 'fatal':
        again.push(row.endpoint)
        t.failed++
        chunkError ??= a.msg
        break
      case 'unsent':
        // nije stigao na red prije roka
        again.push(row.endpoint)
        t.retry++
        truncated = true
        break
      case 'transient':
        if (firstRound && !a.timeout) {
          later.push({ row, at: Date.now() }) // drugi krug; red ostaje posuđen dotad
          return
        }
        again.push(row.endpoint)
        t.retry++
        if (a.timeout) t.timeouts++
        chunkError ??= a.msg
        break
    }
    flush(false)
  }

  /* ── bazen: prvi krug nad redom iz baze, pa drugi krug ─────────────── */

  // Mjesto u bazenu koje ostane bez reda odmah uzima drugi krug — ne čeka
  // uređaje koji vise na prvom, pa poziv traje koliko najsporiji uređaj, a
  // ne zbir oba kruga. Svaki prolazni dobije drugi krug najranije
  // `ROUND2_PAUSE_MS` nakon pada: ko ga doda, i sam ga kasnije pokupi.
  let li = 0
  await Promise.all(
    Array.from({ length: pool }, async () => {
      for (let row = await next(); row; row = await next()) settle(row, await deliver(row), true)
      while (li < later.length) {
        const { row, at } = later[li++]
        const wait = at + ROUND2_PAUSE_MS - Date.now()
        if (wait > 0) await sleep(wait)
        settle(row, await deliver(row), false)
      }
    }),
  )

  flush(true)
  await flushing
  agent.destroy()

  return { ...t, truncated, ...(error ? { error } : {}) }
}
