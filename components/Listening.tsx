'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { MOODS } from '@/data/moods'
import { albumOf } from '@/data/albums'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { useFavorites } from '@/lib/client-store'
import { haptic } from '@/lib/haptic'
import { knownVerses, loadVerses } from '@/lib/verses-client'
import { fadeSwap } from '@/lib/fade-swap'
import { OVERRIDE_ON } from '@/lib/date'
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
function sweep(swap: () => void, dir: 1 | -1) {
  // kratko: utiša se, promijeni, vrati — stih ne kasni. U plejer sadržaj
  // blago ode gore (novi dođe odozdo), nazad na današnji obrnuto
  fadeSwap(document.querySelector<HTMLElement>('main'), swap, 200, 520, 12 * dir)
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

const spring = { type: 'spring', stiffness: 460, damping: 20 } as const
// footer u ritmu ekrana (sweep: 200 ms van, 520 ms nazad): staro tone, novo izroni
const DOCK_OUT = { duration: 0.2, ease: 'easeIn' } as const
const DOCK_IN = { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as const
/** pusti ⇄ pauza — kao u Apple Musicu, mekana opruga */
const GLYPH = { type: 'spring', stiffness: 520, damping: 32 } as const

/** Koliko sačuvanih s pjesmom ima (za raspored početne: traka na dnu ili ne). */
export function useSavedCount(): number {
  return useSavedList().length
}

/**
 * Footer početne — odvojen od gramofona linijom preko cijele širine, a
 * sadržaj stoji tačno na sredini između nje i donje ivice ekrana (i na
 * iPhoneu, s trakom za početni ekran).
 *
 * Dok sačuvani ne sviraju: pilula "Player pjesama" (omoti, broj, trake koje
 * titraju, pusti). Kad sviraju: footer je plejer — lijevo "Danas" (nazad na
 * današnji stih), u sredini natrag · pusti/pauza · naprijed, desno nasumično
 * i ponovi.
 */
export function PlayerDock({ accent = '#BFA87F', listening = false }: { accent?: string; listening?: boolean }) {
  const list = useSavedList()
  const still = useReducedMotion()
  if (!listening && !list.length) return null
  return (
    <motion.footer
      key="dock"
      className={`fixed inset-x-0 bottom-0 z-30 flex items-center justify-center pt-2 ${listening ? 'pb-[max(14px,calc(env(safe-area-inset-bottom)*0.6))]' : 'pb-[max(22px,calc(env(safe-area-inset-bottom)*0.6+6px))]'} ${OVERRIDE_ON ? 'dev-dock' : ''}`}
      initial={still ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16, transition: { duration: 0.25 } }}
      transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* plejer ⇄ pozivnica: staro potone, novo izroni odozdo */}
      <AnimatePresence mode="wait" initial={false}>
        {listening ? (
          <motion.div
            key="controls"
            className="relative w-full"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: DOCK_IN }}
            exit={{ opacity: 0, y: 12, transition: DOCK_OUT }}
          >
            <Controls accent={accent} />
          </motion.div>
        ) : (
          <motion.div
            key="invite"
            className="relative"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: DOCK_IN }}
            exit={{ opacity: 0, y: 12, transition: DOCK_OUT }}
          >
            <Invite list={list} accent={accent} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.footer>
  )
}

/** Pilula "Player pjesama": omoti · natpis · trake koje titraju. */
function Invite({ list, accent }: { list: Verse[]; accent: string }) {
  // do tri različita omota (ili boja raspoloženja kad omota nema)
  const sleeves: { key: string; cover?: string; tint: string }[] = []
  for (const v of list) {
    const cover = albumOf(v.album)?.cover
    const key = cover ?? v.id
    if (sleeves.some((x) => x.key === key)) continue
    sleeves.push({ key, cover, tint: MOODS[v.mood].gradient[1] })
    if (sleeves.length === 3) break
  }
  return (
    <motion.button
      onClick={() => {
        haptic(8)
        // pjesma kreće odmah (iz dodira), ekran pređe na njen stih kroz prelaz
        const first = listenSaved(list, false)
        if (first) sweep(minimizeSaved, 1)
      }}
      aria-label="Player pjesama"
      className="flex items-center gap-3 rounded-full bg-white/[0.05] py-[7px] pl-[7px] pr-4 transition-colors duration-200 hover:bg-white/[0.08]"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.95 }}
      transition={spring}
    >
      {/* tri omota, jedan preko drugog */}
      <span className="flex" aria-hidden>
        {sleeves.map((sl, i) => (
          <span
            key={sl.key}
            className="block h-[24px] w-[24px] rounded-full border-[1.5px] border-[#0c0b0a] bg-cover bg-center"
            style={{ backgroundImage: sl.cover ? `url(${sl.cover})` : undefined, backgroundColor: sl.tint, marginLeft: i ? -9 : 0, zIndex: 3 - i }}
          />
        ))}
      </span>
      <span className="text-[9.5px] font-medium uppercase tracking-[0.26em] text-white/70">
        Player pjesama <span className="tabular text-white/35">{list.length}</span>
      </span>
      {/* trake koje titraju kao muzika */}
      <span className="flex h-3 items-end gap-[2px]" aria-hidden>
        {[0, 0.32, 0.12, 0.46].map((d, i) => (
          <span key={i} className="eq-bar block w-[2px] rounded-full" style={{ background: accent, animationDelay: `${d}s` }} />
        ))}
      </span>
    </motion.button>
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
 * Plejer u footeru, kao u Apple Musicu: krupni bijeli znakovi bez okvira —
 * natrag, pusti/pauza, naprijed; sitni nasumično i ponovi sa strane. Ispod,
 * tiho, "Današnji stih" (sačuvani stanu, vrati se današnji).
 */
