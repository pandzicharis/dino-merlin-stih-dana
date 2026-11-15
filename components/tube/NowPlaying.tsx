'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { albumOf, softOf, thumbOf } from '@/data/albums'
import { MOODS } from '@/data/moods'
import type { Verse } from '@/data/verses'
import { WIDE_MEDIA } from '@/lib/client-store'
import { haptic } from '@/lib/haptic'
import { albumLine, asWritten } from '@/lib/text'
import { tubeNext, useTube, videoOf } from '@/lib/youtube'
import { primeLyrics } from '../Lyrics'
import { DrawerHeader } from '../DrawerIcon'
import { EqBars } from '../EqBars'
import { ListenFooter } from './Listen'
import { Slot } from './Slot'
import { Transport } from './Transport'
import { LyricsView, useTubeLyrics } from './TubeLyrics'

/*
 * Pjesma koja svira — ista ladica na početnoj (components/tube/TubeDrawer.tsx)
 * i u sačuvanima (components/tube/TubePanel.tsx): zatvori zatvara samo pjesmu.
 * Jedna pjesma — pusti, pauza i traka su u YouTube videu.
 *
 *   zaglavlje  kao na ostalim ladicama — "Stih · <stih u jednom redu>", zatvori
 *   video      YouTube plejer
 *   pjesma     red kao u plejeru sačuvanih na developu: omot, "Trenutno" sa
 *              znakom muzike, pjesma u boji stiha, album — poravnat s videom;
 *              desno tiho nazad, pusti i sljedeća kad pjesma ima red (sačuvani —
 *              Transport.tsx)
 *   tekst      harmonika, zatvorena: otvorena raširi ladicu do vrha i tekst
 *              prati pjesmu (TubeLyrics.tsx)
 *   podnožje   znakovi platformi (Listen.tsx)
 *
 * Ladica je visoka koliko joj treba (`onHeight` — visina koju traži):
 * zatvoren tekst — sadržaj, otvoren — do vrha ekrana.
 */
