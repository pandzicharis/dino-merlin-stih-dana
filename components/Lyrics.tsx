'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { MOODS } from '@/data/moods'
import { BRAND } from '@/lib/brand'
import { albumLine, loose } from '@/lib/text'
import { albumOf, thumbOf } from '@/data/albums'
import { EqBars } from './EqBars'
import { haptic } from '@/lib/haptic'
import { ROUND, VerseDrawer } from './VerseDrawer'

/*
 * Tekst pjesme — uz plejer ispod stiha (components/SongCredit.tsx) i u
 * plejeru sačuvanih (components/SavedPlayer.tsx). Donji panel kao ostali
 * (components/Sheet.tsx): izlazi odozdo, povuci nadolje bilo gdje i zatvori se.
 *
 * Dva načina, po onome što stigne s /api/lyrics:
 *   - prati pjesmu (LRCLIB, lib/lrclib.ts): red koji se pjeva je osvijetljen
 *     i stoji pri vrhu, ostali su prigušeni; dodir na red premota pjesmu do
 *     njega — kao na Spotifyju i Instagramu. Gore stoji znak muzike (trake
 *     koje sviraju), a male trake i u instrumentalu
 *   - običan tekst (dinomerlin.com, lib/dino-site.ts): bez vremena — stoji,
 *     čita se i skrola rukom
 * Tekst koji prati pjesmu: pauza ga zaustavi, premotavanje pomjeri, a prst
 * ga preuzme — kad se pusti, sam se vrati na svoje mjesto. Dok svira, iza
 * teksta diše sjaj.
 */

type Lyrics = { title: string; lines: string[]; url?: string; synced?: { t: number; l: string }[]; offset?: number }

/** Zvuk pjesme — čita se u svakom kadru. `loading`: traži da svira, a zvuk još nije stigao. */
export type LyricsClock = () => { t: number; d: number; playing: boolean; loading?: boolean }

/**
 * Plejer u drawer-u — isti kao plejer sačuvanih, i za gramofon ispod stiha.
 * Uz listu (sačuvani): nasumično, prethodna, sljedeća, ponovi; bez nje
 * (jedan stih) na mjestu prethodne/sljedeće je deset sekundi nazad/naprijed.
 */
export type LyricsControls = {
  toggle: () => void
  seek: (fraction: number) => void
  prev?: () => void
  next?: () => void
  shuffle?: { on: boolean; toggle: () => void }
  repeat?: { on: boolean; toggle: () => void }
}

/* po pjesmi, 10 minuta — aplikacija zna danima stajati otvorena, a ispravljen
   tekst (pomak, vremena redova) mora stići; greška se ne pamti */
const cache = new Map<string, { at: number; p: Promise<Lyrics | null> }>()
function load(song: string): Promise<Lyrics | null> {
  const hit = cache.get(song)
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.p
  const p = fetch(`/api/lyrics/${encodeURIComponent(song)}`).then(async (r) => {
    if (r.status === 404) return null
    if (!r.ok) throw new Error(String(r.status))
    return (await r.json()) as Lyrics
  })
  cache.set(song, { at: Date.now(), p })
  p.catch(() => cache.delete(song))
  return p
}

/** Pripremi tekst unaprijed (prst na dugmetu, pjesma krenula) — panel se otvori pun. */
export const primeLyrics = (song: string) => void load(song).catch(() => {})

const SERIF = 'var(--font-serif), serif'


/** Znak teksta pjesme: redovi i nota. */
export function LyricsIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 6h11M3.5 10.5h11M3.5 15h6" />
      <path d="M17.5 19.5a2 2 0 1 1-2-2V9.5l4-1" />
    </svg>
  )
}

/* širine redova u znaku — kao tekst u tri reda */
const ROWS = [1, 0.6, 0.82]

/**
 * Dugme za tekst pjesme — bez natpisa: zlatni krug s tri reda teksta koji,
 * dok pjesma svira, "pjevaju" (dišu jedan za drugim), a krug blago sija.
 */
