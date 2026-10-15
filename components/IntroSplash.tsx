'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Easing } from 'motion/react'
import { COLORS, rng } from './deck/PaperToPhone'
import { startTips, stopTips } from './Tips'
import { deckParam, inDeck } from '@/lib/deck'
import { formatFullDateBs } from '@/lib/date'
import { haptic } from '@/lib/haptic'
import { SPLASH_ARRIVE } from './VerseText'
import { withPeriod } from '@/lib/text'
import { VERSES } from '@/data/verses'
import { MOODS, type Mood } from '@/data/moods'

/**
 * IZVLAČENJE STIHA — jednom dnevno, pri prvom otvaranju.
 *
 * Prvi put ikad (poslije dozvole za obavijesti): gomila papirića padne na
 * ekran i nasumično izvučen stih se podigne (`IntroSplash`), pa savjeti.
 *
 * Svaki sljedeći dan: "Tvoj stih te čeka" — tombola (`Tombola`): staklena
 * kugla puna presavijenih šarenih listića. Držiš — vrti se; pustiš — jedan
 * se digne na sredinu i otvori s pola na cijeli, s tvojim stihom.
 *
 * Stih je već izvučen (lib/draw.ts) — ovo je obred, ne lutrija.
 * Ostala otvaranja istog dana idu pravo na stih.
 */

const EVENT = 'stihdana:intro'
const DRAW = 'stihdana:izvuci'
/** Prvo izvlačenje ikad (poslije dozvole) — poslije njega idu savjeti. */
const SEEN = 'stihdana:intro'

/** Poslije dozvole za obavijesti: gomila papirića, pa savjeti. `force` — uvijek (dev, prezentacija). */
export function playIntro(force = false) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { force } }))
}

/** Prvo otvaranje u danu, kad je stih tek izvučen. Dok je kapija otvorena, čeka. */
export function playDraw() {
  window.dispatchEvent(new Event(DRAW))
}

/* Kapija (Onboarding) — dok stoji preko ekrana, izvlačenje se ne vidi i čeka. */
let gateOpen = false
const GATE = 'stihdana:gate'
export function setGateOpen(open: boolean) {
  if (gateOpen === open) return
  gateOpen = open
  window.dispatchEvent(new Event(GATE))
}
function subscribeGate(cb: () => void) {
  window.addEventListener(GATE, cb)
  return () => window.removeEventListener(GATE, cb)
}

function introSeen(): boolean {
  try {
    return Boolean(localStorage.getItem(SEEN))
  } catch {
    return false
  }
}

function firstTime(): boolean {
  try {
    if (localStorage.getItem(SEEN)) return false
    localStorage.setItem(SEEN, '1')
  } catch {
    /* privatni prozor — izvlačenje se pokaže, samo se ne zapamti */
  }
  return true
}

/**
 * Izvlačenje stoji iznad ekrana sa stihom i čeka poziv. Kad slova s
 * listića sjednu na mjesto stiha, ekran se ponovo ispiše (`onLand`).
 * Poslije prvog izvlačenja ikad krenu savjeti. Bez animacija (manje
 * pokreta) — odmah stih.
 */
export function IntroHost({
  text,
  others = [],
  mood,
  date,
  onLand,
  fresh = false,
}: {
  text: string
  /** ostali stihovi iz liste — za papiriće u gomili na prvom otvaranju */
  others?: string[]
  /** raspoloženje stiha — boja podloge i sjaja */
  mood: Mood
  date: string
  onLand: () => void
  /** prvo otvaranje danas — ekran sa stihom se ne smije vidjeti prije izvlačenja */
  fresh?: boolean
}) {
  const m = MOODS[mood]
  const bg = m.gradient[0]
  const lines = useMemo(() => [text, ...others], [text, others])
  const reduced = useReducedMotion()
  const [on, setOn] = useState<{ first: boolean; demo: boolean } | null>(null)
  // svako novo izvlačenje iz prezentacije kreće ispočetka, i usred prethodnog
  const [run, setRun] = useState(0)
  // izvlačenje traženo dok je kapija bila otvorena
  const [pending, setPending] = useState(false)
  // zastor od prvog frejma dok izvlačenje ne krene (ispod kapije i splasha);
  // u prezentaciji kad se aplikacija otvara uvodom (`?intro`)
  const [hold, setHold] = useState(() => (inDeck() ? deckParam('intro') !== null : fresh))
  const gate = useSyncExternalStore(subscribeGate, () => gateOpen, () => true)
  const runningRef = useRef(false)
  useEffect(() => {
    runningRef.current = on !== null
  }, [on])

  // prezentacija (`?intro`): aplikacija se otvori uvodom — gomila papirića,
  // kao poslije dozvole na pravom telefonu (telefon kod izloga, "Od izloga
  // do hiljada ekrana")
  useEffect(() => {
    if (!inDeck() || deckParam('intro') === null) return
    const t = window.setTimeout(() => playIntro(true), 350)
    return () => clearTimeout(t)
  }, [])

  // Prezentacija traži izvlačenje porukom, ne novom adresom: ponovno
  // učitavanje aplikacije u telefonu zauzme istu nit kao prezentacija, pa bi
  // prelaz između koraka zastao. U njoj se papirić izvuče sam.
  useEffect(() => {
    if (!inDeck()) return
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'stihdana:izvuci') return
      stopTips()
      setRun((r) => r + 1)
      setOn({ first: false, demo: true })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    const go = (e: Event) => {
      const force = (e as CustomEvent<{ force?: boolean }>).detail?.force
      const fresh = firstTime()
      setPending(false)
      if (!reduced && (fresh || force)) {
        setRun((r) => r + 1)
        return setOn({ first: true, demo: inDeck() })
      }
      // bez izvlačenja — savjeti odmah (u prezentaciji ih pokreće njihov korak)
      setHold(false)
      if (!inDeck()) startTips()
    }
    const draw = () => {
      // već se izvlači (npr. obavijest dodirnuta usred tombole) — ne ispočetka
      if (runningRef.current) return
      if (reduced) return setHold(false)
      // zastor odmah (i kad je stih danas već viđen — obavijest): stih se ne
      // vidi dok tombola ne krene
      setHold(true)
      setPending(true)
    }
    window.addEventListener(EVENT, go)
    window.addEventListener(DRAW, draw)
    return () => {
      window.removeEventListener(EVENT, go)
      window.removeEventListener(DRAW, draw)
    }
  }, [reduced])

  // kapija se sklonila — izvlačenje koje je čekalo kreće; prvi put ikad ide sa savjetima
  // (jedan tik kasnije: kapija se pri hidrataciji zna na trenutak otvoriti)
  useEffect(() => {
    if (!pending || gate) return
    const t = window.setTimeout(() => {
      setPending(false)
      if (!introSeen()) return playIntro()
      setRun((r) => r + 1)
      setOn({ first: false, demo: inDeck() })
    }, 0)
    return () => clearTimeout(t)
  }, [pending, gate])

  const done = useCallback(() => {
    setHold(false)
    setOn((cur) => {
      // savjeti tek kad se stih ispiše i smiri — u prezentaciji ih pokreće njihov korak
      if (cur?.first && !inDeck()) window.setTimeout(() => startTips(), 2600)
      return null
    })
  }, [])

  return (
    <>
    {/* splash/tombola imaju svoju punu podlogu — zastor samo dok ne krenu (done ga skloni) */}
    {hold && !on && <div className="fixed inset-0 z-[59]" style={{ background: bg }} aria-hidden />}
    <AnimatePresence>
      {on?.first && <IntroSplash key={`uvod-${run}`} lines={lines} bg={bg} onLand={onLand} onDone={done} />}
      {on && !on.first && (
        <Tombola key={`tombola-${run}`} text={text} bg={bg} accent={m.accent} date={date} demo={on.demo} onLand={onLand} onDone={done} />
      )}
    </AnimatePresence>
    </>
  )
}

