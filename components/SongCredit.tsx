'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { youtubeId } from '@/lib/text'
import { BRAND } from '@/lib/brand'
import { haptic } from '@/lib/haptic'
import { dropNeedle, startCrackle, stopCrackle, unlockVinyl } from '@/lib/vinyl'

/**
 * Potpis pjesme ispod stiha.
 *
 * Naziv je u zlatnoj, verzalom — jedina zlatna stvar na ekranu osim
 * zaglavlja. Ispod je odmah otvoren plejer u tonu aplikacije — zvuk
 * pjesme u pozadini, bez videa i bez iframea.
 *
 * Zvuk se traži redom: `public/audio/<pjesma>.m4a` sa CDN-a, pa /api/audio
 * (lokalno ga izvuče s YouTubea). Ako ni jedno ne stigne, ostaje YouTube znak.
 */
export function SongCredit({ verse }: { verse: Verse }) {
  const id = youtubeId(verse.youtube)
  // dok audio ne pukne, dodir pušta pjesmu; ako server ne može do zvuka, ostaje YouTube link
  // pamti se ZA KOJU pjesmu je zvuk pao — nova pjesma kreće ispočetka sama
  const [failedId, setFailedId] = useState<string | null>(null)
  const failed = failedId === id

  if (id && !failed)
    return (
      <AudioSong key={id} verse={verse} {...sourceOf(verse, id)} onFail={() => setFailedId(id)} />
    )

  return (
    <div className="flex w-full flex-col items-center">
      {id ? (
        /* Naziv i znak su JEDAN link: hover i dodir zumiraju oboje zajedno,
           a prst pogodi bilo koji od njih. */
        <motion.a
          href={`https://www.youtube.com/watch?v=${id}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Poslušaj "${verse.song}" na YouTubeu`}
          title="Poslušaj na YouTubeu"
          data-tip="song"
          className="group flex items-center gap-3 no-underline"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 460, damping: 20 }}
        >
          <SongTitle song={verse.song} withIcon />
          <span className="relative flex h-[26px] w-[38px] items-center justify-center">
            {/* sjaj iza znaka — jača na hover */}
            <span
              className="absolute -inset-3 rounded-full opacity-50 blur-md transition-opacity duration-300 group-hover:opacity-90"
              style={{ background: `radial-gradient(circle, ${BRAND.gold}55 0%, transparent 70%)` }}
              aria-hidden
            />
            <svg width="38" height="26" viewBox="0 0 38 26" className="relative drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" aria-hidden>
              <defs>
                <linearGradient id="yt-gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#F1E2BF" />
                  <stop offset="0.45" stopColor={BRAND.gold} />
                  <stop offset="1" stopColor="#8A7148" />
                </linearGradient>
                <linearGradient id="yt-shine" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
                  <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* oblik YouTube znaka: blago ispupčen pravougaonik */}
              <path
                d="M37.2 4.1A4.8 4.8 0 0 0 33.8.7C30.8 0 19 0 19 0S7.2 0 4.2.7A4.8 4.8 0 0 0 .8 4.1C0 7.1 0 13 0 13s0 5.9.8 8.9a4.8 4.8 0 0 0 3.4 3.4C7.2 26 19 26 19 26s11.8 0 14.8-.7a4.8 4.8 0 0 0 3.4-3.4c.8-3 .8-8.9.8-8.9s0-5.9-.8-8.9z"
                fill="url(#yt-gold)"
              />
              <path
                d="M37.2 4.1A4.8 4.8 0 0 0 33.8.7C30.8 0 19 0 19 0S7.2 0 4.2.7A4.8 4.8 0 0 0 .8 4.1C.3 6 .1 9.2 0 11h38c-.1-1.8-.3-5-.8-6.9z"
                fill="url(#yt-shine)"
              />
              <path d="M15.3 7.6v10.8L24.6 13z" fill="#16110A" />
            </svg>
          </span>
        </motion.a>
      ) : (
        <SongTitle song={verse.song} withIcon={false} />
      )}

      <p className="mt-4 text-[12px] uppercase tracking-[0.24em] text-white/55">
        {verse.album} &middot; {verse.year}
      </p>
    </div>
  )
}