export function LyricsButton({ song, onOpen, playing = false, size = 32 }: { song: string; onOpen: () => void; playing?: boolean; size?: number }) {
  return (
    <motion.button
      type="button"
      onPointerDown={() => primeLyrics(song)}
      onClick={(e) => {
        e.stopPropagation()
        haptic(6)
        onOpen()
      }}
      aria-label="Tekst pjesme"
      title="Tekst pjesme"
      data-lyrics-open
      className="relative flex shrink-0 items-center justify-center rounded-full border transition-shadow duration-500"
      style={{
        width: size,
        height: size,
        borderColor: `${BRAND.gold}5c`,
        background: `radial-gradient(circle at 30% 25%, ${BRAND.gold}33, ${BRAND.gold}0d 70%)`,
        boxShadow: playing ? `0 0 16px ${BRAND.gold}45` : 'none',
      }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.9 }}
    >
      <span className="flex flex-col items-start gap-[2.5px]" style={{ width: Math.round(size * 0.42) }} aria-hidden>
        {ROWS.map((w, i) => (
          <motion.i
            key={i}
            className="block h-[1.7px] w-full origin-left rounded-full"
            style={{ background: BRAND.gold }}
            initial={false}
            animate={playing ? { scaleX: [w, w * 0.4, w] } : { scaleX: w }}
            transition={playing ? { duration: 1.5, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' } : { duration: 0.3 }}
          />
        ))}
      </span>
    </motion.button>
  )
}

/**
 * Panel s tekstom: gore natpis i pjesma, sačuvaj i podijeli; tekst u slovima
 * stiha; dole plejer (`footer` — gramofon kao ispod stiha). Druga pjesma
 * (plejer sačuvanih pređe na sljedeću) — tekst se pretopi u njen.
 */
export function LyricsPanel({
  open,
  verse,
  clock,
  controls,
  onSeek,
  onClose,
}: {
  open: boolean
  verse: Verse
  clock: LyricsClock
  controls: LyricsControls
  /** premotaj na sekundu — dodir na red */
  onSeek?: (t: number) => void
  onClose: () => void
}) {
  const now = useClockState(clock, open)
  return (
    <VerseDrawer
      open={open}
      verse={verse}
      label={`Tekst — ${verse.song}`}
      // zaglavlje kao na ostalim panelima: znak, natpis i naslov, zatvori
      header={
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
            style={{ borderColor: `${BRAND.gold}55`, background: `radial-gradient(circle, ${BRAND.gold}24, transparent 70%)`, color: BRAND.gold }}
            aria-hidden
          >
            <LyricsIcon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.28em]" style={{ color: BRAND.gold }}>
              Dino Merlin
            </p>
            <p className="text-[1.1rem] text-white/90" style={{ fontFamily: SERIF }}>
              Tekst pjesme
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Zatvori" data-drawer-close className={ROUND}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      }
      onClose={onClose}
      data-lyrics
    >
      {/* tekst — pjesma za pjesmom se pretapa (plejer sačuvanih) */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={verse.song}
          className="relative z-10 flex min-h-0 flex-1 flex-col"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <Body verse={verse} clock={clock} onSeek={onSeek} />
        </motion.div>
      </AnimatePresence>

      {/* pjesma (omot, trenutno slušaš, naziv i album), pa plejer — isti za gramofon i sačuvane */}
      <div className="relative z-10 shrink-0 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2" data-player>
        <SongHead verse={verse} playing={now.playing} started={now.t > 0} />
        <div className="mt-3">
          <DrawerPlayer now={now} controls={controls} accent={MOODS[verse.mood].accent} />
        </div>
      </div>
    </VerseDrawer>
  )
}

type ClockState = { t: number; d: number; playing: boolean; loading: boolean }

/** Stanje zvuka za zaglavlje i plejer — četiri puta u sekundi, samo dok je panel otvoren. */
function useClockState(clock: LyricsClock, open: boolean): ClockState {
  const [now, setNow] = useState<ClockState>(() => ({ t: 0, d: 0, playing: false, loading: false }))
  const live = useRef(clock)
  useEffect(() => {
    live.current = clock
  })
  useEffect(() => {
    if (!open) return
    const read = () => {
      const c = live.current()
      const next = { t: c.t, d: c.d, playing: c.playing, loading: Boolean(c.loading) }
      setNow((p) => (p.playing === next.playing && p.loading === next.loading && p.d === next.d && Math.abs(p.t - next.t) < 0.2 ? p : next))
    }
    read()
    const id = window.setInterval(read, 250)
    return () => clearInterval(id)
  }, [open])
  return now
}

/** Iznad plejera, sitnije (sporedno uz tekst): omot, trenutno slušaš (trake), pjesma i album. */
function SongHead({ verse, playing, started }: { verse: Verse; playing: boolean; started: boolean }) {
  const m = MOODS[verse.mood]
  const cover = albumOf(verse.album)?.cover
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={verse.song}
        className="flex items-center gap-3"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28 }}
      >
        <span
          className="block h-11 w-11 shrink-0 rounded-[10px] bg-cover bg-center"
          style={{
            backgroundImage: `url(${cover ? (thumbOf(cover) ?? cover) : '/icons/icon-192.png?v=2'})`,
            backgroundColor: m.gradient[1],
            boxShadow: '0 8px 22px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.08)',
          }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5 opacity-80">
            <EqBars accent={BRAND.gold} on={playing} h={8} />
            <span className="text-[7.5px] font-medium uppercase tracking-[0.26em]" style={{ color: BRAND.gold }}>
              {playing ? 'Trenutno' : started ? 'Pauzirano' : 'Pusti pjesmu'}
            </span>
          </div>
          <p className="truncate text-[12px] font-semibold uppercase leading-tight tracking-[0.18em]" style={{ color: BRAND.gold }}>
            {verse.song}
          </p>
          <p className="mt-1 truncate text-[9px] uppercase tracking-[0.22em] text-white/45">{albumLine(verse)}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

const mmss = (s: number) => (Number.isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00')

/* znakovi kao u plejeru sačuvanih (components/SavedPlayer.tsx) */
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
const GLYPH = { type: 'spring', stiffness: 520, damping: 34 } as const

/** Dugme plejera: lagano naraste pod mišem, stisne se pod prstom (kao u sačuvanima). */
function Btn({ label, onPress, size, color, pressed, children }: { label: string; onPress: () => void; size: number; color?: string; pressed?: boolean; children: React.ReactNode }) {
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
      whileHover={{ scale: 1.12, color: '#fff' }}
      whileTap={{ scale: 0.86 }}
      transition={{ type: 'spring', stiffness: 460, damping: 26 }}
    >
      {children}
    </motion.button>
  )
}

/**
 * Plejer na dnu drawer-a — isti kao plejer sačuvanih: traka (dodir ili
 * povlačenje premota), vrijeme, a ispod krupni bijeli znakovi.
 */
function DrawerPlayer({ now, controls, accent }: { now: ClockState; controls: LyricsControls; accent: string }) {
  const [drag, setDrag] = useState<number | null>(null)
  const f = drag ?? (now.d ? Math.min(1, now.t / now.d) : 0)
  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  }
  const jump = (s: number) => now.d && controls.seek(Math.min(0.999, Math.max(0, (now.t + s) / now.d)))
  const toggleOf = (t: { on: boolean } | undefined) => (t?.on ? accent : 'rgba(255,255,255,0.5)')
  return (
    <div>
      <div
        role="slider"
        aria-label="Premotaj"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(f * 100)}
        className="relative flex h-5 cursor-pointer touch-none items-center"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          setDrag(at(e))
        }}
        onPointerMove={(e) => drag !== null && setDrag(at(e))}
        onPointerUp={(e) => {
          controls.seek(at(e))
          setDrag(null)
        }}
        onPointerCancel={() => setDrag(null)}
      >
        <span className="relative block h-[4px] w-full overflow-hidden rounded-full bg-white/15">
          <span className="block h-full rounded-full" style={{ width: `${f * 100}%`, background: `linear-gradient(90deg, ${accent}, #fff)` }} />
          {/* učitava se — odsjaj prelazi preko trake */}
          {now.loading && (
            <motion.span
              className="absolute inset-y-0 w-2/5 rounded-full"
              style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
              initial={{ left: '-40%' }}
              animate={{ left: '100%' }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </span>
        <span className="pointer-events-none absolute h-3 w-3 rounded-full bg-white" style={{ left: `calc(${f} * (100% - 12px))`, boxShadow: `0 0 0 3px ${accent}40, 0 2px 6px rgba(0,0,0,0.5)` }} />
      </div>
      <div className="tabular flex justify-between text-[10px] text-white/50">
        <span>{mmss(f * now.d)}</span>
        <span>{now.d ? `-${mmss(now.d - f * now.d)}` : '--:--'}</span>
      </div>

      {/* kontrole — kao u Apple Musicu: krupni bijeli znakovi, sitni sa strane */}
      <div className="mt-1 flex items-center justify-between px-1">
        {controls.shuffle ? (
          <Btn label="Nasumično" onPress={controls.shuffle.toggle} size={40} pressed={controls.shuffle.on} color={toggleOf(controls.shuffle)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
            </svg>
          </Btn>
        ) : (
          <span className="w-10" aria-hidden />
        )}
        {controls.prev ? (
          <Btn label="Prethodna" onPress={controls.prev} size={54}>
            <svg width="31" height="31" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              {PREV}
            </svg>
          </Btn>
        ) : (
          <Btn label="Deset sekundi nazad" onPress={() => jump(-10)} size={54}>
            <Skip back />
          </Btn>
        )}
        <Btn label={now.playing ? 'Pauza' : 'Pusti'} onPress={controls.toggle} size={64}>
          {now.loading ? (
            <motion.span className="block h-8 w-8 rounded-full border-[3px] border-white border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
          ) : (
            <>
              <motion.svg width={44} height={44} viewBox="0 0 24 24" fill="currentColor" aria-hidden className="absolute" initial={false} animate={{ opacity: now.playing ? 1 : 0, scale: now.playing ? 1 : 0.5 }} transition={GLYPH}>
                <rect x="5.5" y="4" width="4.4" height="16" rx="1.2" />
                <rect x="14.1" y="4" width="4.4" height="16" rx="1.2" />
              </motion.svg>
              <motion.svg width={44} height={44} viewBox="0 0 24 24" fill="currentColor" aria-hidden className="absolute translate-x-[1px]" initial={false} animate={{ opacity: now.playing ? 0 : 1, scale: now.playing ? 0.5 : 1 }} transition={GLYPH}>
                <path d="M6.5 4.6v14.8a1.1 1.1 0 0 0 1.68.93l11.8-7.4a1.1 1.1 0 0 0 0-1.86L8.18 3.67A1.1 1.1 0 0 0 6.5 4.6z" />
              </motion.svg>
            </>
          )}
        </Btn>
        {controls.next ? (
          <Btn label="Sljedeća" onPress={controls.next} size={54}>
            <svg width="31" height="31" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              {NEXT}
            </svg>
          </Btn>
        ) : (
          <Btn label="Deset sekundi naprijed" onPress={() => jump(10)} size={54}>
            <Skip />
          </Btn>
        )}
        {controls.repeat ? (
          <Btn label="Ponovi pjesmu" onPress={controls.repeat.toggle} size={40} pressed={controls.repeat.on} color={toggleOf(controls.repeat)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m17 2 4 4-4 4" />
              <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
              <path d="m7 22-4-4 4-4" />
              <path d="M21 13v1a4 4 0 0 1-4 4H3" />
            </svg>
          </Btn>
        ) : (
          <span className="w-10" aria-hidden />
        )}
      </div>
    </div>
  )
}

/** Deset sekundi nazad / naprijed — kružna strelica s brojem. */
function Skip({ back = false }: { back?: boolean }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={back ? undefined : { transform: 'scaleX(-1)' }}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4 3.8v3.4h3.4" />
      <text x="12" y="15.2" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none" style={back ? undefined : { transform: 'scaleX(-1)', transformOrigin: '12px 12px' }}>
        10
      </text>
    </svg>
  )
}

/** Tekst jedne pjesme: učitavanje, pa redovi (s vremenom ili bez). */
function Body({ verse, clock, onSeek }: { verse: Verse; clock: LyricsClock; onSeek?: (t: number) => void }) {
  const [data, setData] = useState<Lyrics | null | 'loading' | 'error'>('loading')
  const scroller = useRef<HTMLDivElement>(null)
  const intro = useRef<HTMLDivElement>(null)
  const rows = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    let on = true
    load(verse.song).then(
      (v) => on && setData(v),
      () => on && setData('error'),
    )
    return () => {
      on = false
    }
  }, [verse.song])

  const lyrics = data && typeof data === 'object' ? data : null
  const synced = lyrics?.synced?.length ? lyrics.synced : null
  const { active, playing } = useFollow(scroller, lyrics ? (synced ? 'synced' : 'plain') : null, synced, clock, rows, intro, lyrics?.offset ?? 0)
  const accent = MOODS[verse.mood].accent

  // redovi današnjeg stiha — u tekstu zlatni ("nekog" u stihu, "nekoga" u pjesmi)
  const own = verse.text.split('\n').map(loose).filter((l) => l.length >= 8)
  const mine = (l: string) => {
    const k = loose(l)
    return k.length >= 8 && own.some((v) => k.includes(v) || v.includes(k))
  }

  const fade = 'linear-gradient(180deg, transparent 0, #000 6%, #000 78%, transparent 100%)'
  return (
    <>
      {/* sjaj iza teksta — diše dok pjesma svira */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-[4%] h-[45%]"
        style={{ background: `radial-gradient(60% 50% at 50% 50%, ${accent}2e, transparent 70%)` }}
        animate={playing ? { opacity: [0.35, 0.9, 0.35], scale: [0.96, 1.04, 0.96] } : { opacity: 0.25, scale: 1 }}
        transition={playing ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.6 }}
        aria-hidden
      />
      {!lyrics ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
          {data === 'loading' ? (
            <Dots />
          ) : (
            // nema teksta — dok svira, trake sviraju umjesto njega
            <>
              <Bars on={playing} big />
              <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-[1.05rem] italic text-white/55" style={{ fontFamily: SERIF }}>
                {data === 'error' ? 'Tekst nije stigao.' : 'Teksta još nema.'}
              </motion.p>
            </>
          )}
        </div>
      ) : (
        <>
        {/* znak muzike — stoji pri vrhu dok tekst ide; svira dok pjesma svira */}
        <div className="mt-8 flex shrink-0 items-center justify-center pb-2 pt-4" data-lyrics-sign>
          <Bars on={playing} big />
        </div>
        <div
          ref={scroller}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ maskImage: fade, WebkitMaskImage: fade }}
          data-lyrics-scroll
          // tekst koji ide sam: povlačenje nadolje i preko njega zatvara panel (components/Sheet.tsx);
          // običan tekst se skrola rukom, pa panel povlači tek s vrha — kao ostali
          {...(synced ? { 'data-sheet-pull': '' } : {})}
          data-lyrics-mode={synced ? 'synced' : 'plain'}
        >
          {synced ? (
            // red koji se pjeva stoji pri vrhu (četvrtina visine); dole tek toliko da zadnji redovi ne sjede na dnu
            <div className="px-6 pb-[12vh] pt-[4vh] text-center">
              {/* uvod — prazno mjesto prije prvog reda (znak muzike svira gore) */}
              <div ref={intro} className="h-2" aria-hidden />
              {synced.map((s, i) => (
                <SyncedRow
                  key={i}
                  rowRef={(el) => void (rows.current[i] = el)}
                  text={s.l}
                  state={i === active ? 'now' : i < active ? 'past' : 'next'}
                  playing={playing}
                  mine={mine(s.l)}
                  i={i}
                  onPick={onSeek && (() => onSeek(s.t))}
                />
              ))}
            </div>
          ) : (
            // običan tekst stoji — čita se i skrola rukom
            <div className="px-7 pb-[6vh] pt-[4vh] text-center">
              {lyrics.lines.map((l, i) =>
                !l ? (
                  <div key={i} className="h-6" aria-hidden />
                ) : (
                  <PlainRow key={i} root={scroller} note={l.startsWith('*')} mine={mine(l)} first={i < 9} i={i}>
                    {l}
                  </PlainRow>
                ),
              )}
              {lyrics.url && (
                <a href={lyrics.url} target="_blank" rel="noopener" className="mt-10 inline-block text-[9.5px] uppercase tracking-[0.24em] text-white/35">
                  dinomerlin.com
                </a>
              )}
            </div>
          )}
        </div>
        </>
      )}
    </>
  )
}

