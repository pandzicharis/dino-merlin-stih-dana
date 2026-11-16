'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, type Transition } from 'motion/react'
import { albumOf, softOf, thumbOf } from '@/data/albums'
import { MOODS } from '@/data/moods'
import type { Verse } from '@/data/verses'
import { WIDE_MEDIA } from '@/lib/client-store'
import { haptic } from '@/lib/haptic'
import { albumLine, asWritten } from '@/lib/text'
import { pauseTube, resumeTube, tubeNext, unmuteTube, useTube, videoOf } from '@/lib/youtube'
import { primeLyrics } from '../Lyrics'
import { DrawerHeader } from '../DrawerIcon'
import { GiftCardWide, useGiftLink } from '../GiftLink'
import { QrToggle } from '../VerseQr'
import { EqBars } from '../EqBars'
import { ListenFooter } from './Listen'
import { Slot } from './Slot'
import { TubeControls } from './Transport'
import { LyricsView, useTubeLyrics } from './TubeLyrics'

/*
 * Pjesma koja svira — ista ladica na početnoj (components/tube/TubeDrawer.tsx)
 * i u sačuvanima (components/tube/TubePanel.tsx): zatvori zatvara samo pjesmu.
 *
 *   zaglavlje  kao na ostalim ladicama — "Stih · <stih u jednom redu>", zatvori
 *   video      YouTube plejer
 *   pjesma     red kao u plejeru sačuvanih na developu: omot, "Trenutno" sa
 *              znakom muzike, pjesma u boji stiha, album — poravnat s videom
 *   kontrole   kao u plejeru sačuvanih: traka napretka s vremenom, pa nasumično,
 *              nazad, pusti, sljedeća, ponovi (Transport.tsx `TubeControls`)
 *   tekst      harmonika, zatvorena: otvorena raširi ladicu do vrha i tekst
 *              prati pjesmu (TubeLyrics.tsx)
 *   podnožje   znakovi platformi (Listen.tsx); uz otvoren tekst sitniji, a na niskom
 *              ekranu sklonjeni
 *
 * Ladica je visoka koliko joj treba (`onHeight` — visina koju traži):
 * zatvoren tekst — sadržaj, otvoren — do vrha ekrana. Visina klizi
 * `SHEET_RESIZE`, isto u oba smjera, a ništa u ladici ne skače: pri
 * zatvaranju tekst ostaje dok se ladica spušta (i gasi se), pa tek onda
 * nestane — ladica je tad već na mjeri bez njega. Nikad nije viša od ekrana:
 * na malom telefonu se sadržaj pomjera unutar nje.
 */

