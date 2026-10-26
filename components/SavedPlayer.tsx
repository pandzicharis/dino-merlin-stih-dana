'use client'

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { MOODS } from '@/data/moods'
import { ALBUMS, albumOf, softOf, thumbOf } from '@/data/albums'
import { haptic } from '@/lib/haptic'
import { albumLine, asWritten } from '@/lib/text'
import { EqBars } from './EqBars'
import { toggleLoved } from '@/lib/storage'
import { audioFile } from '@/lib/audio-name'
import { dragScroll } from '@/lib/drag-scroll'
import { useIsLoved, useLoved } from '@/lib/client-store'
import { useLiveFront } from './SavedCarousel'
import { LyricsButton, LyricsIcon, LyricsPanel, primeLyrics, type LyricsClock } from './Lyrics'
import { BRAND } from '@/lib/brand'
import {
  OPEN_LYRICS,
  SAVED_TRACK,
  currentSaved,
  knownDuration,
  nextSaved,
  pauseSaved,
  playSaved,
  playable,
  prevSaved,
  savedSounding,
  savedVerse,
  seekSaved,
  setShownSaved,
  stopSaved,
  toggleRepeat,
  toggleShuffle,
  useSavedPlayerSelect,
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
/** pjesma (fajl) — dva stiha iste pjesme su ista pjesma */
export const keyOf = (v: Verse) => audioFile(v.song)
/** ključ pjesme koja je u plejeru (ili null) */
const nowKeyOf = (id: string | null) => {
  const v = id ? savedVerse() : null
  return v ? keyOf(v) : null
}
/** stih u jednom komadu — redovi spojeni razmakom */
const oneLine = (text: string) => {
  // u jednom komadu, kao rečenica: prvo slovo veliko, sve ostalo malo
  const t = asWritten(text).split('\n').map((l) => l.trim()).filter(Boolean).join(' ').toLocaleLowerCase('bs')
  return t.charAt(0).toLocaleUpperCase('bs') + t.slice(1)
}
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
      const a = v && keyOf(v) === id ? currentSaved() : null
      const d = a && Number.isFinite(a.duration) && a.duration > 0 ? a.duration : v && keyOf(v) === id ? knownDuration(v) : known
      const t = a ? a.currentTime : 0
      const f = d ? Math.min(1, t / d) : 0
      if (Math.abs(f - lastF) > 0.0015) {
        lastF = f
        if (fill.current) fill.current.style.transform = `scaleX(${f})`
        if (dot?.current) dot.current.style.transform = `translateX(${(f * 100).toFixed(2)}%)`
      }
      const n = mmss(t)
      if (now?.current && n !== lastNow) now.current.textContent = lastNow = n
      const l = d ? `-${mmss(Math.max(0, d - t))}` : ''
      if (left?.current && l !== lastLeft) left.current.textContent = lastLeft = l
      // dok ne svira (ili se plejer ne vidi — zatvoren panel; vidi ga mini
      // plejer), nema šta da se pomjera svaki kadar — provjera rjeđe
      const hidden = fill.current?.closest('[role="dialog"]')?.getAttribute('aria-hidden') === 'true'
      // dok svira: 10 puta u sekundi (traka se ionako pomjeri pola piksela za ~0,3 s) —
      // ne u svakom kadru, pa glavna nit ne šalje promjene usred listanja
      raf = window.setTimeout(tick, a && !a.paused && !hidden ? 100 : 400)
    }
    tick()
    return () => clearTimeout(raf)
  }, [id, fill, now, left, known, dot])
}

/** pjesma bez albuma — umjesto omota logo aplikacije (potpis) */
const art = (cover?: string) => `url(${cover ? (thumbOf(cover) ?? cover) : '/icons/icon-192.png?v=2'})`

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
        // sličica od 240 px (data/albums.ts), ne omot od 1200+
        backgroundImage: art(cover),
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
export function LoveButton({ song, accent, size = 34, icon = 17, ring = false }: { song: string; accent: string; size?: number; icon?: number; ring?: boolean }) {
  // omiljena je PJESMA (svi njeni stihovi), ne jedan stih
  const id = audioFile(song)
  const on = useIsLoved(id)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        haptic(on ? 6 : [10, 40, 10])
        toggleLoved(id)
      }}
      aria-label={on ? 'Makni iz omiljenih' : 'Dodaj u omiljene'}
      aria-pressed={on}
      className="flex shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
      style={{
        width: size,
        height: size,
        color: ring ? accent : on ? accent : 'rgba(255,255,255,0.4)',
        // `ring`: u krugu, kao srce i "Raširi" na karti
        ...(ring ? { border: `1px solid ${accent}55`, background: on ? `${accent}33` : `${accent}1a` } : {}),
      }}
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
        <path d={STAR} />
      </svg>
    </button>
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

export { EqBars } from './EqBars'