/**
 * Red teksta koji prati pjesmu: onaj koji se pjeva je pun i blago veći,
 * otpjevani i sljedeći prigušeni. Prazan red (instrumental) — trake sviraju.
 */
function SyncedRow({
  rowRef,
  text,
  state,
  playing,
  mine,
  i,
  onPick,
}: {
  rowRef: (el: HTMLElement | null) => void
  text: string
  state: 'now' | 'past' | 'next'
  playing: boolean
  mine: boolean
  i: number
  onPick?: () => void
}) {
  const now = state === 'now'
  if (!text)
    return (
      <div ref={rowRef} className="flex items-center justify-center transition-[height] duration-500" style={{ height: now ? 44 : 24 }}>
        <Bars on={playing && now} />
      </div>
    )
  return (
    <motion.p
      ref={rowRef}
      onClick={onPick}
      className={`origin-center py-[0.28em] text-[1.45rem] leading-[1.3] ${onPick ? 'cursor-pointer' : ''}`}
      style={{
        fontFamily: SERIF,
        textWrap: 'balance',
        color: mine ? BRAND.gold : '#fff',
        textShadow: now ? `0 0 26px ${mine ? `${BRAND.gold}88` : 'rgba(255,255,255,0.3)'}` : 'none',
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: now ? 1 : state === 'past' ? 0.24 : 0.38, y: 0, scale: now ? 1.04 : 1 }}
      transition={{
        opacity: { duration: 0.45 },
        scale: { type: 'spring', stiffness: 260, damping: 24 },
        y: { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: i < 10 ? 0.15 + i * 0.05 : 0 },
      }}
      data-lyric-now={now || undefined}
    >
      {text}
    </motion.p>
  )
}

