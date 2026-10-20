'use client'

import { memo, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { MOODS } from '@/data/moods'
import { albumOf } from '@/data/albums'
import { haptic } from '@/lib/haptic'
import { asWritten } from '@/lib/text'
import { toggleLoved } from '@/lib/storage'
import { useLoved } from '@/lib/client-store'
import {
  SAVED_TRACK,
  currentSaved,
  knownDuration,
  nextSaved,
  pauseSaved,
  playSaved,
  playable,
  prevSaved,
  savedVerse,
  seekSaved,
  setShownSaved,
  stopSaved,
  toggleRepeat,
  toggleShuffle,
  useSavedPlayer,
} from '@/lib/player'

/*
 * Plejer pjesama — sačuvani stihovi su plejer.
 *
 *   SavedPlayer  plejer na dnu panela, u boji stiha: omot albuma, pjesma,
 *                traka napretka, kontrole i izbor pogleda
 *   SavedList    pjesme (pogled "Pjesme") — dodir pusti pjesmu
 *   SavedAlbums  albumi kao kartice koje se prevlače
 *   MiniPlayer   spušten plejer: pluta iznad dna početne; dodir ga
 *                podigne, povlačenje dolje gasi muziku
 */

/** Ikonica plejera pjesama: redovi liste i nota — u zaglavlju i u panelu. */
export function PlayerIconPaths() {
  return (
    <>
      <path d="M3.5 6h11M3.5 10.5h11M3.5 15h6.5" />
      <path d="M18 16.5V5.2l3 1.1" />
      <circle cx="15.7" cy="16.8" r="2.3" fill="currentColor" stroke="none" />
    </>
  )
}

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
const GLYPH = { type: 'spring', stiffness: 520, damping: 34 } as const

/** zvjezdica — omiljene pjesme */
const STAR = 'M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.9l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z'

/** Stihovi (špil karata) · Pjesme (lista) · Albumi · Omiljene */
const VIEWS: [View, string, ReactNode][] = [
  ['cards', 'Stihovi', <path key="c" d="M8 3.5h9.5A2.5 2.5 0 0 1 20 6v11M4 6.5h13v14H4z" />],
  ['list', 'Pjesme', <path key="l" d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />],
  [
    'albums',
    'Albumi',
    <g key="a">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="12" cy="12" r="0.6" />
    </g>,
  ],
  ['loved', 'Omiljene', <path key="h" d={STAR} />],
]

/** kako se sačuvani prikazuju iznad plejera */
export type View = 'cards' | 'list' | 'albums' | 'loved'

const hasSong = (v: Verse) => Boolean(v.youtube && playable(v))
/** stih u jednom komadu — redovi spojeni razmakom */
const oneLine = (text: string) => asWritten(text).split('\n').map((l) => l.trim()).filter(Boolean).join(' ')
/** 1 pjesma, 2–4 pjesme, 5 pjesama (i 21 pjesma, 22 pjesme…) */
function pjesme(n: number) {
  const d = n % 10
  const t = n % 100
  if (d === 1 && t !== 11) return `${n} pjesma`
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return `${n} pjesme`
  return `${n} pjesama`
}
const mmss = (s: number) => (Number.isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00')

/**
 * Napredak pjesme bez re-rendera: svaki kadar upiše dio (0…1) i vremena
 * direktno u DOM. `id`: pjesma za koju se crta — druga pjesma je na nuli.
 */
function useProgress(
  id: string | null,
  fill: React.RefObject<HTMLElement | null>,
  now?: React.RefObject<HTMLElement | null>,
  left?: React.RefObject<HTMLElement | null>,
  /** trajanje pjesme dok još nije puštena (sekunde) */
  known = 0,
  /** tačka na traci (lijevo u %) */
  dot?: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    let raf = 0
    // zadnje upisano — DOM se dira samo kad se nešto stvarno promijeni (tekst
    // vremena jednom u sekundi, traka kad se pomjeri bar pola piksela)
    let lastF = -1
    let lastNow = ''
    let lastLeft = ''
    const tick = () => {
      const v = savedVerse()
      const a = v && v.id === id ? currentSaved() : null
      const d = a && Number.isFinite(a.duration) && a.duration > 0 ? a.duration : v && v.id === id ? knownDuration(v) : known
      const t = a ? a.currentTime : 0
      const f = d ? Math.min(1, t / d) : 0
      if (Math.abs(f - lastF) > 0.0015) {
        lastF = f
        if (fill.current) fill.current.style.transform = `scaleX(${f})`
        if (dot?.current) dot.current.style.transform = `translateX(${f * (dot.current.parentElement?.clientWidth ?? 0)}px)`
      }
      const n = mmss(t)
      if (now?.current && n !== lastNow) now.current.textContent = lastNow = n
      const l = d ? `-${mmss(Math.max(0, d - t))}` : ''
      if (left?.current && l !== lastLeft) left.current.textContent = lastLeft = l
      // dok ne svira, nema šta da se pomjera — provjera rjeđe
      raf = a && !a.paused ? requestAnimationFrame(tick) : window.setTimeout(tick, 400)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(raf)
    }
  }, [id, fill, now, left, known, dot])
}