function Controls({ accent }: { accent: string }) {
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
    <div className="flex flex-col items-center gap-[18px]">
      <div className="flex w-[min(calc(100vw-3rem),320px)] items-center justify-between">
        <Ctl label="Nasumično" onPress={toggleShuffle} size={40} order={0} pressed={shuffle} kick="spin" color={shuffle ? accent : 'rgba(255,255,255,0.4)'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </svg>
        </Ctl>
        <Ctl label="Prethodna" onPress={prevSaved} size={52} order={1} kick="left">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M11.5 6.2v11.6a.8.8 0 0 1-1.25.66L2.8 13.2a1.4 1.4 0 0 1 0-2.4l7.45-5.26a.8.8 0 0 1 1.25.66z" />
            <path d="M21.5 6.2v11.6a.8.8 0 0 1-1.25.66L12.8 13.2a1.4 1.4 0 0 1 0-2.4l7.45-5.26a.8.8 0 0 1 1.25.66z" />
          </svg>
        </Ctl>
        {/* pusti/pauza — krupno, znakovi se pretope jedan u drugi; dodir pusti
            talas, a dok svira iza dugmeta mekano diše sjaj u boji stiha */}
        <motion.button
          onClick={play}
          aria-label={playing ? 'Pauza' : 'Pusti'}
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white transition-colors duration-200 active:bg-white/10"
          initial={still ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.86 }}
          transition={{ type: 'spring', stiffness: 420, damping: 20, opacity: { duration: 0.35, delay: 0.12 } }}
        >
          <motion.span
            className="pointer-events-none absolute inset-1 rounded-full"
            style={{ background: `radial-gradient(circle, ${accent}55 0%, transparent 70%)` }}
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
          <motion.svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="absolute" initial={false} animate={{ opacity: playing ? 1 : 0, scale: playing ? 1 : 0.5, rotate: playing ? 0 : -45 }} transition={GLYPH}>
            <rect x="5.2" y="3.8" width="4.6" height="16.4" rx="1.3" />
            <rect x="14.2" y="3.8" width="4.6" height="16.4" rx="1.3" />
          </motion.svg>
          <motion.svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="absolute" initial={false} animate={{ opacity: playing ? 0 : 1, scale: playing ? 0.5 : 1, rotate: playing ? 45 : 0 }} transition={GLYPH}>
            <path d="M6.5 4.6v14.8a1.1 1.1 0 0 0 1.68.93l11.8-7.4a1.1 1.1 0 0 0 0-1.86L8.18 3.67A1.1 1.1 0 0 0 6.5 4.6z" />
          </motion.svg>
        </motion.button>
        <Ctl label="Sljedeća" onPress={nextSaved} size={52} order={3} kick="right">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M2.5 6.2v11.6a.8.8 0 0 0 1.25.66l7.45-5.26a1.4 1.4 0 0 0 0-2.4L3.75 5.54a.8.8 0 0 0-1.25.66z" />
            <path d="M12.5 6.2v11.6a.8.8 0 0 0 1.25.66l7.45-5.26a1.4 1.4 0 0 0 0-2.4l-7.45-5.26a.8.8 0 0 0-1.25.66z" />
          </svg>
        </Ctl>
        <Ctl label="Ponovi pjesmu" onPress={toggleRepeat} size={40} order={4} pressed={repeat} kick="spin" color={repeat ? accent : 'rgba(255,255,255,0.4)'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m17 2 4 4-4 4" />
            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <path d="m7 22-4-4 4-4" />
            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
          </svg>
        </Ctl>
      </div>
      {/* nazad na današnji stih — tiho, bez okvira */}
      <motion.button
        onClick={() => {
          haptic(8)
          sweep(stopSaved, -1)
        }}
        aria-label="Nazad na današnji stih"
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9.5px] font-medium uppercase tracking-[0.24em] text-white/45 transition-colors hover:text-white/80"
        whileTap={{ scale: 0.94 }}
        transition={spring}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Današnji stih
      </motion.button>
    </div>
  )
}
