'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { MOODS } from '@/data/moods'
import { BRAND } from '@/lib/brand'
import { haptic } from '@/lib/haptic'
import { OPEN_LYRICS, OPEN_SAVED, SAVED_TRACK, pauseSaved, playSaved, savedVerse, takeFlyFrom, useSavedPlayer, warmSaved } from '@/lib/player'
import { VerseText } from './VerseText'

/** ploča u plejeru — širina ekrana bez zraka, najviše ovoliko */
const DISC = 'min(62vw, 250px)'
/** kriva iOS prelaza — ista kao kad se plejer otvara */
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

/**
 * Plejer sačuvanih kao gramofon: gore stih (kao naslov), u sredini velika
 * ploča. Prevuci ploču lijevo ili desno — druga sačuvana pjesma (svira li
 * muzika, odmah svira i ona); dodir na etiketu — pusti / pauza; dodir na
 * ručicu — tekst pjesme. Kad plejer otvori gramofon s početne, ploča izleti
 * s njegovog mjesta (openSaved → takeFlyFrom) — gramofon "naraste" u plejer.
 */
export function VinylDeck({ verses, onFront }: { verses: Verse[]; onFront?: (v: Verse) => void }) {
  const n = verses.length
  const [at, setAt] = useState(() => Math.max(0, verses.findIndex((v) => v.id === savedVerse()?.id)))
  const [dir, setDir] = useState<1 | -1>(1)
  const i = n ? ((at % n) + n) % n : 0
  const verse = verses[i]
  const p = useSavedPlayer()
  const playing = Boolean(verse && p.playing && p.id === verse.id)

  // plejer ispod pokazuje ovu pjesmu
  useEffect(() => {
    if (verse) onFront?.(verse)
  }, [verse, onFront])

  // plejer je prešao na drugu pjesmu (kraj pjesme, sljedeća) — ploča za njim
  const live = useRef({ verses, i })
  useEffect(() => {
    live.current = { verses, i }
  })
  useEffect(() => {
    const onTrack = (e: Event) => {
      const { verses: vs, i: cur } = live.current
      const to = vs.findIndex((v) => v.id === (e as CustomEvent).detail)
      if (to < 0 || to === cur) return
      setDir(to > cur ? 1 : -1)
      setAt(to)
    }
    window.addEventListener(SAVED_TRACK, onTrack)
    return () => window.removeEventListener(SAVED_TRACK, onTrack)
  }, [])

  const go = (d: 1 | -1) => {
    if (n < 2) return
    haptic(6)
    const next = verses[(((i + d) % n) + n) % n]
    setDir(d)
    setAt(i + d)
    // muzika svira — svira i nova ploča (iz ovog dodira, pa i na iPhoneu)
    if (p.playing && next) playSaved(next)
    warmSaved([verses[(((i + 2 * d) % n) + n) % n]])
  }

  // ploča izleti s gramofona početne na svoje mjesto (samo kad ga je on otvorio)
  const disc = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onOpen = () => {
      const from = takeFlyFrom()
      if (!from) return
      // dva kadra: ekran plejera je vidljiv, ploča stoji na svom mjestu
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const el = disc.current
          const to = el?.getBoundingClientRect()
          if (!el || !to?.width) return
          const dx = from.left + from.width / 2 - (to.left + to.width / 2)
          const dy = from.top + from.height / 2 - (to.top + to.height / 2)
          el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width})` }, { transform: 'none' }], { duration: 650, easing: EASE })
        }),
      )
    }
    window.addEventListener(OPEN_SAVED, onOpen)
    return () => window.removeEventListener(OPEN_SAVED, onOpen)
  }, [])

  if (!verse) return null
  const m = MOODS[verse.mood]

  return (
    <div className="flex h-full flex-col items-center justify-between pb-[92px] pt-2" data-vinyl-deck>
      {/* stih — naslov plejera; druga ploča, drugi stih (pretopi se) */}
      <div className="relative flex min-h-[86px] w-full flex-1 items-center justify-center px-1">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={verse.id}
            className="w-full text-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <VerseText text={verse.text} color={m.text} glow={m.accent} font={verse.font} appearAt={0} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* gramofon: ploča (prevuci) i ručica (tekst) */}
      <div ref={disc} className="relative mt-4 shrink-0" style={{ width: DISC, height: DISC }}>
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={verse.id}
            custom={dir}
            className="absolute inset-0 touch-pan-y"
            variants={{
              enter: (d: number) => ({ x: `${d * 115}%`, opacity: 0, rotate: d * 40 }),
              center: { x: '0%', opacity: 1, rotate: 0 },
              exit: (d: number) => ({ x: `${-d * 115}%`, opacity: 0, rotate: -d * 40 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
            drag={n > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60 || info.velocity.x < -500) go(1)
              else if (info.offset.x > 60 || info.velocity.x > 500) go(-1)
            }}
          >
            <Disc spinning={playing} accent={m.accent} />
            {/* etiketa: pusti / pauza */}
            <button
              type="button"
              onClick={() => {
                haptic(8)
                if (playing) pauseSaved()
                else playSaved(verse)
              }}
              aria-label={playing ? `Pauziraj "${verse.song}"` : `Pusti "${verse.song}"`}
              className="absolute left-1/2 top-1/2 flex h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
            >
              {playing ? (
                <svg width="22" height="22" viewBox="0 0 12 12" aria-hidden>
                  <rect x="2" y="1" width="3" height="10" rx="1" fill="#16110A" />
                  <rect x="7" y="1" width="3" height="10" rx="1" fill="#16110A" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 12 12" className="ml-[3px]" aria-hidden>
                  <path d="M2 1v10l9-5z" fill="#16110A" />
                </svg>
              )}
            </button>
          </motion.div>
        </AnimatePresence>
        <Arm down={playing} onOpen={() => window.dispatchEvent(new Event(OPEN_LYRICS))} />
      </div>
    </div>
  )
}

/** Ploča: brazde, zlatni rub, odsjaj, zlatna etiketa — vrti se dok svira. */
function Disc({ spinning, accent }: { spinning: boolean; accent: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg
      viewBox="0 0 100 100"
      className="vinyl-disc absolute inset-0 h-full w-full drop-shadow-[0_18px_40px_rgba(0,0,0,0.6)]"
      style={{ animation: 'vinyl-spin 3.6s linear infinite', animationPlayState: spinning ? 'running' : 'paused' }}
      aria-hidden
    >
      <defs>
        <radialGradient id={`${uid}d`} cx="50%" cy="50%" r="50%">
          <stop offset="0.3" stopColor="#36312B" />
          <stop offset="0.7" stopColor="#1B1917" />
          <stop offset="1" stopColor="#0B0A09" />
        </radialGradient>
        <linearGradient id={`${uid}l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F1E2BF" />
          <stop offset="0.45" stopColor={BRAND.gold} />
          <stop offset="1" stopColor="#8A7148" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#${uid}d)`} />
      <circle cx="50" cy="50" r="49.2" fill="none" stroke={BRAND.gold} strokeOpacity="0.5" strokeWidth="0.8" />
      {[45, 42, 39, 36, 33, 30, 27, 24].map((r, k) => (
        <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#fff" strokeOpacity={k % 2 ? 0.04 : 0.08} strokeWidth="0.4" />
      ))}
      {/* odsjaji — vrte se s pločom, pa se vidi da svira */}
      <path d="M50 5A45 45 0 0 1 89 27.5L50 50z" fill="#fff" fillOpacity="0.1" />
      <path d="M50 95A45 45 0 0 1 11 72.5L50 50z" fill="#fff" fillOpacity="0.06" />
      <circle cx="50" cy="50" r="17" fill={`url(#${uid}l)`} />
      <circle cx="50" cy="50" r="17" fill="none" stroke="#5E4C30" strokeWidth="0.5" />
      <circle cx="50" cy="50" r="13.5" fill="none" stroke={accent} strokeOpacity="0.35" strokeWidth="0.4" />
      <circle cx="50" cy="50" r="1.4" fill="#0c0a08" />
    </svg>
  )
}