/** Omot albuma pjesme — samo slika (u plejeru i mini plejeru). */
function Cover({ verse, size }: { verse: Verse; size: number }) {
  const m = MOODS[verse.mood]
  const cover = albumOf(verse.album)?.cover
  return (
    <span
      className="block shrink-0 rounded-[10px] bg-cover bg-center"
      style={{
        width: size,
        height: size,
        backgroundImage: cover ? `url(${cover})` : undefined,
        backgroundColor: m.gradient[1],
        boxShadow: '0 6px 18px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.08)',
      }}
      aria-hidden
    />
  )
}

/** Dugme plejera: lagano naraste pod mišem, stisne se pod prstom. */
function Btn({
  label,
  onPress,
  size,
  color,
  pressed,
  zoom = 1.12,
  children,
}: {
  label: string
  onPress: () => void
  size: number
  color?: string
  pressed?: boolean
  /** koliko naraste pod mišem/prstom */
  zoom?: number
  children: ReactNode
}) {
  return (
    <motion.button
      type="button"
      onClick={() => {
        haptic(5)
        onPress()
      }}
      aria-label={label}
      aria-pressed={pressed}
      className="relative flex shrink-0 items-center justify-center rounded-full transition-colors duration-200 active:bg-white/10"
      style={{ width: size, height: size, color: color ?? '#fff' }}
      whileHover={{ scale: zoom, color: '#fff' }}
      whileTap={{ scale: 0.86 }}
      transition={{ type: 'spring', stiffness: 460, damping: 26 }}
    >
      {children}
    </motion.button>
  )
}

/** Zvjezdica — pjesma u "Omiljene" (ili van). */
export function LoveButton({ id, accent, size = 34, icon = 17 }: { id: string; accent: string; size?: number; icon?: number }) {
  const on = useLoved().ids.includes(id)
  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        haptic(on ? 6 : [10, 40, 10])
        toggleLoved(id)
      }}
      aria-label={on ? 'Makni iz omiljenih' : 'Dodaj u omiljene'}
      aria-pressed={on}
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, color: on ? accent : 'rgba(255,255,255,0.4)' }}
      whileTap={{ scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 460, damping: 20 }}
    >
      <motion.svg width={icon} height={icon} viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden key={String(on)} initial={on ? { scale: 0.6 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 14 }}>
        <path d={STAR} />
      </motion.svg>
    </motion.button>
  )
}

/** Pusti ⇄ pauza — znakovi se pretope jedan u drugi. */
function PlayGlyph({ playing, size }: { playing: boolean; size: number }) {
  return (
    <>
      <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className="absolute" initial={false} animate={{ opacity: playing ? 1 : 0, scale: playing ? 1 : 0.5 }} transition={GLYPH}>
        {PAUSE}
      </motion.svg>
      <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className="absolute translate-x-[1px]" initial={false} animate={{ opacity: playing ? 0 : 1, scale: playing ? 0.5 : 1 }} transition={GLYPH}>
        {PLAY}
      </motion.svg>
    </>
  )
}

/** Trake koje titraju kao muzika (stoje dok je pauza). */
export function EqBars({ accent, on, h = 12 }: { accent: string; on: boolean; h?: number }) {
  return (
    <span className="flex items-end gap-[2px]" style={{ height: h }} aria-hidden>
      {[0, 0.32, 0.12, 0.46].map((d, i) => (
        <span
          key={i}
          className="eq-bar block w-[2px] rounded-full"
          style={{ background: accent, animationDelay: `${d}s`, animationPlayState: on ? 'running' : 'paused' }}
        />
      ))}
    </span>
  )
}

/** Šta pusti/pauza radi za pjesmu `cur` (ona u plejeru ili prednja karta). */
function toggle(cur: Verse, playing: boolean) {
  haptic(6)
  if (playing) return pauseSaved()
  if (!playSaved(cur)) nextSaved()
}

