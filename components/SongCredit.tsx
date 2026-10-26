'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { albumLine, isFirstVerse, youtubeId } from '@/lib/text'
import { albumOf, thumbOf } from '@/data/albums'
import { BRAND } from '@/lib/brand'
import { haptic } from '@/lib/haptic'
import { cancelFade, dropNeedle, fadeOut, isRouted, startCrackle, stopCrackle, unlockVinyl } from '@/lib/vinyl'
import { AUTOPLAY, SHARED, SHARED_GONE, SOLO, createPlayer, playOn, pauseSaved, playSaved, playable, session, shared, sourceOf, type Player } from '@/lib/player'
import { warmAudio } from '@/lib/sw-cache'
import { bumpMonth } from '@/lib/storage'
import { audioFile } from '@/lib/audio-name'
import { FitLines } from './deck/FitLines'
import { LyricsButton, LyricsPanel, primeLyrics, type LyricsClock } from './Lyrics'

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
export function SongCredit({
  verse,
  preview = false,
  share = false,
}: {
  verse: Verse
  preview?: boolean
  /** sačuvani sviraju na početnoj — ploča je plejer sačuvanih (lib/player.ts) */
  share?: boolean
}) {
  const id = youtubeId(verse.youtube)
  // dok audio ne pukne, dodir pušta pjesmu; ako server ne može do zvuka, ostaje samo naziv
  // pamti se ZA KOJU pjesmu je zvuk pao — nova pjesma kreće ispočetka sama
  const [failedId, setFailedId] = useState<string | null>(null)
  const failed = failedId === id

  // pregled u adminu: gramofon i za pjesmu koja se tek preuzme kad se stih sačuva
  if (id && !failed && (playable(verse) || preview))
    return (
      <AudioSong key={`${id}-${share}`} verse={verse} {...sourceOf(verse, id)} onFail={() => setFailedId(id)} preview={preview} share={share} />
    )

  // bez pjesme (nema linka ili zvuk nije stigao): samo naziv i album, bez znaka
  return (
    <div className="flex w-full flex-col items-center">
      <SongTitle song={verse.song} withIcon={false} />

      <p className="mt-4 text-[12px] uppercase tracking-[0.24em] text-white/55">
        {albumLine(verse)}
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

const ICON = { initial: { scale: 0.5, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.5, opacity: 0 } }
type State = 'idle' | 'loading' | 'playing' | 'paused'

type Source = { verse: Verse; src: string; fallback: string; dur?: number; onFail: () => void }

/**
 * Pjesma otključana prvim dodirom (svira nečujno, vidi `unlock`), po izvoru.
 * Podnožje ekrana stiha se pri slijetanju papirića složi iznova — novi plejer
 * preuzme baš ovaj zvuk; nov bi iPhone bez dodira ne pustio.
 */
const primed = new Map<string, Player>()

/**
 * Zvuk jedne pjesme: statični fajl, pa server; stanje, vrijeme, premotavanje.
 *
 * Da dodir pusti pjesmu odmah, početak se preuzme unaprijed: plejer ispod
 * stiha ga pripremi kad se ekran smiri (osim uz uštedu podataka), a svaki
 * plejer i na sam pritisak prsta — pola sekunde prije nego dodir postane klik.
 */
function useSong({
  verse,
  src,
  fallback,
  dur: known,
  onFail,
  preload,
  share = false,
}: Source & { preload: boolean; share?: boolean }) {
  const audio = useRef<Player | null>(null)
  const unbind = useRef<(() => void) | null>(null)
  const leaving = useRef(false)
  // zajednički zvuk već svira (npr. pokrenut na raširenoj karti) — plejer to
  // pokaže od prvog kadra
  const [state, setState] = useState<State>(() => {
    const a = share ? shared.get(src) : undefined
    return !a ? 'idle' : !a.paused ? 'playing' : a.currentTime > 0 ? 'paused' : 'idle'
  })
  const [cur, setCur] = useState(() => (share ? (shared.get(src)?.currentTime ?? 0) : 0))
  const [dur, setDur] = useState(() => {
    const d = share ? shared.get(src)?.duration : undefined
    return d && Number.isFinite(d) ? d : (known ?? 0)
  })

  /** Ovaj plejer prati zvuk `a` — stanje i vrijeme stižu kroz događaje. */
  function attach(a: Player) {
    if (audio.current === a && unbind.current) return
    unbind.current?.()
    // otključana pjesma (unlock) svira nečujno do samopokretanja — plejer to ne pokazuje
    const time = () => {
      if (a.dataset.unlock) return
      setCur(a.currentTime)
      if (Number.isFinite(a.duration)) setDur(a.duration)
    }
    const waiting = () => !a.dataset.unlock && setState('loading')
    const playing = () => !a.dataset.unlock && setState('playing')
    const pause = () => !a.dataset.unlock && setState((s) => (s === 'idle' ? s : 'paused'))
    const ended = () => setState('paused')
    const fail = () => {
      setState('idle')
      onFail()
    }
    const on: [string, () => void][] = [
      ['timeupdate', time],
      ['durationchange', time],
      ['waiting', waiting],
      ['playing', playing],
      ['pause', pause],
      ['ended', ended],
    ]
    for (const [e, f] of on) a.addEventListener(e, f)
    a.fails?.add(fail)
    unbind.current = () => {
      for (const [e, f] of on) a.removeEventListener(e, f)
      a.fails?.delete(fail)
    }
    audio.current = a
  }

  /** Prati zvuk `a` i odmah preuzmi gdje je stao (na mountu to radi početno stanje). */
  function bind(a: Player) {
    attach(a)
    if (!a.paused) setState('playing')
    else if (a.currentTime > 0) setState('paused')
    setCur(a.currentTime)
    if (Number.isFinite(a.duration)) setDur(a.duration)
  }

  useEffect(() => {
    // prezentacija: odlaskom s koraka pjesma stane i vrati se na početak
    const stop = () => {
      const a = audio.current
      if (a) {
        a.dataset.want = ''
        a.pause()
        a.currentTime = 0
      }
      setCur(0)
      setState('idle')
    }
    // krenula je druga pjesma — ova se utiša i stane
    const solo = (e: Event) => {
      const a = audio.current
      if (!a || (e as CustomEvent).detail === a) return
      a.dataset.want = ''
      fadeOut(a, 400)
    }
    // ova pjesma je ušla u plejer sačuvanih — karta ga prati
    const joined = (e: Event) => {
      const a = shared.get(src)
      if ((e as CustomEvent).detail === src && a) bind(a)
    }
    // pjesma je izašla iz plejera (svira druga) — karta se otkači i stane
    const gone = (e: Event) => {
      if ((e as CustomEvent).detail !== src) return
      unbind.current?.()
      unbind.current = null
      audio.current = null
      setCur(0)
      setState('idle')
    }
    window.addEventListener('stihdana:stop-audio', stop)
    if (!share) window.addEventListener(SOLO, solo)
    if (share) {
      window.addEventListener(SHARED, joined)
      window.addEventListener(SHARED_GONE, gone)
      const a = shared.get(src)
      if (a) attach(a)
    }
    // plejer ispod stiha: početak pjesme se preuzme kad se ekran smiri
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    const t = preload && !conn?.saveData ? window.setTimeout(prime, 1500) : 0
    return () => {
      leaving.current = true
      clearTimeout(t)
      window.removeEventListener('stihdana:stop-audio', stop)
      window.removeEventListener(SOLO, solo)
      window.removeEventListener(SHARED, joined)
      window.removeEventListener(SHARED_GONE, gone)
      unbind.current?.()
      unbind.current = null
      // zajednički zvuk svira dalje — gasi ga tek zatvaranje sačuvanih
      // otključana (nečujna) svira dalje — preuzme je sljedeći plejer iste pjesme
      if (!share && !audio.current?.dataset.unlock) audio.current?.pause()
      audio.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // pucketanje ploče od dodira — igla je spuštena i dok se pjesma tek učitava
  // (sačuvane: pucketanje vodi sam plejer, lib/player.ts)
  useEffect(() => {
    const a = audio.current
    if (!a || share) return
    if (state === 'playing' || state === 'loading') startCrackle(a)
    else stopCrackle(a)
    return () => {
      // zajednička pjesma svira dalje i kad se ova karta skupi — i pucketanje
      if (!(share && leaving.current)) stopCrackle(a)
    }
  }, [state, share])

  function player(): Player {
    if (audio.current) return audio.current
    const a = primed.get(src) ?? createPlayer(src, fallback)
    attach(a)
    return a
  }

  /**
   * Zvuk koji je prošao kroz Web Audio (utišavanje na iPhoneu) ne svira kad je
   * ekran zaključan — za novo puštanje dođe svjež, s istog mjesta u pjesmi.
   */
  function renew(old: Player): Player {
    const t = old.currentTime
    const fresh = createPlayer(src, fallback)
    fresh.preload = 'auto'
    const seek = () => {
      try {
        fresh.currentTime = t
      } catch {}
    }
    fresh.addEventListener('loadedmetadata', seek, { once: true })
    attach(fresh)
    return fresh
  }

  /**
   * iPhone pušta zvuk samo iz dodira. Pjesma koja kreće sama se zato
   * otključa prvim dodirom bilo gdje (kapija, dozvola): pusti i odmah stane,
   * bez zvuka — poslije je preglednik pusti i bez prsta. Plejer to ne vidi.
   */
  function unlock() {
    // samo telefon (iPhone) — računar pušta i bez ovoga
    if (!matchMedia('(pointer: coarse)').matches) return
    const a = player()
    if (!a.paused || a.dataset.want) return
    // Pjesma stvarno krene iz dodira, ali bez zvuka — iPhone je poslije pusti
    // naglas i bez prsta (samo "pusti pa stani" nije uvijek dovoljno). Oznaka
    // drži ploču, traku i pucketanje mirnim dok samopokretanje ne krene (toggle).
    a.dataset.unlock = '1'
    a.muted = true
    a.preload = 'auto'
    primed.set(src, a)
    a.play().catch(() => {
      delete a.dataset.unlock
      primed.delete(src)
      a.muted = false
    })
    unlockVinyl()
    // samopokretanje nije stiglo (uvod preskočen, bez animacija) — tiho stane
    window.setTimeout(() => {
      if (!a.dataset.unlock) return
      delete a.dataset.unlock
      primed.delete(src)
      a.pause()
      a.currentTime = 0
      a.muted = false
    }, 120000)
  }

  /** Preuzmi početak pjesme unaprijed — dodir je onda trenutan. */
  function prime() {
    const a = player()
    if (a.preload === 'auto' || !a.paused) return
    a.preload = 'auto'
    a.load()
  }

  function toggle() {
    haptic(6)
    // sačuvani: plejer sačuvanih pušta i pauzira (lista, natrag/naprijed)
    if (share) {
      const on = shared.get(src)
      if (on && !on.paused && on.dataset.want) {
        pauseSaved()
        // ploča odmah stane — zvuk se samo još utišava
        setState('paused')
      } else {
        setState('loading')
        playSaved(verse)
      }
      return
    }
    let a = player()
    // otključana prvim dodirom — svira nečujno od tad; sad od početka i naglas
    if (a.dataset.unlock) {
      delete a.dataset.unlock
      primed.delete(src)
      a.muted = false
      try {
        a.currentTime = 0
      } catch {}
      a.dataset.want = '1'
      unlockVinyl()
      dropNeedle(0.3)
      window.dispatchEvent(new CustomEvent(SOLO, { detail: a }))
      session(a, verse)
      bumpMonth('plays', audioFile(verse.song))
      setCur(0)
      if (!a.paused) return setState('playing')
      setState('loading')
      playOn(a, () => setState('paused'))
      return
    }
    // utišava se (pauza upravo dodirnuta) — novi dodir je vrati punom jačinom
    if (!a.paused && !a.dataset.want) {
      cancelFade(a)
      a.dataset.want = '1'
      setState('playing')
      return
    }
    if (a.paused) {
      // pjesma se sluša — service worker je zadrži (javi mu se prije nego zvuk krene)
      warmAudio([src])
      // prošao kroz Web Audio, ili zapeo (greška) — dolazi svjež
      if (isRouted(a) || a.error) a = renew(a)
      delete a.dataset.unlock
      a.dataset.want = '1'
      // zvuk gramofona: kontekst se otvara iz dodira, tup kad igla legne
      unlockVinyl()
      dropNeedle(0.3)
      window.dispatchEvent(new CustomEvent(SOLO, { detail: a }))
      session(a, verse)
      // slušanje mjeseca — pjesma od početka, ne nastavak poslije pauze
      if (a.currentTime < 1) bumpMonth('plays', audioFile(verse.song))
      setState('loading')
      playOn(a, () => setState('paused'))
    } else {
      // pauza — sve stane istog trena: pjesma, pucketanje, ploča (bez utišavanja
      // u koracima — ono kasni i "grmi")
      a.dataset.want = ''
      cancelFade(a)
      a.pause()
      stopCrackle()
      setState('paused')
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
  return { state, progress, dur, time, toggle, seek, prime, unlock, audio }
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
  onPrime,
  deck = false,
  arm = false,
  hole = false,
  cover,
}: {
  size: number
  state: State
  progress: number
  song: string
  /** omot albuma — etiketa ploče (bez omota zlatna) */
  cover?: string
  onClick: () => void
  /** prst je na ploči — pjesma se počne preuzimati prije klika */
  onPrime?: () => void
  /** dugme koje prezentacija sama pritisne */
  deck?: boolean
  /** ručica gramofona koja se spusti na ploču */
  arm?: boolean
  /** rupa na etiketi umjesto play/pauze — kontrole su u plejeru ispod (sačuvani) */
  hole?: boolean
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const playing = state === 'playing'
  // ploča kreće odmah na dodir, kao gramofon — ne čeka prve tonove
  const spinning = playing || state === 'loading'
  const disc = Math.round((size * 66) / 76)
  const icon = Math.max(10, Math.round((size * 14) / 76))
  // zlatno dugme na sredini etikete — znak pusti/pauza na njemu
  const knob = Math.round(icon * 1.85)
  const label = cover ? (thumbOf(cover) ?? cover) : null
  return (
    <motion.button
      type="button"
      onClick={onClick}
      onPointerDown={onPrime}
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
      {/* tanak zlatni prsten oko ploče — napredak pokazuju traka i igla */}
      <svg width={size} height={size} viewBox="0 0 60 60" className="absolute inset-0" aria-hidden>
        <circle cx="30" cy="30" r="28.5" fill="none" stroke={`${BRAND.gold}47`} strokeWidth="1.5" />
      </svg>
      {/* pjesma se učitava — zlatni luk kruži po prstenu */}
      <AnimatePresence>
        {state === 'loading' && (
          <motion.svg
            key="arc"
            width={size}
            height={size}
            viewBox="0 0 60 60"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, rotate: 360 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.25 }, rotate: { duration: 1.1, repeat: Infinity, ease: 'linear' } }}
            aria-hidden
          >
            <circle cx="30" cy="30" r="28.5" fill="none" stroke="#F1E2BF" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="34 145" />
          </motion.svg>
        )}
      </AnimatePresence>
      {/* ploča — vrti se i stane tačno gdje je pauzirana (vinyl-disc: i dok je panel otvoren, globals.css) */}
      <svg
        width={disc}
        height={disc}
        viewBox="0 0 52 52"
        className="vinyl-disc relative drop-shadow-[0_4px_12px_rgba(0,0,0,0.7)]"
        style={{ animation: 'vinyl-spin 3.6s linear infinite', animationPlayState: spinning ? 'running' : 'paused' }}
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
        {label ? (
          <>
            {/* etiketa je omot albuma — vrti se s pločom */}
            <clipPath id={`${uid}c`}>
              <circle cx="26" cy="26" r="12" />
            </clipPath>
            <image href={label} x="14" y="14" width="24" height="24" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${uid}c)`} />
            <circle cx="26" cy="26" r="12" fill="#000" fillOpacity="0.12" />
            <circle cx="26" cy="26" r="12" fill="none" stroke={`url(#${uid}r)`} strokeWidth="0.8" />
          </>
        ) : (
          <>
            <circle cx="26" cy="26" r="12" fill={`url(#${uid}l)`} />
            <circle cx="26" cy="26" r="12" fill="none" stroke="#5E4C30" strokeWidth="0.6" />
            <circle cx="26" cy="26" r="9.5" fill="none" stroke="#16110A" strokeOpacity="0.2" strokeWidth="0.5" />
          </>
        )}
      </svg>
      {/* znak na etiketi — ne vrti se; na omotu stoji na zlatnom dugmetu */}
      <span className="absolute inset-0 flex items-center justify-center">
        {label && !hole && (
          <span
            className="absolute rounded-full"
            style={{
              width: knob,
              height: knob,
              background: `linear-gradient(145deg, #F1E2BF, ${BRAND.gold} 55%, #8A7148)`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.55), inset 0 0 0 0.5px rgba(94,76,48,0.8)',
            }}
            aria-hidden
          />
        )}
        {/* iznad zlatnog dugmeta */}
        <span className="relative flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {state === 'loading' && !hole ? (
            <motion.span
              key="load"
              className="rounded-full border-[1.5px] border-[#16110A] border-t-transparent"
              style={{ width: icon, height: icon }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{ rotate: { duration: 0.8, repeat: Infinity, ease: 'linear' } }}
            />
          ) : hole ? (
            // rupa na sredini ploče, kao na pravoj — ne vrti se
            <motion.span
              key="hole"
              className="rounded-full"
              style={{
                width: Math.max(5, Math.round(icon * 0.5)),
                height: Math.max(5, Math.round(icon * 0.5)),
                background: 'radial-gradient(circle at 40% 35%, #3a332a 0%, #0c0a08 70%)',
                boxShadow: 'inset 0 1px 1.5px rgba(0,0,0,0.9), 0 0 0 1px rgba(22,17,10,0.45), 0 0.5px 0 rgba(255,240,210,0.35)',
              }}
              {...ICON}
              aria-hidden
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
 * Plejer ispod stiha — odmah otvoren, bez kutije: ploča, pored nje naziv,
 * album i traka za premotavanje.
 * Kontrole rade i sa zaključanog ekrana (Media Session).
 */
function AudioSong({ preview = false, share = false, ...props }: Source & { preview?: boolean; share?: boolean }) {
  // pregled (samo za gledanje): bez pripreme i preuzimanja pjesme
  const { state, progress, dur, time, toggle, seek, prime, unlock, audio } = useSong({ ...props, preload: !preview && !share, share })
  const { verse, fallback } = props
  const cover = albumOf(verse.album)?.cover
  // tekst pjesme (components/Lyrics.tsx) — isti zvuk, plejer i u panelu
  const [lyrics, setLyrics] = useState(false)
  // pjesma svira — tekst se pripremi, da se panel otvori pun
  useEffect(() => {
    if (state === 'playing' && !preview) primeLyrics(verse.song)
  }, [state, preview, verse.song])

  // "Mir svim dobrim ljudima" (prvi stih novom korisniku): kad se stih otvori
  // (papirić sleti), pjesma krene sama. Prvi dodir bilo gdje je otključa.
  const auto = !preview && !share && isFirstVerse(verse.text)
  const live = useRef({ state, toggle, unlock })
  useEffect(() => {
    live.current = { state, toggle, unlock }
  })
  useEffect(() => {
    if (!auto) return
    const kinds = ['touchend', 'click', 'keydown'] as const
    const off = () => kinds.forEach((k) => window.removeEventListener(k, first, true))
    function first(e: Event) {
      // pravi dodir — ne "klik" kojim lib/haptic.ts pravi trzaj
      if (!e.isTrusted) return
      off()
      live.current.unlock()
    }
    kinds.forEach((k) => window.addEventListener(k, first, true))
    // telefon ipak nije dao zvuk bez prsta (npr. nije bilo nijednog dodira prije
    // stiha) — pjesma krene na prvi dodir bilo gdje (osim same ploče, ona to radi sama)
    let retry = 0
    const late = (e: Event) => {
      if (!e.isTrusted || (e.target as Element | null)?.closest?.('[data-deck="play"]')) return
      offLate()
      if (live.current.state !== 'playing' && live.current.state !== 'loading') live.current.toggle()
    }
    const offLate = () => kinds.forEach((k) => window.removeEventListener(k, late, true))
    const go = (e: Event) => {
      if ((e as CustomEvent).detail !== verse.id || live.current.state !== 'idle') return
      live.current.toggle()
      clearTimeout(retry)
      retry = window.setTimeout(() => {
        if (live.current.state === 'playing' || live.current.state === 'loading') return
        kinds.forEach((k) => window.addEventListener(k, late, true))
      }, 1500)
    }
    window.addEventListener(AUTOPLAY, go)
    return () => {
      off()
      offLate()
      clearTimeout(retry)
      window.removeEventListener(AUTOPLAY, go)
    }
  }, [auto, verse.id])

  // Lokalno server pripremi pjesmu čim se stih pojavi — dodir je onda trenutan.
  // Na Vercelu nema yt-dlp-a, pa tamo svira samo statični fajl i ovo ne treba.
  useEffect(() => {
    if (!preview && process.env.NODE_ENV === 'development') fetch(`${fallback}&warm=1`).catch(() => {})
  }, [fallback, preview])

  // tekst prati ovaj zvuk (components/Lyrics.tsx) — vrijeme se čita u svakom kadru
  const clock: LyricsClock = () => {
    const a = audio.current
    const on = Boolean(a && !a.dataset.unlock)
    return { t: on ? a!.currentTime : 0, d: a && Number.isFinite(a.duration) && a.duration > 0 ? a.duration : dur, playing: on && !a!.paused, loading: state === 'loading' }
  }
  const row = { verse, state, progress, time, cover, onToggle: toggle, onPrime: prime, onSeek: seek }

  return (
    <>
      <GramophoneRow
        {...row}
        tip
        deck
        hole={share}
        icon={!preview}
        // dugme ne mijenja visinu reda — samo stoji na sredini reda s nazivom
        extra={
          !preview && (
            <span className="-my-2.5">
              <LyricsButton song={verse.song} onOpen={() => setLyrics(true)} playing={state === 'playing'} />
            </span>
          )
        }
      />
      {!preview && (
        <LyricsPanel
          open={lyrics}
          verse={verse}
          clock={clock}
          // dodir na red: pjesma odatle (i krene, ako je stajala)
          onSeek={(t) => {
            const d = clock().d
            if (d) seek(Math.min(1, t / d))
            if (state !== 'playing' && state !== 'loading') toggle()
          }}
          controls={{ toggle, seek }}
          onClose={() => setLyrics(false)}
        />
      )}
    </>
  )
}

/**
 * Gramofon s pjesmom ispod stiha: ploča (s ručicom), pored nje naziv, album
 * i traka. `extra`: desno u redu s nazivom (dugme za tekst).
 */
function GramophoneRow({
  verse,
  state,
  progress,
  time,
  cover,
  onToggle,
  onPrime,
  onSeek,
  tip = false,
  deck = false,
  hole = false,
  icon = false,
  extra,
}: {
  verse: Verse
  state: State
  progress: number
  time: string
  cover?: string
  onToggle: () => void
  onPrime: () => void
  onSeek: (fraction: number) => void
  /** savjet (Tips) se kači na ovaj red — samo ispod stiha */
  tip?: boolean
  /** dugme koje prezentacija sama pritisne — samo ispod stiha */
  deck?: boolean
  hole?: boolean
  /** u redu s nazivom ima mjesta za dugme (naziv se smanji) */
  icon?: boolean
  extra?: React.ReactNode
}) {
  const loading = state === 'loading'
  return (
    <div data-tip={tip ? 'song' : undefined} className="flex items-center gap-4 text-left" style={{ width: CARD_W }}>
      {/* ploča visoka koliko i tekst s trakom desno */}
      {/* sačuvani sviraju — samo ploča (rupa), dugmad su ispod; današnji ima pusti */}
      <Vinyl size={72} state={state} progress={progress} song={verse.song} cover={cover} onClick={onToggle} onPrime={onPrime} deck={deck} arm hole={hole} />
      <div className="min-w-0 flex-1">
        {/* dodir na naziv radi isto što i ploča */}
        <div className="flex items-center gap-2.5">
          <p
            className="min-w-0 flex-1 cursor-pointer truncate font-semibold uppercase leading-none tracking-[0.18em]"
            style={{ color: BRAND.gold, fontSize: cardSongSize(verse.song, icon) }}
            onClick={onToggle}
            onPointerDown={onPrime}
          >
            {verse.song}
          </p>
          {extra}
        </div>
        <p className="mt-2 truncate text-[10.5px] uppercase leading-none tracking-[0.22em] text-white/60">{albumLine(verse)}</p>
        <div className="mt-1 flex items-center gap-2.5">
          <Seek value={progress} onSeek={onSeek} loading={loading} />
          <Time loading={loading} text={time} className="w-9 text-[10.5px]" />
        </div>
      </div>
    </div>
  )
}

/** Vrijeme pjesme; dok se učitava, tri tačke koje dišu. */
function Time({ loading, text, className }: { loading: boolean; text: string; className: string }) {
  return (
    <span className={`tabular flex justify-end text-right tracking-[0.06em] text-white/60 ${className}`}>
      {loading ? (
        <span className="flex gap-[3px]" role="status" aria-label="Pjesma se učitava">
          {[0, 1, 2].map((i) => (
            <motion.i
              key={i}
              className="block h-[3px] w-[3px] rounded-full"
              style={{ background: BRAND.gold }}
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.16 }}
            />
          ))}
        </span>
      ) : (
        text
      )}
    </span>
  )
}

/**
 * Pjesma u kartici sačuvanog stiha: mala ploča je pusti, desno naziv i
 * album, ispod traka za premotavanje. Bez zvuka ostaje tačka raspoloženja.
 * `fit`: naziv i album cijeli, svaki u jednom redu — slova se smanje koliko treba (karte sačuvanih).
 */
export function SongRow({
  verse,
  accent,
  fit = false,
  hole = false,
  vinyl = 60,
}: {
  verse: Verse
  accent: string
  fit?: boolean
  /** rupa na ploči umjesto play — kad je plejer ispod (karte u panelu sačuvanih) */
  hole?: boolean
  /** veličina ploče (px) — manja na kartama u špilu */
  vinyl?: number
}) {
  const id = youtubeId(verse.youtube)
  const [failedId, setFailedId] = useState<string | null>(null)

  if (!id || failedId === id || !playable(verse))
    return (
      <>
        <i className="block h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} aria-hidden />
        <div className="min-w-0 flex-1">
          <RowText verse={verse} fit={fit} />
        </div>
      </>
    )
  return <AudioRow key={id} verse={verse} {...sourceOf(verse, id)} onFail={() => setFailedId(id)} fit={fit} hole={hole} vinyl={vinyl} />
}

function AudioRow({ fit, hole, vinyl, ...props }: Source & { fit: boolean; hole: boolean; vinyl: number }) {
  // plejer na karti sačuvanih — zajednički zvuk, ne staje kad se karta skupi ili prevuče
  const { state, progress, time, toggle, seek, prime } = useSong({ ...props, preload: false, share: true })
  const { verse } = props
  const loading = state === 'loading'
  // mala ploča (karta u špilu) — i slova sitnija
  const small = vinyl < 56
  return (
    <>
      <Vinyl size={vinyl} state={state} progress={progress} song={verse.song} cover={albumOf(verse.album)?.cover} onClick={toggle} onPrime={prime} arm hole={hole} />
      <div className="min-w-0 flex-1">
        <RowText verse={verse} onClick={toggle} fit={fit} small={small} />
        <div className={`flex items-center ${small ? 'gap-2' : 'gap-2.5'}`}>
          <Seek value={progress} onSeek={seek} loading={loading} />
          <Time loading={loading} text={time} className={small ? 'w-7 text-[8.5px]' : 'w-9 text-[10px]'} />
        </div>
      </div>
    </>
  )
}

function RowText({ verse, onClick, fit = false, small = false }: { verse: Verse; onClick?: () => void; fit?: boolean; small?: boolean }) {
  // jedan red: skraćen (lista) ili cio, sa smanjenim slovima (karte) — nikad
  // preko ivice: duga pjesma se smanji, ne gura razmak
  const line = (t: React.ReactNode) => (fit ? <FitLines><span>{t}</span></FitLines> : t)
  const cut = fit ? 'overflow-hidden' : 'truncate'
  return (
    <div className={`min-w-0 ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
      <p className={`${cut} ${small ? 'text-[9px] tracking-[0.16em]' : 'text-[11px] tracking-[0.18em]'} font-semibold uppercase`} style={{ color: BRAND.gold }}>
        {line(verse.song)}
      </p>
      <p className={`mt-1 ${cut} ${small ? 'text-[8.5px] tracking-[0.14em]' : 'text-[10px] tracking-[0.16em]'} uppercase text-white/55`}>
        {line(albumLine(verse))}
      </p>
    </div>
  )
}

/** Traka napretka — dodir ili povlačenje prstom premota pjesmu. */
export function Seek({ value, onSeek, loading = false }: { value: number; onSeek: (fraction: number) => void; loading?: boolean }) {
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
      <span className="absolute inset-x-0 h-[2px] overflow-hidden rounded-full bg-white/15">
        {/* pjesma se učitava — zlatni odsjaj prelazi preko trake */}
        {loading && (
          <motion.span
            className="absolute inset-y-0 w-2/5 rounded-full"
            style={{ background: `linear-gradient(90deg, transparent, ${BRAND.gold}, transparent)` }}
            initial={{ left: '-40%' }}
            animate={{ left: '100%' }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />
        )}
      </span>
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
/** širina reda s gramofonom — skoro do ivica ekrana, da duži naziv stane */
const CARD_W = 'min(calc(100vw - 2.5rem), 360px)'

function cardSongSize(song: string, icon = false): string {
  const em = Math.max(song.length, 1) * 0.9 + 0.18
  // ploča i razmak; uz dugme za tekst još njegova širina
  return `min(15px, calc((${CARD_W} - ${icon ? 152 : 108}px) / ${em.toFixed(2)}))`
}

export function clock(s: number): string {
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
