'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { motion } from 'motion/react'
import type { Verse } from '@/data/verses'

/** Jarke boje papirića kakvi se dijele u Magazi. */
export const COLORS = ['#F28C38', '#E8473B', '#F6D23A', '#3FA2E0', '#4BB86A', '#E9B8E6', '#8EDBE8', '#F7A35C', '#D7E87C']

/** Mali deterministički PRNG — gomila izgleda isto pri svakom otvaranju. */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Središte gomile, u vw/vh — između teksta i telefona. */
const CX = 55
const CY = 50
/** Sve trake su iste veličine, kao izrezane istim makazama. */
const W = 'min(10.5vw, 19vh)'
const H = 'calc(min(10.5vw, 19vh) / 3.3)'

/** Koliko se papirić podigne i uveća prije leta, da se pročita. */
const LIFT_Y = -24
const LIFT_S = 1.2

/** Gusto oko sredine, rjeđe prema rubu — gomila, a ne mreža. */
function heap(r: () => number, rx: number, ry: number) {
  const g = () => (r() + r() + r() - 1.5) / 1.5
  return { x: CX + g() * rx, y: CY + g() * ry }
}

/**
 * Gomila papirića sa stihovima, kao na pultu u Magazi: mnogo uskih traka u
 * jarkim bojama, natrpanih jedna preko druge, a na vrhu one s ispisanim
 * stihom. Jedna po jedna odleti u telefon i nestane u ekranu — tad aplikacija
 * ispiše isti stih (`onLand`) — a na njeno mjesto dođe traka sa sljedećim
 * stihom. Vrti se kroz sve stihove dok traje slajd.
 *
 * Cilj se mjeri sa samog iframea, pa let pogađa ekran na svakoj veličini.
 */