/** Pozadina u atmosferi stiha — plejer i mini plejer nose boju karte iznad. */
function moodBg(v: Verse) {
  const m = MOODS[v.mood]
  return `radial-gradient(130% 120% at 15% 0%, ${m.gradient[2]}66 0%, transparent 55%), radial-gradient(120% 120% at 100% 100%, ${m.gradient[1]}aa 0%, transparent 60%), linear-gradient(180deg, ${m.gradient[1]} 0%, ${m.gradient[0]} 100%)`
}

/** Atmosfera stiha iza plejera; omot jedva, zamućen — pretopi se s pjesmom. */
function Atmosphere({ verse }: { verse: Verse }) {
  const cover = albumOf(verse.album)?.cover
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={verse.id}
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        aria-hidden
      >
        <div className="absolute inset-0" style={{ background: moodBg(verse) }} />
        {cover && (
          // mali sloj uvećan — izgleda kao jako zamućen, a crta se jeftino
          <div
            className="absolute left-0 top-0 h-[30%] w-[30%] origin-top-left bg-cover bg-center opacity-25"
            style={{ backgroundImage: `url(${cover})`, filter: 'blur(6px)', transform: 'scale(3.5)' }}
          />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.4) 100%)' }} />
      </motion.div>
    </AnimatePresence>
  )
}

