#!/usr/bin/env node
/**
 * Proba opterećenja za push — N lažnih korisnika (zadano 5000), bez ijednog
 * telefona, direktno na produkciji. Uputstvo: DEPLOY.md → "Proba
 * opterećenja".
 *
 *   read -rs 'CRON_SECRET?CRON_SECRET: ' && export CRON_SECRET && node scripts/proba-5000.mjs 5000; unset CRON_SECRET
 *
 *   --zadrzi   ne briši lažne pretplate na kraju
 *   --ocisti   samo obriši sve lažne pretplate (nakon prekinute probe)
 *
 * Druga adresa (npr. preview grane) ide kao argument ili kroz PROBA_URL;
 * preview iza Vercelove prijave traži i VERCEL_BYPASS (Protection Bypass
 * for Automation), takođe upisan skriveno.
 *
 * Pravi korisnici ne dobiju ništa: baza drži probu i pravo slanje odvojeno,
 * a dan probe je izmišljen (2099-…). Lažni se na kraju brišu.
 *
 * Tok: provjera adrese i deploya → prijava N lažnih korisnika kroz pravi
 * /api/push/subscribe, s pravim P-256 ključevima → slanje kao cron tri puta
 * za izmišljen dan 2099-… → izvještaj i provjere → čišćenje.
 * Lažni push servis: app/api/proba-push. Pravila probe: lib/proba.ts.
 */
import { createECDH, randomBytes } from 'node:crypto'

