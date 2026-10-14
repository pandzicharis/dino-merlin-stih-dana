'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { youtubeId } from '@/lib/text'
import { BRAND } from '@/lib/brand'
import { haptic } from '@/lib/haptic'

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
      <AudioSong
        key={id}
        verse={verse}
        src={`/audio/${audioSlug(verse.song)}.m4a`}
        fallback={`/api/audio/${id}?s=${audioSlug(verse.song)}`}
        onFail={() => setFailedId(id)}
      />
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

type State = 'idle' | 'loading' | 'playing' | 'paused'

/**
 * Plejer je odmah otvoren, bez kutije: gramofonska ploča sa zlatnom
 * etiketom (play/pauza) i prstenom napretka — vrti se dok pjesma svira i
 * stane gdje je pauzirana. Pored nje naziv, album i traka za premotavanje
 * prstom. Kontrole rade i sa zaključanog ekrana (Media Session).
 */
function AudioSong({ verse, src, fallback, onFail }: { verse: Verse; src: string; fallback: string; onFail: () => void }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const want = useRef(false)
  const [state, setState] = useState<State>('idle')
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)

  useEffect(() => {
    // Lokalno server pripremi pjesmu čim se stih pojavi — dodir je onda trenutan.
    // Na Vercelu nema yt-dlp-a, pa tamo svira samo statični fajl i ovo ne treba.
    if (process.env.NODE_ENV === 'development') fetch(`${fallback}&warm=1`).catch(() => {})
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
    window.addEventListener('stihdana:stop-audio', stop)
    return () => {
      window.removeEventListener('stihdana:stop-audio', stop)
      audio.current?.pause()
      audio.current = null
    }
  }, [fallback])

  function player(): HTMLAudioElement {
    if (audio.current) return audio.current
    const a = new Audio(src)
    a.preload = 'metadata'
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

    if ('mediaSession' in navigator) {
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
    return a
  }

  // trajanje pjesme se vidi i prije prvog dodira (samo zaglavlje fajla)
  useEffect(() => {
    player()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle() {
    haptic(6)
    const a = player()
    if (a.paused) {
      want.current = true
      setState('loading')
      a.play().catch(() => setState('paused'))
    } else {
      want.current = false
      a.pause()
    }
  }

  const playing = state === 'playing'
  const progress = dur ? cur / dur : 0
  const time = !dur ? '--:--' : cur > 0 ? `-${clock(dur - cur)}` : clock(dur)

  return (
    <div data-tip="song" className="flex w-[min(84vw,320px)] items-center gap-4 text-left">
      <motion.button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Pauziraj "${verse.song}"` : `Pusti "${verse.song}"`}
        aria-pressed={playing}
        data-deck="play"
        data-state={state}
        className="relative flex h-[76px] w-[76px] shrink-0 cursor-pointer items-center justify-center"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.93 }}
        transition={{ type: 'spring', stiffness: 460, damping: 20 }}
      >
        {/* sjaj — diše dok pjesma svira */}
        <motion.span
          className="absolute -inset-2 rounded-full blur-lg"
          style={{ background: `radial-gradient(circle, ${BRAND.gold}55 0%, transparent 70%)` }}
          animate={playing ? { opacity: [0.35, 0.8, 0.35], scale: [0.95, 1.1, 0.95] } : { opacity: 0.2, scale: 1 }}
          transition={playing ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
          aria-hidden
        />
        {/* prsten napretka oko ploče */}
        <svg width="76" height="76" viewBox="0 0 60 60" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="30" cy="30" r="28.5" fill="none" stroke={`${BRAND.gold}2E`} strokeWidth="1.5" />
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
          width="66"
          height="66"
          viewBox="0 0 52 52"
          className="relative drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
          style={{ animation: 'vinyl-spin 3.6s linear infinite', animationPlayState: playing ? 'running' : 'paused' }}
          aria-hidden
        >
          <defs>
            <radialGradient id="vinyl" cx="50%" cy="50%" r="50%">
              <stop offset="0.4" stopColor="#1C1A18" />
              <stop offset="1" stopColor="#060606" />
            </radialGradient>
            <linearGradient id="vinyl-label" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F1E2BF" />
              <stop offset="0.45" stopColor={BRAND.gold} />
              <stop offset="1" stopColor="#8A7148" />
            </linearGradient>
          </defs>
          <circle cx="26" cy="26" r="26" fill="url(#vinyl)" />
          {[23.5, 21, 18.5, 16].map((r) => (
            <circle key={r} cx="26" cy="26" r={r} fill="none" stroke="#fff" strokeOpacity="0.06" strokeWidth="0.6" />
          ))}
          {/* odsjaj na brazdama — vrti se s pločom, pa se vidi da svira */}
          <path d="M26 2.5A23.5 23.5 0 0 1 46.4 14.3L26 26z" fill="#fff" fillOpacity="0.07" />
          <path d="M26 49.5A23.5 23.5 0 0 1 5.6 37.7L26 26z" fill="#fff" fillOpacity="0.045" />
          <circle cx="26" cy="26" r="12" fill="url(#vinyl-label)" />
          <circle cx="26" cy="26" r="9.5" fill="none" stroke="#16110A" strokeOpacity="0.18" strokeWidth="0.6" />
        </svg>
        {/* znak na etiketi — ne vrti se */}
        <span className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            {state === 'loading' ? (
              <motion.span
                key="load"
                className="h-3.5 w-3.5 rounded-full border-[1.5px] border-[#16110A] border-t-transparent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, rotate: 360 }}
                exit={{ opacity: 0 }}
                transition={{ rotate: { duration: 0.8, repeat: Infinity, ease: 'linear' } }}
              />
            ) : playing ? (
              <motion.svg key="pause" width="14" height="14" viewBox="0 0 12 12" {...ICON} aria-hidden>
                <rect x="2" y="1" width="3" height="10" rx="1" fill="#16110A" />
                <rect x="7" y="1" width="3" height="10" rx="1" fill="#16110A" />
              </motion.svg>
            ) : (
              <motion.svg key="play" width="14" height="14" viewBox="0 0 12 12" className="ml-[2px]" {...ICON} aria-hidden>
                <path d="M2 1v10l9-5z" fill="#16110A" />
              </motion.svg>
            )}
          </AnimatePresence>
        </span>
      </motion.button>

      <div className="min-w-0 flex-1">
        {/* dodir na naziv radi isto što i ploča */}
        <p
          className="cursor-pointer truncate font-semibold uppercase leading-none tracking-[0.18em]"
          style={{ color: BRAND.gold, fontSize: cardSongSize(verse.song) }}
          onClick={toggle}
        >
          {verse.song}
        </p>
        <p className="mt-2 truncate text-[10.5px] uppercase leading-none tracking-[0.22em] text-white/60">
          {verse.album} &middot; {verse.year}
        </p>
        <div className="mt-1 flex items-center gap-2.5">
          <Seek
            value={progress}
            onSeek={(f) => {
              const a = audio.current
              if (a && dur) {
                a.currentTime = f * dur
                setCur(a.currentTime)
              }
            }}
          />
          <span className="tabular w-9 text-right text-[10.5px] tracking-[0.06em] text-white/60">{time}</span>
        </div>
      </div>
    </div>
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
        style={{ width: `${shown * 100}%`, background: `linear-gradient(90deg, #8A7148, ${BRAND.gold})` }}
      />
      <span
        className="absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.6)] transition-transform group-active:scale-125"
        style={{ left: `${shown * 100}%`, background: '#F1E2BF' }}
      />
    </div>
  )
}

/** Naziv pored ploče: uvijek u jednom redu, nikad preko 15px. */
function cardSongSize(song: string): string {
  const em = Math.max(song.length, 1) * 0.9 + 0.18
  return `min(15px, calc((min(84vw, 320px) - 96px) / ${em.toFixed(2)}))`
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