/** Šta pusti/pauza radi za pjesmu `cur` (ona u plejeru ili prednja karta). */
let lastToggle = 0
function toggle(cur: Verse, playing: boolean) {
  // dvostruki dodir (prst odskoči) se ne broji kao pusti pa pauza
  const t = performance.now()
  if (t - lastToggle < 400) return
  lastToggle = t
  haptic(6)
  // dugme kaže "svira", a zvuk je stao (iOS u pozadini) — dodir pusti
  if (playing && savedSounding()) return pauseSaved()
  if (!playSaved(cur)) nextSaved()
}

/**
 * Pozadina u atmosferi stiha — plejer i mini plejer nose boju karte iznad.
 * `see` (0…1): koliko se ispod boje vidi omot albuma — unaprijed zamućena
 * slika od 128 px kao obična pozadina (bez CSS blura i pretapanja).
 */
function moodBg(v: Verse, see = 0) {
  const m = MOODS[v.mood]
  const soft = see ? softOf(albumOf(v.album)?.cover) : undefined
  const a = soft ? Math.round((1 - see) * 255).toString(16).padStart(2, '0') : ''
  return `radial-gradient(130% 120% at 15% 0%, ${m.gradient[2]}66 0%, transparent 55%), radial-gradient(120% 120% at 100% 100%, ${m.gradient[1]}aa 0%, transparent 60%), linear-gradient(180deg, ${m.gradient[1]}${a} 0%, ${m.gradient[0]}${a} 100%)${soft ? `, url(${soft}) center / cover, ${m.gradient[1]}` : ''}`
}

/** Atmosfera stiha iza plejera — boje stiha, a ispod njih jedva omot albuma. */
function Atmosphere({ verse }: { verse: Verse }) {
  return (
    <div className="absolute inset-0" aria-hidden>
      <div className="absolute inset-0" style={{ background: moodBg(verse, 0.22) }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.4) 100%)' }} />
    </div>
  )
}

/** Pjesma kao ispod stiha na početnoj: naziv krupno u boji stiha, album · godina sitno. */
function Credit({ verse, size = 12.5, track = 0.18 }: { verse: Verse; size?: number; track?: number }) {
  const m = MOODS[verse.mood]
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold uppercase leading-tight" style={{ fontSize: size, letterSpacing: `${track}em`, color: m.accent }}>
        {verse.song}
      </p>
      <p className="mt-1.5 truncate text-[10px] uppercase tracking-[0.22em] text-white/55">
        {albumLine(verse)}
      </p>
    </div>
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
  // samo ono što plejer pokazuje — spuštanje i podizanje panela ga ne crtaju iznova
  const p = {
    id: useSavedPlayerSelect((s) => s.id),
    playing: useSavedPlayerSelect((s) => s.playing),
  }
  const nowKey = nowKeyOf(p.id)
  const loaded = verses.find((v) => v.id === p.id) ?? (nowKey ? verses.find((v) => keyOf(v) === nowKey) : undefined) ?? null
  // u špilu: karta na sredini dok se lista — pjesma se promijeni čim karta pređe pola puta
  const liveId = useLiveFront()
  const shownFront = (view === 'cards' && liveId && liveId !== front?.id ? verses.find((v) => v.id === liveId) : undefined) ?? front
  const inQueue = shownFront && verses.some((v) => v.id === shownFront.id) ? shownFront : shownFront && verses.find((v) => keyOf(v) === keyOf(shownFront))
  // u "Stihovi" plejer je uvijek pjesma prednje karte — "Pusti" pusti nju;
  // inače pjesma koja je u plejeru (pa prednja / prva)
  const cur = (view === 'cards' ? (inQueue ?? loaded) : (loaded ?? inQueue)) ?? verses[0] ?? null
  const isLoaded = Boolean(cur && nowKey && keyOf(cur) === nowKey)
  // pjesma koju plejer pokazuje — spušten bez puštanja, ostaje u mini plejeru
  useEffect(() => setShownSaved(cur && hasSong(cur) ? cur : null), [cur])
  // tekst pjesme (components/Lyrics.tsx): one koja svira — pređe li plejer na sljedeću, i tekst pređe
  const [lyrics, setLyrics] = useState(false)
  // ručica ploče (components/VinylDeck.tsx) otvara tekst
  useEffect(() => {
    const open = () => setLyrics(true)
    window.addEventListener(OPEN_LYRICS, open)
    return () => window.removeEventListener(OPEN_LYRICS, open)
  }, [])
  const sung = loaded ?? cur
  if (!cur) return null

  const m = MOODS[cur.mood]
  const playing = isLoaded && p.playing
  const n = verses.length
  const i = Math.max(0, verses.findIndex((v) => v.id === cur.id))

  const skip = (dir: 1 | -1) => {
    // svira (ili je pjesma u plejeru, a nije špil) — sljedeća/prethodna pjesma
    if (p.id && (p.playing || view !== 'cards')) return dir > 0 ? nextSaved() : prevSaved()
    // ništa ne svira u špilu — samo se špil pomjeri na susjednu kartu
    const v = verses[(((i + dir) % n) + n) % n]
    if (v) window.dispatchEvent(new CustomEvent(SAVED_TRACK, { detail: v.id }))
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
                {playing ? 'Trenutno' : isLoaded ? 'Pauzirano' : 'Pusti pjesmu'}
              </span>
            </div>
            <Credit verse={cur} />
          </div>
          <div className="flex shrink-0 flex-col items-end justify-between gap-1 self-stretch">
            <span className="tabular text-[10px] tracking-[0.18em] text-white/45">
              {i + 1} / {n}
            </span>
            {sung && <LyricsButton song={sung.song} onOpen={() => setLyrics(true)} playing={Boolean(loaded && sung === loaded && p.playing)} size={30} />}
          </div>
        </div>

        <Transport verse={cur} loaded={isLoaded} playing={playing} onSkip={skip} />

        {/* pogled iznad plejera: karte, lista pjesama (cijeli stih) ili albumi */}
        <div className="mt-4 flex justify-center">
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
      {sung && <SavedLyrics open={lyrics} verse={sung} onClose={() => setLyrics(false)} />}
    </div>
  )
}