/** Kako klizi visina ladice s pjesmom (TubeDrawer, TubePanel) — mekano, bez naglog starta. */
export const SHEET_RESIZE: Transition = { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
const RESIZE_MS = 500

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
  // tekst je u ladici: otvoren, ili se upravo zatvara (ladica se spušta, tekst se gasi)
  const [shown, setShown] = useState(false)
  const toggle = () => {
    haptic(6)
    if (!open) setShown(true)
    setOpen(!open)
  }
  const wide = shown && has
  const playing = tube.status === 'playing'
  const m = MOODS[verse.mood]
  const cover = albumOf(verse.album)?.cover
  // QR kod stiha (GiftLink.tsx) — dugme u zaglavlju ga stavi na mjesto videa. Pjesma
  // za to vrijeme stoji, a kad se video vrati, nastavi (ako je svirala)
  const [qrOn, setQrOn] = useState(false)
  const gift = useGiftLink(verse, qrOn)
  const resumeAfterQr = useRef(false)
  const toggleQr = () => {
    haptic(6)
    if (!qrOn) {
      resumeAfterQr.current = tube.status === 'playing' || tube.status === 'loading'
      pauseTube()
    } else if (resumeAfterQr.current) resumeTube()
    setQrOn(!qrOn)
  }
  // druga pjesma (sljedeća iz reda) — opet video
  const [qrFor, setQrFor] = useState(id)
  if (qrFor !== id) {
    setQrFor(id)
    setQrOn(false)
  }
  // pjesma krenula dok je QR na mjestu videa (pusti, nazad, sljedeća) — vrati se video:
  // YouTube svira samo dok se vidi
  const showVideo = () => setQrOn(false)
  const [lastStatus, setLastStatus] = useState(tube.status)
  if (lastStatus !== tube.status) {
    setLastStatus(tube.status)
    if (qrOn && tube.status === 'playing') setQrOn(false)
  }

  // koliko ladica treba: zatvoren tekst — koliko je sadržaj, otvoren — do vrha, a dok se
  // zatvara — mjera bez teksta (zapamćena), da se spušta ravno na nju
  const inner = useRef<HTMLDivElement>(null)
  const closedH = useRef(0)
  // sadržaj viši od ekrana (mali telefon): ladica je do vrha, a sadržaj se pomjera u njoj
  const [tall, setTall] = useState(false)
  const report = useRef(onHeight)
  useEffect(() => {
    report.current = onHeight
  })
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    if (wide && open) return void report.current?.(fullHeight())
    if (wide) {
      // zatvara se: ladica klizi na mjeru bez teksta, a tekst nestane tek kad stigne —
      // tad je sadržaj već te visine. Ne po satu: telefon koji kasni s kadrovima bi
      // inače izgubio tekst usred kretnje (i dno bi skočilo). Sat je samo osigurač.
      report.current?.(Math.min(closedH.current || el.offsetHeight, fullHeight()))
      const arrived = () => el.offsetHeight <= closedH.current + 1 && setShown(false)
      const ro = new ResizeObserver(arrived)
      ro.observe(el)
      const late = window.setTimeout(() => setShown(false), RESIZE_MS * 5)
      return () => {
        ro.disconnect()
        clearTimeout(late)
      }
    }
    const send = () => {
      closedH.current = el.offsetHeight
      const full = fullHeight()
      setTall(el.offsetHeight > full)
      report.current?.(Math.min(el.offsetHeight, full))
    }
    send()
    const ro = new ResizeObserver(send)
    ro.observe(el)
    return () => ro.disconnect()
  }, [wide, open])

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col ${tall ? 'overflow-y-auto overflow-x-hidden overscroll-contain' : ''}`}>
      <div ref={inner} className={`flex flex-col ${wide ? 'min-h-0 flex-1' : ''}`}>
        <DrawerHeader
          icon={<NoteIcon />}
          eyebrow="Stih"
          title={asWritten(verse.text).replace(/\s*\n\s*/g, ' ')}
          onClose={onClose}
          minimize={minimize}
          action={<QrToggle on={qrOn} onClick={toggleQr} />}
        />

        <div className="shrink-0 px-[10px] pt-3">
          <div className="relative rounded-[18px] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            {/* video se skloni (mjesto ostaje), a na njegovo mjesto, iste mjere, QR kod
                stiha — ladica ne skače; pjesma za to vrijeme stoji (YouTube ne svira skriven) */}
            <Slot id={id} away={qrOn} />
            <AnimatePresence>
              {qrOn && (
                <motion.div
                  key="qr"
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 30, delay: 0.08 } }}
                  exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
                >
                  <GiftCardWide verse={verse} qr={gift.qr} onBack={toggleQr} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* pjesma — kao u plejeru sačuvanih, poravnata s videom */}
        <div className="flex shrink-0 items-center gap-2.5 px-[10px] pt-6">
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
              {tube.muted ? (
                // svira bez zvuka (iPhone prije prvog dodira) — u videu nema YouTubeovih
                // kontrola, pa zvuk pušta naše dugme
                <button
                  type="button"
                  onClick={() => {
                    haptic(6)
                    unmuteTube()
                  }}
                  className="relative -my-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-[3px] text-[8.5px] font-semibold uppercase leading-none tracking-[0.22em] transition-transform before:absolute before:-inset-2 before:content-[''] active:scale-95"
                  style={{ color: m.accent, borderColor: `${m.accent}66`, background: `${m.accent}1a` }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M11 5 6 9H2v6h4l5 4z" />
                    <path d="m22 9-6 6M16 9l6 6" />
                  </svg>
                  Uključi zvuk
                </button>
              ) : (
                <span className="whitespace-nowrap text-[8.5px] font-medium uppercase tracking-[0.26em]" style={{ color: m.accent }}>
                  {tube.status === 'paused' ? 'Pauzirano' : 'Trenutno'}
                </span>
              )}
            </div>
            <p className="truncate text-[12.5px] font-semibold uppercase leading-tight tracking-[0.18em]" style={{ color: m.accent }}>
              {verse.song}
            </p>
            <p className="mt-1.5 truncate text-[10px] uppercase tracking-[0.22em] text-white/55">{albumLine(verse)}</p>
          </div>
        </div>

        {/* traka napretka i kontrole — nasumično, nazad, pusti, sljedeća, ponovi */}
        <div className="shrink-0 px-[10px] pt-3">
          <TubeControls accent={m.accent} onPlay={showVideo} />
        </div>

        {/* tekst pjesme — harmonika preko cijele širine ladice: "Tekst pjesme" je tamnija
            traka od ivice do ivice, a otvoren tekst teče ispod nje preko atmosfere pjesme —
            bez okvira, pa ništa ne sužava prostor */}
        {has && (
          <div className={`mt-5 flex flex-col ${wide ? 'min-h-0 flex-1' : 'shrink-0'}`}>
            <button
              type="button"
              onClick={toggle}
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
            {/* otvoren tekst se pretopi dok ladica raste; zatvoren se ugasi dok se ladica
                spušta i tek onda nestane — ništa se ne preslaže usput */}
            {wide && (
              <motion.div
                key="lyrics"
                className="relative flex min-h-0 flex-1 flex-col"
                initial={{ opacity: 0 }}
                animate={{ opacity: open ? 1 : 0 }}
                transition={open ? { duration: 0.3, delay: 0.12 } : { duration: 0.22 }}
              >
                <LyricsView verse={verse} lyrics={lyrics} anchor={0.5} />
              </motion.div>
            )}
          </div>
        )}

        {/* podnožje: "Slušaj na" i platforme — bez linija, nisko, pri dnu (više mjesta iznad);
            razmak iznad klizi zajedno s visinom ladice. Otvoren tekst: sitniji znakovi, a na
            niskom ekranu (do 760 px) podnožje se skloni — tekstu ostane mjesta */}
        <div
          className={`relative mx-[10px] grid shrink-0 pb-[max(0.15rem,calc(env(safe-area-inset-bottom)-0.75rem))] transition-[padding,grid-template-rows,opacity,visibility] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${open && has ? 'grid-rows-[1fr] pt-4 [@media(max-height:760px)]:invisible [@media(max-height:760px)]:grid-rows-[0fr] [@media(max-height:760px)]:pt-0 [@media(max-height:760px)]:opacity-0' : 'grid-rows-[1fr] pt-10'} wide:pb-3`}
        >
          <div className="min-h-0 overflow-hidden">
            <ListenFooter verse={verse} videoId={id} small={open && has} />
          </div>
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