/** Trake na pultu (uvod) su iste veličine, kao izrezane istim makazama. */
const W = 'min(36vw, 170px)'
const H = 'calc(min(36vw, 170px) / 3.3)'
/** Središte gomile i oblaka, u vw/vh. */
const CX = 50
const CY = 47
/** koliko se podignuti papir (uvod) uveća */
const LIFT_S = 1.3
/** tombola: izvučeni listić je veći i stoji između naslova i kugle (koja se spusti) */
const DRAW_S = 1.6
const DRAW_Y = 0.12
/* ── tombola: zavrti i izvuci svoj ─────────────────────────── */

type TombolaPhase = 'pour' | 'ready' | 'spin' | 'out' | 'fly'

/** Listić u kugli — mjere, boja i kad upadne kroz otvor. Kretanje je fizika. */
type Ball = {
  w: number
  h: number
  color: string
  /** poluprečnik za sudare — listići se smiju malo preklopiti, kao u gomili */
  r: number
  /** kad upadne kroz otvor (s) */
  spawn: number
  /** na koju stranu je bačen */
  side: number
}

/* Fizika kugle — u pikselima i sekundama. */
const G = 1400
/** najveća brzina vrtnje (rad/s) — kugla se ne vrti mahnito */
const SPIN = 4.6
/** koliko se listić odbije od stakla */
const BOUNCE = 0.25

/** Koliko traje put izabranog listića: kroz kuglu, kroz otvor, na sredinu (s). */
const RISE = 1.1

/** Krug nabijanja ispod kugle: poluprečnik i obim (px). */
const RING_R = 26
const RING = 2 * Math.PI * RING_R

/**
 * Tombola na pultu ispred Magaze: staklena kugla na zlatnom postolju.
 * Listići se kroz otvor na vrhu saspu u nju i slegnu na dno. Držiš prst —
 * kugla se vrti sve brže, listići lete i prevrću se. Pustiš — ostali
 * potamne, a jedan se mirno digne na sredinu i otvori s pola na cijeli;
 * stih izroni iznutra. Slova zatim odlete na mjesto stiha.
 *
 * Stih je već izvučen, pa koji god listić se izvuče, u njemu je tvoj. Bez
 * dodira (i u prezentaciji) kugla se zavrti sama.
 *
 * Svi listići se pomjeraju u jednoj petlji (jedna transformacija po listiću
 * po frejmu) — bez React rendera dok se vrti.
 */
