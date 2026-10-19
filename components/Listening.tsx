'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { Mood } from '@/data/moods'
import { motion, useReducedMotion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { useFavorites } from '@/lib/client-store'
import { haptic } from '@/lib/haptic'
import { knownVerses, loadVerses } from '@/lib/verses-client'
import {
  listenSaved,
  minimizeSaved,
  nextSaved,
  pauseSaved,
  playSaved,
  playable,
  prevSaved,
  savedVerse,
  stopSaved,
  toggleRepeat,
  toggleShuffle,
  useSavedPlayer,
} from '@/lib/player'

/*
 * Sačuvani na početnoj: gramofon ispod stiha postaje plejer sačuvanih, a
 * ekran pokazuje stih pjesme koja svira — nova pjesma, novi stih (ispiše se,
 * pozadina se pretopi).
 *
 * Sve u stilu ekrana stiha: pilule kao "Sačuvaj" / "Podijeli" (FavoriteButton,
 * ShareButton) i čisti bijeli znakovi kao u zaglavlju. Ispod kontrola
 * pilula "Današnji stih" — dodir vrati današnji (mekan prelaz).
 */

/**
 * Prelaz: ekran stiha se mekano utiša, promijeni stih (`swap`) i mekano
 * vrati — pozadina se pretapa sama, novi stih se ispisuje. Bez animacija: odmah.
 */
function sweep(swap: () => void) {
  const main = document.querySelector<HTMLElement>('main')
  if (!main || matchMedia('(prefers-reduced-motion: reduce)').matches) return swap()
  main
    .animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 260,
      easing: 'ease-in',
      fill: 'forwards',
    })
    .finished.then((out) => {
      swap()
      requestAnimationFrame(() => {
        out.cancel()
        main.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 520,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        })
      })
    }, swap)
}

/** Sačuvani koje stranica zna, redom kao u špilu (najnoviji prvi), samo s pjesmom. */
function useSavedList(): Verse[] {
  const ids = useFavorites()
  // stranica je već donijela listu — inače stigne jednom (lib/verses-client.ts)
  const [all, setAll] = useState<Verse[]>(knownVerses)
  useEffect(() => {
    let alive = true
    loadVerses().then((v) => alive && v.length && setAll(v))
    return () => {
      alive = false
    }
  }, [])
  const byId = new Map(all.map((v) => [v.id, v]))
  return ids.flatMap((id) => {
    const v = byId.get(id)
    return v && v.youtube && playable(v) ? [v] : []
  })
}

/** Pilula kao "Sačuvaj" / "Podijeli" — isti oblik, slova i boje. */
const PILL =
  'flex h-10 items-center justify-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.03] px-4 text-[10px] font-medium uppercase tracking-[0.22em] text-white/75 backdrop-blur-sm'
const spring = { type: 'spring', stiffness: 460, damping: 20 } as const
/** pusti ⇄ pauza — kao u Apple Musicu, mekana opruga */
const GLYPH = { type: 'spring', stiffness: 520, damping: 32 } as const