function SongTitle({ song, withIcon }: { song: string; withIcon: boolean }) {
  return (
    <span
      className="whitespace-nowrap font-semibold uppercase leading-none tracking-[0.2em]"
      style={{ color: BRAND.gold, fontSize: songSize(song, withIcon) }}
    >
      {song}
    </span>
  )
}

/** `Moj je život Švicarska` → `moj-je-zivot-svicarska` (ime fajla u public/audio, ako ga ima) */
function audioSlug(song: string): string {
  return song
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const RING = 2 * Math.PI * 28.5
const ICON = { initial: { scale: 0.5, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.5, opacity: 0 } }
/** Svira jedna pjesma u isto vrijeme: kad krene nova, ostale stanu. */
const SOLO = 'stihdana:solo'

type State = 'idle' | 'loading' | 'playing' | 'paused'

type Source = { verse: Verse; src: string; fallback: string; onFail: () => void }

const sourceOf = (verse: Verse, id: string) => ({
  src: `/audio/${audioSlug(verse.song)}.m4a`,
  fallback: `/api/audio/${id}?s=${audioSlug(verse.song)}`,
})

/**
 * Zvuk jedne pjesme: statični fajl, pa server; stanje, vrijeme, premotavanje.
 * `preload` odmah povuče zaglavlje fajla, da se trajanje vidi prije dodira.
 */
function useSong({ verse, src, fallback, onFail, preload }: Source & { preload: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const want = useRef(false)
  const [state, setState] = useState<State>('idle')
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)

  useEffect(() => {
    // prezentacija: odlaskom s koraka pjesma stane i vrati se na početak
    const stop = () => {
      const a = audio.current
      want.current = false
      if (a) {
        a.pause()
        a.currentTime = 0
      }
      setCur(0)
      setState('idle')
    }
    const solo = (e: Event) => {
      if ((e as CustomEvent).detail === audio.current) return
      want.current = false
      audio.current?.pause()
    }
    window.addEventListener('stihdana:stop-audio', stop)
    window.addEventListener(SOLO, solo)
    if (preload) player()
    return () => {
      window.removeEventListener('stihdana:stop-audio', stop)
      window.removeEventListener(SOLO, solo)
      audio.current?.pause()
      audio.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // pucketanje ploče dok pjesma svira
  useEffect(() => {
    const a = audio.current
    if (!a) return
    if (state === 'playing') startCrackle(a)
    else stopCrackle(a)
    return () => stopCrackle(a)
  }, [state])

  function player(): HTMLAudioElement {
    if (audio.current) return audio.current
    const a = new Audio(src)
    a.preload = preload ? 'metadata' : 'none'
    const time = () => {
      setCur(a.currentTime)
      if (Number.isFinite(a.duration)) setDur(a.duration)
    }
    a.addEventListener('timeupdate', time)
    a.addEventListener('durationchange', time)
    a.addEventListener('waiting', () => setState('loading'))
    a.addEventListener('playing', () => setState('playing'))
    a.addEventListener('pause', () => setState((s) => (s === 'idle' ? s : 'paused')))
    a.addEventListener('ended', () => {
      a.currentTime = 0
      setState('paused')
    })
    a.addEventListener('error', () => {
      if (audio.current !== a) return // stari plejer, već ugašen
      // statičnog fajla nema (nova pjesma iz admina) → pokušaj preko servera
      if (a.src.endsWith(src)) {
        a.src = fallback
        if (want.current) a.play().catch(() => {})
        return
      }
      setState('idle')
      onFail()
    })
    audio.current = a
    return a
  }

  /** kontrole sa zaključanog ekrana — za pjesmu koja upravo svira */
  function session(a: HTMLAudioElement) {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    ms.metadata = new MediaMetadata({
      title: verse.song,
      artist: BRAND.name,
      album: verse.album,
      artwork: [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    })
    ms.setActionHandler('play', () => a.play())
    ms.setActionHandler('pause', () => a.pause())
    ms.setActionHandler('seekto', (d) => d.seekTime != null && (a.currentTime = d.seekTime))
  }

  function toggle() {
    haptic(6)
    const a = player()
    if (a.paused) {
      want.current = true
      // zvuk gramofona: kontekst se otvara iz dodira, tup kad igla legne
      unlockVinyl()
      dropNeedle(0.3)
      window.dispatchEvent(new CustomEvent(SOLO, { detail: a }))
      session(a)
      setState('loading')
      a.play().catch(() => setState('paused'))
    } else {
      want.current = false
      a.pause()
    }
  }

  function seek(f: number) {
    const a = audio.current
    if (a && dur) {
      a.currentTime = f * dur
      setCur(a.currentTime)
    }
  }

  const progress = dur ? cur / dur : 0
  const time = !dur ? '--:--' : cur > 0 ? `-${clock(dur - cur)}` : clock(dur)
  return { state, progress, time, toggle, seek }
}

/**
 * Gramofonska ploča sa zlatnom etiketom (play/pauza) i prstenom napretka —
 * vrti se dok pjesma svira i stane tačno gdje je pauzirana.
 */
function Vinyl({
  size,
  state,
  progress,
  song,
  onClick,
  deck = false,
  arm = false,
}: {
  size: number
  state: State
  progress: number
  song: string
  onClick: () => void
  /** dugme koje prezentacija sama pritisne */
  deck?: boolean
  /** ručica gramofona koja se spusti na ploču */
  arm?: boolean
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const playing = state === 'playing'
  const disc = Math.round((size * 66) / 76)
  const icon = Math.max(10, Math.round((size * 14) / 76))
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={playing ? `Pauziraj "${song}"` : `Pusti "${song}"`}
      aria-pressed={playing}
      data-deck={deck ? 'play' : undefined}
      data-state={state}
      className="relative flex shrink-0 cursor-pointer items-center justify-center"
      style={{ width: size, height: size }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.93 }}
      transition={{ type: 'spring', stiffness: 460, damping: 20 }}
    >
      {/* sjaj — diše dok pjesma svira */}
      {/* mekan gradijent umjesto blur filtera; disanje je CSS (globals.css) */}
      <span
        className={`absolute -inset-3 rounded-full transition-opacity duration-500 ${playing ? 'vinyl-glow' : ''}`}
        style={{ background: `radial-gradient(circle, ${BRAND.gold}4d 0%, ${BRAND.gold}1f 40%, transparent 70%)`, opacity: playing ? undefined : 0.35 }}
        aria-hidden
      />
      {/* prsten napretka oko ploče */}
      <svg width={size} height={size} viewBox="0 0 60 60" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="30" cy="30" r="28.5" fill="none" stroke={`${BRAND.gold}47`} strokeWidth="1.5" />
        <circle
          cx="30"
          cy="30"
          r="28.5"
          fill="none"
          stroke={BRAND.gold}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={RING}
          strokeDashoffset={RING * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 0.25s linear' }}
        />
      </svg>
      {/* ploča — vrti se i stane tačno gdje je pauzirana */}
      <svg
        width={disc}
        height={disc}
        viewBox="0 0 52 52"
        className="relative drop-shadow-[0_4px_12px_rgba(0,0,0,0.7)]"
        style={{ animation: 'vinyl-spin 3.6s linear infinite', animationPlayState: playing ? 'running' : 'paused' }}
        aria-hidden
      >
        <defs>
          <radialGradient id={`${uid}d`} cx="50%" cy="50%" r="50%">
            <stop offset="0.3" stopColor="#36312B" />
            <stop offset="0.7" stopColor="#1B1917" />
            <stop offset="1" stopColor="#0B0A09" />
          </radialGradient>
          <linearGradient id={`${uid}r`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F1E2BF" stopOpacity="0.95" />
            <stop offset="0.5" stopColor={BRAND.gold} stopOpacity="0.35" />
            <stop offset="1" stopColor="#8A7148" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id={`${uid}l`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F1E2BF" />
            <stop offset="0.45" stopColor={BRAND.gold} />
            <stop offset="1" stopColor="#8A7148" />
          </linearGradient>
        </defs>
        <circle cx="26" cy="26" r="26" fill={`url(#${uid}d)`} />
        {/* zlatni rub — ploča se vidi i na crnoj pozadini */}
        <circle cx="26" cy="26" r="25.4" fill="none" stroke={`url(#${uid}r)`} strokeWidth="1.1" />
        {[23.5, 22, 20.5, 19, 17.5, 16, 14.5].map((r, i) => (
          <circle key={r} cx="26" cy="26" r={r} fill="none" stroke="#fff" strokeOpacity={i % 2 ? 0.05 : 0.1} strokeWidth="0.5" />
        ))}
        {/* odsjaj na brazdama — vrti se s pločom, pa se vidi da svira */}
        <path d="M26 2.5A23.5 23.5 0 0 1 46.4 14.3L26 26z" fill="#fff" fillOpacity="0.13" />
        <path d="M26 49.5A23.5 23.5 0 0 1 5.6 37.7L26 26z" fill="#fff" fillOpacity="0.08" />
        <circle cx="26" cy="26" r="12" fill={`url(#${uid}l)`} />
        <circle cx="26" cy="26" r="12" fill="none" stroke="#5E4C30" strokeWidth="0.6" />
        <circle cx="26" cy="26" r="9.5" fill="none" stroke="#16110A" strokeOpacity="0.2" strokeWidth="0.5" />
      </svg>
      {/* znak na etiketi — ne vrti se */}
      <span className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {state === 'loading' ? (
            <motion.span
              key="load"
              className="rounded-full border-[1.5px] border-[#16110A] border-t-transparent"
              style={{ width: icon, height: icon }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{ rotate: { duration: 0.8, repeat: Infinity, ease: 'linear' } }}
            />
          ) : playing ? (
            <motion.svg key="pause" width={icon} height={icon} viewBox="0 0 12 12" {...ICON} aria-hidden>
              <rect x="2" y="1" width="3" height="10" rx="1" fill="#16110A" />
              <rect x="7" y="1" width="3" height="10" rx="1" fill="#16110A" />
            </motion.svg>
          ) : (
            <motion.svg key="play" width={icon} height={icon} viewBox="0 0 12 12" className="ml-[2px]" {...ICON} aria-hidden>
              <path d="M2 1v10l9-5z" fill="#16110A" />
            </motion.svg>
          )}
        </AnimatePresence>
      </span>
      {arm && <Tonearm size={size} down={playing || state === 'loading'} progress={progress} />}
    </motion.button>
  )
}

/**
 * Ručica gramofona, s lijeve strane ploče: na play se igla spusti na vanjske
 * brazde i kako pjesma ide klizi prema etiketi; na pauzu se podigne.
 * Okreće se oko osovine u gornjem lijevom uglu.
 */
function Tonearm({ size, down, progress }: { size: number; down: boolean; progress: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  // -8° = vanjska brazda, -21° = tik do etikete; 14° = sa strane, van ploče
  const angle = down ? -8 - 13 * Math.min(1, Math.max(0, progress)) : 14
  return (
    <motion.span
      className="pointer-events-none absolute inset-0 drop-shadow-[0_3px_4px_rgba(0,0,0,0.65)]"
      style={{ transformOrigin: `${(2 / 62) * 100}% ${(4 / 62) * 100}%` }}
      initial={false}
      animate={{ rotate: angle }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden
    >
      <svg width={size} height={size} viewBox="0 0 62 62" className="block overflow-visible">
        <defs>
          <linearGradient id={`${uid}m`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F1E2BF" />
            <stop offset="0.5" stopColor={BRAND.gold} />
            <stop offset="1" stopColor="#8A7148" />
          </linearGradient>
          <radialGradient id={`${uid}b`} cx="40%" cy="35%" r="70%">
            <stop offset="0" stopColor="#4A443C" />
            <stop offset="1" stopColor="#14120F" />
          </radialGradient>
        </defs>
        {/* protuteg iza osovine */}
        <rect x="-1" y="-6.5" width="6" height="6.5" rx="1.4" fill={`url(#${uid}b)`} stroke={BRAND.gold} strokeOpacity="0.6" strokeWidth="0.5" />
        {/* cijev ručice, na kraju blago savijena prema glavi */}
        <path d="M2 4V37Q2 41.5 4.8 44.6" fill="none" stroke="#DCCBA4" strokeWidth="1.8" strokeLinecap="round" />
        {/* glava s iglom */}
        <path d="M6.8 42.6l-4.4 2.8 2.6 4.1 4.4-2.8z" fill={`url(#${uid}m)`} stroke="#5E4C30" strokeWidth="0.4" />
        <circle cx="8.2" cy="48.6" r="0.8" fill="#16110A" />
        {/* osovina */}
        <circle cx="2" cy="4" r="4.6" fill={`url(#${uid}b)`} stroke={BRAND.gold} strokeOpacity="0.7" strokeWidth="0.7" />
        <circle cx="2" cy="4" r="1.6" fill={BRAND.gold} />
      </svg>
    </motion.span>
  )
}

/**
 * Plejer ispod stiha — odmah otvoren, bez kutije: ploča, pored nje naziv
 * (desno titra ekvilajzer dok svira), album i traka za premotavanje.
 * Kontrole rade i sa zaključanog ekrana (Media Session).
 */
function AudioSong(props: Source) {
  const { state, progress, time, toggle, seek } = useSong({ ...props, preload: true })
  const { verse, fallback } = props

  // Lokalno server pripremi pjesmu čim se stih pojavi — dodir je onda trenutan.
  // Na Vercelu nema yt-dlp-a, pa tamo svira samo statični fajl i ovo ne treba.
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') fetch(`${fallback}&warm=1`).catch(() => {})
  }, [fallback])

  return (
    <div data-tip="song" className="flex w-[min(84vw,320px)] items-center gap-4 text-left">
      {/* ploča visoka koliko i tekst s trakom desno */}
      <Vinyl size={62} state={state} progress={progress} song={verse.song} onClick={toggle} deck arm />
      <div className="min-w-0 flex-1">
        {/* dodir na naziv radi isto što i ploča */}
        <div className="flex cursor-pointer items-center gap-2" onClick={toggle}>
          <p
            className="min-w-0 flex-1 truncate font-semibold uppercase leading-none tracking-[0.18em]"
            style={{ color: BRAND.gold, fontSize: cardSongSize(verse.song) }}
          >
            {verse.song}
          </p>
          <Equalizer playing={state === 'playing'} />
        </div>
        <p className="mt-2 truncate text-[10.5px] uppercase leading-none tracking-[0.22em] text-white/60">
          {verse.album} &middot; {verse.year}
        </p>
        <div className="mt-1 flex items-center gap-2.5">
          <Seek value={progress} onSeek={seek} />
          <span className="tabular w-9 text-right text-[10.5px] tracking-[0.06em] text-white/60">{time}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Pjesma u kartici sačuvanog stiha: mala ploča je pusti, desno titra
 * ekvilajzer, ispod je traka za premotavanje. Bez zvuka ostaje tačka raspoloženja.
 */
export function SongRow({ verse, accent }: { verse: Verse; accent: string }) {
  const id = youtubeId(verse.youtube)
  const [failedId, setFailedId] = useState<string | null>(null)

  if (!id || failedId === id)
    return (
      <>
        <i className="block h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} aria-hidden />
        <div className="min-w-0 flex-1">
          <RowText verse={verse} />
        </div>
      </>
    )
  return <AudioRow key={id} verse={verse} {...sourceOf(verse, id)} onFail={() => setFailedId(id)} />
}

function AudioRow(props: Source) {
  const { state, progress, time, toggle, seek } = useSong({ ...props, preload: false })
  const { verse } = props
  return (
    <>
      <Vinyl size={60} state={state} progress={progress} song={verse.song} onClick={toggle} arm />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <RowText verse={verse} onClick={toggle} />
          </div>
          <Equalizer playing={state === 'playing'} />
        </div>
        <div className="flex items-center gap-2.5">
          <Seek value={progress} onSeek={seek} />
          <span className="tabular w-9 text-right text-[10px] tracking-[0.06em] text-white/60">{time}</span>
        </div>
      </div>
    </>
  )
}

function RowText({ verse, onClick }: { verse: Verse; onClick?: () => void }) {
  return (
    <div className={onClick ? 'cursor-pointer' : undefined} onClick={onClick}>
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: BRAND.gold }}>
        {verse.song}
      </p>
      <p className="mt-1 truncate text-[10px] uppercase tracking-[0.16em] text-white/55">
        {verse.album} &middot; {verse.year}
      </p>
    </div>
  )
}

/** Četiri zlatne trake — titraju dok svira, spuste se na pauzi. */
function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className="flex h-3.5 w-[18px] shrink-0 items-end gap-[2px]" aria-hidden>
      {[0.9, 0.65, 1.05, 0.75].map((d, i) => (
        // CSS animacija (globals.css) — titra i dok je JavaScript zauzet
        <span
          key={i}
          className={`eq-bar h-full w-[3px] origin-bottom rounded-full ${playing ? 'eq-on' : ''}`}
          style={{
            background: `linear-gradient(to top, #8A7148, ${BRAND.gold}, #F1E2BF)`,
            animationDuration: `${d}s`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </span>
  )
}

/** Traka napretka — dodir ili povlačenje prstom premota pjesmu. */
function Seek({ value, onSeek }: { value: number; onSeek: (fraction: number) => void }) {
  const [drag, setDrag] = useState<number | null>(null)
  const shown = drag ?? value
  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  }
  return (
    <div
      role="slider"
      aria-label="Premotaj"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown * 100)}
      className="group relative flex h-6 flex-1 cursor-pointer touch-none items-center"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setDrag(at(e))
      }}
      onPointerMove={(e) => drag !== null && setDrag(at(e))}
      onPointerUp={(e) => {
        onSeek(at(e))
        setDrag(null)
      }}
      onPointerCancel={() => setDrag(null)}
    >
      <span className="absolute inset-x-0 h-[2px] rounded-full bg-white/15" />
      <span
        className="absolute left-0 h-[2px] rounded-full"
        style={{ width: `calc(${shown} * (100% - 10px) + 5px)`, background: `linear-gradient(90deg, #8A7148, ${BRAND.gold})` }}
      />
      <span
        className="absolute h-2.5 w-2.5 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.6)] transition-transform group-active:scale-125"
        // kružić ostaje unutar trake — na početku se ne odsiječe
        style={{ left: `calc(${shown} * (100% - 10px))`, background: '#F1E2BF' }}
      />
    </div>
  )
}

/** Naziv pored ploče: uvijek u jednom redu, nikad preko 15px. */
function cardSongSize(song: string): string {
  const em = Math.max(song.length, 1) * 0.9 + 0.18
  return `min(15px, calc((min(84vw, 320px) - 108px) / ${em.toFixed(2)}))`
}

function clock(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

/**
 * Naziv pjesme uvijek u jednom redu. Verzal Rubika s razmakom 0.2em je
 * ~0.92em po znaku; ako ne staje u širinu ekrana (minus margine i YouTube
 * znak), slova se smanje — nikad preko 1.15rem.
 */
function songSize(song: string, withIcon: boolean): string {
  const em = Math.max(song.length, 1) * 0.92 + 0.2
  const reserved = withIcon ? 110 : 60
  return `min(1.15rem, calc((100vw - ${reserved}px) / ${em.toFixed(2)}))`
}
