'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FIGURE_SRC, MOODS, type Mood } from '@/data/moods'
import { BRAND } from '@/lib/brand'
import { SEND_TIME } from '@/lib/date'
import { GALAXY, Galaxy, IPHONE, IPhone, deviceOuter } from './deck/Devices'
import { InstallDemo, type InstallPhase } from './deck/InstallDemo'

type Platform = 'ios' | 'android'

/** Jedan krug: instalacija (~9 s), pa predah na početnom ekranu s novom ikonom. */
const LOOP = 11_000

/** Koji korak uputstva odgovara kojoj fazi animacije. */
function stepOf(phase: InstallPhase) {
  if (phase === 'page' || phase === 'tapMenu') return 0
  if (phase === 'menu' || phase === 'scroll' || phase === 'tapAdd') return 1
  return 2
}

/**
 * "Pogledaj kako" — ista animacija instalacije kao u prezentaciji, na
 * telefonu koji odgovara korisnikovom (iPhone ili Galaxy), u krug.
 *
 * Ispod telefona stoji korak uputstva koji se upravo odigrava — isti tekst
 * kao na uvodu, pa se animacija i uputstvo čitaju kao jedno.
 *
 * Učitava se tek na zahtjev (`next/dynamic`): instalirana aplikacija ovaj
 * kod nikad ne preuzme.
 */
export default function InstallHowTo({
  platform,
  mood,
  steps,
  onClose,
}: {
  platform: Platform
  mood: Mood
  steps: ReactNode[]
  onClose: () => void
}) {
  const [run, setRun] = useState(0)
  const [phase, setPhase] = useState<InstallPhase>('page')
  const closeRef = useRef<HTMLButtonElement>(null)
  const step = stepOf(phase)

  const ios = platform === 'ios'
  const D = ios ? IPHONE : GALAXY
  const outer = deviceOuter(ios ? 'iphone' : 'galaxy')
  // ista visina statusne trake kao na živom telefonu u prezentaciji
  const bar = ios ? 50 : 34
  // Telefon staje u visinu ekrana zajedno s tekstom i dugmetom ispod.
  const width = `max(9rem, min(16.5rem, calc((100dvh - 14rem) * ${(outer.w / outer.h).toFixed(4)})))`
  const Frame = ios ? IPhone : Galaxy

  useEffect(() => {
    const t = setInterval(() => setRun((r) => r + 1), LOOP)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Kako dodati Stih dana na početni ekran — ${ios ? 'iPhone' : 'Android'}`}
      className="fixed inset-0 z-10 flex flex-col items-center justify-center overflow-y-auto bg-black/75 px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,var(--sat))] backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    >
      <motion.div
        className="flex w-full max-w-[19rem] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 16, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        <Frame width={width}>
          <MiniPage mood={mood} w={D.w} h={D.h - bar} top={bar} steps={steps} />
          <AnimatePresence initial={false}>
            <motion.div
              key={run}
              className="absolute inset-0"
              style={{ zIndex: 20 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <InstallDemo platform={platform} w={D.w} h={D.h} top={bar} onPhase={setPhase} />
            </motion.div>
          </AnimatePresence>
        </Frame>

        {/* napredak kroz tri koraka */}
        <div className="mt-7 flex w-full gap-1.5" aria-hidden>
          {steps.map((_, k) => (
            <span
              key={k}
              className="h-[2px] flex-1 rounded-full transition-colors duration-300"
              style={{
                background: k === step ? BRAND.gold : k < step ? `${BRAND.gold}59` : 'rgba(255,255,255,0.12)',
              }}
            />
          ))}
        </div>

        <div className="mt-4 flex min-h-[2.5rem] w-full items-start" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={step}
              className="w-full text-center text-[13px] leading-[1.5] text-white/60"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {steps[step]}
            </motion.p>
          </AnimatePresence>
        </div>

        <button
          ref={closeRef}
          data-deck="close"
          onClick={onClose}
          className="mt-5 rounded-full border border-white/15 px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 transition-colors active:bg-white/10"
        >
          Zatvori
        </button>
      </motion.div>
    </motion.div>
  )
}

/**
 * Umanjeni uvod s uputstvom — ono što animacija "otvori" u pregledniku.
 * Sve u `em` (1em = 1 piksel ekrana), da stoji u okviru telefona bilo koje
 * veličine.
 */
function MiniPage({
  mood,
  w,
  h,
  top,
  steps,
}: {
  mood: Mood
  w: number
  h: number
  top: number
  steps: ReactNode[]
}) {
  const m = MOODS[mood]
  const [a, b, c] = m.gradient
  return (
    <div
      className="absolute inset-x-0 bottom-0 isolate flex flex-col items-center"
      style={{
        top: `${top}em`,
        padding: `48em 32em 0`,
        background: `radial-gradient(120% 70% at 25% 20%, ${c} 0%, ${b} 45%, ${a} 100%)`,
        color: '#fff',
      }}
    >
      {/* portret kao u MoodBackground — lice na 70% širine, utopljeno prije teksta */}
      <div
        className="absolute inset-0 -z-10 bg-no-repeat"
        style={{
          backgroundImage: `url(${FIGURE_SRC})`,
          backgroundSize: 'auto 118%',
          backgroundPosition: `${0.7 * w - 0.4 * h}em ${-0.02 * h}em`,
          mixBlendMode: m.blend,
          opacity: m.figure,
          maskImage: 'radial-gradient(ellipse 80% 62% at 78% 22%, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 62% at 78% 22%, black 30%, transparent 80%)',
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/signature.webp?v=2" alt="" style={{ height: '64em', width: 'auto', opacity: 0.9 }} />
      <div
        className="flex flex-1 flex-col items-center justify-center text-center"
        style={{ width: '304em', paddingBottom: '96em' }}
      >
        <p
          style={{
            fontFamily: 'var(--font-serif), serif',
            fontSize: '18.4em',
            lineHeight: 1.35,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          Jedan stih, svaki dan u {SEND_TIME}
        </p>
        <span
          style={{
            margin: '24em 0',
            width: '56em',
            height: '1em',
            background: `linear-gradient(to right, transparent, ${BRAND.gold}80, transparent)`,
          }}
        />
        <ol className="flex flex-col text-left" style={{ gap: '16em' }}>
          {steps.map((s, k) => (
            <li key={k} className="flex items-center" style={{ gap: '14em', color: 'rgba(255,255,255,0.55)' }}>
              <span
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: '26em',
                  height: '26em',
                  border: `1em solid ${BRAND.gold}40`,
                  color: `${BRAND.gold}D9`,
                }}
              >
                <span style={{ fontSize: '10em', fontWeight: 600 }}>{k + 1}</span>
              </span>
              <span style={{ fontSize: '13em', lineHeight: 1.5 }}>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