/** "Player pjesama" (sačuvanih) — ispod gramofona, kad ima bar jedan sačuvan s pjesmom (inače `fallback`). */
export function ListenKey({ accent = '#BFA87F', fallback }: { accent?: string; fallback?: ReactNode }) {
  const list = useSavedList()
  if (!list.length) return fallback ?? null
  return (
    // ulazi mekano, malo poslije gramofona: izroni odozdo, iz magle
    <motion.span
      className="inline-flex"
      initial={{ opacity: 0, y: 12, scale: 0.92, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.button
        onClick={() => {
          haptic(8)
          // pjesma kreće odmah (iz dodira), ekran pređe na njen stih kroz prelaz
          const first = listenSaved(list, false)
          if (first) sweep(minimizeSaved)
        }}
        aria-label="Player pjesama"
        className={PILL}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        transition={spring}
      >
        {/* trake koje titraju kao muzika — poziv da se pusti */}
        <span className="flex h-3 items-end gap-[2px]" aria-hidden>
          {[0, 0.32, 0.12, 0.46].map((d, i) => (
            <span key={i} className="eq-bar block w-[2px] rounded-full" style={{ background: accent, animationDelay: `${d}s` }} />
          ))}
        </span>
        Player pjesama
        <span className="tabular text-white/40">{list.length}</span>
      </motion.button>
    </motion.span>
  )
}

/**
 * Jedno dugme plejera: lagano naraste pod mišem, stisne se pod prstom; znak
 * na dodir kratko "trzne" (natrag lijevo, naprijed desno) ili se okrene
 * (nasumično, ponovi). Kontrole ulaze jedna za drugom (`order`).
 */
function Ctl({
  label,
  onPress,
  size,
  order,
  color,
  pressed,
  kick,
  children,
}: {
  label: string
  onPress: () => void
  /** veličina dodira (px) */
  size: number
  order: number
  color?: string
  pressed?: boolean
  /** kako znak reaguje na dodir */
  kick?: 'left' | 'right' | 'spin'
  children: ReactNode
}) {
  const [n, setN] = useState(0)
  const still = useReducedMotion()
  const from = kick === 'left' ? { x: -7 } : kick === 'right' ? { x: 7 } : kick === 'spin' ? { rotate: -90, scale: 0.6 } : undefined
  return (
    <motion.button
      onClick={() => {
        haptic(5)
        setN((k) => k + 1)
        onPress()
      }}
      aria-label={label}
      aria-pressed={pressed}
      className="relative flex shrink-0 items-center justify-center rounded-full transition-colors duration-200 active:bg-white/10"
      style={{ width: size, height: size, color: color ?? '#fff' }}
      initial={still ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.14 }}
      whileTap={{ scale: 0.84 }}
      transition={{
        type: 'spring',
        stiffness: 460,
        damping: 22,
        opacity: { duration: 0.35, delay: 0.06 * order },
        y: { type: 'spring', stiffness: 300, damping: 24, delay: 0.06 * order },
      }}
    >
      <motion.span
        key={n}
        className="flex"
        initial={n && from && !still ? from : false}
        animate={{ x: 0, rotate: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 16 }}
      >
        {children}
      </motion.span>
    </motion.button>
  )
}

/**
 * Kontrole ispod gramofona, kao u Apple Musicu: krupni bijeli znakovi bez
 * okvira (natrag, pusti/pauza, naprijed), sitni nasumično i ponovi sa
 * strane. Ispod pilula "Današnji stih".
 */
export function RetroDeck({ accent, today }: { accent: string; today?: { text: string; mood: Mood } }) {
  const { playing, shuffle, repeat } = useSavedPlayer()
  // svaki dodir na pusti/pauza pusti talas iz dugmeta (bez animacija — ništa)
  const [wave, setWave] = useState(0)
  const still = useReducedMotion()
  const play = () => {
    haptic(6)
    setWave((w) => w + 1)
    const v = savedVerse()
    if (playing) pauseSaved()
    else if (v && !playSaved(v)) nextSaved()
  }
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex w-[min(calc(100vw-3rem),320px)] items-center justify-between">
        <Ctl label="Nasumično" onPress={toggleShuffle} size={40} order={0} pressed={shuffle} kick="spin" color={shuffle ? accent : 'rgba(255,255,255,0.4)'}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </svg>
        </Ctl>
        <Ctl label="Prethodna" onPress={prevSaved} size={56} order={1} kick="left">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M11.5 6.2v11.6a.8.8 0 0 1-1.25.66L2.8 13.2a1.4 1.4 0 0 1 0-2.4l7.45-5.26a.8.8 0 0 1 1.25.66z" />
            <path d="M21.5 6.2v11.6a.8.8 0 0 1-1.25.66L12.8 13.2a1.4 1.4 0 0 1 0-2.4l7.45-5.26a.8.8 0 0 1 1.25.66z" />
          </svg>
        </Ctl>
        {/* pusti/pauza — krupno, znakovi se pretope jedan u drugi; dodir pusti
            talas, a dok svira iza dugmeta mekano diše sjaj u boji stiha */}
        <motion.button
          onClick={play}
          aria-label={playing ? 'Pauza' : 'Pusti'}
          className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white transition-colors duration-200 active:bg-white/10"
          initial={still ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.86 }}
          transition={{
            type: 'spring',
            stiffness: 420,
            damping: 20,
            opacity: { duration: 0.35, delay: 0.12 },
          }}
        >
          <motion.span
            className="pointer-events-none absolute inset-1 rounded-full"
            style={{
              background: `radial-gradient(circle, ${accent}55 0%, transparent 70%)`,
            }}
            initial={false}
            animate={playing ? (still ? { opacity: 0.5, scale: 1 } : { opacity: [0.35, 0.8, 0.35], scale: [0.9, 1.15, 0.9] }) : { opacity: 0, scale: 0.8 }}
            transition={playing && !still ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
            aria-hidden
          />
          {wave > 0 && !still && (
            <motion.span
              key={wave}
              className="pointer-events-none absolute inset-0 rounded-full border-2"
              style={{ borderColor: accent }}
              initial={{ scale: 0.7, opacity: 0.7 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden
            />
          )}
          <motion.svg
            width="38"
            height="38"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
            className="absolute"
            initial={false}
            animate={{
              opacity: playing ? 1 : 0,
              scale: playing ? 1 : 0.5,
              rotate: playing ? 0 : -45,
            }}
            transition={GLYPH}
          >
            <rect x="5.2" y="3.8" width="4.6" height="16.4" rx="1.3" />
            <rect x="14.2" y="3.8" width="4.6" height="16.4" rx="1.3" />
          </motion.svg>
          <motion.svg
            width="38"
            height="38"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
            className="absolute"
            initial={false}
            animate={{
              opacity: playing ? 0 : 1,
              scale: playing ? 0.5 : 1,
              rotate: playing ? 45 : 0,
            }}
            transition={GLYPH}
          >
            <path d="M6.5 4.6v14.8a1.1 1.1 0 0 0 1.68.93l11.8-7.4a1.1 1.1 0 0 0 0-1.86L8.18 3.67A1.1 1.1 0 0 0 6.5 4.6z" />
          </motion.svg>
        </motion.button>
        <Ctl label="Sljedeća" onPress={nextSaved} size={56} order={3} kick="right">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M2.5 6.2v11.6a.8.8 0 0 0 1.25.66l7.45-5.26a1.4 1.4 0 0 0 0-2.4L3.75 5.54a.8.8 0 0 0-1.25.66z" />
            <path d="M12.5 6.2v11.6a.8.8 0 0 0 1.25.66l7.45-5.26a1.4 1.4 0 0 0 0-2.4l-7.45-5.26a.8.8 0 0 0-1.25.66z" />
          </svg>
        </Ctl>
        <Ctl label="Ponovi pjesmu" onPress={toggleRepeat} size={40} order={4} pressed={repeat} kick="spin" color={repeat ? accent : 'rgba(255,255,255,0.4)'}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m17 2 4 4-4 4" />
            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <path d="m7 22-4-4 4-4" />
            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
          </svg>
        </Ctl>
      </div>
      {/* nazad na današnji stih */}
      {today && <TodayPeek />}
    </div>
  )
}

/** "Današnji stih" — ista pilula kao "Player pjesama"; dodir vrati današnji (mekan prelaz). */
function TodayPeek() {
  return (
    <motion.button
      onClick={() => {
        haptic(8)
        sweep(stopSaved)
      }}
      aria-label="Nazad na današnji stih"
      className={PILL}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      transition={spring}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Današnji stih
    </motion.button>
  )
}