/** Ručica gramofona — legne na ploču dok svira; dodir otvara tekst pjesme. */
function Arm({ down, onOpen }: { down: boolean; onOpen: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={() => {
        haptic(6)
        onOpen()
      }}
      aria-label="Tekst pjesme"
      title="Tekst pjesme"
      className="absolute -right-[6%] -top-[8%] h-[66%] w-[30%]"
      style={{ transformOrigin: '72% 10%' }}
      animate={{ rotate: down ? 24 : 4 }}
      transition={{ type: 'spring', stiffness: 120, damping: 18 }}
    >
      <svg viewBox="0 0 30 66" className="h-full w-full overflow-visible drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]" aria-hidden>
        {/* osovina */}
        <circle cx="21.6" cy="6.6" r="5" fill="#2a2520" stroke={BRAND.gold} strokeOpacity="0.7" strokeWidth="0.8" />
        <circle cx="21.6" cy="6.6" r="1.8" fill={BRAND.gold} />
        {/* krak i glava */}
        <path d="M21.6 6.6 L20 46 L13 58" fill="none" stroke="#d9cbb0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="8.5" y="55" width="8" height="5.5" rx="1.2" transform="rotate(34 12.5 57.75)" fill={BRAND.gold} />
      </svg>
    </motion.button>
  )
}