const argv = process.argv.slice(2)
const N = Number(argv.find((a) => /^\d+$/.test(a)) ?? 5000)
const ZADRZI = argv.includes('--zadrzi')
const SAMO_CISTI = argv.includes('--ocisti')
const RAW_BASE = argv.find((a) => /^https:\/\//.test(a)) ?? process.env.PROBA_URL ?? 'https://dino-merlin-stih-dana.vercel.app'
const SECRET = process.env.CRON_SECRET ?? ''
const BYPASS = process.env.VERCEL_BYPASS ?? ''

const TZ = 'Europe/Sarajevo'
/** `maxDuration` rute za slanje (app/api/cron/send-daily) */
const ROK_FUNKCIJE_MS = 60_000
/** koliko cron-job.org čeka odgovor */
const CRON_CEKA_MS = 30_000

/** udio tipova; `ok` je ostatak */
const UDIO = { sporo: 0.03, prolazno: 0.025, gust: 0.008, mrtva: 0.012, visi: 0.004 }
const TIPOVI = ['ok', 'sporo', 'prolazno', 'gust', 'mrtva', 'visi']
const ISTOVREMENO = 25
const POKUSAJA = 3

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b64url = (b) => Buffer.from(b).toString('base64url')
const sek = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`
const log = (...a) => console.log(...a)

function stani(msg) {
  console.error(`\n✘ ${msg}`)
  process.exit(1)
}

/* ── 1. adresa i tajna ─────────────────────────────────────────────── */

let BASE
try {
  BASE = new URL(RAW_BASE).origin
} catch {
  stani(`neispravna adresa: ${RAW_BASE}`)
}
if (!BASE.startsWith('https://')) stani(`adresa mora biti https: ${BASE}`)
const HOST = new URL(BASE).hostname
const LOKALNO = HOST === 'localhost' || HOST === '127.0.0.1'
if (!SECRET) stani("nedostaje CRON_SECRET — read -rs 'CRON_SECRET?CRON_SECRET: ' && export CRON_SECRET")

const H = (extra = {}) => ({
  'x-cron-secret': SECRET,
  ...(BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {}),
  ...extra,
})

async function zovi(path, { method = 'GET', body, timeout = 30_000 } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: H(body ? { 'content-type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
    redirect: 'manual',
  })
  const text = await r.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* Vercelova stranica za prijavu, HTML greška… */
  }
  return { status: r.status, json, text }
}

async function ocisti(p) {
  const r = await zovi(`/api/proba-push?ocisti=1${p ? `&p=${p}` : ''}`, { method: 'POST', timeout: 60_000 })
  if (r.status !== 200 || !r.json) throw new Error(`čišćenje: HTTP ${r.status} ${r.text.slice(0, 200)}`)
  return r.json.obrisano
}

if (SAMO_CISTI) {
  try {
    log(`obrisano lažnih pretplata: ${await ocisti()}`)
    process.exit(0)
  } catch (e) {
    stani(e.message)
  }
}

if (!Number.isInteger(N) || N < 10 || N > 20_000) stani('broj korisnika: 10–20000')

// Pravo slanje ide u podne (ruta šalje do 14:59). Proba i pravo slanje
// dijele bravu: proba bi tad držala pravi cron da čeka — pa ne.
const sada = new Date()
const sat = Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(sada)
    .map((x) => [x.type, x.value]),
)
const minuta = Number(sat.hour) * 60 + Number(sat.minute)
if (!LOKALNO && minuta >= 11 * 60 + 45 && minuta < 15 * 60 + 5) {
  stani(`u Sarajevu je ${sat.hour}:${sat.minute} — od 11:45 do 15:05 ide pravo slanje; pokreni probu van tog vremena`)
}

/* ── 2. je li deploy spreman ──────────────────────────────────────── */

const pf = await zovi('/api/proba-push?provjera=1').catch((e) => stani(`${BASE} ne odgovara: ${e.message}`))
if ((pf.status === 401 || (pf.status >= 300 && pf.status < 400)) && !pf.json) {
  stani(
    BYPASS
      ? 'Vercel odbija VERCEL_BYPASS — provjeri tajnu (Settings → Deployment Protection → Protection Bypass for Automation) i redeployaj granu'
      : 'adresa je iza Vercelove prijave (preview) — upiši i VERCEL_BYPASS (DEPLOY.md → Proba opterećenja)',
  )
}
if (pf.status === 404) stani('prijemnik vraća 404 — na toj adresi još nije najnoviji kod (push na trunk)')
if (pf.status === 401) stani('CRON_SECRET ne odgovara onom u Vercelu')
if (!pf.json) stani(`provjera deploya: HTTP ${pf.status} ${pf.text.slice(0, 200)}`)
const P = pf.json
if (P.env !== 'production' && P.env !== 'preview') stani(`deploy kaže da je "${P.env}" — proba radi na produkciji ili previewu`)
if (!P.ok) {
  const fali = [
    !P.baza && 'baza (SUPABASE_URL / ključ u Vercelu)',
    !P.vapid && 'VAPID ključevi u Vercelu',
    !P.shema && 'nova shema — pokreni supabase/schema.sql u Supabase SQL Editoru',
    !P.brava && 'brava (take/release_push_lock) — pokreni supabase/schema.sql',
  ].filter(Boolean)
  stani(`deploy nije spreman: ${fali.join('; ')}${P.greska ? ` (${P.greska})` : ''}`)
}
if (P.zaostale) log(`pažnja: u bazi je ${P.zaostale} lažnih pretplata od ranijih proba (ne smetaju; brisanje: --ocisti)`)

/* ── 3. lažni korisnici ───────────────────────────────────────────── */

const OZNAKA = `p${randomBytes(5).toString('hex')}`
const dio = Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, month: '2-digit', day: '2-digit' })
    .formatToParts(sada)
    .map((x) => [x.type, x.value]),
)
const DAN = `2099-${dio.month}-${dio.day}`

const broj = { ok: 0 }
let ostatak = N
for (const [tip, u] of Object.entries(UDIO)) {
  broj[tip] = Math.max(1, Math.round(N * u))
  ostatak -= broj[tip]
}
broj.ok = ostatak
const red = TIPOVI.flatMap((t) => Array(broj[t]).fill(t))
for (let i = red.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1))
  ;[red[i], red[j]] = [red[j], red[i]]
}

log(`proba ${OZNAKA} · ${P.env === 'production' ? 'PRODUKCIJA ' : ''}${BASE} · dan ${DAN}`)
log(`tipovi: ${TIPOVI.map((t) => `${t} ${broj[t]}`).join(' · ')}`)

function pretplata(i, tip) {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return {
    endpoint: `${BASE}/api/proba-push?id=${i}&tip=${tip}&p=${OZNAKA}`,
    keys: { p256dh: b64url(ecdh.getPublicKey()), auth: b64url(randomBytes(16)) },
  }
}

async function prijavi(i, tip) {
  const subscription = pretplata(i, tip)
  let zadnja = ''
  for (let a = 1; a <= POKUSAJA; a++) {
    try {
      const r = await zovi('/api/push/subscribe', {
        method: 'POST',
        body: { subscription, sendHour: 12, tz: TZ },
        timeout: 20_000,
      })
      if (r.status === 200) return null
      zadnja = `${r.status} ${r.json?.error ?? r.text.slice(0, 80)}`
      // naša greška — ponavljanje ne pomaže
      if (r.status >= 400 && r.status < 500 && r.status !== 429) return zadnja
    } catch (e) {
      zadnja = e.message
    }
    await sleep(400 * a)
  }
  return zadnja
}

let krenulo = false
let cistim = false
let prekid = false

async function pocisti() {
  if (!krenulo || cistim) return
  cistim = true
  if (ZADRZI) {
    log(`\nlažne pretplate ostaju (--zadrzi); brisanje: node scripts/proba-5000.mjs --ocisti ${BASE}`)
    return
  }
  try {
    log(`\nčišćenje: obrisano ${await ocisti(OZNAKA)} lažnih pretplata`)
  } catch (e) {
    log(`\n✘ ${e.message} — obriši ručno: node scripts/proba-5000.mjs --ocisti ${BASE}`)
  }
}

process.on('SIGINT', async () => {
  if (prekid) process.exit(130)
  prekid = true
  log('\nprekinuto — čekam prijave koje su u toku, pa brišem')
  await sleep(3_000)
  await pocisti()
  process.exit(130)
})

let sveProslo = false

try {
  krenulo = true
  const prijavljeno = Object.fromEntries(TIPOVI.map((t) => [t, 0]))
  const greskePrijave = new Map()
  let gotovo = 0
  let sljedeci = 0
  const t0 = Date.now()

  await Promise.all(
    Array.from({ length: ISTOVREMENO }, async () => {
      while (sljedeci < N && !prekid) {
        const i = sljedeci++
        const greska = await prijavi(i + 1, red[i])
        if (greska) greskePrijave.set(greska, (greskePrijave.get(greska) ?? 0) + 1)
        else prijavljeno[red[i]]++
        if (++gotovo % 1000 === 0 && gotovo < N) log(`  prijave ${gotovo}/${N}…`)
      }
    }),
  )

  const ukupnoPrijavljeno = TIPOVI.reduce((s, t) => s + prijavljeno[t], 0)
  log(`\nprijave: ${ukupnoPrijavljeno}/${N} za ${sek(Date.now() - t0)} (${ISTOVREMENO} istovremeno, do ${POKUSAJA} pokušaja)`)
  for (const [g, n] of greskePrijave) log(`  ✘ ${n}× ${g}`)
  if (!ukupnoPrijavljeno) throw new Error('nijedna prijava nije prošla')

  /* ── 4. slanje kao cron ─────────────────────────────────────────── */

  async function posalji(oznakaSata) {
    for (let k = 0; k < 12; k++) {
      const t = Date.now()
      const r = await zovi(`/api/cron/send-daily?proba=${OZNAKA}&dan=${DAN}&sat=12`, {
        method: 'POST',
        timeout: 120_000,
      })
      if (r.status !== 200 || !r.json) throw new Error(`slanje ${oznakaSata}: HTTP ${r.status} ${r.text.slice(0, 300)}`)
      if (r.json.busy) {
        log(`  ${oznakaSata}: drugo slanje je u toku — čekam 20 s`)
        await sleep(20_000)
        continue
      }
      if (r.json.skipped || r.json.error) throw new Error(`slanje ${oznakaSata}: ${r.json.skipped ?? r.json.error}`)
      return { ...r.json, klijentMs: Date.now() - t }
    }
    throw new Error(`slanje ${oznakaSata}: brava zauzeta duže od 4 minute`)
  }

  log('\nslanje (kao cron, izmišljen dan):')
  const pozivi = []
  for (const s of ['12:00', '12:01', '12:03']) {
    if (pozivi.length) await sleep(5_000)
    const r = await posalji(s)
    pozivi.push(r)
    const v = (x) => x ?? 0
    log(
      `  ${s}  na redu ${v(r.due)} · poslano ${v(r.sent)} · obrisano ${v(r.removed)} · ` +
        `prolazno ${v(r.retry)} (bez odgovora ${v(r.timeouts)}) · naša greška ${v(r.failed)} · ` +
        `pokušaja ${v(r.attempts)} · workera ${v(r.workers)} · ${sek(v(r.ms))}` +
        (r.truncated ? ' · PREKINUTO (rok)' : '') +
        (r.brava ? ` · ${r.brava}` : ''),
    )
    for (const e of r.errors ?? []) log(`     ✘ ${e}`)
  }

  /* ── 5. izvještaj ───────────────────────────────────────────────── */

  const iz = await zovi(`/api/proba-push?izvjestaj=dan:${DAN}&p=${OZNAKA}`, { timeout: 60_000 })
  if (iz.status !== 200 || !iz.json) throw new Error(`izvještaj: HTTP ${iz.status} ${iz.text.slice(0, 200)}`)
  const uBazi = iz.json.tipovi

  const ocekivano = {
    ok: 'stiglo svima',
    sporo: 'stiglo svima',
    prolazno: 'stiglo svima',
    gust: 'stiglo svima',
    mrtva: 'obrisane iz baze',
    visi: 'nije stiglo, ostale',
  }
  const tipProsao = (t) => {
    const { pretplata, stiglo } = uBazi[t]
    if (t === 'mrtva') return pretplata === 0
    if (t === 'visi') return stiglo === 0 && pretplata === prijavljeno[t]
    return stiglo === prijavljeno[t] && pretplata === prijavljeno[t]
  }

  log('\ntip        prijavljeno  u bazi  stiglo  očekivano')
  for (const t of TIPOVI) {
    const { pretplata, stiglo } = uBazi[t]
    log(
      `${t.padEnd(10)} ${String(prijavljeno[t]).padStart(11)} ${String(pretplata).padStart(7)} ${String(stiglo).padStart(7)}  ` +
        `${ocekivano[t].padEnd(20)} ${tipProsao(t) ? '✔' : '✘'}`,
    )
  }
  for (const [g, n] of Object.entries(iz.json.greske ?? {})) log(`  nije stiglo: ${n}× ${g}`)
  if (iz.json.posudjeno) log(`  još posuđeno (slanje prekinuto usred porcije): ${iz.json.posudjeno}`)

  /* ── 6. provjere ────────────────────────────────────────────────── */

  const [p1, p2, p3] = pozivi
  const n = (x) => x ?? 0
  const ostalo1 = n(p1.due) - n(p1.sent) - n(p1.removed)
  const ostalo2 = n(p2.due) - n(p2.sent) - n(p2.removed)
  const poslanoUkupno = pozivi.reduce((s, p) => s + n(p.sent), 0)
  const stigloUkupno = TIPOVI.reduce((s, t) => s + uBazi[t].stiglo, 0)

  const provjere = [
    ['stiglo po tipu (ok, sporo, prolazno, gust)', ['ok', 'sporo', 'prolazno', 'gust'].every(tipProsao)],
    ['mrtve obrisane iz baze', tipProsao('mrtva')],
    ['visi: nije stiglo, ostale u bazi za sljedeći put', tipProsao('visi')],
    [`bez duplikata: poslano u 3 poziva ${poslanoUkupno} = stiglo ${stigloUkupno}`, poslanoUkupno === stigloUkupno],
    [`nadoknada: 12:01 poslao ${n(p2.sent)} ≤ ostatak ${ostalo1}`, n(p2.sent) <= ostalo1],
    [`nadoknada: 12:03 poslao ${n(p3.sent)} ≤ ostatak ${ostalo2}`, n(p3.sent) <= ostalo2],
    [
      `prvi poziv ${sek(n(p1.ms))} — ispod roka funkcije ${sek(ROK_FUNKCIJE_MS)}, bez prekida`,
      n(p1.ms) < ROK_FUNKCIJE_MS && !p1.truncated,
    ],
  ]
  log('')
  for (const [opis, prosla] of provjere) log(`${prosla ? '✔' : '✘'} ${opis}`)
  if (n(p3.sent) > 0) log(`  (12:03 je ipak nekome poslao — prolazni koji je pao i u 12:00 i u 12:01)`)
  log(
    n(p1.klijentMs) < CRON_CEKA_MS
      ? `  prvi poziv je stao i u ${sek(CRON_CEKA_MS)} koliko čeka cron-job.org`
      : `  pažnja: prvi poziv (${sek(n(p1.klijentMs))}) je duži od ${sek(CRON_CEKA_MS)} — cron-job.org ne dočeka odgovor, ali slanje svejedno završi`,
  )
  if (poslanoUkupno > stigloUkupno) log('  (više poslanih nego stiglih: neki uređaj je dobio obavijest dva puta)')
  if (poslanoUkupno < stigloUkupno) log('  (manje poslanih nego stiglih: odgovor nekog workera nije stigao do dispatchera)')

  sveProslo = provjere.every(([, prosla]) => prosla)
  log(sveProslo ? '\nproba prošla' : '\nproba NIJE prošla')
} catch (e) {
  console.error(`\n✘ ${e.message}`)
} finally {
  await pocisti()
}

process.exit(sveProslo ? 0 : 1)
