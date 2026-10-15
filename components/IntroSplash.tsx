'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { COLORS, rng } from './deck/PaperToPhone'
import { startTips } from './Tips'
import { deckParam, inDeck } from '@/lib/deck'
import { SPLASH_ARRIVE } from './VerseText'
import { withPeriod } from '@/lib/text'
import { VERSES } from '@/data/verses'

const EVENT = 'stihdana:intro'
/** Splash se vidi samo pri prvom paljenju — pamti se na uređaju. */
const SEEN = 'stihdana:intro'

/**
 * Pusti splash — poslije dozvole za obavijesti. Samo prvi put; `force`
 * ga pusti uvijek (dev traka, prezentacija).
 */
export function playIntro(force = false) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { force } }))
}

function firstTime(): boolean {
  try {
    if (localStorage.getItem(SEEN)) return false
    localStorage.setItem(SEEN, '1')
  } catch {
    /* privatni prozor — splash se pokaže, samo se ne zapamti */
  }
  return true
}

/**
 * Splash stoji iznad ekrana sa stihom i čeka `playIntro()`. Kad papirić
 * sleti na mjesto stiha, ekran se ponovo ispiše (`onLand`), a savjeti
 * krenu tek kad se stih smiri. Bez animacija (manje pokreta) — odmah savjeti.
 */
export function IntroHost({ lines, bg, onLand }: { lines: string[]; bg: string; onLand: () => void }) {
  const reduced = useReducedMotion()
  const [on, setOn] = useState(false)

  // prezentacija (`?intro`): aplikacija se otvori splashom — kao poslije
  // dozvole na pravom telefonu; telefon kod izloga tako pokazuje pravu animaciju
  useEffect(() => {
    if (!inDeck() || deckParam('intro') === null) return
    const t = window.setTimeout(() => playIntro(true), 350)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const go = (e: Event) => {
      const force = (e as CustomEvent<{ force?: boolean }>).detail?.force
      const fresh = firstTime()
      if (!reduced && (fresh || force)) return setOn(true)
      // bez splasha — savjeti odmah (u prezentaciji ih pokreće njihov korak)
      if (!inDeck()) startTips()
    }
    window.addEventListener(EVENT, go)
    return () => window.removeEventListener(EVENT, go)
  }, [reduced])

  const done = useCallback(() => {
    setOn(false)
    // savjeti tek kad se stih ispiše i smiri — u prezentaciji ih pokreće njihov korak
    if (!inDeck()) window.setTimeout(() => startTips(), 2600)
  }, [])

  return <AnimatePresence>{on && <IntroSplash key="intro" lines={lines} bg={bg} onLand={onLand} onDone={done} />}</AnimatePresence>
}

/** Trake su iste veličine, kao izrezane istim makazama. */
const W = 'min(36vw, 170px)'
const H = 'calc(min(36vw, 170px) / 3.3)'
/** Središte gomile, u vw/vh. */
const CX = 50
const CY = 47

/** Tok: papirići padaju → današnji se podigne → papir ga pusti, a slova odu na mjesto stiha. */
type Phase = 'drop' | 'lift' | 'fly'
/** koliko se današnji stih uveća kad se podigne */
const LIFT_S = 1.3
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
  const [phase, setPhase] = useState<Phase>('drop')
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
    const r = rng(11)
    const vw = window.innerWidth
    const vh = window.innerHeight
    const base = Math.min(vw * 0.36, 170)
    const pool = VERSES.map((v) => v.text)
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
  }, [])

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
    fontFamily: 'var(--font-serif), Georgia, serif',
    fontStyle: 'italic',
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
      {/* podloga — ista boja kao stih; nestane dok papirić leti, pa se stih vidi */}
      <motion.div
        className="absolute inset-0"
        style={{ background: bg }}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'fly' ? 0 : 0.96 }}
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

      {/* Jedan pokret: tekst s papira (već u slovima stiha) putuje i raste do
          stiha na ekranu. Na kraju je identičan stihu, pa ga stih zamijeni bez
          skoka — kopija stoji na mjestu stiha, pomak je vraća na papir. */}
      {phase === 'fly' && to && (
        <motion.p
          className="verse pointer-events-none absolute m-0 text-center"
          style={{ ...to.style, left: to.left, top: to.top, width: to.width, zIndex: 4, transformOrigin: '50% 50%', textShadow: 'none' }}
          initial={{ x: to.dx, y: to.dy, scale: to.s0, opacity: 0 }}
          animate={{ x: 0, y: 0, scale: 1, opacity: [0, 1, 1, 0] }}
          transition={{
            duration: SPLASH_ARRIVE,
            ease: [0.4, 0, 0.2, 1],
            // pojavi se preko slova papira, a nestane tek kad se stih pojavi ispod nje
            opacity: { duration: SPLASH_ARRIVE + 0.06, times: [0, 0.2, 0.94, 1], ease: 'linear' },
          }}
        >
          {/* tamna slova (kao na papiru) pa svijetla (kao na ekranu) — ista slova */}
          <motion.span
            className="block"
            style={{ color: '#1d1a16' }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            <VerseLines text={lines[0] ?? ''} />
          </motion.span>
          <motion.span
            className="absolute inset-0 block"
            style={{ color: to.color, textShadow: to.shadow }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            <VerseLines text={lines[0] ?? ''} />
          </motion.span>
        </motion.p>
      )}
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

/** Boja papira malo tamnija ili svjetlija — `tone` 1 = ista. */
function shade(hex: string, tone: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * tone)))
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`
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

function measureTransfer(): Transfer | null {
  const el = document.querySelector<HTMLElement>('main .verse')
  const r = el?.getBoundingClientRect()
  if (!el || !r || !r.width) return null
  const cs = getComputedStyle(el)
  const vw = window.innerWidth
  const vh = window.innerHeight
  // tekst na podignutom papiru: sredina papira, slova papira × LIFT_S
  const paperFont = Math.min(vw * 0.025, 11.5) * LIFT_S
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    dx: vw * (CX / 100) - (r.left + r.width / 2),
    dy: vh * (CY / 100) - vh * 0.1 - (r.top + r.height / 2),
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
