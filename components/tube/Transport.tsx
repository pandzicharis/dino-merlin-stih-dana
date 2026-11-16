'use client'

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { motion } from 'motion/react'
import { haptic } from '@/lib/haptic'
import { nextTube, prevTube, scrubTube, toggleTube, toggleTubeRepeat, toggleTubeShuffle, tubeSnap, tubeTime, useTube } from '@/lib/youtube'

/*
 * Kontrole pjesme (lib/youtube.ts) — isti znakovi i dodir kao plejer iza
 * prekidača (components/SavedPlayer.tsx): krupni bijeli znakovi, bez
 * podloge, pod prstom se smanje, pusti ⇄ pauza se pretope.
 *
 *   TubeControls  u ladici s pjesmom (NowPlaying.tsx), ispod pjesme: traka
 *                 napretka s vremenom, pa nasumično, nazad, pusti, sljedeća, ponovi
 *   Transport     u traci spuštene pjesme (MiniSong.tsx): nazad, pusti, sljedeća —
 *                 spuštena se svakim dodirom vrati gore (YouTube svira samo dok
 *                 se video vidi)
 */

const PREV = (
  <>
    <path d="M11.5 6.2v11.6a.8.8 0 0 1-1.25.66L2.8 13.2a1.4 1.4 0 0 1 0-2.4l7.45-5.26a.8.8 0 0 1 1.25.66z" />
    <path d="M21.5 6.2v11.6a.8.8 0 0 1-1.25.66L12.8 13.2a1.4 1.4 0 0 1 0-2.4l7.45-5.26a.8.8 0 0 1 1.25.66z" />
  </>
)
const NEXT = (
  <>
    <path d="M2.5 6.2v11.6a.8.8 0 0 0 1.25.66l7.45-5.26a1.4 1.4 0 0 0 0-2.4L3.75 5.54a.8.8 0 0 0-1.25.66z" />
    <path d="M12.5 6.2v11.6a.8.8 0 0 0 1.25.66l7.45-5.26a1.4 1.4 0 0 0 0-2.4l-7.45-5.26a.8.8 0 0 0-1.25.66z" />
  </>
)
const PLAY = <path d="M6.5 4.6v14.8a1.1 1.1 0 0 0 1.68.93l11.8-7.4a1.1 1.1 0 0 0 0-1.86L8.18 3.67A1.1 1.1 0 0 0 6.5 4.6z" />
const PAUSE = (
  <>
    <rect x="5.5" y="4" width="4.4" height="16" rx="1.2" />
    <rect x="14.1" y="4" width="4.4" height="16" rx="1.2" />
  </>
)
const SHUFFLE = <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
const REPEAT = (
  <>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </>
)
const GLYPH = { type: 'spring', stiffness: 520, damping: 34 } as const
/** malo deblji puni znakovi (plejer u ladici) — obrub iste boje, zaobljen */
const BOLD = { stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round' } as const

/** Dugme kao u plejeru iza prekidača: bijelo, bez podloge, pod prstom se smanji. */
export function Btn({
  label,
  onPress,
  size,
  color,
  disabled = false,
  pressed,
  zoom = 1.12,
  children,
}: {
  label: string
  onPress: () => void
  size: number
  color?: string
  disabled?: boolean
  /** prekidač (nasumično, ponovi) — uključen */
  pressed?: boolean
  /** koliko naraste pod mišem */
  zoom?: number
  children: ReactNode
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => {
        haptic(5)
        onPress()
      }}
      aria-label={label}
      aria-pressed={pressed}
      className="relative flex shrink-0 items-center justify-center rounded-full transition-colors duration-200 active:bg-white/10 disabled:pointer-events-none"
      style={{ width: size, height: size, color: disabled ? 'rgba(255,255,255,0.3)' : (color ?? '#fff') }}
      whileHover={{ scale: zoom, color: '#fff' }}
      whileTap={{ scale: 0.86 }}
      transition={{ type: 'spring', stiffness: 460, damping: 26 }}
    >
      {children}
    </motion.button>
  )
}