/**
 * Traka napretka i kontrole plejera sačuvanih — u plejeru na dnu panela i
 * u panelu s tekstom (isti plejer: nasumično, prethodna, pusti, sljedeća, ponovi).
 */
function Transport({ verse, loaded, playing, onSkip }: { verse: Verse; loaded: boolean; playing: boolean; onSkip: (dir: 1 | -1) => void }) {
  const shuffle = useSavedPlayerSelect((s) => s.shuffle)
  const repeat = useSavedPlayerSelect((s) => s.repeat)
  const m = MOODS[verse.mood]
  const song = hasSong(verse)
  const fill = useRef<HTMLSpanElement>(null)
  const dot = useRef<HTMLSpanElement>(null)
  const now = useRef<HTMLSpanElement>(null)
  const left = useRef<HTMLSpanElement>(null)
  const track = useRef<HTMLDivElement>(null)
  useProgress(loaded ? keyOf(verse) : null, fill, now, left, !loaded && song ? knownDuration(verse) : 0, dot)
  // premotavanje: dodir ili povlačenje po traci
  const seekAt = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = track.current?.getBoundingClientRect()
    if (!r || !loaded) return
    seekSaved(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
  }

  return (
    <>
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
          {/* omot tačke širok kao traka — pomak u % od nje, bez mjerenja u svakom kadru */}
          <span ref={dot} className="pointer-events-none absolute inset-x-0 top-[4px] block h-3">
            <span
              className="absolute -left-1.5 top-0 block h-3 w-3 rounded-full bg-white"
              style={{ boxShadow: `0 0 0 3px ${m.accent}40, 0 2px 6px rgba(0,0,0,0.5)` }}
            />
          </span>
        </div>
        <div className="tabular flex justify-between text-[10px] text-white/50">
          <span ref={now}>0:00</span>
          <span ref={left}>{song ? `-${mmss(knownDuration(verse))}` : 'bez pjesme'}</span>
        </div>
      </div>

      {/* kontrole — kao u Apple Musicu: krupni bijeli znakovi, sitni sa strane */}
      <div className="mt-1 flex items-center justify-between px-1">
        <Btn label="Nasumično" onPress={toggleShuffle} size={40} pressed={shuffle} color={shuffle ? m.accent : 'rgba(255,255,255,0.5)'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </svg>
        </Btn>
        <Btn label="Prethodna" onPress={() => onSkip(-1)} size={54}>
          <svg width="31" height="31" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            {PREV}
          </svg>
        </Btn>
        <Btn label={playing ? 'Pauza' : 'Pusti'} onPress={() => song && toggle(verse, playing)} size={64} color={song ? '#fff' : 'rgba(255,255,255,0.3)'}>
          <PlayGlyph playing={playing} size={44} />
        </Btn>
        <Btn label="Sljedeća" onPress={() => onSkip(1)} size={54}>
          <svg width="31" height="31" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            {NEXT}
          </svg>
        </Btn>
        <Btn label="Ponovi pjesmu" onPress={toggleRepeat} size={40} pressed={repeat} color={repeat ? m.accent : 'rgba(255,255,255,0.5)'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m17 2 4 4-4 4" />
            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <path d="m7 22-4-4 4-4" />
            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
          </svg>
        </Btn>
      </div>
    </>
  )
}

/**
 * Tekst pjesme iz plejera sačuvanih: prati pjesmu koja je u plejeru (vrijeme
 * iz zajedničkog zvuka); plejer u drawer-u je isti kao ispod stiha.
 */
function SavedLyrics({ open, verse, onClose }: { open: boolean; verse: Verse; onClose: () => void }) {
  const id = useSavedPlayerSelect((s) => s.id)
  const playing = useSavedPlayerSelect((s) => s.playing)
  const shuffle = useSavedPlayerSelect((s) => s.shuffle)
  const repeat = useSavedPlayerSelect((s) => s.repeat)
  const on = keyOf(verse) === nowKeyOf(id) && playing
  // zvuk ove pjesme — samo dok je ona u plejeru
  const clock: LyricsClock = () => {
    const v = savedVerse()
    const a = v && keyOf(v) === keyOf(verse) ? currentSaved() : null
    const d = a && Number.isFinite(a.duration) && a.duration > 0 ? a.duration : knownDuration(verse)
    return { t: a?.currentTime ?? 0, d, playing: Boolean(a && !a.paused), loading: Boolean(a?.dataset.want && a.readyState < 3) }
  }

  return (
    <LyricsPanel
      open={open}
      verse={verse}
      clock={clock}
      // dodir na red: pjesma odatle (i krene, ako je stajala)
      onSeek={(t) => {
        const d = clock().d
        if (!on) playSaved(verse)
        if (d) seekSaved(Math.min(1, t / d))
      }}
      // isti plejer kao u sačuvanima: nasumično, prethodna, pusti, sljedeća, ponovi
      controls={{
        toggle: () => toggle(verse, on),
        seek: (f) => {
          if (!on) playSaved(verse)
          seekSaved(f)
        },
        prev: prevSaved,
        next: nextSaved,
        shuffle: { on: shuffle, toggle: toggleShuffle },
        repeat: { on: repeat, toggle: toggleRepeat },
      }}
      onClose={onClose}
    />
  )
}

/**
 * Red pjesme — isti u "Pjesme" i u karticama albuma, mirno kao u Apple
 * Musicu: omot (trake dok svira), naziv, cijeli stih običnim slovima i
 * trajanje. Pjesma koja je u plejeru je u boji stiha. Dodir pusti/pauzira.
 */
const SongItem = memo(function SongItem({ v, on, playing }: { v: Verse; on: boolean; playing: boolean }) {
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
          style={{ backgroundImage: art(cover), backgroundColor: m.gradient[2], boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
        >
          {on && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50">
              <EqBars accent={m.accent} on={playing} h={14} />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          {/* naziv pjesme velikim slovima — kao ispod stiha i na albumu */}
          <span className="block truncate text-[12px] font-semibold uppercase leading-tight tracking-[0.18em]" style={{ color: on ? m.accent : 'rgba(255,255,255,0.92)' }}>
            {v.song}
          </span>
          {/* cijeli stih — obična slova, u jednom komadu */}
          <span className="mt-1 block text-[12.5px] leading-snug text-white/50">{oneLine(v.text)}</span>
        </span>
      </button>
      {/* trajanje iznad zvjezdice */}
      <span className="flex shrink-0 flex-col items-center gap-0.5 self-stretch justify-center">
        <span className="tabular text-[11px] leading-none text-white/35">{song ? mmss(knownDuration(v)) : '—'}</span>
        <LoveButton song={v.song} accent={m.accent} size={30} />
      </span>
    </div>
  )
})

/**
 * Pri otvaranju prikaza pjesma koja svira je u fokusu — na sredini liste;
 * ako ništa ne svira, lista je na početku.
 */
function useFocusPlaying(list: React.RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    if (!active) return
    const el = list.current?.querySelector<HTMLElement>('[data-now="true"]')
    const pane = list.current?.closest<HTMLElement>('[data-pane]')
    if (!pane) return
    if (!el) {
      pane.scrollTop = 0
      return
    }
    // samo okvir prikaza (scrollIntoView bi pomjerio i panel)
    const r = el.getBoundingClientRect()
    const pr = pane.getBoundingClientRect()
    pane.scrollTop += r.top - pr.top - (pane.clientHeight - r.height) / 2.6
    // pri otvaranju prikaza — poslije korisnik skrola sam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}

/** Pjesme: lista sačuvanih (najnovija prva). */
export const SavedList = memo(function SavedList({ verses, front, active = true }: { verses: Verse[]; front: Verse | null; active?: boolean }) {
  const p = { id: useSavedPlayerSelect((s) => s.id), playing: useSavedPlayerSelect((s) => s.playing) }
  // po pjesmi: red pjesme je "trenutni" i kad svira drugi njen stih
  const nowKey = nowKeyOf(p.id)
  const curKey = nowKey ?? (front ? keyOf(front) : null)
  const ul = useRef<HTMLUListElement>(null)
  useFocusPlaying(ul, active)
  return (
    // redovi (i podloga reda koji svira) u liniji sa zaglavljem — od ikonice do ×
    <ul ref={ul} className="flex flex-col pt-1 [&>li+li]:border-t [&>li+li]:border-white/[0.06]">
      {verses.map((v) => (
        <li key={v.id} data-now={keyOf(v) === nowKey} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 68px' }}>
          <SongItem v={v} on={keyOf(v) === curKey} playing={p.playing && keyOf(v) === nowKey} />
        </li>
      ))}
    </ul>
  )
})

/** album bez sačuvanih stihova — isti (prazan) niz, da se kartica ne crta iznova */
const NONE: Verse[] = []

/**
 * Sačuvani po albumima, po godini od kraja (najnoviji album prvi). Svi albumi
 * su tu — oni iz kojih još nema stiha su prazni (zatamnjeni), na svom mjestu
 * u diskografiji. Pjesme bez (poznatog) albuma — jedna kartica, zadnja.
 */
function byAlbum(verses: Verse[]) {
  const got = new Map<string, Verse[]>()
  const loose: Verse[] = []
  for (const v of verses) {
    const name = albumOf(v.album)?.title
    if (!name) loose.push(v)
    else if (got.has(name)) got.get(name)!.push(v)
    else got.set(name, [v])
  }
  // ALBUMS su poredani od najstarijeg
  const all = [...ALBUMS].reverse().map((a) => ({ name: a.title, list: got.get(a.title) ?? NONE }))
  return loose.length ? [...all, { name: 'Bez albuma', list: loose }] : all
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
    lite = false,
  }: {
    name: string
    list: Verse[]
    width: number
    /** ova je ispred */
    ahead: boolean
    /** daleko od sredine — pjesme kao tihi obrisi (slože se kad se album približi) */
    lite?: boolean
    curId: string | null
    playingId: string | null
    /** dodir na susjednu karticu je dovede naprijed */
    onBring: () => void
  }) {
    const first = list[0]
    const album = albumOf(name)
    const cover = album?.cover
    const box = {
      'aria-label': name,
      'aria-hidden': !ahead,
      'data-album': true,
      className: 'relative flex shrink-0 snap-center snap-always flex-col overflow-hidden rounded-[24px] border border-white/[0.07]',
      // svoj stalni sloj: kartica (i zamućeni omot u njoj) nacrta se jednom, a skrol je samo pomjera
      style: { width: width || 'calc(100% - 40px)', height: ALBUM_H, contain: 'layout paint', willChange: 'transform' },
      onClickCapture: (e: React.MouseEvent) => {
        if (ahead) return
        e.stopPropagation()
        onBring()
      },
    } as const
    // još nijedan stih s ovog albuma — zatamnjen: omot jedva, bez pjesama
    if (!first) {
      const soft = softOf(cover)
      return (
        <section {...box}>
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(180deg, rgba(10,10,12,0.8) 0%, rgba(8,8,10,0.92) 100%)${soft ? `, url(${soft}) center / cover` : ''}, #0b0b0d` }}
            aria-hidden
          />
          <div className="relative flex shrink-0 items-center gap-3 px-4 pb-3 pt-4">
            <span
              className="block h-[72px] w-[72px] shrink-0 rounded-[14px] bg-cover bg-center opacity-35"
              style={{ backgroundImage: art(cover), boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold uppercase leading-tight tracking-[0.2em] text-white/45">{name}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/30">{album?.year} · još bez stiha</p>
            </div>
          </div>
          {/* ploča — mjesto za album koji tek dođe */}
          <div className="relative flex flex-1 items-center justify-center pb-6 text-white/[0.08]" aria-hidden>
            <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6.5" />
              <circle cx="12" cy="12" r="3" />
              <circle cx="12" cy="12" r="0.5" fill="currentColor" />
            </svg>
          </div>
        </section>
      )
    }
    return (
      <section {...box}>
        {/* boje albuma — samo zamućen omot, bez atmosfere stiha (slika se nacrta jednom u sloj kartice) */}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.7) 100%)${softOf(cover) ? `, url(${softOf(cover)}) center / cover` : ''}, #141416` }}
          aria-hidden
        />

        {/* album: omot, naziv, godina, broj pjesama — u liniji s pjesmama ispod
            (omot albuma počinje gdje i kartica pjesme) */}
        <div className="relative flex shrink-0 items-center gap-3 px-4 pb-3 pt-4">
          <span
            className="block h-[72px] w-[72px] shrink-0 rounded-[14px] bg-cover bg-center"
            style={{ backgroundImage: art(cover), backgroundColor: '#141416', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}
            aria-hidden
          />
          <div className="min-w-0">
            {/* naziv albuma velikim slovima — bijelo, boje daje omot */}
            <p className="truncate text-[14px] font-semibold uppercase leading-tight tracking-[0.2em] text-white">
              {name}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/55">
              {/* bez albuma — samo broj pjesama */}
              {album ? `${album.year} · ${pjesme(list.length)}` : pjesme(list.length)}
            </p>
          </div>
        </div>

        {/* njegove pjesme — isti redovi kao u "Pjesme", lista se skrola u kartici */}
        {/* samo okomito (`overflow-x-hidden`, `overscroll-y-contain`): vodoravan potez
            preko pjesama ide traci albuma — `touch-pan-y` / `overscroll-contain` su ga blokirali */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-none px-2 pb-2 [&>*+*]:border-t [&>*+*]:border-white/[0.06]">
          {lite
            ? list.slice(0, 6).map((v) => (
                <div key={v.id} className="flex items-center gap-3 px-2 py-3" aria-hidden>
                  <span className="block h-[46px] w-[46px] shrink-0 rounded-[10px] bg-white/[0.06]" />
                  <span className="flex flex-1 flex-col gap-2">
                    <span className="block h-2.5 w-1/2 rounded-full bg-white/[0.08]" />
                    <span className="block h-2 w-1/3 rounded-full bg-white/[0.05]" />
                  </span>
                </div>
              ))
            : list.map((v) => (
                <div key={v.id} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 68px' }}>
                  <SongItem v={v} on={curId === keyOf(v)} playing={playingId === keyOf(v)} />
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
    a.playingId === b.playingId &&
    a.lite === b.lite,
)

/**
 * Omiljene — pjesme označene zvjezdicom, redom koliko su slušane (najslušanija
 * gore). Naprijed/natrag u plejeru idu samo kroz njih (`onQueue`).
 */
export function SavedLoved({
  verses,
  onQueue,
  active = true,
}: {
  verses: Verse[]
  front: Verse | null
  onQueue?: (list: Verse[]) => void
  active?: boolean
}) {
  const p = { id: useSavedPlayerSelect((s) => s.id), playing: useSavedPlayerSelect((s) => s.playing) }
  const { ids, plays } = useLoved()
  const list = useMemo(
    () =>
      verses
        .filter((v) => ids.includes(keyOf(v)))
        .map((v, k) => ({ v, k }))
        .sort((a, b) => (plays[keyOf(b.v)] ?? 0) - (plays[keyOf(a.v)] ?? 0) || a.k - b.k)
        .map(({ v }) => v),
    [verses, ids, plays],
  )
  const key = list.map((v) => v.id).join('|')
  // red plejera javlja samo prikaz koji se gleda
  useEffect(() => {
    if (active) onQueue?.(list)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, onQueue, active])
  // ista pjesma kao u plejeru ispod: ona koja svira, inače prva
  const nowKey = nowKeyOf(p.id)
  const curKey = (nowKey && list.some((v) => keyOf(v) === nowKey) ? nowKey : null) ?? (list[0] ? keyOf(list[0]) : null)
  const ul = useRef<HTMLUListElement>(null)
  useFocusPlaying(ul, active)

  if (!list.length)
    return (
      // na sredini vidljivog dijela prikaza (iznad plejera)
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
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
    // redovi (i podloga reda koji svira) u liniji sa zaglavljem — od ikonice do ×
    <ul ref={ul} className="flex flex-col pt-1 [&>li+li]:border-t [&>li+li]:border-white/[0.06]">
      {list.map((v) => (
        <li key={v.id} data-now={keyOf(v) === nowKey} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 68px' }}>
          <SongItem v={v} on={keyOf(v) === curKey} playing={p.playing && keyOf(v) === nowKey} />
        </li>
      ))}
    </ul>
  )
}

/** visina kartice albuma */
export const ALBUM_H = 'min(46dvh, 400px)'

/** razmak između kartica albuma (px) */
const ALBUM_GAP = 12

/**
 * Albumi kao kartice — prevuci lijevo/desno za sljedeći album: pravi
 * vodoravni skrol sistema sa zaustavljanjem na kartici (kao karte stihova),
 * pa listanje ne zavisi od JavaScripta; svaka kartica je svoj sloj (nacrta se
 * jednom). Tačkice ispod pokazuju koji je. Kartica nosi omot (zamućen
 * iza), naziv velikim slovima i godinu, a ispod svoje pjesme — isti redovi
 * kao u "Pjesme", u listi koja se skrola gore-dolje unutar kartice.
 *
 * `onQueue`: pjesme albuma koji se sluša (ili je ispred) — naprijed/natrag
 * u plejeru idu samo kroz njih.
 */
export function SavedAlbums({
  verses,
  front,
  onQueue,
  active = true,
}: {
  verses: Verse[]
  front: Verse | null
  onQueue?: (list: Verse[]) => void
  active?: boolean
}) {
  const p = { id: useSavedPlayerSelect((s) => s.id), playing: useSavedPlayerSelect((s) => s.playing) }
  const nowKey = nowKeyOf(p.id)
  const cur = (nowKey ? verses.find((v) => keyOf(v) === nowKey) : undefined) ?? front
  const albums = useMemo(() => byAlbum(verses), [verses])
  // za slušače (traka, pjesma se promijenila) — uvijek trenutni niz
  const shelf = useRef(albums)
  useEffect(() => {
    shelf.current = albums
  }, [albums])
  const n = albums.length
  // na početku je ispred album pjesme koja svira — inače prvi koji ima pjesme
  const [at, setAt] = useState(() => {
    const k = albums.findIndex((a) => a.list.some((v) => keyOf(v) === nowKey))
    return k >= 0 ? k : Math.max(0, albums.findIndex((a) => a.list.length))
  })
  const i = Math.min(at, n - 1)
  // tačkica ispod — prati listanje odmah (album ispred i red plejera tek kad stane)
  const [dot, setDot] = useState(i)
  const strip = useRef<HTMLDivElement>(null)
  // kartica u liniji sa zaglavljem (20 px od ivice, kao ikonica i ×) — širinu
  // daje CSS (100% − 40px), pa je raspored tačan od prvog kadra, i kad se
  // prikaz tek pokaže (ne čeka mjerenje); sljedeća je odmah iza ivice — prevuci
  /** album `k` na sredini trake (`smooth`: mekano — tačkice, plejer prešao na drugi) */
  const scrollTo = useCallback((k: number, smooth: boolean) => {
    const el = strip.current
    const c = el?.querySelectorAll<HTMLElement>('[data-album]')[k]
    if (!el || !c) return
    el.scrollTo({ left: c.offsetLeft + c.offsetWidth / 2 - el.clientWidth / 2, behavior: smooth ? 'smooth' : 'instant' })
  }, [])
  const go = (k: number) => {
    const t = Math.max(0, Math.min(n - 1, k))
    if (t !== i) haptic(5)
    scrollTo(t, true)
  }
  // gdje je listanje stalo — tek tad se mijenja album ispred (i red plejera)
  useEffect(() => {
    const el = strip.current
    if (!el || n < 2) return
    let t = 0
    let raf = 0
    const nearest = () => {
      const cs = el.querySelectorAll<HTMLElement>('[data-album]')
      const step = cs.length > 1 ? cs[1].offsetLeft - cs[0].offsetLeft : 0
      // sakriven prikaz (0) — ništa se ne zaključuje
      if (!(step > 0)) return -1
      return Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / step)))
    }
    const settle = () => {
      clearTimeout(t)
      const k = nearest()
      if (k < 0) return
      setDot(k)
      setAt(k)
    }
    const onScroll = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0
          const k = nearest()
          if (k >= 0) setDot(k)
        })
      clearTimeout(t)
      t = window.setTimeout(settle, 90)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('scrollend', settle)
    // mišem (računar) — prst i trackpad ionako skrolaju sami
    const undrag = dragScroll(el, () => {
      const cs = el.querySelectorAll<HTMLElement>('[data-album]')
      return cs.length > 1 ? cs[1].offsetLeft - cs[0].offsetLeft : 0
    })
    return () => {
      undrag()
      clearTimeout(t)
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('scrollend', settle)
    }
  }, [n])
  // na svoje mjesto odmah — pri slaganju, kad se prikaz ponovo pokaže (Activity), kad se promijeni širina
  const iRef = useRef(i)
  useEffect(() => {
    iRef.current = i
  }, [i])
  useLayoutEffect(() => {
    scrollTo(iRef.current, false)
  }, [n, scrollTo])

  // prikaz opet vidljiv (Activity) — ispred je album pjesme koja sad svira
  useEffect(() => {
    const k = albums.findIndex((a) => a.list.some((v) => keyOf(v) === nowKeyOf(savedVerse()?.id ?? null)))
    if (k < 0) return
    const r = requestAnimationFrame(() => {
      scrollTo(k, false)
      setAt(k)
      setDot(k)
    })
    return () => cancelAnimationFrame(r)
    // samo pri pokazivanju prikaza
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // pjesma se promijenila (naprijed/natrag, kraj pjesme) — ispred dođe album
  // koji se sluša, i kad je gledan neki drugi
  const names = albums.map((a) => a.name).join('|')
  useEffect(() => {
    const onTrack = (e: Event) => {
      const key = nowKeyOf(String((e as CustomEvent).detail))
      const k = shelf.current.findIndex((a) => a.list.some((v) => keyOf(v) === key))
      if (k >= 0) scrollTo(k, true)
    }
    window.addEventListener(SAVED_TRACK, onTrack)
    return () => window.removeEventListener(SAVED_TRACK, onTrack)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names])

  const curKey = cur ? keyOf(cur) : null
  const playKey = p.playing ? nowKeyOf(p.id) : null
  // red za plejer: album pjesme koja svira, inače album ispred — i spušten
  // (mini plejer) ide samo kroz njega
  const playingAlbum = albums.findIndex((a) => a.list.some((v) => keyOf(v) === nowKey))
  const queue = albums[playingAlbum >= 0 ? playingAlbum : i]?.list
  const queueKey = queue?.map((v) => v.id).join('|') ?? ''
  useEffect(() => {
    // album bez pjesama — plejer ostaje na redu koji je imao
    if (queue?.length && active) onQueue?.(queue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueKey, onQueue, active])

  return (
    <div className="pt-2">
      <div className="-mx-5">
        <div
          ref={strip}
          data-hscroll
          className="relative flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ gap: ALBUM_GAP }}
        >
          {/* razmak do prvog/zadnjeg — da i oni stanu u liniju sa zaglavljem */}
          <div aria-hidden className="shrink-0" style={{ width: 20 - ALBUM_GAP }} />
          {albums.map(({ name, list }, k) => (
            <AlbumCard
              key={name}
              name={name}
              list={list}
              width={0}
              ahead={k === i}
              // samo kartica albuma koji ga ima — ostale se ne crtaju iznova
              curId={curKey && list.some((v) => keyOf(v) === curKey) ? curKey : null}
              playingId={playKey && list.some((v) => keyOf(v) === playKey) ? playKey : null}
              onBring={() => go(k)}
            />
          ))}
          <div aria-hidden className="shrink-0" style={{ width: 20 - ALBUM_GAP }} />
        </div>
      </div>

      {/* tačkice — koji je album; dodir skoči na njega */}
      {n > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {albums.map(({ name, list }, k) => (
            <button key={name} type="button" onClick={() => go(k)} aria-label={name} aria-current={k === dot} className="flex h-6 items-center px-0.5">
              {/* album bez stiha — prazan kružić */}
              <span
                className="block h-1.5 w-1.5 rounded-full"
                style={
                  list.length
                    ? { background: k === dot ? '#fff' : 'rgba(255,255,255,0.22)' }
                    : { boxShadow: `inset 0 0 0 1px rgba(255,255,255,${k === dot ? 0.7 : 0.22})` }
                }
              />
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
  const p = { id: useSavedPlayerSelect((s) => s.id), playing: useSavedPlayerSelect((s) => s.playing) }
  const v = p.id ? savedVerse() : null
  const fill = useRef<HTMLSpanElement>(null)
  const start = useRef<number | null>(null)
  const swiped = useRef(false)
  useProgress(v ? keyOf(v) : null, fill)
  // tekst pjesme koja svira — isti panel kao iz plejera
  const [lyrics, setLyrics] = useState(false)
  if (!v) return null
  const m = MOODS[v.mood]
  return (
    <>
    <motion.div
      role="button"
      tabIndex={0}
      aria-label="Otvori plejer pjesama"
      data-mini
      // bez z-indexa: u sloju panela je prvi, pa ga zatamnjenje i panel pri
      // podizanju prekriju prirodno — nema dva sloja koja se miješaju
      className="pointer-events-auto fixed inset-x-3 mx-auto max-w-[420px] cursor-pointer touch-none"
      // iznad trake za početni ekran (iPhone), inače malo zraka od dna; na
      // localhostu i iznad razvojne trake
      style={{ bottom: 'calc(max(14px, calc(env(safe-area-inset-bottom, 0px) + 4px)) + var(--dev-bar, 0px))' }}
      // `transform` kao string (ne y/scale) — Motion ga pusti kroz WAAPI, na
      // grafičkom procesoru, dok je glavna nit zauzeta panelom. Svuda iste
      // funkcije (translateY + scale), da prekinuta kretnja nastavi odakle je stala
      variants={{
        hidden: (why?: string) =>
          why === 'open'
            ? // panel se podiže preko njega — mini se blago podigne i ugasi ispod
              { opacity: 0, transform: 'translateY(-22px) scale(0.97)', transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }
            : { opacity: 0, transform: 'translateY(96px) scale(1)', transition: { duration: 0.3, ease: [0.4, 0, 1, 1] } },
        // tek kad panel ode s ekrana (0.42 s) — jedno pa drugo, ništa ne preskače
        // 0.24 s + LAG (SavedPanel, 0.12 s) — kad panel prođe
        shown: { opacity: 1, transform: 'translateY(0px) scale(1)', transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1], delay: 0.24 } },
      }}
      initial={{ opacity: 0, transform: 'translateY(26px) scale(1)' }}
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
          {/* omot je dugme za tekst pjesme — znak teksta u uglu (red je pun dugmadi) */}
          <button
            type="button"
            onPointerDown={() => primeLyrics(v.song)}
            onClick={() => {
              haptic(6)
              setLyrics(true)
            }}
            aria-label="Tekst pjesme"
            data-lyrics-open
            className="relative shrink-0 transition-transform active:scale-95"
          >
            <Cover verse={v} size={52} />
            <span
              className="absolute -bottom-1 -right-1 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[#16110A]"
              style={{ background: `linear-gradient(145deg, #F1E2BF, ${BRAND.gold})`, boxShadow: '0 2px 6px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(0,0,0,0.35)' }}
              aria-hidden
            >
              <LyricsIcon size={12} />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            {/* trenutno slušaš — trake titraju dok svira */}
            <div className="mb-1.5 flex items-center gap-1.5">
              <EqBars accent={m.accent} on={p.playing} h={9} />
              <span className="whitespace-nowrap text-[8px] font-medium uppercase tracking-[0.14em]" style={{ color: m.accent }}>
                {p.playing ? 'Trenutno' : 'Pauzirano'}
              </span>
            </div>
            <Credit verse={v} size={12} track={0.1} />
          </div>
          <Btn label="Prethodna" onPress={prevSaved} size={38}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              {PREV}
            </svg>
          </Btn>
          <Btn label={p.playing ? 'Pauza' : 'Pusti'} onPress={() => toggle(v, p.playing)} size={44}>
            <PlayGlyph playing={p.playing} size={28} />
          </Btn>
          <Btn label="Sljedeća" onPress={nextSaved} size={38}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              {NEXT}
            </svg>
          </Btn>
          {/* × — muzika stane, mini plejer ode */}
          <Btn label="Zatvori plejer" onPress={stopSaved} size={32} color="rgba(255,255,255,0.5)" zoom={1.3}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
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
    {/* pored mini plejera, ne u njemu — povlačenje u tekstu ne smije ugasiti muziku (povučen mini je gasi) */}
    <SavedLyrics open={lyrics} verse={v} onClose={() => setLyrics(false)} />
    </>
  )
}