/**
 * Red običnog teksta: pojavi se kad uđe u kadar (izroni i izoštri se). Prvi
 * redovi se pojave redom, jedan za drugim, čim se panel otvori.
 */
function PlainRow({ children, root, note, mine, first, i }: { children: string; root: RefObject<HTMLDivElement | null>; note: boolean; mine: boolean; first: boolean; i: number }) {
  return (
    <motion.p
      className={note ? 'mt-4 text-[12px] italic leading-snug text-white/45' : 'py-[0.18em] text-[1.32rem] leading-[1.35] text-white/90'}
      style={{
        fontFamily: SERIF,
        textWrap: 'balance',
        ...(mine ? { color: BRAND.gold, textShadow: `0 0 22px ${BRAND.gold}55` } : {}),
      }}
      initial={{ opacity: 0, y: 16, filter: 'blur(5px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
      viewport={{ root, once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: first ? 0.25 + i * 0.07 : 0 }}
    >
      {children}
    </motion.p>
  )
}

/* visine traka (dio pune visine) i njihov ritam — svaka u svom */
const BARS = [0.45, 0.8, 0.6, 1, 0.7, 0.9, 0.5]

/**
 * Trake koje sviraju — uvod, instrumental i pjesma bez teksta. Stoje
 * (niske, prigušene) dok pjesma ne svira.
 */
function Bars({ on, big = false }: { on: boolean; big?: boolean }) {
  const h = big ? 30 : 12
  return (
    <motion.span className="flex items-end gap-[3px]" style={{ height: h }} animate={{ opacity: on ? 1 : big ? 0.45 : 0.25 }} transition={{ duration: 0.4 }} aria-hidden>
      {BARS.map((k, i) => (
        <span
          key={i}
          className="eq-bar block rounded-full"
          style={{
            width: big ? 3 : 2,
            height: `${k * 100}%`,
            background: `linear-gradient(180deg, #F1E2BF, ${BRAND.gold})`,
            animationDuration: `${0.7 + (i % 3) * 0.18}s`,
            animationDelay: `${-i * 0.13}s`,
            animationPlayState: on ? 'running' : 'paused',
          }}
        />
      ))}
    </motion.span>
  )
}

/** Tekst stiže — tri zlatne tačke koje dišu. */
function Dots() {
  return (
    <span className="flex gap-2" role="status" aria-label="Tekst stiže">
      {[0, 1, 2].map((i) => (
        <motion.i
          key={i}
          className="block h-1.5 w-1.5 rounded-full"
          style={{ background: BRAND.gold }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.15, 0.85] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

/**
 * Tekst prati pjesmu, svaki kadar iz zvuka: red koji se pjeva (zadnji čije je
 * vrijeme prošlo) ide pri vrh (četvrtina visine). Prst (ili točkić) preuzme
 * tekst; tri i po sekunde poslije tekst se vrati mekano. Običan tekst (bez
 * vremena) stoji. Vraća red koji se pjeva (-1 = uvod) i svira li pjesma.
 */
function useFollow(
  ref: RefObject<HTMLDivElement | null>,
  mode: 'synced' | 'plain' | null,
  synced: { t: number }[] | null,
  clock: LyricsClock,
  rows: RefObject<(HTMLElement | null)[]>,
  intro: RefObject<HTMLDivElement | null>,
  /** pomak teksta pjesme iz admina (sekunde, + = ranije) */
  shift: number,
): { active: number; playing: boolean } {
  const [active, setActive] = useState(-1)
  const [playing, setPlaying] = useState(() => clock().playing)
  const live = useRef(clock)
  useEffect(() => {
    live.current = clock
  })

  // svira li — i bez teksta (trake, sjaj)
  useEffect(() => {
    const id = window.setInterval(() => setPlaying(live.current().playing), 300)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || mode !== 'synced' || !synced) return
    let raf = 0
    let hold = 0
    let pos = -1
    let last = -2
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const { t } = live.current()
      // malo unaprijed (glas krene prije zapisanog vremena), plus pomak pjesme iz admina
      let i = -1
      while (i + 1 < synced.length && synced[i + 1].t <= t + 0.35 + shift) i++
      if (i !== last) {
        last = i
        setActive(i)
      }
      const row = i < 0 ? intro.current : rows.current[i]
      const max = el.scrollHeight - el.clientHeight
      if (!row || max <= 0 || now < hold) {
        pos = -1
        return
      }
      const target = Math.max(0, Math.min(max, row.offsetTop + row.offsetHeight / 2 - el.clientHeight * 0.26))
      if (pos < 0) pos = el.scrollTop
      const gap = target - pos
      // daleko (otvaranje, premotavanje, poslije prsta) — sporije, kao da sustiže
      pos += gap * (Math.abs(gap) > 60 ? 0.07 : 0.15)
      if (Math.abs(target - pos) < 0.3) pos = target
      el.scrollTop = pos
    }
    raf = requestAnimationFrame(tick)
    const take = () => {
      hold = performance.now() + 3500
    }
    const opts = { passive: true } as const
    const kinds = ['wheel', 'touchstart', 'touchmove', 'pointerdown'] as const
    for (const k of kinds) el.addEventListener(k, take, opts)
    return () => {
      cancelAnimationFrame(raf)
      for (const k of kinds) el.removeEventListener(k, take)
    }
  }, [ref, mode, synced, rows, intro, shift])

  return { active, playing }
}