export function NowPlaying({
  verse,
  id,
  onClose,
  onHeight,
  minimize = false,
}: {
  verse: Verse
  id: string
  onClose: () => void
  onHeight?: (h: number) => void
  /** u sačuvanima: spusti umjesto zatvori (lib/youtube.ts `minimizeTube`) */
  minimize?: boolean
}) {
  const lyrics = useTubeLyrics(verse)
  // dok tekst nove pjesme stiže, harmonika ostaje (i otvorena) — promjena pjesme ne trepne
  const has = lyrics !== null
  const tube = useTube()

  // sljedeća iz reda: tekst i slika se pripreme unaprijed — prelaz bez treptaja
  useEffect(() => {
    const n = tube.next ? tubeNext() : null
    const id = n ? videoOf(n) : null
    if (!n || !id) return
    primeLyrics(n.song)
    new Image().src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
  }, [tube.next])
  const [open, setOpen] = useState(false)
  const wide = open && has
  const playing = tube.status === 'playing'
  const m = MOODS[verse.mood]
  const cover = albumOf(verse.album)?.cover

  // koliko ladica treba: zatvoren tekst — koliko je sadržaj, otvoren — do vrha
  const inner = useRef<HTMLDivElement>(null)
  const report = useRef(onHeight)
  useEffect(() => {
    report.current = onHeight
  })
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    if (wide) return void report.current?.(fullHeight())
    const send = () => report.current?.(el.offsetHeight)
    send()
    const ro = new ResizeObserver(send)
    ro.observe(el)
    return () => ro.disconnect()
  }, [wide])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={inner} className={`flex flex-col ${wide ? 'min-h-0 flex-1' : ''}`}>
        <DrawerHeader icon={<NoteIcon />} eyebrow="Stih" title={asWritten(verse.text).replace(/\s*\n\s*/g, ' ')} onClose={onClose} minimize={minimize} />

        <div className="shrink-0 px-[10px] pt-3">
          <div className="rounded-[18px] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <Slot id={id} />
          </div>
        </div>

        {/* pjesma — kao u plejeru sačuvanih, poravnata s videom; video, pjesma i tekst po 28 px razmaka */}
        <div className="flex shrink-0 items-center gap-2.5 px-[10px] pt-7">
          <span
            className="block h-[58px] w-[58px] shrink-0 rounded-[10px] bg-cover bg-center"
            style={{
              backgroundImage: `url(${cover ? (thumbOf(cover) ?? cover) : '/icons/icon-192.png?v=2'})`,
              backgroundColor: m.gradient[1],
              boxShadow: '0 6px 18px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.08)',
            }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            {/* trenutno slušaš — trake titraju dok svira (stoje kad je pauza) */}
            <div className="mb-1.5 flex items-center gap-1.5">
              <EqBars accent={m.accent} on={playing} h={9} />
              {/* svira bez zvuka (iPhone prije prvog dodira u videu) — kaže kako se pušta zvuk */}
              <span className="whitespace-nowrap text-[8.5px] font-medium uppercase tracking-[0.26em]" style={{ color: m.accent }}>
                {tube.muted ? 'Dodirni video za zvuk' : tube.status === 'paused' ? 'Pauzirano' : 'Trenutno'}
              </span>
            </div>
            <p className="truncate text-[12.5px] font-semibold uppercase leading-tight tracking-[0.18em]" style={{ color: m.accent }}>
              {verse.song}
            </p>
            <p className="mt-1.5 truncate text-[10px] uppercase tracking-[0.22em] text-white/55">{albumLine(verse)}</p>
          </div>
          {/* pjesma iz liste: nazad, pusti, sljedeća — tiho, uz pjesmu */}
          {tube.list && <Transport />}
        </div>

        {/* tekst pjesme — harmonika preko cijele širine ladice: "Tekst pjesme" je tamnija
            traka od ivice do ivice, a otvoren tekst teče ispod nje preko atmosfere pjesme —
            bez okvira, pa ništa ne sužava prostor */}
        {has && (
          <div className={`mt-7 flex flex-col ${wide ? 'min-h-0 flex-1' : 'shrink-0'}`}>
            <button
              type="button"
              onClick={() => {
                haptic(6)
                setOpen((o) => !o)
              }}
              aria-expanded={open}
              // traka je uvijek u tonu (i otvorena) — pod prstom još malo jača
              className="flex h-14 shrink-0 items-center gap-3 bg-white/[0.08] px-5 text-left transition-colors hover:bg-white/[0.1] active:bg-white/[0.11]"
            >
              {/* znak muzike — titra dok pjesma svira */}
              <EqBars accent={m.accent} on={playing} h={14} />
              <span className="flex-1 text-[12px] font-bold uppercase leading-none tracking-[0.2em] text-white/90">Tekst pjesme</span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-white/60 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {/* otvoren tekst se pretopi dok ladica raste; zatvoren nestane odmah — ladica se
                smanjuje na mjeru bez njega, ništa se ne preslaže usput */}
            {wide && (
              <motion.div key="lyrics" className="relative flex min-h-0 flex-1 flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.12 }}>
                <LyricsView verse={verse} lyrics={lyrics} anchor={0.34} />
              </motion.div>
            )}
          </div>
        )}

        {/* podnožje: "Slušaj na" i platforme — bez linija, malo niže (više mjesta iznad) */}
        <div className={`relative mx-[10px] shrink-0 pb-[max(0.6rem,env(safe-area-inset-bottom))] ${wide ? 'pt-5' : 'pt-8'}`}>
          <ListenFooter verse={verse} videoId={id} />
        </div>
      </div>
    </div>
  )
}

/** visina ladice do vrha ekrana (ispod izreza); na širokom ekranu panel na sredini */
export function fullHeight(): number {
  const h = window.innerHeight
  if (window.matchMedia(WIDE_MEDIA).matches) return Math.round(h * 0.82)
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden'
  document.body.append(probe)
  const top = probe.offsetHeight
  probe.remove()
  return h - Math.max(top, 12)
}

/** znak pjesme u zaglavlju — nota */
function NoteIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

/**
 * Iza pjesme: atmosfera stiha, kao plejer sačuvanih — boje stiha, a ispod
 * njih jedva omot albuma (unaprijed zamućen). Druga pjesma se pretopi.
 */
export function SongBackdrop({ verse }: { verse: Verse }) {
  const m = MOODS[verse.mood]
  const soft = softOf(albumOf(verse.album)?.cover)
  // omot se vidi 22% ispod boja
  const a = soft ? 'c7' : ''
  const bg = `radial-gradient(130% 120% at 15% 0%, ${m.gradient[2]}66 0%, transparent 55%), radial-gradient(120% 120% at 100% 100%, ${m.gradient[1]}aa 0%, transparent 60%), linear-gradient(180deg, ${m.gradient[1]}${a} 0%, ${m.gradient[0]}${a} 100%)${soft ? `, url(${soft}) center / cover, ${m.gradient[1]}` : ''}`
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={`${verse.mood}|${soft ?? ''}`}
        className="pointer-events-none absolute inset-0 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        aria-hidden
      >
        <div className="absolute inset-0" style={{ background: bg }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.4) 100%)' }} />
      </motion.div>
    </AnimatePresence>
  )
}