/** Pusti ⇄ pauza — znakovi se pretope jedan u drugi. */
function PlayGlyph({ playing, size, bold = false }: { playing: boolean; size: number; bold?: boolean }) {
  return (
    <>
      <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...(bold ? BOLD : {})} aria-hidden className="absolute" initial={false} animate={{ opacity: playing ? 1 : 0, scale: playing ? 1 : 0.5 }} transition={GLYPH}>
        {PAUSE}
      </motion.svg>
      <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...(bold ? BOLD : {})} aria-hidden className="absolute translate-x-[1px]" initial={false} animate={{ opacity: playing ? 0 : 1, scale: playing ? 0.5 : 1 }} transition={GLYPH}>
        {PLAY}
      </motion.svg>
    </>
  )
}

/** Nazad, pusti, sljedeća — tiho, u traci spuštene pjesme. */
export function Transport() {
  const tube = useTube()
  const on = !tube.min && (tube.status === 'playing' || tube.status === 'loading')
  return (
    <div className="flex shrink-0 items-center">
      {tube.list && (
        <Btn
          label="Prethodna"
          onPress={prevTube}
          size={41}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            {PREV}
          </svg>
        </Btn>
      )}
      <Btn
        label={on ? 'Pauza' : 'Pusti'}
        onPress={toggleTube}
        size={47}
      >
        <PlayGlyph playing={on} size={31} />
      </Btn>
      {tube.list && (
        <Btn
          label="Sljedeća"
          onPress={nextTube}
          size={41}
          disabled={!tube.next}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            {NEXT}
          </svg>
        </Btn>
      )}
    </div>
  )
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

type Bar = {
  track: RefObject<HTMLDivElement | null>
  fill: RefObject<HTMLSpanElement | null>
  dot: RefObject<HTMLSpanElement | null>
  now: RefObject<HTMLSpanElement | null>
  left: RefObject<HTMLSpanElement | null>
}

/** traka i vremena za sekundu `t` od `d` — upisano direktno u DOM, bez re-rendera */
function paint(b: Bar, t: number, d: number) {
  const f = d ? Math.min(1, Math.max(0, t / d)) : 0
  if (b.fill.current) b.fill.current.style.transform = `scaleX(${f})`
  if (b.dot.current) b.dot.current.style.left = `${(f * 100).toFixed(2)}%`
  const n = mmss(t)
  if (b.now.current && b.now.current.textContent !== n) {
    b.now.current.textContent = n
    b.track.current?.setAttribute('aria-valuenow', String(Math.round(t)))
    b.track.current?.setAttribute('aria-valuemax', String(Math.round(d)))
    b.track.current?.setAttribute('aria-valuetext', d ? `${n} od ${mmss(d)}` : n)
  }
  const l = d ? `-${mmss(Math.max(0, d - t))}` : ''
  if (b.left.current && b.left.current.textContent !== l) b.left.current.textContent = l
}

/**
 * Traka napretka i kontrole u ladici s pjesmom (NowPlaying.tsx) — kao plejer
 * sačuvanih: vrijeme, pa nasumično, nazad, pusti, sljedeća, ponovi. Traka se
 * dodirne ili povuče (premota; pauza ostaje pauza), strelicama ±5 s.
 * `onPlay`: pjesma će krenuti — u plejeru se tad vrati video umjesto QR koda.
 */
export function TubeControls({ accent, onPlay }: { accent: string; onPlay?: () => void }) {
  const tube = useTube()
  const on = !tube.min && (tube.status === 'playing' || tube.status === 'loading')
  const track = useRef<HTMLDivElement>(null)
  const fill = useRef<HTMLSpanElement>(null)
  const dot = useRef<HTMLSpanElement>(null)
  const now = useRef<HTMLSpanElement>(null)
  const left = useRef<HTMLSpanElement>(null)
  // premotano prstom: traka drži to mjesto dok se vuče i dok plejer ne stigne tamo
  const held = useRef<{ t: number; until: number } | null>(null)
  const drag = useRef(false)

  // napredak: 10 puta u sekundi dok svira, rjeđe kad stoji
  useEffect(() => {
    const b = { track, fill, dot, now, left }
    let timer = 0
    const tick = () => {
      const { t, d } = tubeTime()
      const h = held.current
      if (h && !drag.current && (performance.now() > h.until || Math.abs(t - h.t) <= 1)) held.current = null
      paint(b, held.current?.t ?? t, d)
      timer = window.setTimeout(tick, tubeSnap().status === 'playing' ? 100 : 400)
    }
    tick()
    return () => clearTimeout(timer)
  }, [])

  const go = (t: number, final: boolean) => {
    const { d } = tubeTime()
    if (!d) return
    const to = Math.min(d, Math.max(0, t))
    held.current = { t: to, until: performance.now() + 1500 }
    paint({ track, fill, dot, now, left }, to, d)
    scrubTube(to, final)
  }
  const at = (x: number) => {
    const r = track.current?.getBoundingClientRect()
    return r ? ((x - r.left) / r.width) * tubeTime().d : 0
  }

  return (
    <>
      {/* traka napretka — dodir ili povlačenje premota */}
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Napredak pjesme"
        aria-valuemin={0}
        aria-valuenow={0}
        className="relative flex h-4 cursor-pointer touch-none items-center"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = true
          go(at(e.clientX), false)
        }}
        onPointerMove={(e) => drag.current && go(at(e.clientX), false)}
        onPointerUp={(e) => {
          if (!drag.current) return
          drag.current = false
          go(at(e.clientX), true)
        }}
        onPointerCancel={() => {
          drag.current = false
          if (held.current) scrubTube(held.current.t, true)
        }}
        onKeyDown={(e) => {
          const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 5 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -5 : 0
          if (!step) return
          e.preventDefault()
          go((held.current?.t ?? tubeTime().t) + step, true)
        }}
      >
        <span className="relative block h-[4px] w-full overflow-hidden rounded-full bg-white/15">
          <span ref={fill} className="block h-full w-full origin-left rounded-full" style={{ background: `linear-gradient(90deg, ${accent}, #fff)`, transform: 'scaleX(0)' }} />
        </span>
        {/* tačka — lijevo u % trake; ne pomjera se omot širok kao traka (virio bi van ladice — bočni skrol) */}
        <span
          ref={dot}
          className="pointer-events-none absolute top-[2px] -ml-1.5 block h-3 w-3 rounded-full bg-white"
          style={{ left: 0, boxShadow: `0 0 0 3px ${accent}40, 0 2px 6px rgba(0,0,0,0.5)` }}
        />
      </div>
      <div className="tabular flex justify-between text-[9px] leading-none text-white/50" aria-hidden>
        <span ref={now}>0:00</span>
        <span ref={left} />
      </div>

      {/* kontrole — krupni bijeli znakovi, sitni prekidači sa strane */}
      <div className="mt-2 flex items-center justify-between px-1">
        <Btn label="Nasumično" onPress={toggleTubeShuffle} size={38} pressed={tube.shuffle} color={tube.shuffle ? accent : 'rgba(255,255,255,0.5)'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {SHUFFLE}
          </svg>
        </Btn>
        <Btn
          label="Prethodna"
          onPress={() => {
            onPlay?.()
            prevTube()
          }}
          size={46}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" {...BOLD} aria-hidden>
            {PREV}
          </svg>
        </Btn>
        <Btn
          label={on ? 'Pauza' : 'Pusti'}
          onPress={() => {
            if (!on) onPlay?.()
            toggleTube()
          }}
          size={52}
        >
          <PlayGlyph playing={on} size={36} bold />
        </Btn>
        <Btn
          label="Sljedeća"
          onPress={() => {
            onPlay?.()
            nextTube()
          }}
          size={46}
          disabled={!tube.next}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" {...BOLD} aria-hidden>
            {NEXT}
          </svg>
        </Btn>
        <Btn label="Ponovi pjesmu" onPress={toggleTubeRepeat} size={38} pressed={tube.repeat} color={tube.repeat ? accent : 'rgba(255,255,255,0.5)'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {REPEAT}
          </svg>
        </Btn>
      </div>
    </>
  )
}
