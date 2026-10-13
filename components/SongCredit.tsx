'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { youtubeId } from '@/lib/text'
import { BRAND } from '@/lib/brand'

/**
 * Potpis pjesme ispod stiha.
 *
 * Naziv je u zlatnoj, verzalom — jedina zlatna stvar na ekranu osim
 * zaglavlja. Dodir na naziv pusti zvuk pjesme u pozadini — play/pauza,
 * prsten napretka, ekvilajzer, bez plejera i bez iframea.
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

  return (
    <div className="flex w-full flex-col items-center">
      {id && !failed ? (
        <AudioSong
          key={id}
          verse={verse}
          src={`/audio/${audioSlug(verse.song)}.m4a`}
          fallback={`/api/audio/${id}?s=${audioSlug(verse.song)}`}
          onFail={() => setFailedId(id)}
        />
      ) : id ? (
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

const RING = 2 * Math.PI * 17
const ICON = { initial: { scale: 0.5, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.5, opacity: 0 } }

type State = 'idle' | 'loading' | 'playing' | 'paused'

/**
 * Naziv + okrugli play/pauza s prstenom napretka. Kad pjesma krene, ispod
 * se razvuče traka: ekvilajzer, vrijeme i premotavanje prstom. Kontrole
 * rade i sa zaključanog ekrana (Media Session).
 */
function AudioSong({ verse, src, fallback, onFail }: { verse: Verse; src: string; fallback: string; onFail: () => void }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [state, setState] = useState<State>('idle')
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)

  // Lokalno server pripremi pjesmu čim se stih pojavi — dodir je onda trenutan.
  // Na Vercelu nema yt-dlp-a, pa tamo svira samo statični fajl i ovo ne treba.
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') fetch(`${fallback}&warm=1`).catch(() => {})
    // prezentacija: odlaskom s koraka pjesma stane i plejer se sklopi
    const stop = () => {
      const a = audio.current
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
    a.preload = 'auto'
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
      // statičnog fajla nema (nova pjesma iz admina) → pokušaj preko servera
      if (a.src.endsWith(src)) {
        a.src = fallback
        a.play().catch(() => {})
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

  function toggle() {
    const a = player()
    if (a.paused) {
      setState('loading')
      a.play().catch(() => setState('paused'))
    } else a.pause()
  }

  const playing = state === 'playing'
  const progress = dur ? cur / dur : 0

  return (
    <div className="flex flex-col items-center">
      <motion.button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Pauziraj "${verse.song}"` : `Pusti "${verse.song}"`}
        aria-pressed={playing}
        data-deck="play"
        data-tip="song"
        data-state={state}
        className="group flex cursor-pointer items-center gap-3"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 460, damping: 20 }}
      >
        <SongTitle song={verse.song} withIcon />
        <span className="relative flex h-[38px] w-[38px] items-center justify-center">
          {/* sjaj — diše dok pjesma svira */}
          <motion.span
            className="absolute -inset-3 rounded-full blur-md"
            style={{ background: `radial-gradient(circle, ${BRAND.gold}66 0%, transparent 70%)` }}
            animate={playing ? { opacity: [0.5, 1, 0.5], scale: [0.95, 1.15, 0.95] } : { opacity: 0.45, scale: 1 }}
            transition={playing ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
            aria-hidden
          />
          <svg width="38" height="38" viewBox="0 0 38 38" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="19" cy="19" r="17" fill="none" stroke={`${BRAND.gold}40`} strokeWidth="1.5" />
            <circle
              cx="19"
              cy="19"
              r="17"
              fill="none"
              stroke={BRAND.gold}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 0.25s linear' }}
            />
          </svg>
          <span
            className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
            style={{ background: `linear-gradient(135deg, #F1E2BF, ${BRAND.gold} 45%, #8A7148)` }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {state === 'loading' ? (
                <motion.span
                  key="load"
                  className="h-3 w-3 rounded-full border-[1.5px] border-[#16110A] border-t-transparent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, rotate: 360 }}
                  exit={{ opacity: 0 }}
                  transition={{ rotate: { duration: 0.8, repeat: Infinity, ease: 'linear' } }}
                />
              ) : playing ? (
                <motion.svg key="pause" width="12" height="12" viewBox="0 0 12 12" {...ICON} aria-hidden>
                  <rect x="2" y="1" width="3" height="10" rx="1" fill="#16110A" />
                  <rect x="7" y="1" width="3" height="10" rx="1" fill="#16110A" />
                </motion.svg>
              ) : (
                <motion.svg key="play" width="12" height="12" viewBox="0 0 12 12" className="ml-[2px]" {...ICON} aria-hidden>
                  <path d="M2 1v10l9-5z" fill="#16110A" />
                </motion.svg>
              )}
            </AnimatePresence>
          </span>
        </span>
      </motion.button>

      <AnimatePresence initial={false}>
        {state !== 'idle' && (
          <motion.div
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex w-[min(76vw,300px)] items-center gap-3 pt-5">
              <Equalizer playing={playing} />
              <span className="tabular w-8 text-[10px] tracking-[0.08em] text-white/65">{clock(cur)}</span>
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
              <span className="tabular w-9 text-right text-[10px] tracking-[0.08em] text-white/40">
                {dur ? `-${clock(dur - cur)}` : '--:--'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Četiri zlatne trake — skaču dok svira, spuste se na pauzi. */
function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className="flex h-3.5 w-[18px] items-end gap-[2px]" aria-hidden>
      {[0.9, 0.65, 1.05, 0.75].map((d, i) => (
        <motion.span
          key={i}
          className="h-full w-[3px] origin-bottom rounded-full"
          style={{ background: `linear-gradient(to top, #8A7148, ${BRAND.gold}, #F1E2BF)` }}
          animate={playing ? { scaleY: [0.25, 1, 0.4, 0.85, 0.25] } : { scaleY: 0.2 }}
          transition={playing ? { duration: d, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 } : { duration: 0.3 }}
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
      <span className="absolute inset-x-0 h-[3px] rounded-full bg-white/12" />
      <span
        className="absolute left-0 h-[3px] rounded-full"
        style={{ width: `${shown * 100}%`, background: `linear-gradient(90deg, #8A7148, ${BRAND.gold})` }}
      />
      <span
        className="absolute h-3 w-3 -translate-x-1/2 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.6)] transition-transform group-active:scale-125"
        style={{ left: `${shown * 100}%`, background: '#F1E2BF' }}
      />
    </div>
  )
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