export function PaperToPhone({
  verses,
  target,
  onLand,
}: {
  /** prvi ide prvi u telefon */
  verses: Verse[]
  target: RefObject<HTMLIFrameElement | null>
  onLand: (v: Verse) => void
}) {
  // prazne trake — podloga gomile
  const blanks = useMemo(() => {
    const r = rng(7)
    return Array.from({ length: 64 }, (_, k) => ({
      ...heap(r, 6.5, 15),
      rot: (r() - 0.5) * 180,
      color: COLORS[Math.floor(r() * COLORS.length)],
      delay: r() * 0.6,
      k,
    }))
  }, [])

  // mjesta za trake sa stihom — raširene preko gomile (mreža s pomakom), da
  // se odmah vidi mnogo stihova, a ne samo par na vrhu
  const slots = useMemo(() => {
    const r = rng(23)
    const out: { x: number; y: number; rot: number; color: string }[] = []
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        const k = out.length
        out.push({
          x: CX + (col - 1) * 4.6 + (row % 2 ? 1.6 : -1.2) + (r() - 0.5) * 1.6,
          y: CY + (row - 2) * 6.6 + (r() - 0.5) * 2.2,
          rot: (r() - 0.5) * 46,
          color: COLORS[(k * 4 + 1) % COLORS.length],
        })
      }
    }
    return out
  }, [])

  const refs = useRef<(HTMLDivElement | null)[]>([])
  // Uzima se odozgo: zadnji nacrtan je na vrhu gomile. Odletjeli se ne
  // vraća — gomila se čisti, a kad ostane bez stihova, složi se nova.
  const order = useMemo(() => slots.map((_, k) => slots.length - 1 - k), [slots])
  const [batch, setBatch] = useState(0)
  const [cycle, setCycle] = useState(0)
  const [lift, setLift] = useState<number | null>(null)
  const [flight, setFlight] = useState<{ idx: number; dx: number; dy: number; s: number } | null>(null)
  const [gone, setGone] = useState<Set<number>>(() => new Set())
  /** "magija" na ekranu kad papirić uleti — jedna po letu */
  const [burst, setBurst] = useState<{ id: number; x: number; y: number } | null>(null)

  // Sljedeći let: papirić se prvo podigne s gomile da se pročita šta piše,
  // pa tek onda polako odleti u telefon.
  useEffect(() => {
    const idx = order[cycle % slots.length]
    const up = setTimeout(
      () => {
        setLift(idx)
      },
      cycle === 0 ? 900 : 2600,
    )
    const fly = setTimeout(
      () => {
        const el = refs.current[idx]
        const r = target.current?.getBoundingClientRect()
        if (!el || !r) return
        const e = el.getBoundingClientRect()
        setBurst(null)
        setFlight({
          idx,
          dx: r.left + r.width / 2 - (e.left + e.width / 2),
          // podignut stoji LIFT_Y iznad svog mjesta
          dy: r.top + r.height * 0.45 - (e.top + e.height / 2) + LIFT_Y,
          s: Math.min(1.5, (r.width * 0.6) / (e.width / LIFT_S)),
        })
      },
      // let kreće tek kad se podizanje smiri — isto u svakom krugu
      (cycle === 0 ? 900 : 2600) + 950,
    )
    return () => {
      clearTimeout(up)
      clearTimeout(fly)
    }
  }, [cycle, order, slots.length, target])

  const at = (x: number, y: number) => ({ left: `${x}vw`, top: `${y}vh`, translate: '-50% -50%' })

  if (!verses.length) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-10" aria-hidden>
      {blanks.map((b) => (
        <motion.span
          key={b.k}
          className="absolute block rounded-[2px] shadow-[0_3px_8px_rgba(0,0,0,0.35)]"
          style={{ ...at(b.x, b.y), width: W, height: H, background: b.color }}
          initial={{ opacity: 0, scale: 0.6, rotate: b.rot - 40 }}
          animate={{ opacity: 1, scale: 1, rotate: b.rot }}
          transition={{ delay: 0.05 + b.delay * 0.4, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}

      {slots.map((s, k) => {
        const flying = flight?.idx === k
        const lifted = lift === k && !flying
        const verse = verses[(batch * slots.length + k) % verses.length]
        const isGone = gone.has(k)
        return (
          <motion.div
            key={`${batch}-${k}`}
            ref={(el) => {
              refs.current[k] = el
            }}
            className="absolute flex flex-col items-center justify-center rounded-[2px] px-[0.8em] text-center text-[#1d1a16] shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
            style={{
              ...at(s.x, s.y),
              width: W,
              height: H,
              background: s.color,
              // štampani kurziv, kao na papirićima iz Magaze
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontStyle: 'italic',
              fontSize: 'min(0.72vw, 1.3vh)',
              lineHeight: 1.18,
              zIndex: flying || lifted ? 3 : 2,
            }}
            initial={{ opacity: 0, scale: 0.7, rotate: 0 }}
            animate={
              flying
                ? { x: flight.dx, y: flight.dy, rotate: 0, scale: flight.s, opacity: [1, 1, 0] }
                : lifted
                  ? { x: 0, y: LIFT_Y, rotate: 0, scale: LIFT_S, opacity: 1 }
                  : { x: 0, y: 0, rotate: s.rot, scale: 1, opacity: isGone ? 0 : 1 }
            }
            transition={
              flying
                ? // stalnom brzinom do sredine ekrana; blijedi tek kad je iznad njega
                  { duration: 2.4, ease: 'linear', opacity: { duration: 2.4, times: [0, 0.74, 1], ease: 'easeIn' } }
                : lifted
                  ? { type: 'spring', stiffness: 160, damping: 18 }
                  : isGone
                    ? { duration: 0 }
                    : { delay: 0.1 + k * 0.02, duration: 0.45, ease: [0.22, 1, 0.36, 1] }
            }
            onAnimationComplete={() => {
              if (!flying) return
              const r = target.current?.getBoundingClientRect()
              if (r) setBurst({ id: cycle, x: r.left + r.width / 2, y: r.top + r.height * 0.45 })
              onLand(verse)
              setLift(null)
              setFlight(null)
              // zadnji sa gomile — složi se nova, sa sljedećim stihovima
              if (gone.size + 1 >= slots.length) {
                setGone(new Set())
                setBatch((b) => b + 1)
              } else {
                setGone((g) => new Set(g).add(k))
              }
              setCycle((c) => c + 1)
            }}
          >
            {verse.text.split('\n').map((l, j) => (
              <span key={j} className="block">
                {l}
              </span>
            ))}
          </motion.div>
        )
      })}

      {burst && <Burst key={burst.id} x={burst.x} y={burst.y} />}
    </div>
  )
}

const GOLD = '#E9D2A0'

/**
 * Trenutak kad papir postane stih na ekranu: bljesak zlatnog svjetla, talas
 * koji se raširi, iskre i par nota koje odlete — kratko, pa nestane.
 */
export function Burst({ x, y }: { x: number; y: number }) {
  const sparks = useMemo(() => {
    const r = rng(Math.round(x * 7 + y))
    return Array.from({ length: 26 }, () => {
      const a = r() * Math.PI * 2
      const d = 100 + r() * 170
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.9, size: 4 + r() * 7, delay: r() * 0.12 }
    })
  }, [x, y])
  const notes = ['♪', '♫', '♬', '♩', '♫', '♪']

  return (
    <div className="absolute" style={{ left: x, top: y, width: 0, height: 0, zIndex: 5 }}>
      {/* bljesak */}
      <motion.span
        className="absolute rounded-full"
        style={{
          width: 480,
          height: 480,
          left: -240,
          top: -240,
          background: `radial-gradient(circle, ${GOLD}cc 0%, ${GOLD}55 30%, transparent 68%)`,
          mixBlendMode: 'screen',
        }}
        initial={{ scale: 0.15, opacity: 0 }}
        animate={{ scale: [0.15, 1.3, 1.9], opacity: [0, 1, 0] }}
        transition={{ duration: 1.1, ease: 'easeOut', times: [0, 0.25, 1] }}
      />
      {/* talasi */}
      {[0, 0.18].map((d) => (
        <motion.span
          key={d}
          className="absolute rounded-full"
          style={{ width: 220, height: 220, left: -110, top: -110, border: `2px solid ${GOLD}` }}
          initial={{ scale: 0.2, opacity: 0.9 }}
          animate={{ scale: 3.1, opacity: 0 }}
          transition={{ duration: 1.2, delay: d, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
      {/* iskre */}
      {sparks.map((p, k) => (
        <motion.span
          key={k}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: -p.size / 2,
            top: -p.size / 2,
            background: '#FFF4D6',
            boxShadow: `0 0 10px 2px ${GOLD}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0.3 }}
          transition={{ duration: 0.95, delay: 0.05 + p.delay, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
      {/* note */}
      {notes.map((n, k) => (
        <motion.span
          key={k}
          className="absolute select-none"
          style={{ left: -12, top: -20, color: GOLD, fontSize: 34, textShadow: `0 0 16px ${GOLD}` }}
          initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
          animate={{ x: (k - 2.5) * 58, y: -170 - (k % 3) * 40, opacity: [0, 1, 0], rotate: (k - 2.5) * 12 }}
          transition={{ duration: 1.9, delay: 0.12 + k * 0.07, ease: 'easeOut' }}
        >
          {n}
        </motion.span>
      ))}
    </div>
  )
}
