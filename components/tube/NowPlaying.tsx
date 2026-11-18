'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
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
  // tekst preko cijelog ekrana: zaglavlje, pjesma i podnožje se sklone, a video
  // (YouTube ga traži vidljivog) i kontrole ostaju — sve ostalo je tekst
  const [focus, setFocus] = useState(false)
  const toggle = () => {
    haptic(6)
    if (!open) setShown(true)
    else setFocus(false)
    setOpen(!open)
  }
  const big = focus && open
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
        {/* tekst preko ekrana: zaglavlje i pjesma se sklope i pretope (ne nestanu u
            kadru) — video, kontrole i tekst klize gore u istom potezu kao podnožje dole */}
        <div className="grid shrink-0" style={fold(big)} inert={big}>
          <div className="min-h-0 overflow-hidden">
            <DrawerHeader
              icon={<NoteIcon />}
              eyebrow="Stih"
              title={asWritten(verse.text).replace(/\s*\n\s*/g, ' ')}
              onClose={onClose}
              minimize={minimize}
              action={<QrToggle on={qrOn} onClick={toggleQr} />}
            />
          </div>
        </div>

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

        {/* pjesma — kao u plejeru sačuvanih, poravnata s videom (tekst preko ekrana: sklopljena) */}
        <div className="grid shrink-0" style={fold(big)} inert={big}>
        <div className="min-h-0 overflow-hidden">
        <div className="flex items-center gap-2.5 px-[10px] pt-6">
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
              <span className="whitespace-nowrap text-[8.5px] font-medium uppercase tracking-[0.26em]" style={{ color: m.accent }}>
                {tube.status === 'paused' ? 'Pauzirano' : 'Trenutno'}
              </span>
            </div>
            <p className="truncate text-[12.5px] font-semibold uppercase leading-tight tracking-[0.18em]" style={{ color: m.accent }}>
              {verse.song}
            </p>
            <p className="mt-1.5 truncate text-[10px] uppercase tracking-[0.22em] text-white/55">{albumLine(verse)}</p>
          </div>
          {/* svira bez zvuka (iPhone prije prvog dodira) — okrugla ikonica gore desno uključi
              zvuk (u videu nema YouTubeovih kontrola); dok zvuk radi, nema je */}
          <AnimatePresence>
            {tube.muted && (
              <motion.button
                key="zvuk"
                type="button"
                onClick={() => {
                  haptic(6)
                  unmuteTube()
                }}
                aria-label="Uključi zvuk"
                className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full border"
                style={{ color: m.accent, borderColor: `${m.accent}66`, background: `${m.accent}1f` }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M11 5 6 9H2v6h4l5 4z" />
                  <path d="m22 9-6 6M16 9l6 6" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
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
            <div className="flex h-14 shrink-0 items-stretch bg-white/[0.08]">
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                // traka je uvijek u tonu (i otvorena) — pod prstom još malo jača
                className="flex min-w-0 flex-1 items-center gap-3 pl-5 pr-3 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.04]"
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
            </div>
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
                <LyricsView verse={verse} lyrics={lyrics} anchor={0.5} big={big} />
                {/* tekst preko cijelog ekrana i nazad — dole desno, kao kod videa */}
                {open && (
                  <button
                    type="button"
                    onClick={() => {
                      haptic(6)
                      setFocus(!focus)
                    }}
                    aria-pressed={focus}
                    aria-label={focus ? 'Tekst u ladici' : 'Tekst preko cijelog ekrana'}
                    title={focus ? 'Tekst u ladici' : 'Tekst preko cijelog ekrana'}
                    data-lyrics-focus
                    className="absolute bottom-3 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/75 backdrop-blur-md transition-[color,transform] hover:text-white active:scale-95"
                    style={focus ? { color: m.accent, borderColor: `${m.accent}66` } : undefined}
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.svg
                        key={focus ? 'in' : 'out'}
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                        initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      >
                        {focus ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
                      </motion.svg>
                    </AnimatePresence>
                  </button>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* podnožje: "Slušaj na" i platforme — bez linija, nisko, pri dnu (više mjesta iznad);
            razmak iznad klizi zajedno s visinom ladice. Otvoren tekst: sitniji znakovi, a na
            niskom ekranu (do 760 px) podnožje se skloni — tekstu ostane mjesta */}
        <div
          className={`relative mx-[10px] grid shrink-0 pb-[max(0.15rem,calc(env(safe-area-inset-bottom)-0.75rem))] transition-[padding,grid-template-rows,opacity,visibility] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${big ? 'invisible grid-rows-[0fr] pt-0 opacity-0' : open && has ? 'grid-rows-[1fr] pt-4 [@media(max-height:760px)]:invisible [@media(max-height:760px)]:grid-rows-[0fr] [@media(max-height:760px)]:pt-0 [@media(max-height:760px)]:opacity-0' : 'grid-rows-[1fr] pt-10'} wide:pb-3`}
        >
          <div className="min-h-0 overflow-hidden">
            <ListenFooter verse={verse} videoId={id} small={open && has} />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Sklapanje dijela ladice (tekst preko ekrana): visina na nulu u istom potezu
 * kao podnožje i slova teksta; sadržaj se pretopi brže dok se sklapa, a pri
 * vraćanju tek kad se mjesto otvori.
 */
function fold(gone: boolean): CSSProperties {
  return {
    gridTemplateRows: gone ? '0fr' : '1fr',
    opacity: gone ? 0 : 1,
    transition: `grid-template-rows 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity ${gone ? '0.22s ease-out' : '0.32s ease-out 0.16s'}`,
  }
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