/** Pjesma kao ispod stiha na početnoj: naziv krupno u boji stiha, album · godina sitno. */
function Credit({ verse, size = 12.5, track = 0.18 }: { verse: Verse; size?: number; track?: number }) {
  const m = MOODS[verse.mood]
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={verse.id}
        className="min-w-0"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="truncate font-semibold uppercase leading-tight" style={{ fontSize: size, letterSpacing: `${track}em`, color: m.accent }}>
          {verse.song}
        </p>
        <p className="mt-1.5 truncate text-[10px] uppercase tracking-[0.22em] text-white/55">
          {verse.album} · {verse.year}
        </p>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Plejer na dnu panela, u boji i atmosferi stiha iznad (karta izlazi iz
 * njega). Pjesma je ona koja je u plejeru, a dok ništa nije pušteno —
 * prednja karta (ili prva u listi). Natrag/naprijed bez muzike samo
 * pomjere špil. Dole "Lista pjesama" — pjesme sa cijelim stihom.
 */
export function SavedPlayer({
  verses,
  front,
  view,
  onView,
}: {
  verses: Verse[]
  front: Verse | null
  view: View
  onView: (v: View) => void
}) {
  const p = useSavedPlayer()
  const loaded = verses.find((v) => v.id === p.id) ?? null
  const inQueue = front && verses.some((v) => v.id === front.id) ? front : null
  // u "Stihovi" plejer je uvijek pjesma prednje karte — "Pusti" pusti nju;
  // inače pjesma koja je u plejeru (pa prednja / prva)
  const cur = (view === 'cards' ? (inQueue ?? loaded) : (loaded ?? inQueue)) ?? verses[0] ?? null
  const isLoaded = Boolean(cur && p.id === cur.id)
  const fill = useRef<HTMLSpanElement>(null)
  const dot = useRef<HTMLSpanElement>(null)
  const now = useRef<HTMLSpanElement>(null)
  const left = useRef<HTMLSpanElement>(null)
  const track = useRef<HTMLDivElement>(null)
  useProgress(isLoaded && cur ? cur.id : null, fill, now, left, !isLoaded && cur && hasSong(cur) ? knownDuration(cur) : 0, dot)
  // pjesma koju plejer pokazuje — spušten bez puštanja, ostaje u mini plejeru
  useEffect(() => setShownSaved(cur && hasSong(cur) ? cur : null), [cur])
  if (!cur) return null

  const m = MOODS[cur.mood]
  const playing = isLoaded && p.playing
  const song = hasSong(cur)
  const n = verses.length
  const i = Math.max(0, verses.findIndex((v) => v.id === cur.id))

  const skip = (dir: 1 | -1) => {
    // svira (ili je pjesma u plejeru, a nije špil) — sljedeća/prethodna pjesma
    if (p.id && (p.playing || view !== 'cards')) return dir > 0 ? nextSaved() : prevSaved()
    // ništa ne svira u špilu — samo se špil pomjeri na susjednu kartu
    const v = verses[(((i + dir) % n) + n) % n]
    if (v) window.dispatchEvent(new CustomEvent(SAVED_TRACK, { detail: v.id }))
  }
  // premotavanje: dodir ili povlačenje po traci
  const seekAt = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = track.current?.getBoundingClientRect()
    if (!r || !isLoaded) return
    seekSaved(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
  }

  return (
    // blago zaobljen gornji rub — traka preko cijele širine, karte izlaze iz nje
    <div data-player className="relative overflow-hidden rounded-t-[16px] shadow-[0_-18px_50px_rgba(0,0,0,0.45)]">
      <Atmosphere verse={cur} />
      {/* šav na vrhu — odavde karta izlazi */}
      <span className="pointer-events-none absolute inset-x-8 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${m.accent}b3, transparent)` }} aria-hidden />

      <div className="relative px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-5">
        {/* omot · pjesma · album */}
        <div className="flex items-center gap-2.5">
          <Cover verse={cur} size={58} />
          <div className="min-w-0 flex-1">
            {/* trenutno slušaš — trake titraju dok svira (stoje kad je pauza) */}
            <div className="mb-1.5 flex items-center gap-1.5">
              <EqBars accent={m.accent} on={playing} h={9} />
              <span className="text-[8.5px] font-medium uppercase tracking-[0.26em]" style={{ color: m.accent }}>
                {playing ? 'Trenutno slušaš' : isLoaded ? 'Pauzirano' : 'Pusti pjesmu'}
              </span>
            </div>
            <Credit verse={cur} />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 self-stretch">
            <span className="tabular text-[10px] tracking-[0.18em] text-white/45">
              {i + 1} / {n}
            </span>
            <LoveButton id={cur.id} accent={m.accent} size={30} />
          </div>
        </div>

        {/* traka napretka — dodir ili povlačenje premota */}
        <div className="mt-4">
          <div
            ref={track}
            data-nodrag
            aria-hidden
            className="relative flex h-5 cursor-pointer touch-none items-center"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              seekAt(e)
            }}
            onPointerMove={(e) => e.buttons && seekAt(e)}
          >
            <span className="relative block h-[4px] w-full overflow-hidden rounded-full bg-white/15">
              <span ref={fill} className="block h-full w-full origin-left rounded-full" style={{ background: `linear-gradient(90deg, ${m.accent}, #fff)`, transform: 'scaleX(0)' }} />
            </span>
            <span
              ref={dot}
              className="pointer-events-none absolute -left-1.5 top-[4px] block h-3 w-3 rounded-full bg-white"
              style={{ boxShadow: `0 0 0 3px ${m.accent}40, 0 2px 6px rgba(0,0,0,0.5)` }}
            />
          </div>
          <div className="tabular flex justify-between text-[10px] text-white/50">
            <span ref={now}>0:00</span>
            <span ref={left}>{song ? `-${mmss(knownDuration(cur))}` : 'bez pjesme'}</span>
          </div>
        </div>

        {/* kontrole — kao u Apple Musicu: krupni bijeli znakovi, sitni sa strane */}
        <div className="mt-1 flex items-center justify-between px-1">
          <Btn label="Nasumično" onPress={toggleShuffle} size={40} pressed={p.shuffle} color={p.shuffle ? m.accent : 'rgba(255,255,255,0.5)'}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
            </svg>
          </Btn>
          <Btn label="Prethodna" onPress={() => skip(-1)} size={48}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              {PREV}
            </svg>
          </Btn>
          <Btn label={playing ? 'Pauza' : 'Pusti'} onPress={() => song && toggle(cur, playing)} size={60} color={song ? '#fff' : 'rgba(255,255,255,0.3)'}>
            <PlayGlyph playing={playing} size={38} />
          </Btn>
          <Btn label="Sljedeća" onPress={() => skip(1)} size={48}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              {NEXT}
            </svg>
          </Btn>
          <Btn label="Ponovi pjesmu" onPress={toggleRepeat} size={40} pressed={p.repeat} color={p.repeat ? m.accent : 'rgba(255,255,255,0.5)'}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m17 2 4 4-4 4" />
              <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
              <path d="m7 22-4-4 4-4" />
              <path d="M21 13v1a4 4 0 0 1-4 4H3" />
            </svg>
          </Btn>
        </div>

        {/* pogled iznad plejera: karte, lista pjesama (cijeli stih) ili albumi */}
        <div className="mt-1.5 flex justify-center">
          <div className="relative flex rounded-full bg-black/25 p-[3px]" role="tablist" aria-label="Prikaz">
            {VIEWS.map(([v, label, icon]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => {
                  haptic(5)
                  onView(v)
                }}
                data-view={v}
                className="relative flex h-10 min-w-[44px] items-center justify-center gap-2 rounded-full px-3.5 text-[10px] font-medium uppercase tracking-[0.2em] transition-colors duration-300"
                style={{ color: view === v ? '#14100A' : 'rgba(255,255,255,0.65)' }}
              >
                {view === v && (
                  <motion.span layoutId="saved-view" className="absolute inset-0 rounded-full" style={{ background: m.accent }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                )}
                <svg className="relative" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {icon}
                </svg>
                {/* natpis samo na izabranom — četiri taba stanu i na malom ekranu */}
                {view === v ? <span className="relative">{label}</span> : <span className="sr-only">{label}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Red pjesme — isti u "Pjesme" i u karticama albuma, mirno kao u Apple
 * Musicu: omot (trake dok svira), naziv, cijeli stih običnim slovima i
 * trajanje. Pjesma koja je u plejeru je u boji stiha. Dodir pusti/pauzira.
 */
function SongItem({ v, on, playing }: { v: Verse; on: boolean; playing: boolean }) {
  const m = MOODS[v.mood]
  const cover = albumOf(v.album)?.cover
  const song = hasSong(v)
  return (
    <div
      className="flex w-full items-center gap-1 rounded-[14px] pr-1 transition-colors duration-300 hover:bg-white/[0.04]"
      style={{ background: on ? 'rgba(255,255,255,0.06)' : undefined }}
    >
      <button
        type="button"
        onClick={() => {
          haptic(6)
          if (!song) return window.dispatchEvent(new CustomEvent(SAVED_TRACK, { detail: v.id }))
          if (playing) pauseSaved()
          else playSaved(v)
        }}
        aria-current={on}
        className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2.5 text-left"
      >
        <span
          className="relative flex h-[46px] w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-cover bg-center"
          style={{ backgroundImage: cover ? `url(${cover})` : undefined, backgroundColor: m.gradient[2], boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
        >
          {on && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50">
              <EqBars accent={m.accent} on={playing} h={14} />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          {/* naziv pjesme velikim slovima — kao ispod stiha i na albumu */}
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold uppercase leading-tight tracking-[0.18em]" style={{ color: on ? m.accent : 'rgba(255,255,255,0.92)' }}>
              {v.song}
            </span>
            <span className="tabular shrink-0 text-[11px] text-white/35">{song ? mmss(knownDuration(v)) : '—'}</span>
          </span>
          {/* cijeli stih — obična slova, u jednom komadu */}
          <span className="mt-1 block text-[12.5px] leading-snug text-white/50">{oneLine(v.text)}</span>
        </span>
      </button>
      <LoveButton id={v.id} accent={m.accent} />
    </div>
  )
}

/**
 * Pri otvaranju prikaza pjesma koja svira je u fokusu — na sredini liste;
 * ako ništa ne svira, lista je na početku.
 */
function useFocusPlaying(list: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>('[data-now="true"]')
    if (el) el.scrollIntoView({ block: 'center' })
    // samo pri otvaranju prikaza — poslije korisnik skrola sam
  }, [list])
}

/** Pjesme: lista sačuvanih (najnovija prva). */
export function SavedList({ verses, front }: { verses: Verse[]; front: Verse | null }) {
  const p = useSavedPlayer()
  const cur = verses.find((v) => v.id === p.id) ?? front
  const ul = useRef<HTMLUListElement>(null)
  useFocusPlaying(ul)
  return (
    // -mx-2: omot i zvjezdica stoje u liniji sa zaglavljem (ikonica, ×), a
    // podloga reda viri malo van
    <ul ref={ul} className="-mx-2 flex flex-col pb-12 pt-1 [&>li+li]:border-t [&>li+li]:border-white/[0.06]">
      {verses.map((v, k) => (
        <motion.li key={v.id} data-now={p.id === v.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: Math.min(k, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}>
          <SongItem v={v} on={cur?.id === v.id} playing={cur?.id === v.id && p.id === v.id && p.playing} />
        </motion.li>
      ))}
    </ul>
  )
}

/** sačuvani po albumima, redom kako su sačuvani (najnoviji prvi) */
function byAlbum(verses: Verse[]) {
  const albums: { name: string; list: Verse[] }[] = []
  for (const v of verses) {
    const a = albums.find((x) => x.name === v.album)
    if (a) a.list.push(v)
    else albums.push({ name: v.album, list: [v] })
  }
  return albums
}

/**
 * Jedna kartica albuma. Memoizovana: dok se niz albuma prevlači (i kad se
 * plejer promijeni), crta se iznova samo kartica kojoj se nešto promijenilo.
 */
const AlbumCard = memo(
  function AlbumCard({
    name,
    list,
    width,
    ahead,
    curId,
    playingId,
    onBring,
  }: {
    name: string
    list: Verse[]
    width: number
    /** ova je ispred */
    ahead: boolean
    curId: string | null
    playingId: string | null
    /** dodir na susjednu karticu je dovede naprijed */
    onBring: () => void
  }) {
    const first = list[0]
    const m = MOODS[first.mood]
    const cover = albumOf(name)?.cover
    return (
      <section
        aria-label={name}
        aria-hidden={!ahead}
        className="relative flex shrink-0 flex-col overflow-hidden rounded-[24px] border border-white/[0.07]"
        style={{ width: width || '78%', height: 'min(46dvh, 400px)', contain: 'layout paint' }}
        onClickCapture={(e) => {
          if (ahead) return
          e.stopPropagation()
          onBring()
        }}
      >
        <div className="absolute inset-0" style={{ background: moodBg(first) }} aria-hidden />
        {cover && (
          <div
            className="absolute left-0 top-0 h-[30%] w-[30%] origin-top-left bg-cover bg-center opacity-35"
            style={{ backgroundImage: `url(${cover})`, filter: 'blur(5px)', transform: 'scale(3.5)' }}
            aria-hidden
          />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.6) 100%)' }} aria-hidden />

        {/* album: omot, naziv, godina, broj pjesama */}
        <div className="relative flex shrink-0 items-center gap-3 px-4 pb-3 pt-4">
          <span
            className="block h-[72px] w-[72px] shrink-0 rounded-[14px] bg-cover bg-center"
            style={{ backgroundImage: cover ? `url(${cover})` : undefined, backgroundColor: m.gradient[2], boxShadow: '0 10px 26px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.1)' }}
            aria-hidden
          />
          <div className="min-w-0">
            {/* naziv albuma velikim slovima — kao naziv pjesme ispod stiha */}
            <p className="truncate text-[14px] font-semibold uppercase leading-tight tracking-[0.2em]" style={{ color: m.accent }}>
              {name}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/55">
              {first.year} · {pjesme(list.length)}
            </p>
          </div>
        </div>

        {/* njegove pjesme — isti redovi kao u "Pjesme", lista se skrola u kartici */}
        <div className="relative flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto overscroll-contain px-2 pb-2 [&>*+*]:border-t [&>*+*]:border-white/[0.06]">
          {list.map((v) => (
            <div key={v.id}>
              <SongItem v={v} on={curId === v.id} playing={playingId === v.id} />
            </div>
          ))}
        </div>
      </section>
    )
  },
  (a, b) =>
    a.name === b.name &&
    a.list === b.list &&
    a.width === b.width &&
    a.ahead === b.ahead &&
    a.curId === b.curId &&
    a.playingId === b.playingId,
)

/**
 * Omiljene — pjesme označene zvjezdicom, redom koliko su slušane (najslušanija
 * gore). Naprijed/natrag u plejeru idu samo kroz njih (`onQueue`).
 */
export function SavedLoved({ verses, front, onQueue }: { verses: Verse[]; front: Verse | null; onQueue?: (list: Verse[]) => void }) {
  const p = useSavedPlayer()
  const { ids, plays } = useLoved()
  const list = useMemo(
    () =>
      verses
        .filter((v) => ids.includes(v.id))
        .map((v, k) => ({ v, k }))
        .sort((a, b) => (plays[b.v.id] ?? 0) - (plays[a.v.id] ?? 0) || a.k - b.k)
        .map(({ v }) => v),
    [verses, ids, plays],
  )
  const key = list.map((v) => v.id).join('|')
  useEffect(() => {
    onQueue?.(list)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, onQueue])
  // ista pjesma kao u plejeru ispod: ona koja svira, inače prva
  const cur = list.find((v) => v.id === p.id) ?? (front && list.find((v) => v.id === front.id)) ?? list[0] ?? null
  const ul = useRef<HTMLUListElement>(null)
  useFocusPlaying(ul)

  if (!list.length)
    return (
      <div className="flex flex-col items-center px-6 pb-14 pt-8 text-center">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-white/45">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
            <path d={STAR} />
          </svg>
        </span>
        <p className="text-[14px] text-white/80">Još nema omiljenih</p>
        <p className="mt-1.5 max-w-[15rem] text-[12.5px] leading-relaxed text-white/45">Zvjezdicom označi pjesme koje najviše slušaš — ovdje će biti redom kako ih slušaš.</p>
      </div>
    )

  return (
    // -mx-2: omot i zvjezdica stoje u liniji sa zaglavljem (ikonica, ×), a
    // podloga reda viri malo van
    <ul ref={ul} className="-mx-2 flex flex-col pb-12 pt-1 [&>li+li]:border-t [&>li+li]:border-white/[0.06]">
      {list.map((v, k) => (
        <motion.li key={v.id} data-now={p.id === v.id} layout="position" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: Math.min(k, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}>
          <SongItem v={v} on={cur?.id === v.id} playing={cur?.id === v.id && p.id === v.id && p.playing} />
        </motion.li>
      ))}
    </ul>
  )
}

/** razmak između kartica albuma (px) */
const ALBUM_GAP = 12

/**
 * Albumi kao kartice — prevuci lijevo/desno (i mišem) za sljedeći album:
 * cijeli niz klizi na grafičkom procesoru (transform + opruga), pa nema
 * treptaja. Tačkice ispod pokazuju koji je. Kartica nosi omot (zamućen
 * iza), naziv velikim slovima i godinu, a ispod svoje pjesme — isti redovi
 * kao u "Pjesme", u listi koja se skrola gore-dolje unutar kartice.
 *
 * `onQueue`: pjesme albuma koji se sluša (ili je ispred) — naprijed/natrag
 * u plejeru idu samo kroz njih.
 */
export function SavedAlbums({ verses, front, onQueue }: { verses: Verse[]; front: Verse | null; onQueue?: (list: Verse[]) => void }) {
  const p = useSavedPlayer()
  const cur = verses.find((v) => v.id === p.id) ?? front
  const albums = useMemo(() => byAlbum(verses), [verses])
  const n = albums.length
  // na početku je ispred album pjesme koja svira — inače prvi album
  const [at, setAt] = useState(() => Math.max(0, albums.findIndex((a) => a.list.some((v) => v.id === p.id))))
  const i = Math.min(at, n - 1)
  const box = useRef<HTMLDivElement>(null)
  const moved = useRef(false)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // kartica je 78% širine, na sredini; susjedne vire sa strane
  const card = Math.round(w * 0.78)
  const step = card + ALBUM_GAP
  const pad = (w - card) / 2
  const go = (k: number) => {
    const t = Math.max(0, Math.min(n - 1, k))
    if (t !== i) haptic(5)
    setAt(t)
  }

  // pjesma se promijenila (naprijed/natrag, kraj pjesme) — ispred dođe album
  // koji se sluša, i kad je gledan neki drugi
  const names = albums.map((a) => a.name).join('|')
  useEffect(() => {
    const onTrack = (e: Event) => {
      const id = String((e as CustomEvent).detail)
      const k = byAlbum(verses).findIndex((a) => a.list.some((v) => v.id === id))
      if (k >= 0) setAt(k)
    }
    window.addEventListener(SAVED_TRACK, onTrack)
    return () => window.removeEventListener(SAVED_TRACK, onTrack)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names])

  // red za plejer: album pjesme koja svira, inače album ispred — i spušten
  // (mini plejer) ide samo kroz njega
  const playingAlbum = albums.findIndex((a) => a.list.some((v) => v.id === p.id))
  const queue = albums[playingAlbum >= 0 ? playingAlbum : i]?.list
  const queueKey = queue?.map((v) => v.id).join('|') ?? ''
  useEffect(() => {
    if (queue) onQueue?.(queue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueKey, onQueue])

  return (
    <div className="pb-12 pt-2">
      <div ref={box} className="-mx-5 overflow-hidden">
        <motion.div
          className="flex touch-pan-y"
          style={{ gap: ALBUM_GAP, paddingLeft: pad, paddingRight: pad, willChange: 'transform' }}
          initial={false}
          animate={{ x: -i * step }}
          transition={{ type: 'spring', stiffness: 300, damping: 34 }}
          // povlačenje nije dodir na pjesmu
          onPointerDownCapture={() => (moved.current = false)}
          onDragStart={() => (moved.current = true)}
          onClickCapture={(e) => {
            if (!moved.current) return
            moved.current = false
            e.stopPropagation()
            e.preventDefault()
          }}
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: -(n - 1) * step, right: 0 }}
          dragElastic={0.12}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            const swipe = Math.abs(info.offset.x) > card * 0.22 || Math.abs(info.velocity.x) > 400
            if (swipe) go(i + (info.offset.x < 0 ? 1 : -1))
            else go(i)
          }}
        >
          {albums.map(({ name, list }, k) => (
            <AlbumCard
              key={name}
              name={name}
              list={list}
              width={card}
              ahead={k === i}
              curId={cur?.id ?? null}
              playingId={p.playing ? p.id : null}
              onBring={() => go(k)}
            />
          ))}
        </motion.div>
      </div>

      {/* tačkice — koji je album; dodir skoči na njega */}
      {n > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {albums.map(({ name, list }, k) => (
            <button key={name} type="button" onClick={() => go(k)} aria-label={name} aria-current={k === i} className="flex h-6 items-center px-0.5">
              <span className="block h-1.5 rounded-full transition-all duration-300" style={{ width: k === i ? 18 : 6, background: k === i ? MOODS[list[0].mood].accent : 'rgba(255,255,255,0.22)' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Mini plejer — kad se panel spusti, pluta iznad dna početne: zaobljena
 * kartica u boji stiha koji svira, omot, pjesma i album, natrag · pusti/
 * pauza · naprijed · × (zatvori), tanka linija napretka. Dodir pored dugmadi
 * (ili povlačenje gore) podigne panel; × ili povlačenje dolje gasi muziku.
 *
 * Kretnja: panel klizne dolje, a mini plejer izroni (opruga) dok panel
 * prolazi kroz njegovo mjesto; pri otvaranju panel naraste preko njega, a
 * on se pretopi (`custom`: "open" | "stop" iz AnimatePresence).
 */
export function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const p = useSavedPlayer()
  const v = savedVerse()
  const fill = useRef<HTMLSpanElement>(null)
  const start = useRef<number | null>(null)
  const swiped = useRef(false)
  useProgress(v?.id ?? null, fill)
  if (!v) return null
  const m = MOODS[v.mood]
  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label="Otvori plejer pjesama"
      className="pointer-events-auto fixed inset-x-3 z-[101] mx-auto max-w-[420px] cursor-pointer touch-none"
      // iznad trake za početni ekran (iPhone), inače malo zraka od dna; na
      // localhostu i iznad razvojne trake
      style={{ bottom: 'calc(max(14px, calc(env(safe-area-inset-bottom, 0px) + 4px)) + var(--dev-bar, 0px))' }}
      variants={{
        hidden: (why?: string) =>
          why === 'open'
            ? { opacity: 0, y: -18, scale: 1.03, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }
            : { opacity: 0, y: 96, transition: { duration: 0.3, ease: [0.4, 0, 1, 1] } },
        shown: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 360, damping: 30, delay: 0.16 } },
      }}
      initial={{ opacity: 0, y: 48, scale: 0.94 }}
      animate="shown"
      exit="hidden"
      onPointerDown={(e) => {
        if ((e.target as Element).closest('button')) return
        start.current = e.clientY
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerUp={(e) => {
        const y0 = start.current
        start.current = null
        // povučen dolje — muzika stane i mini plejer ode (dodir koji slijedi se ne broji)
        if (y0 != null && e.clientY - y0 > 40) {
          haptic(6)
          swiped.current = true
          stopSaved()
        }
      }}
      onClick={(e) => {
        if (swiped.current) return (swiped.current = false)
        if ((e.target as Element).closest('button')) return
        // dodir (ili povlačenje gore) — panel se podigne
        haptic(6)
        onOpen()
      }}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      {/* bez okvira — samo boja stiha i meka sjena */}
      <div className="relative overflow-hidden rounded-[24px] shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
        <Atmosphere verse={v} />
        {/* jedan red: omot · trenutno slušaš, pjesma i album · natrag, pusti/pauza, naprijed */}
        <div className="relative flex items-center gap-2 py-3 pl-3 pr-2">
          <Cover verse={v} size={52} />
          <div className="min-w-0 flex-1">
            {/* trenutno slušaš — trake titraju dok svira */}
            <div className="mb-1.5 flex items-center gap-1.5">
              <EqBars accent={m.accent} on={p.playing} h={9} />
              <span className="whitespace-nowrap text-[8px] font-medium uppercase tracking-[0.14em]" style={{ color: m.accent }}>
                {p.playing ? 'Trenutno slušaš' : 'Pauzirano'}
              </span>
            </div>
            <Credit verse={v} size={12.5} track={0.1} />
          </div>
          <Btn label="Prethodna" onPress={prevSaved} size={34}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              {PREV}
            </svg>
          </Btn>
          <Btn label={p.playing ? 'Pauza' : 'Pusti'} onPress={() => toggle(v, p.playing)} size={40}>
            <PlayGlyph playing={p.playing} size={25} />
          </Btn>
          <Btn label="Sljedeća" onPress={nextSaved} size={34}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              {NEXT}
            </svg>
          </Btn>
          {/* × — muzika stane, mini plejer ode */}
          <Btn label="Zatvori plejer" onPress={stopSaved} size={28} color="rgba(255,255,255,0.45)" zoom={1.35}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </Btn>
        </div>
        {/* napredak — sam donji rub kartice se puni (ne dodatna linija) */}
        <span className="absolute inset-x-0 bottom-0 block h-[2px] bg-white/[0.06]" aria-hidden>
          <span ref={fill} className="block h-full w-full origin-left" style={{ background: `linear-gradient(90deg, ${m.accent}, #fff)`, transform: 'scaleX(0)' }} />
        </span>
      </div>
    </motion.div>
  )
}