function Tombola({
  text,
  bg,
  accent,
  date,
  demo,
  onLand,
  onDone,
}: {
  text: string
  bg: string
  accent: string
  date: string
  demo: boolean
  onLand: () => void
  onDone: () => void
}) {
  const [phase, setPhase] = useState<TombolaPhase>('pour')
  const [chosen, setChosen] = useState<{ i: number; x: number; y: number; rot: number; k: number; color: string } | null>(null)
  const [to, setTo] = useState<Transfer | null>(null)
  const landed = useRef(false)
  const land = useCallback(() => {
    if (landed.current) return
    landed.current = true
    onLand()
  }, [onLand])

  // mjere ekrana — i kad se prozor promijeni ili telefon okrene, kugla ostaje na sredini
  const [{ vw, vh }, setSize] = useState(() => ({ vw: window.innerWidth, vh: window.innerHeight }))
  useEffect(() => {
    const on = () => setSize({ vw: window.innerWidth, vh: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const paperW = Math.min(vw * 0.36, 170)
  // kugla i ispod nje postolje, pa uputa — sve mora stati i na nizak ekran
  const R = Math.min(vw * 0.38, vh * 0.2, 175)
  const cx = vw / 2
  // kugla na sredini ekrana; uputa je ispod, pri dnu
  const cy = vh * 0.5

  // listići: koliko ih treba da kugla bude do pola puna; upadaju jedan za drugim
  const balls = useMemo<Ball[]>(() => {
    const r = rng(41 + [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0))
    const n = Math.round(Math.min(34, Math.max(18, (R * R) / 880)))
    return Array.from({ length: n }, (_, i) => {
      const w = (paperW / 2) * (0.85 + r() * 0.3)
      const h = (paperW / 3.3) * (0.9 + r() * 0.2)
      return {
        w,
        h,
        color: shade(COLORS[Math.floor(r() * COLORS.length)], 0.88 + r() * 0.18),
        r: (w + h) * 0.17,
        spawn: 0.2 + i * 0.03 + r() * 0.02,
        side: r() - 0.5,
      }
    })
  }, [text, paperW, R])

  const els = useRef<(HTMLDivElement | null)[]>([])
  const band = useRef<SVGEllipseElement>(null)
  // krug ispod kugle: puni se dok se drži, kao da se kugla nabija
  const charge = useRef<SVGCircleElement>(null)
  const chargeGlow = useRef<HTMLSpanElement>(null)
  const sim = useRef({
    holding: false,
    heldAt: 0,
    theta: 0,
    omega: 0,
    chosen: -1,
    start: 0,
  })
  // stanje listića: položaj, brzina, ugao — obični nizovi, bez Reacta
  const body = useRef<{ x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array; a: Float32Array; va: Float32Array; on: Uint8Array; sleep: Uint8Array; rest: Uint16Array } | null>(null)

  // Jedna petlja, prava fizika: listić pada, staklo ga nosi dok se kugla
  // vrti, odbija se od drugih i slegne se na dno. Ništa nije unaprijed
  // nacrtano, pa nema ni skokova između "stanja".
  useEffect(() => {
    const n = balls.length
    const B = {
      x: new Float32Array(n),
      y: new Float32Array(n),
      vx: new Float32Array(n),
      vy: new Float32Array(n),
      a: new Float32Array(n),
      va: new Float32Array(n),
      on: new Uint8Array(n),
      // Smiren listić "zaspi" — stoji potpuno mirno dok ga kugla ne pokrene.
      // Bez ovoga se gomila stalno sitno gura i papirići titraju.
      sleep: new Uint8Array(n),
      rest: new Uint16Array(n),
    }
    body.current = B
    let raf = 0
    const sm = sim.current
    sm.start = performance.now()
    let last = sm.start
    let tickAt = 0
    let tick = 0
    let calm = 0
    let lastFull = -1
    const frame = (now: number) => {
      const t = (now - sm.start) / 1000
      // stvarno proteklo vrijeme (do 0,1 s) — i kad telefon zakasni s frejmom,
      // fizika ga sustigne u malim koracima, pa ništa ne ide usporeno
      const all = Math.min(0.1, (now - last) / 1000)
      last = now
      // kugla ubrzava i usporava postepeno, kao teška
      sm.omega += ((sm.holding ? SPIN : 0) - sm.omega) * Math.min(1, all * (sm.holding ? 1.3 : 1.1))
      if (!sm.holding && sm.omega < 0.02) sm.omega = 0
      sm.theta += sm.omega * all
      if (sm.omega > 0) {
        B.sleep.fill(0)
        B.rest.fill(0)
      }

      let energy = 0
      const steps = Math.max(1, Math.ceil(all / (1 / 120)))
      const dt = all / steps
      for (let st = 0; st < steps; st++) {
        for (let i = 0; i < n; i++) {
          const p = balls[i]
          if (!B.on[i]) {
            if (t < p.spawn) continue
            // upadne kroz otvor
            B.on[i] = 1
            B.x[i] = cx + p.side * 14
            B.y[i] = cy - R + 10
            B.vx[i] = p.side * 160
            B.vy[i] = 120 + Math.abs(p.side) * 200
            B.a[i] = p.side * 6
            B.va[i] = p.side * 8
          }
          if (i === sm.chosen || B.sleep[i]) continue
          B.vy[i] += G * dt
          const drag = 1 - 0.6 * dt
          B.vx[i] *= drag
          B.vy[i] *= drag
          B.x[i] += B.vx[i] * dt
          B.y[i] += B.vy[i] * dt
          B.a[i] += B.va[i] * dt
          B.va[i] *= 1 - 1.8 * dt
          // staklo: odbije, a dok se kugla vrti — povuče listić sa sobom
          const dx = B.x[i] - cx
          const dy = B.y[i] - cy
          const d = Math.hypot(dx, dy) || 1
          const lim = R - p.r * 1.2
          if (d > lim) {
            const nx = dx / d
            const ny = dy / d
            B.x[i] = cx + nx * lim
            B.y[i] = cy + ny * lim
            const vn = B.vx[i] * nx + B.vy[i] * ny
            if (vn > 0) {
              B.vx[i] -= (1 + BOUNCE) * vn * nx
              B.vy[i] -= (1 + BOUNCE) * vn * ny
            }
            const tx = -ny
            const ty = nx
            const vt = B.vx[i] * tx + B.vy[i] * ty
            const dv = (sm.omega * lim - vt) * Math.min(1, 9 * dt)
            B.vx[i] += dv * tx
            B.vy[i] += dv * ty
            B.va[i] += (dv / p.r) * 0.5
          }
        }
        // listići se ne prolaze jedan kroz drugi — meko se razmaknu
        for (let i = 0; i < n; i++) {
          if (!B.on[i] || i === sm.chosen) continue
          for (let j = i + 1; j < n; j++) {
            if (!B.on[j] || j === sm.chosen) continue
            // dva usnula se ne diraju — gomila stoji
            if (B.sleep[i] && B.sleep[j]) continue
            const dx = B.x[j] - B.x[i]
            const dy = B.y[j] - B.y[i]
            const md = balls[i].r + balls[j].r
            const d2 = dx * dx + dy * dy
            if (d2 >= md * md || d2 < 0.0001) continue
            const d = Math.sqrt(d2)
            const nx = dx / d
            const ny = dy / d
            // usnuli stoji kao zid — budni se odmakne od njega cijelim preklopom
            const wi = B.sleep[i] ? 0 : B.sleep[j] ? 1 : 0.5
            const wj = B.sleep[j] ? 0 : B.sleep[i] ? 1 : 0.5
            const over = md - d
            B.x[i] -= nx * over * wi
            B.y[i] -= ny * over * wi
            B.x[j] += nx * over * wj
            B.y[j] += ny * over * wj
            const rv = (B.vx[j] - B.vx[i]) * nx + (B.vy[j] - B.vy[i]) * ny
            if (rv < 0) {
              B.vx[i] += rv * nx * wi
              B.vy[i] += rv * ny * wi
              B.vx[j] -= rv * nx * wj
              B.vy[j] -= rv * ny * wj
            }
          }
        }
      }
      // upis u DOM — samo dok se nešto miče
      for (let i = 0; i < n; i++) {
        if (!B.on[i] || B.sleep[i]) continue
        const sp = Math.abs(B.vx[i]) + Math.abs(B.vy[i])
        // gotovo miran listić se priguši, pa zaspi — bez drhtanja u gomili
        if (sm.omega === 0 && sp < 40) {
          B.vx[i] *= 0.6
          B.vy[i] *= 0.6
          B.va[i] *= 0.6
          if (++B.rest[i] > 8) {
            B.sleep[i] = 1
            B.vx[i] = 0
            B.vy[i] = 0
            B.va[i] = 0
            continue
          }
        } else B.rest[i] = 0
        energy += sp
      }
      const moving = energy > 0 || sm.omega > 0 || t < balls[n - 1].spawn + 0.5
      calm = moving ? 0 : calm + 1
      if (calm < 3) {
        for (let i = 0; i < n; i++) {
          const el = els.current[i]
          if (!el || i === sm.chosen) continue
          if (!B.on[i]) {
            el.style.opacity = '0'
            continue
          }
          const p = balls[i]
          el.style.opacity = '1'
          el.style.transform = `translate(${(B.x[i] - p.w / 2).toFixed(1)}px, ${(B.y[i] - p.h / 2).toFixed(1)}px) rotate(${B.a[i].toFixed(3)}rad)`
        }
      }
      // obruč se okreće s kuglom
      if (band.current && sm.omega > 0) band.current.setAttribute('rx', (Math.abs(Math.cos(sm.theta)) * R * 0.98 + 1).toFixed(1))
      // nabijanje: krug se puni s brzinom kugle; pun — zasja
      const full = Math.round(Math.min(1, sm.omega / (SPIN * 0.95)) * 100) / 100
      if (full !== lastFull) {
        lastFull = full
        if (charge.current) charge.current.style.strokeDashoffset = String((1 - full) * RING)
        if (chargeGlow.current) chargeGlow.current.style.opacity = String(full * full)
      }
      // trzaj kao čegrtaljka dok se vrti (Android)
      const k = Math.floor(sm.theta / 0.7)
      if (k !== tick) {
        tick = k
        if (sm.omega > 1.5 && now - tickAt > 90 && typeof navigator.vibrate === 'function') {
          tickAt = now
          navigator.vibrate(3)
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    const ready = window.setTimeout(() => setPhase((p) => (p === 'pour' ? 'ready' : p)), (balls[balls.length - 1].spawn + 1.2) * 1000)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(ready)
    }
  }, [balls, cx, cy, R])

  const hold = useCallback(() => {
    const sm = sim.current
    if (sm.holding || sm.chosen >= 0) return
    sm.holding = true
    sm.heldAt = performance.now()
    setPhase('spin')
    haptic(8)
  }, [])

  // pušteno: kugla uspori, pa se listić koji je najviše gore nježno digne
  const again = useRef<() => void>(() => {})
  const release = useCallback(() => {
    const sm = sim.current
    if (!sm.holding || sm.chosen >= 0) return
    // kratak dodir: kugla se ipak zavrti bar malo
    const held = performance.now() - sm.heldAt
    if (held < 1100) {
      window.setTimeout(() => again.current(), 1100 - held)
      return
    }
    sm.holding = false
    setPhase('out')
    window.setTimeout(() => {
      const B = body.current
      if (!B) return
      let best = 0
      for (let i = 1; i < balls.length; i++) if (B.on[i] && B.y[i] < B.y[best]) best = i
      const p = balls[best]
      const k = p.w / (paperW / 2)
      sm.chosen = best
      setChosen({
        i: best,
        // presavijena polovina je desna — njeno središte je papir pomjeren za W/4
        x: B.x[best] - vw * (CX / 100) - (paperW / 4) * k,
        y: B.y[best] - vh * (CY / 100),
        rot: (((B.a[best] * 180) / Math.PI + 540) % 360) - 180,
        k,
        color: p.color,
      })
      haptic([10, 40, 16])
    }, 450)
  }, [balls, paperW, vw, vh])
  useEffect(() => {
    again.current = release
  }, [release])

  // izvučeni se otvori i pročita, pa slova odlete na mjesto stiha
  useEffect(() => {
    if (phase !== 'out') return
    const t = window.setTimeout(() => {
      setTo(measureTransfer(DRAW_Y, DRAW_S))
      setPhase('fly')
      land()
    }, (0.45 + RISE + 2.1) * 1000)
    return () => clearTimeout(t)
  }, [phase, land])
  useEffect(() => {
    if (phase !== 'fly') return
    const t = window.setTimeout(onDone, 1100)
    return () => clearTimeout(t)
  }, [phase, onDone])

  // bez dodira se zavrti sama samo u prezentaciji — na telefonu čeka prst
  const later = useRef(0)
  useEffect(() => {
    if (phase !== 'ready' || !demo) return
    const t = window.setTimeout(() => {
      hold()
      later.current = window.setTimeout(release, 1700)
    }, 500)
    return () => clearTimeout(t)
  }, [phase, demo, hold, release])
  useEffect(() => () => clearTimeout(later.current), [])

  // tastatura: razmak ili Enter — drži i pusti
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && phase === 'ready') {
        e.preventDefault()
        hold()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') release()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [phase, hold, release])

  const paper = {
    // isti rez kao stih na ekranu (globals.css .verse) — slova koja polete
    // s papira se pri prelazu ne smiju promijeniti
    fontFamily: 'var(--font-serif), Georgia, serif',
    fontWeight: 400,
    letterSpacing: '-0.02em',
    fontVariationSettings: "'wght' 400, 'opsz' 144, 'SOFT' 30, 'WONK' 0",
    fontSize: 'min(2.5vw, 11.5px)',
    lineHeight: 1.18,
    color: '#1d1a16',
  } as const
  const out = phase === 'out' || phase === 'fly'
  // Izabrani listić se jednim mirnim pokretom digne na sredinu i legne ravno.
  const exit = useMemo(() => {
    if (!chosen) return { animate: {}, transition: {} }
    return {
      animate: { x: 0, y: -vh * DRAW_Y, rotate: 0, scale: DRAW_S },
      transition: { duration: RISE, ease: [0.33, 0, 0.2, 1] as Easing },
    }
  }, [chosen, vh])

  return (
    <motion.div
      className="fixed inset-0 z-[70] touch-none select-none overflow-hidden"
      role="dialog"
      aria-label="Tvoj stih te čeka: drži da zavrtiš, pusti da izvučeš"
      data-izvlacenje
      onPointerDown={(e) => {
        e.preventDefault()
        if (phase === 'ready') return hold()
        // listić je izvučen — dodir preskače do stiha
        if (out) {
          land()
          onDone()
        }
      }}
      onPointerUp={release}
      onPointerCancel={release}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
    >
      {/* podloga u boji stiha — stih koji čeka ispod ne smije se nazrijeti */}
      <motion.div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 80% 45% at 50% ${(cy / vh) * 100}%, ${accent}26, transparent 70%), ${bg}` }}
        initial={{ opacity: 1 }}
        animate={{ opacity: phase === 'fly' ? 0 : 1 }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
      />

      {/* naslov — ostaje i dok se listić otvara ("te čeka" → "za danas"), ode tek sa slovima */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 px-8 text-center"
        style={{ top: `max(10vh, calc(var(--sat) + 3rem))` }}
        initial={{ opacity: 0, y: 10 }}
        animate={phase === 'fly' ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
        transition={{ duration: phase === 'fly' ? 0.4 : 0.9, delay: phase === 'fly' ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="tabular text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: accent, opacity: 0.8 }}>
          {formatFullDateBs(date)}
        </p>
        <div className="relative mt-3 h-[2.6rem]">
          {(['Tvoj stih te čeka', 'Tvoj stih za danas'] as const).map((t, j) => (
            <motion.p
              key={t}
              className="absolute inset-x-0 top-0 text-[2rem] leading-tight text-white/95"
              style={{ fontFamily: 'var(--font-serif), serif' }}
              initial={false}
              animate={{ opacity: (j === 1) === out ? 1 : 0, y: (j === 1) === out ? 0 : j === 1 ? 8 : -8 }}
              transition={{ duration: 0.6, delay: out && j === 1 ? RISE * 0.7 : 0, ease: [0.22, 1, 0.36, 1] }}
            >
              {t}
            </motion.p>
          ))}
        </div>
      </motion.div>
      {/* uputa: otisak prsta u zlatnom krugu koji se puni dok se drži */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-2.5"
        // pri dnu ekrana, odvojeno od kugle — tu palac prirodno dođe
        style={{ bottom: 'max(5vh, calc(env(safe-area-inset-bottom) + 1.5rem))' }}
        initial={{ opacity: 0, y: 8 }}
        animate={phase === 'ready' || phase === 'spin' ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="relative flex h-14 w-14 items-center justify-center">
          {/* sjaj kad je krug pun */}
          <span
            ref={chargeGlow}
            className="absolute -inset-3 rounded-full"
            style={{ background: `radial-gradient(circle, ${accent}66, transparent 70%)`, opacity: 0 }}
          />
          {/* disanje dok čeka */}
          {phase === 'ready' && (
            <motion.span
              className="absolute inset-0 rounded-full border"
              style={{ borderColor: `${accent}66` }}
              animate={{ scale: [1, 1.45], opacity: [0.7, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          <svg width="56" height="56" viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
            <circle cx="28" cy="28" r={RING_R} fill="none" stroke={`${accent}33`} strokeWidth="1.5" />
            <circle
              ref={charge}
              cx="28"
              cy="28"
              r={RING_R}
              fill="none"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={RING}
              style={{ strokeDashoffset: RING }}
            />
          </svg>
          {/* otisak prsta */}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.4" strokeLinecap="round" aria-hidden>
            <path d="M7.5 5.6A8 8 0 0 1 20 12.2v1.3" />
            <path d="M4.2 9.4A8 8 0 0 0 4 12v.6M4.6 16.5c.3 1 .7 1.9 1.2 2.7" />
            <path d="M8 18.6a11 11 0 0 1-1.1-5.2V12a5.1 5.1 0 0 1 10.2 0v1.6" />
            <path d="M12 12v1.8a12 12 0 0 0 1.6 6M17.1 16.6c-.1 1.3-.4 2.5-.8 3.6M9.8 20.8a14 14 0 0 1-.8-4.4V12a3 3 0 0 1 4.3-2.7" />
          </svg>
        </span>
        <span className="relative h-6 w-full text-center">
          {(['Drži prst da dobiješ svoj stih', 'Pusti prst'] as const).map((t, j) => (
            <motion.span
              key={t}
              className="absolute inset-x-0 top-0 text-[15px] italic text-white/85"
              style={{ fontFamily: 'var(--font-serif), serif' }}
              initial={false}
              animate={{ opacity: (j === 1) === (phase === 'spin') ? 1 : 0, y: (j === 1) === (phase === 'spin') ? 0 : 4 }}
              transition={{ duration: 0.35 }}
            >
              {t}
            </motion.span>
          ))}
        </span>
      </motion.div>

      {/* tombola — kad se listić izvuče, spusti se malo (iste vidljivosti); ode sa slovima */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ transformOrigin: `50% ${cy}px` }}
        initial={{ opacity: 0, y: 30, scale: 0.94 }}
        animate={phase === 'fly' ? { opacity: 0, y: vh * 0.18, scale: 1 } : out ? { opacity: 1, y: vh * 0.18, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: out ? 0.6 : 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <Globe cx={cx} cy={cy} R={R} vw={vw} accent={accent} layer="back" />
        {/* listići — samo unutar kugle (i u otvoru dok se sipaju) */}
        <div className="absolute inset-0" style={{ clipPath: `path('${globeClip(cx, cy, R)}')` }}>
          {balls.map((p, i) => (
            <div
              key={i}
              ref={(el) => void (els.current[i] = el)}
              className="absolute left-0 top-0 rounded-[2px]"
              style={{
                width: p.w,
                height: p.h,
                opacity: 0,
                visibility: chosen?.i === i ? 'hidden' : 'visible',
                willChange: 'transform',
                // presavijen: pregib lijevo, blagi sjaj papira
                background: `linear-gradient(90deg, rgba(0,0,0,0.16), rgba(0,0,0,0) 16%), linear-gradient(170deg, rgba(255,255,255,0.16), rgba(255,255,255,0) 50%), ${p.color}`,
                // tanka tamna ivica umjesto sjene — sjena na 40 pokretnih slojeva je skupa
                boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.25)',
              }}
            />
          ))}
        </div>
        {/* naljepnica Magaze zalijepljena na staklo — ispod prednjeg sloja stakla,
            pa odsjaji kugle prelaze preko nje; bez sjene (leži na staklu, ne visi),
            rubovi prate oblinu */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            // malo ispod sredine, ravno
            left: cx - R * 0.31,
            top: cy + R * 0.1,
            width: R * 0.62,
            height: R * 0.24,
            borderRadius: R * 0.045,
            // papir: blaga oblina kugle (rubovi tamniji), topao ton, sitna zrnatost
            background:
              'linear-gradient(90deg, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0) 18%, rgba(255,255,255,0.22) 44%, rgba(255,255,255,0) 64%, rgba(0,0,0,0.16) 100%), radial-gradient(rgba(0,0,0,0.035) 0.6px, transparent 0.7px) 0 0 / 3px 3px, #EFE7D6',
            // tanka sjena uz rub — leži na staklu; bijeli rub izreza naljepnice
            boxShadow: '0 0.5px 1px rgba(0,0,0,0.35), 0 0 0 1.5px rgba(255,255,255,0.55), inset 0 0 0 0.5px rgba(0,0,0,0.1)',
            opacity: 0.92,
          }}
          aria-hidden
        >
          <span
            className="block"
            style={{
              width: '78%',
              aspectRatio: '316 / 87',
              background: '#1d1a16',
              mask: 'url(/brand/magaza.svg) center / contain no-repeat',
              WebkitMask: 'url(/brand/magaza.svg) center / contain no-repeat',
            }}
          />
          {/* odsjaj stakla preko naljepnice — koso, kao preko ostatka kugle */}
          <span
            className="pointer-events-none absolute inset-0"
            style={{
              borderRadius: 'inherit',
              background: 'linear-gradient(115deg, rgba(255,255,255,0) 28%, rgba(255,255,255,0.32) 44%, rgba(255,255,255,0) 60%)',
            }}
          />
        </div>
        <Globe cx={cx} cy={cy} R={R} vw={vw} accent={accent} layer="front" band={band} />
      </motion.div>

      {/* tvoj listić — kroz otvor, gore, pa na sredinu; otvori se s pola na cijeli.
          Kad slova polete, listić ostaje gdje je: papir padne, a slova s njega
          odu na mjesto stiha — isto kao u uvodu. */}
      {chosen && (
        <motion.div
          className="pointer-events-none absolute"
          style={{ left: `${CX}vw`, top: `${CY}vh`, translate: '-50% -50%', width: W, height: H, zIndex: 3, perspective: 700 }}
          initial={{ x: chosen.x, y: chosen.y, rotate: chosen.rot, scale: chosen.k }}
          animate={exit.animate}
          transition={exit.transition}
        >
          {/* papir — kad pusti slova, padne i nestane */}
          <motion.div
            className="absolute inset-0"
            style={{ transformStyle: 'preserve-3d' }}
            initial={{ y: 0, rotate: 0, opacity: 1 }}
            animate={phase === 'fly' ? { y: 70, rotate: 9, opacity: 0 } : { y: 0, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.75, ease: [0.55, 0, 0.75, 0.4] }}
          >
            {/* desna polovina — stoji */}
            <div className="absolute inset-y-0 left-1/2 w-1/2 overflow-hidden rounded-r-[2px]" style={{ background: chosen.color, boxShadow: '0 24px 50px rgba(0,0,0,0.55)' }}>
              {/* pregib s desne strane — ista blaga sjena kao lijevo, da se prelije */}
              <span className="absolute inset-y-0 left-0 w-[28%]" style={{ background: 'linear-gradient(270deg, transparent, rgba(0,0,0,0.035) 70%, rgba(0,0,0,0.05))' }} />
            </div>
            {/* lijeva polovina — presavijena preko desne, pa se otvori */}
            <motion.div
              className="absolute inset-y-0 left-0 w-1/2"
              style={{ transformOrigin: '100% 50%', transformStyle: 'preserve-3d' }}
              initial={{ rotateY: 180 }}
              animate={{ rotateY: 0 }}
              transition={{ duration: 0.75, delay: RISE, ease: [0.3, 0, 0.2, 1] }}
            >
              <div className="absolute inset-0 overflow-hidden rounded-l-[2px]" style={{ background: chosen.color, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                {/* pregib — blaga, široka sjena po sredini otvorenog listića (bez oštrog reza) */}
                <span className="absolute inset-y-0 -right-px w-[28%]" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.035) 70%, rgba(0,0,0,0.05))' }} />
              </div>
              {/* naličje — ono što se vidi dok je presavijen */}
              <div
                className="absolute inset-0 rounded-l-[2px]"
                style={{
                  background: `linear-gradient(270deg, rgba(0,0,0,0.16), rgba(0,0,0,0) 16%), ${chosen.color}`,
                  transform: 'rotateY(180deg)',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              />
            </motion.div>
          </motion.div>
          {/* Stih je napisan iznutra: dok se listić otvara, izranja iz pregiba
              prema krajevima — nikad presječen na dvije polovine. Kad slova
              polete, ova se (još sitna) pretope u kopiju koja leti. */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center px-[0.6em] text-center"
            style={paper}
            initial={{ opacity: 0, clipPath: 'inset(0% 50% 0% 50%)', scale: 0.97 }}
            animate={phase === 'fly' && to ? { opacity: 0 } : { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', scale: 1 }}
            transition={phase === 'fly' ? { duration: 0 } : { delay: RISE + 0.3, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            {text.split('\n').map((l, j) => (
              <span key={j} className="block">
                {l}
              </span>
            ))}
          </motion.div>
        </motion.div>
      )}

      {phase === 'fly' && to && <FlyText to={to} text={text} />}
    </motion.div>
  )
}

/** Unutrašnjost kugle i vrat otvora — listići se vide samo tu. */
function globeClip(cx: number, cy: number, R: number) {
  const n = 16
  return `M ${cx - n} ${cy - R - 40} H ${cx + n} V ${cy - R + 4} A ${R} ${R} 0 1 1 ${cx - n} ${cy - R + 4} Z`
}

/**
 * Staklena kugla na zlatnom postolju. Stražnji sloj (unutrašnjost) ide
 * ispod listića, prednji (staklo, odsjaj, obruč, otvor) preko.
 */
function Globe({
  cx,
  cy,
  R,
  vw,
  accent,
  layer,
  band,
}: {
  cx: number
  cy: number
  R: number
  vw: number
  accent: string
  layer: 'back' | 'front'
  band?: React.RefObject<SVGEllipseElement | null>
}) {
  const id = `tombola-${layer}`
  const foot = cy + R + 44
  return (
    <svg className="absolute left-0 top-0" width={vw} height={foot + 20} aria-hidden>
      <defs>
        <radialGradient id={`${id}-in`} cx="45%" cy="40%" r="65%">
          <stop offset="0" stopColor={accent} stopOpacity="0.08" />
          <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </radialGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8A7148" />
          <stop offset="0.5" stopColor="#E2CFA6" />
          <stop offset="1" stopColor="#8A7148" />
        </linearGradient>
        <radialGradient id={`${id}-shadow`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.6" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      {layer === 'back' ? (
        <>
          <ellipse cx={cx} cy={foot + 4} rx={R * 0.85} ry={10} fill={`url(#${id}-shadow)`} />
          {/* postolje — dvije zlatne noge i ploča */}
          <path
            d={`M ${cx - R * 0.42} ${cy + R * 0.9} L ${cx - R * 0.62} ${foot} M ${cx + R * 0.42} ${cy + R * 0.9} L ${cx + R * 0.62} ${foot}`}
            stroke={`url(#${id}-gold)`}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect x={cx - R * 0.75} y={foot - 3} width={R * 1.5} height={7} rx={3.5} fill={`url(#${id}-gold)`} />
          <circle cx={cx} cy={cy} r={R} fill={`url(#${id}-in)`} />
        </>
      ) : (
        <>
          {/* staklo i odsjaji */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#fff" strokeOpacity="0.2" strokeWidth="1.5" />
          <path
            d={`M ${cx - R * 0.72} ${cy - R * 0.38} A ${R * 0.82} ${R * 0.82} 0 0 1 ${cx - R * 0.2} ${cy - R * 0.78}`}
            fill="none"
            stroke="#fff"
            strokeOpacity="0.32"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx={cx + R * 0.55} cy={cy + R * 0.5} r={R * 0.05} fill="#fff" opacity="0.12" />
          {/* obruč — okreće se s kuglom */}
          <ellipse ref={band} cx={cx} cy={cy} rx={R} ry={R} fill="none" stroke={`url(#${id}-gold)`} strokeOpacity="0.55" strokeWidth="2" />
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={`url(#${id}-gold)`} strokeOpacity="0.35" strokeWidth="1" />
          {/* osovina i otvor na vrhu */}
          <circle cx={cx - R} cy={cy} r={5} fill={`url(#${id}-gold)`} />
          <circle cx={cx + R} cy={cy} r={5} fill={`url(#${id}-gold)`} />
          <rect x={cx - 18} y={cy - R - 12} width={36} height={14} rx={4} fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2.5" />
        </>
      )}
    </svg>
  )
}

/** Prvo otvaranje (poslije dozvole): papirići padaju → današnji se podigne → slova odu na mjesto stiha. */
type PilePhase = 'drop' | 'lift' | 'fly'
const AT = { lift: 2500, fly: 4000, end: 5500 }

/**
 * Kao na pultu u Magazi: gomila šarenih papirića sa stihovima padne na
 * ekran, papirić s današnjim stihom se podigne da se pročita, pa odleti
 * tačno na mjesto stiha i tu se pretopi u digitalni stih — uz zlatni
 * bljesak — dok se ostali rasprše. Dodir bilo gdje preskače.
 *
 * Samo transformacije i opacity — glatko i na slabijem telefonu.
 */
function IntroSplash({
  lines,
  bg,
  onLand,
  onDone,
}: {
  lines: string[]
  bg: string
  onLand: () => void
  onDone: () => void
}) {
  const [phase, setPhase] = useState<PilePhase>('drop')
  // sjeme gomile — nasumično, ali isto kroz cijelu animaciju
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31))
  const landed = useRef(false)
  const land = useCallback(() => {
    if (landed.current) return
    landed.current = true
    onLand()
  }, [onLand])

  // gdje stih stoji na ekranu — tamo papirić sleti
  // pravi stih na ekranu — tekst s papira putuje tačno u njega
  const [to, setTo] = useState<Transfer | null>(null)

  useEffect(() => {
    const t = [
      setTimeout(() => setPhase('lift'), AT.lift),
      setTimeout(() => {
        setTo(measureTransfer())
        setPhase('fly')
        // stih na ekranu se ne ispisuje — pojavi se u trenutku kad mu tekst s
        // papira sjedne na mjesto (VerseScreen `replay`)
        land()
      }, AT.fly),
      setTimeout(onDone, AT.end),
    ]
    return () => t.forEach(clearTimeout)
  }, [onDone, land])

  // Prava gomila: trake različite dužine i širine, nabacane pod svim
  // uglovima. Prvo se nabaca nasumično, pa se svaka rupa na ekranu zatrpa
  // još jednom trakom — pozadina se nigdje ne vidi, a raspored nema reda.
  const strips = useMemo(() => {
    // svako otvaranje druga gomila: drugi raspored i drugi stihovi na papirićima
    const r = rng(seed)
    const vw = window.innerWidth
    const vh = window.innerHeight
    const base = Math.min(vw * 0.36, 170)
    // papirići nose prave stihove iz liste (bez današnjeg — on je onaj koji se podigne)
    const pool = lines.length > 1 ? lines.slice(1) : VERSES.map((v) => v.text)
    const out: Strip[] = []
    const add = (x: number, y: number) => {
      const w = base * (0.85 + r() * 0.55)
      const h = (base / 3.3) * (0.9 + r() * 0.5)
      const rot = (r() - 0.5) * 180
      const hasText = w > base * 0.85 && r() < 0.55
      out.push({ x, y, w, h, rot, color: COLORS[Math.floor(r() * COLORS.length)], tone: 0.88 + r() * 0.18, text: hasText ? pool[Math.floor(r() * pool.length)] : null, flip: false, from: (r() - 0.5) * 0.5 * vw, sway: (r() - 0.5) * 0.2 * vw, wobble: (r() - 0.5) * 50, delay: 0, dur: 0.7 + r() * 0.5, top: false, fade: 0 })
    }
    // sin/cos jednom po traci, a daleke tačke odbaci krug — računa se u par ms
    const geo: { c: number; s: number; rr: number }[] = []
    const covered = (px: number, py: number) => {
      for (let i = 0; i < out.length; i++) {
        const p = out[i]
        const g = (geo[i] ??= {
          c: Math.cos((-p.rot * Math.PI) / 180),
          s: Math.sin((-p.rot * Math.PI) / 180),
          rr: (p.w * p.w + p.h * p.h) / 4,
        })
        const dx = px - p.x
        const dy = py - p.y
        if (dx * dx + dy * dy > g.rr) continue
        if (Math.abs(dx * g.c - dy * g.s) <= p.w * 0.47 && Math.abs(dx * g.s + dy * g.c) <= p.h * 0.44) return true
      }
      return false
    }
    for (let k = 0; k < 45; k++) add(r() * vw, r() * vh)
    // rupe — tačke ekrana nasumičnim redom; svaka nepokrivena dobije traku
    const pts: [number, number][] = []
    for (let y = 0; y <= vh; y += 8) for (let x = 0; x <= vw; x += 8) pts.push([x, y])
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[pts[i], pts[j]] = [pts[j], pts[i]]
    }
    for (const [x, y] of pts) if (!covered(x, y)) add(x + (r() - 0.5) * 20, y + (r() - 0.5) * 12)
    // još malo nabacanih navrh, za dubinu; dio sa stihom padne naopako
    for (let k = 0; k < 18; k++) {
      add(r() * vw, r() * vh)
      const p = out[out.length - 1]
      p.top = true
      p.flip = p.text !== null && r() < 0.6
    }
    // donji padnu prvi — gomila raste odozdo prema vrhu
    // pri "magiji" nestanu svi zajedno, uz tek malo rasipanja
    out.forEach((p, k) => {
      p.delay = (k / out.length) * 0.75 + r() * 0.2
      p.fade = 0.05 + r() * 0.15
    })
    return out
  }, [lines, seed])

  const VH = typeof window === 'undefined' ? 0 : window.innerHeight

  // Gomila se animira kroz Web Animations API: transform i opacity vrti
  // grafički procesor, pa ~180 papirića ne optereti glavnu nit i ne štekće.
  const pile = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const nodes = pile.current?.children
    if (!nodes) return
    const anims: Animation[] = []
    strips.forEach((p, k) => {
      const el = nodes[k] as HTMLElement | undefined
      if (!el) return
      anims.push(el.animate(fall(p, VH), { delay: p.delay * 1000, duration: p.dur * 1000, fill: 'both' }))
      if (p.flip)
        anims.push(
          (el.firstElementChild as HTMLElement).animate([{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }], {
            delay: (p.delay + p.dur * 0.8) * 1000,
            duration: 600,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            fill: 'both',
          }),
        )
    })
    return () => anims.forEach((a) => a.cancel())
  }, [strips, VH])

  // ostali papirići leže dok se stih podiže i leti — nestanu svi kad sleti
  useEffect(() => {
    if (phase !== 'fly') return
    const nodes = pile.current?.children
    if (!nodes) return
    strips.forEach((p, k) =>
      (nodes[k] as HTMLElement | undefined)?.animate([{ opacity: 1 }, { opacity: 0 }], {
        delay: p.fade * 1000,
        duration: 500,
        easing: 'ease-out',
        fill: 'forwards',
      }),
    )
  }, [phase, strips])
  const at = (x: number, y: number) => ({ left: `${x}vw`, top: `${y}vh`, translate: '-50% -50%' })
  const paper = {
    // isti rez kao stih na ekranu (globals.css .verse) — slova koja polete
    // s papira se pri prelazu ne smiju promijeniti
    fontFamily: 'var(--font-serif), Georgia, serif',
    fontWeight: 400,
    letterSpacing: '-0.02em',
    fontVariationSettings: "'wght' 400, 'opsz' 144, 'SOFT' 30, 'WONK' 0",
    fontSize: 'min(2.5vw, 11.5px)',
    lineHeight: 1.18,
  } as const
  const lift = typeof window === 'undefined' ? 0 : -window.innerHeight * 0.1

  return (
    <motion.div
      className="fixed inset-0 z-[70] cursor-pointer overflow-hidden"
      onClick={() => {
        land()
        onDone()
      }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      aria-hidden
    >
      {/* podloga — ista boja kao stih, puna od prvog frejma (stih ispod se ne
          nazire); nestane dok papirić leti, pa se stih vidi */}
      <motion.div
        className="absolute inset-0"
        style={{ background: bg }}
        initial={{ opacity: 1 }}
        animate={{ opacity: phase === 'fly' ? 0 : 1 }}
        transition={{ duration: phase === 'fly' ? 0.8 : 0.45, ease: 'easeInOut' }}
      />

      <div ref={pile} className="absolute inset-0" style={{ contain: 'layout paint' }}>
        {strips.map((p, k) => (
          <div
            key={k}
            className="absolute"
            style={{
              left: p.x - p.w / 2,
              top: p.y - p.h / 2,
              width: p.w,
              height: p.h,
              // dok animacija ne krene, papirić čeka iznad ekrana
              transform: fall(p, VH)[0].transform as string,
              perspective: p.flip ? 700 : undefined,
            }}
          >
            {/* okretanje je na unutrašnjem sloju — pad i okret su dvije animacije */}
            <div
              className="absolute inset-0"
              style={p.flip ? { transformStyle: 'preserve-3d', transform: 'rotateY(180deg)' } : undefined}
            >
              <Face p={p} paper={paper} />
              {/* naličje — prazno, samo kod onih koji se okreću */}
              {p.flip && (
                <div
                  className="absolute inset-0 rounded-[2px]"
                  style={{
                    background: shade(p.color, p.tone * 0.85),
                    transform: 'rotateY(180deg)',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* današnji stih — padne zadnji, polako se podigne iznad gomile */}
      <motion.div
        className="absolute"
        style={{ ...at(CX, CY), width: W, height: H, zIndex: 3 }}
        initial={{ y: '-75vh', rotate: -70, scale: 1 }}
        animate={
          phase === 'drop' ? { x: 0, y: 0, rotate: -6, scale: 1 } : { x: 0, y: lift, rotate: 0, scale: LIFT_S }
        }
        transition={
          phase === 'drop'
            ? { delay: 1.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }
            : // polako se odvoji od gomile i podigne
              { duration: 1.2, ease: [0.33, 0, 0.2, 1] }
        }
      >
        {/* papir — kad pusti stih, padne i nestane */}
        <motion.div
          className="absolute inset-0 rounded-[2px]"
          style={{ background: '#F6D23A' }}
          initial={{ y: 0, rotate: 0, opacity: 1, boxShadow: '0 14px 30px rgba(0,0,0,0.55)' }}
          animate={
            phase === 'fly'
              ? { y: 70, rotate: 9, opacity: 0, boxShadow: '0 4px 8px rgba(0,0,0,0)' }
              : phase === 'lift'
                ? { boxShadow: '0 30px 60px rgba(0,0,0,0.65)' }
                : {}
          }
          transition={phase === 'fly' ? { duration: 0.75, ease: [0.55, 0, 0.75, 0.4] } : { duration: 1.2 }}
        />
        {/* slova na papiru — u trenutku polijetanja se (još sitna) pretope u
            kopiju pravog stiha koja kreće s istog mjesta */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center px-[0.6em] text-center"
          style={{ ...paper, color: '#1d1a16' }}
          initial={{ opacity: 1 }}
          animate={phase === 'fly' && to ? { opacity: 0 } : {}}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {(lines[0] ?? '').split('\n').map((l, j) => (
            <span key={j} className="block">
              {l}
            </span>
          ))}
        </motion.div>
      </motion.div>

      {phase === 'fly' && to && <FlyText to={to} text={lines[0] ?? ''} />}
    </motion.div>
  )
}

type Strip = {
  x: number
  y: number
  w: number
  h: number
  rot: number
  color: string
  /** nijansa papira — nijedan nije baš iste boje */
  tone: number
  text: string | null
  flip: boolean
  from: number
  sway: number
  wobble: number
  delay: number
  dur: number
  /** gornji sloj — jedini sa sjenom */
  top: boolean
  /** kad nestane pri "magiji" */
  fade: number
}

/** Lice papirića: boja, blagi sjaj papira, mekana sjena i (možda) stih. */
function Face({ p, paper }: { p: Strip; paper: React.CSSProperties }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center rounded-[2px] px-[0.6em] text-center text-[#1d1a16]"
      style={{
        background: `linear-gradient(170deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 45%, rgba(0,0,0,0.06)), ${shade(p.color, p.tone)}`,
        boxShadow: p.top ? '0 5px 12px rgba(0,0,0,0.4)' : 'inset 0 0 0 0.5px rgba(0,0,0,0.12)',
        borderRadius: 2,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        ...paper,
        // slova rastu s trakom — duža traka, krupniji stih
        fontSize: Math.min(12.5, p.w * 0.07),
      }}
    >
      {p.text?.split('\n').map((l, j) => (
        <span key={j} className="block">
          {l}
        </span>
      ))}
    </div>
  )
}

/** Pad papirića: njiše se lijevo-desno, pri doskoku se još malo zanese pa smiri. */
function fall(p: Strip, vh: number): Keyframe[] {
  const t = (x: number, y: number, r: number) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg)`
  return [
    { offset: 0, transform: t(p.from, -1.1 * vh, p.rot - 80 + p.wobble), easing: 'ease-in' },
    { offset: 0.45, transform: t(p.sway, -0.4 * vh, p.rot + p.wobble * 0.6), easing: 'ease-out' },
    { offset: 0.85, transform: t(-p.sway * 0.25, 0.012 * vh, p.rot - p.wobble * 0.12), easing: 'ease-in-out' },
    { offset: 1, transform: t(0, 0, p.rot) },
  ]
}

/** Jedan pokret: tekst s papira (već u slovima stiha) putuje i raste do
 *  stiha na ekranu. Na kraju je identičan stihu, pa ga stih zamijeni bez
 *  skoka — kopija stoji na mjestu stiha, pomak je vraća na papir. */
function FlyText({ to, text }: { to: Transfer; text: string }) {
  return (
    <motion.p
      className="verse pointer-events-none absolute m-0 text-center"
      style={{ ...to.style, left: to.left, top: to.top, width: to.width, zIndex: 4, transformOrigin: '50% 50%', textShadow: 'none' }}
      // od prvog frejma puna, tačno preko slova papira (ona se tad sklone) —
      // bez trenutka u kojem su oboje napola providni
      initial={{ x: to.dx, y: to.dy, scale: to.s0, opacity: 1 }}
      animate={{ x: 0, y: 0, scale: 1, opacity: [1, 1, 0] }}
      transition={{
        duration: SPLASH_ARRIVE,
        ease: [0.45, 0, 0.15, 1],
        // nestaje tek POSLIJE pojave stiha ispod nje (ista slova, isto mjesto) —
        // i kad stih kasni koji frejm, nema praznog trenutka (treptaja)
        opacity: { duration: SPLASH_ARRIVE + 0.3, times: [0, (SPLASH_ARRIVE + 0.05) / (SPLASH_ARRIVE + 0.3), 1], ease: 'linear' },
      }}
    >
      {/* tamna slova (kao na papiru) pa svijetla (kao na ekranu) — ista slova */}
      <motion.span
        className="block"
        style={{ color: '#1d1a16' }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        // tamna se skloni tek kad svijetla uđe — u prelazu slova ne izblijede
        transition={{ duration: 0.3, delay: 0.4, ease: 'easeOut' }}
      >
        <VerseLines text={text} />
      </motion.span>
      <motion.span
        className="absolute inset-0 block"
        style={{ color: to.color, textShadow: to.shadow }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.05, ease: 'easeInOut' }}
      >
        <VerseLines text={text} />
      </motion.span>
    </motion.p>
  )
}

/** Boja papira malo tamnija ili svjetlija — `tone` 1 = ista. */
function shade(hex: string, tone: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * tone)))
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`
}

/** Pravi stih na ekranu i kako ga dovesti s papira: kopija stoji na mjestu
 *  stiha, a pomak (dx, dy) i umanjenje (s0) je vrate na podignuti papir. */
type Transfer = {
  left: number
  top: number
  width: number
  dx: number
  dy: number
  s0: number
  style: React.CSSProperties
  color: string
  shadow: string
}

function measureTransfer(lift = 0.1, scale = LIFT_S): Transfer | null {
  const el = document.querySelector<HTMLElement>('main .verse')
  const r = el?.getBoundingClientRect()
  if (!el || !r || !r.width) return null
  const cs = getComputedStyle(el)
  const vw = window.innerWidth
  const vh = window.innerHeight
  // tekst na podignutom papiru: sredina papira, slova papira × uvećanje
  const paperFont = Math.min(vw * 0.025, 11.5) * scale
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    dx: vw * (CX / 100) - (r.left + r.width / 2),
    dy: vh * (CY / 100) - vh * lift - (r.top + r.height / 2),
    s0: paperFont / parseFloat(cs.fontSize),
    style: {
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle,
      letterSpacing: cs.letterSpacing,
      fontVariationSettings: cs.fontVariationSettings,
    } as React.CSSProperties,
    color: cs.color,
    shadow: cs.textShadow,
  }
}

/** Stih po redovima, riječi kao na ekranu (inline-block + razmak). */
function VerseLines({ text }: { text: string }) {
  return (
    <>
      {withPeriod(text)
        .split('\n')
        .map((l, j) => (
          <span key={j} className="block">
            {l
              .trim()
              .split(/\s+/)
              .map((w, i) => (
                <Fragment key={i}>
                  <span className="inline-block">{w}</span>{' '}
                </Fragment>
              ))}
          </span>
        ))}
    </>
  )
}
