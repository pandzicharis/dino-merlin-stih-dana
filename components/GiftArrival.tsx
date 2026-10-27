'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, type Easing } from 'motion/react'
import type { Verse } from '@/data/verses'
import { MOODS } from '@/data/moods'
import { albumOf } from '@/data/albums'
import { MAGAZA_BESIDE, MAGAZA_DROP_CSS } from '@/lib/brand'
import { haptic } from '@/lib/haptic'
import { paperText } from '@/lib/text'
import { todayInTz } from '@/lib/date'
import { COLORS } from './deck/PaperToPhone'
import { PaperVerse } from './IntroSplash'
import { SPLASH_ARRIVE, VerseText } from './VerseText'
import { VerseScreen } from './VerseScreen'
import { CardAtmosphere } from './CardAtmosphere'
import { FavoriteButton } from './FavoriteButton'
import { ShareButton } from './ShareSheet'
import { SongCredit } from './SongCredit'
import { Signature } from './Signature'
import { MagazaLogo } from './MagazaLogo'
import { SheetBackdrop, SheetLayer, SheetSlide, useSheetDrag, useSheetOpen } from './Sheet'
import { BackLink } from './BackLink'
import { lockScroll } from '@/lib/scroll-lock'

const EASE: Easing = [0.3, 0, 0.2, 1]
/** sjena je na polovinama (ne animira se) — pokret ostaje samo pomak i prozirnost */
const SHADOW = '0 18px 40px rgba(0,0,0,0.45)'

/*
 * STIH POKLON — "Link i QR" u panelu za dijeljenje.
 *
 * Link je stranica stiha s `?poklon` (`/stih/<id>?poklon`; ona nosi pregled
 * za WhatsApp/IG). Odatle odmah na početnu (`/?poklon=<id>`), jer iza
 * poklona stoji moj stih dana:
 *
 *   1. podloga i naslov kao kod tombole ("Stih za tebe", s poklonom), dole
 *      potpis | Magaza
 *   2. presavijen papirić — isti kao listić iz tombole (boja, mjere, samo
 *      tekst, bez fontova stiha) — sleti na sredinu i otvori se s pola na
 *      cijeli; stih izroni iz pregiba
 *   3. kao u tomboli: drawer sa stihom (iste veličine kao ekran stiha) već
 *      stoji iza podloge; podloga se pretopi, slova odlete s papira na mjesto
 *      stiha i pretope se u digitalni stih, a papirić padne i nestane
 *   4. zatvoriš drawer (×, ili povuci nadolje) — tu je moj stih dana
 *
 * Dodir dok papirić stoji preskače na drawer. Bez animacija (smanjen pokret)
 * — odmah drawer.
 */

/* `/stih/<id>?poklon` — adresa se čita jednom po stranici */
let seen: { path: string; on: boolean } | null = null
const noop = () => () => {}

function read(): boolean {
  if (seen?.path !== location.pathname) seen = { path: location.pathname, on: new URLSearchParams(location.search).has('poklon') }
  return seen.on
}

/** Stranica stiha: poklon ide na početnu (iza njega je moj stih dana), inače stih kao i prije. */
export function GiftVerse({ verse, date }: { verse: Verse; date: string }) {
  const gift = useSyncExternalStore(noop, read, () => false)
  const router = useRouter()
  useEffect(() => {
    if (gift) router.replace(`/?poklon=${encodeURIComponent(verse.id)}`)
  }, [gift, router, verse.id])

  // dok se početna ne učita — samo boja stiha, bez bljeska ekrana
  if (gift) return <div className="fixed inset-0" style={{ background: MOODS[verse.mood].gradient[0] }} aria-hidden />
  return (
    <>
      {/* prije prvog prikaza (HTML sa servera ne zna za ?poklon): poklon — sadržaj se ne
          vidi ni trenutak (globals.css html[data-gift]), samo boja stiha */}
      <script dangerouslySetInnerHTML={{ __html: GIFT_EARLY }} />
      <div className="gift-cover fixed inset-0 z-[200]" style={{ background: MOODS[verse.mood].gradient[0] }} aria-hidden />
      <div data-gift-hide>
        <BackLink />
        <VerseScreen verse={verse} date={date} />
      </div>
    </>
  )
}

/** `?poklon` u adresi — oznaka na <html> prije prvog prikaza (skine se na početnoj) */
const GIFT_EARLY = "if(/[?&]poklon(=|&|$)/.test(location.search))document.documentElement.dataset.gift=''"

/** `in` sleti presavijen, `open` otvoren, `gone` slova lete — podloga se pretopi, papirić pada */
type Phase = 'in' | 'open' | 'gone'

/* `/?poklon=<id>` — pročita se (i skloni iz adrese) jednom po učitavanju; efekat
   koji se pokrene dvaput (React u razvoju) dobije isti stih */
let arrived: string | null | undefined
function takeGift(): string | null {
  // oznaka sa stranice stiha (prije prvog prikaza) više ne treba — sad je tu podloga poklona
  delete document.documentElement.dataset.gift
  if (arrived !== undefined) return arrived
  const url = new URL(window.location.href)
  arrived = url.searchParams.get('poklon')
  if (arrived) {
    url.searchParams.delete('poklon')
    window.history.replaceState(null, '', url)
  }
  return arrived
}

const GIFT_EVENT = 'stihdana:gift'
/** Otvori poklon odmah, bez učitavanja stranice (skener QR koda u aplikaciji); van početne — na nju. */
export function openGift(id: string) {
  const taken = !window.dispatchEvent(new CustomEvent(GIFT_EVENT, { detail: id, cancelable: true }))
  // namjerno puno učitavanje: poklon se čita iz adrese jednom po učitavanju (takeGift)
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  if (!taken) window.location.assign(`/?poklon=${encodeURIComponent(id)}`)
}

/** `?poklon=<id>` u adresi (ili već pročitan) — samo čita, ništa ne mijenja */
function peekGift(): string | null {
  if (arrived !== undefined) return arrived
  return new URLSearchParams(window.location.search).get('poklon')
}

/**
 * Poklon na početnoj (`/?poklon=<id>`): papirić na podlozi tombole, pa
 * drawer sa stihom. Stih je s liste stranice, ili (nov, još nije na njoj) s
 * `/api/day`.
 */
export function GiftHost({ verses }: { verses: Verse[] }) {
  const [verse, setVerse] = useState<Verse | null>(null)
  const [phase, setPhase] = useState<Phase | null>(null)
  // podloga poklona od prvog kadra (prije fontova i papirića) — početna ispod se ne vidi ni trenutak
  const early = useSyncExternalStore(noop, peekGift, () => null)
  const earlyVerse = useMemo(() => (early ? (verses.find((v) => v.id === early) ?? null) : null), [early, verses])
  // let se pripremi dok papirić stoji otvoren (izmjeri, iscrta) — krene bez zastoja
  const [go, setGo] = useState(false)
  const [drawer, setDrawer] = useState(false)
  // slova u letu s papira do stiha; stih u drawer-u se pokaže kad mu stignu
  const [fly, setFly] = useState<Flight | null>(null)
  const [hide, setHide] = useState(false)
  // tekst papira se skloni u istom trenutku kad kopija krene (bez dvostrukih slova)
  const [blank, setBlank] = useState(false)
  // skeniran u aplikaciji — papirić bez čekanja (nema učitavanja stranice da ga sakrije)
  const [quick, setQuick] = useState(false)
  const list = useRef(verses)
  const skip = useRef<() => void>(() => {})
  const land = useRef<() => void>(() => {})
  const verseBox = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // jedan poklon: papirić, let slova, drawer — vrati čišćenje
    // `quick`: skeniran u aplikaciji — stranica je već tu, papirić kreće odmah
    const play = (id: string, quick = false) => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      let dead = false
      const timers: number[] = []
      const at = (ms: number, f: () => void) => timers.push(window.setTimeout(() => !dead && f(), ms))
      let flown = false
      let landed = false
      let flight: Flight | null = null
      // drawer stoji iza podloge: izmjeri stih i iscrtaj kopiju (nevidljivu) unaprijed
      const prepare = (v: Verse, then?: () => void) =>
        whenStill(verseBox.current, () => {
          if (dead) return
          flight ??= measureFlight(verseBox.current, v)
          setFly(flight)
          then?.()
        })
      // slova s papira na stih
      const toVerse = (v: Verse) => {
        if (flown) return
        flown = true
        timers.forEach(clearTimeout)
        // papirić se otvori i kad je dodir preskočio otvaranje
        setPhase((p) => (p === 'in' ? 'open' : p))
        prepare(v, () => {
          // dva kadra: kopija je iscrtana, tek onda krene
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (dead) return
              setGo(true)
              setBlank(true)
              haptic([10, 40, 16])
              at(40, () => setPhase('gone'))
              // ako kraj leta ne javi (pozadinska kartica) — zamjena ipak
              at((SPLASH_ARRIVE + 0.25) * 1000, () => land.current())
            }),
          )
        })
      }
      // slova sletjela: stih i kopija se zamijene u istom kadru — bez preklapanja (sjaj
      // bi se udvostručio) i bez praznog trenutka
      land.current = () => {
        if (landed || dead) return
        landed = true
        setHide(false)
        setFly(null)
      }
      const start = (v: Verse) => {
        setVerse(v)
        skip.current = () => {
          haptic(6)
          toVerse(v)
        }
        if (reduced) return setDrawer(true)
        // drawer se otvori odmah, iza podloge — dok se papirić otvara, on je na svom mjestu
        setHide(true)
        setDrawer(true)
        // duži stih — duže stoji otvoren
        const hold = Math.min(3600, 1600 + v.text.length * 25)
        at(quick ? 0 : 80, () => setPhase('in'))
        at(quick ? 650 : 1000, () => {
          setPhase('open')
          haptic(8)
          prepare(v)
        })
        at((quick ? 650 : 1000) + 800 + hold, () => toVerse(v))
      }
      // kreće kad su fontovi tu — inače bi papirić zastao dok se stranica slaže
      void Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 700))]).then(async () => {
        const v =
          list.current.find((x) => x.id === id) ??
          ((await fetch(`/api/day?id=${encodeURIComponent(id)}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)) as Verse | null)
        if (v && !dead) start(v)
      })
      return () => {
        dead = true
        timers.forEach(clearTimeout)
      }
    }
    // poklon iz adrese (link, QR kamerom telefona) ili skeniran u aplikaciji (openGift)
    let stop = () => {}
    const first = takeGift()
    if (first) stop = play(first)
    const onGift = (e: Event) => {
      // javi openGift da je poklon preuzet ovdje
      e.preventDefault()
      stop()
      setGo(false)
      setBlank(false)
      setFly(null)
      setPhase(null)
      setQuick(true)
      stop = play((e as CustomEvent<string>).detail, true)
    }
    window.addEventListener(GIFT_EVENT, onGift)
    return () => {
      stop()
      window.removeEventListener(GIFT_EVENT, onGift)
    }
  }, [])

  const shown = verse ?? earlyVerse
  if (!shown) return null
  // podloga stoji od prvog kadra (i dok se čekaju fontovi), pa do leta slova
  const staging = phase === 'in' || phase === 'open' || (phase === null && Boolean(earlyVerse))
  return (
    <>
      {/* podloga tombole s naslovom i logom — iznad drawer-a; isti element od prvog kadra; pretopi se kad slova polete */}
      <AnimatePresence>{staging && <Stage key="stage" verse={shown} onSkip={() => skip.current()} />}</AnimatePresence>
      {verse && (
        <>
      <GiftCard
        open={drawer}
        verse={verse}
        verseBox={verseBox}
        hideVerse={hide}
        onClose={() => {
          setDrawer(false)
          // poklon je viđen — ponovni ulazak na početnu ga ne ponavlja
          arrived = null
        }}
      />
      {/* papirić iznad drawer-a — dok mu slova ne odlete */}
      {createPortal(
        <AnimatePresence>
          {phase && phase !== 'gone' && (
            <motion.div key="paper" className="pointer-events-none fixed inset-0 z-[118]" exit={{ transition: { duration: 0.6 } }}>
              <Paper verse={verse} opened={phase === 'open'} blank={blank} quick={quick} />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
      {fly && <FlyLetters fly={fly} verse={verse} go={go} onLand={() => land.current()} />}
        </>
      )}
    </>
  )
}

/** Kad drawer stane (stih se ne pomjera tri kadra zaredom) — najviše sekundu i po. */
function whenStill(el: HTMLElement | null, done: () => void) {
  const start = performance.now()
  let last = Number.NaN
  let calm = 0
  const step = () => {
    const top = el?.getBoundingClientRect().top ?? 0
    calm = Math.abs(top - last) < 0.5 ? calm + 1 : 0
    last = top
    if (calm >= 3 || performance.now() - start > 1500) return done()
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/** Gdje je stih u drawer-u i kako do njega s papira (sredina ekrana, 47 %). */
type Flight = {
  left: number
  top: number
  width: number
  dx: number
  dy: number
  s0: number
  style: React.CSSProperties
  color: string
  /** širina teksta na papiru (prije umanjenja) — tamna slova se prelome kao na papiru */
  paperWidth: number
}

function measureFlight(box: HTMLElement | null, verse: Verse): Flight | null {
  const el = box?.querySelector<HTMLElement>('.verse')
  const r = el?.getBoundingClientRect()
  if (!el || !r || !r.width) return null
  const cs = getComputedStyle(el)
  const fit = el.querySelector<HTMLElement>('[data-fit]')
  const fontSize = fit ? getComputedStyle(fit).fontSize : cs.fontSize
  // slova papira — iste mjere kao Paper (širina bez unutrašnje zrake od 0.6em)
  const W = Math.min(window.innerWidth * 0.8, 330)
  const paperFont = W * 0.0676
  const s0 = paperFont / parseFloat(fontSize)
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    dx: window.innerWidth / 2 - (r.left + r.width / 2),
    dy: window.innerHeight * 0.47 - (r.top + r.height / 2),
    s0,
    style: { fontSize, lineHeight: cs.lineHeight, fontFamily: cs.fontFamily, letterSpacing: cs.letterSpacing, fontVariationSettings: cs.fontVariationSettings, whiteSpace: 'nowrap' },
    color: MOODS[verse.mood].text,
    paperWidth: (W - paperFont * 1.2) / s0,
  }
}

/**
 * Slova s papira na mjesto stiha — kao iz tombole: kopija stiha krene s
 * papira (tamna, sitna) i stigne na stih u drawer-u (svijetla, puna), pa je
 * stih zamijeni bez skoka.
 */
function FlyLetters({ fly, verse, go, onLand }: { fly: Flight | null; verse: Verse; go: boolean; onLand: () => void }) {
  if (!fly) return null
  const m = MOODS[verse.mood]
  return createPortal(
    <motion.div
      className="pointer-events-none fixed z-[120] m-0 text-center"
      // svoj sloj od prvog kadra: let je samo pomak, uvećanje i prozirnost na grafičkom procesoru
      style={{ ...fly.style, left: fly.left, top: fly.top, width: fly.width, transformOrigin: '50% 50%', willChange: 'transform, opacity' }}
      initial={{ x: fly.dx, y: fly.dy, scale: fly.s0, opacity: 0 }}
      // dok ne krene: nevidljiva, na papiru (iscrtana unaprijed)
      animate={go ? { x: 0, y: 0, scale: 1, opacity: 1 } : { x: fly.dx, y: fly.dy, scale: fly.s0, opacity: 0 }}
      transition={{ duration: SPLASH_ARRIVE, ease: [0.45, 0, 0.15, 1], opacity: { duration: 0 } }}
      // na mjestu — stih je zamijeni u istom kadru (GiftHost `land`)
      onAnimationComplete={() => go && onLand()}
      aria-hidden
    >
      {/* svijetla slova — isti VerseText kao stih u drawer-u (fontovi, sjaj, prelom),
          pa je zamjena na kraju piksel u piksel; uđu dok kopija leti */}
      <motion.div
        style={{ whiteSpace: 'normal', willChange: 'opacity' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: go ? 1 : 0 }}
        transition={{ duration: 0.45, delay: go ? 0.15 : 0, ease: 'easeInOut' }}
      >
        <VerseText text={verse.text} color={m.text} glow={m.accent} font={verse.font} appearAt={0} />
      </motion.div>
      {/* tamna slova — prelomljena tačno kao na papiru, pa let krene bez skoka; ode u letu */}
      <motion.span
        className="absolute inset-0 flex items-center justify-center"
        // isti rez kao na papiru (Paper) — i kad stih ima svoj font
        style={{
          color: '#1d1a16',
          fontFamily: 'var(--font-serif), Georgia, serif',
          fontWeight: 400,
          fontVariationSettings: "'wght' 400, 'opsz' 144, 'SOFT' 30, 'WONK' 0",
          letterSpacing: '-0.02em',
          lineHeight: 1.18,
          textTransform: 'none',
          willChange: 'opacity',
        }}
        initial={{ opacity: 1 }}
        animate={{ opacity: go ? 0 : 1 }}
        transition={{ duration: 0.35, delay: go ? 0.25 : 0, ease: 'easeOut' }}
      >
        <span className="block shrink-0 whitespace-normal" style={{ width: fly.paperWidth }}>
          {paperText(verse.text)}
        </span>
      </motion.span>
    </motion.div>,
    document.body,
  )
}

/** Potpis | Magaza — iste mjere kao u zaglavlju ekrana stiha (VerseScreen). */
function Brand() {
  return (
    <div className="flex items-center gap-3.5">
      <Signature height={36} wipe={false} className="opacity-90" />
      <span className="h-6 w-px bg-white/20" aria-hidden />
      <MagazaLogo height={Math.round(36 * MAGAZA_BESIDE)} color="#FFFFFF" style={{ transform: MAGAZA_DROP_CSS, opacity: 0.9 }} />
    </div>
  )
}

/**
 * Drawer sa stihom — iste veličine kao ekran stiha (VerseScreen): potpis |
 * Magaza gore, desno samo ×; "Stih za tebe" s poklonom, stih, sačuvaj i
 * podijeli; dole gramofon s pjesmom. Pozadina je atmosfera albuma, kao na
 * raširenoj karti. Povuci nadolje ili × zatvara.
 */
function GiftCard({
  open,
  verse,
  verseBox,
  hideVerse,
  onClose,
}: {
  open: boolean
  verse: Verse
  verseBox: RefObject<HTMLDivElement | null>
  /** stih čeka slova s papira (ne vidi se dok ne stignu) */
  hideVerse: boolean
  onClose: () => void
}) {
  useSheetOpen(open)
  const sheetDrag = useSheetDrag(onClose, open)
  const m = MOODS[verse.mood]
  const album = albumOf(verse.album)

  // Escape zatvara, a stranica ispod ne skrola dok je panel otvoren
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const unlock = lockScroll()
    window.addEventListener('keydown', onKey)
    return () => {
      unlock()
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <SheetLayer className="fixed inset-0 z-[115] flex items-end justify-center sm:items-center">
          <SheetBackdrop onClose={onClose} />
          <SheetSlide>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`Stih za tebe — ${verse.song}`}
              data-gift
              className="os-sheet relative flex h-[86dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[26px] border border-b-0 border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.1)] sm:h-[80dvh] sm:rounded-[26px] sm:border-b"
              {...sheetDrag}
              style={{ ...sheetDrag.style, background: m.gradient[0], fontFamily: 'var(--font-sans), sans-serif' }}
            >
              {/* atmosfera albuma kao na raširenoj karti (u em od širine karte) */}
              <div className="pointer-events-none absolute inset-0" style={{ '--cw': 'min(100vw, 440px)', fontSize: 'calc(var(--cw) / 390)' } as React.CSSProperties} aria-hidden>
                <CardAtmosphere mood={verse.mood} cover={album?.cover} lift={album?.lift} />
              </div>

              {/* raspored i mjere kao na ekranu stiha */}
              <div className="relative z-[1] flex min-h-0 flex-1 flex-col px-6 pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+0.5rem))] pt-7">
                <div className="flex items-center justify-between">
                  <Brand />
                  <button type="button" onClick={onClose} aria-label="Zatvori" data-gift-close className="hdr-btn w-[34px]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>

                {/* "Stih za tebe" → stih → radnje (kao datum → stih → radnje) */}
                <div className="flex flex-1 flex-col items-center justify-center gap-8 pb-[min(10vh,80px)] pt-4">
                  <p
                    className="tabular flex items-center gap-2 whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.2em]"
                    style={{ color: m.accent, textShadow: '0 1px 2px rgba(0,0,0,0.85), 0 0 14px rgba(0,0,0,0.65)' }}
                  >
                    <GiftIcon size={14} />
                    Stih za tebe
                  </p>
                  <div ref={verseBox} className="w-full text-center" style={{ opacity: hideVerse ? 0 : 1 }}>
                    {/* cio odmah (bez ispisa riječ po riječ) — pojavi se kad mu slova stignu */}
                    <VerseText text={verse.text} color={m.text} glow={m.accent} font={verse.font} appearAt={0} />
                  </div>
                  <div className="mt-5 flex items-center gap-2.5">
                    <FavoriteButton id={verse.id} accent={m.accent} />
                    <ShareButton verse={verse} accent={m.accent} date={todayInTz()} pill />
                  </div>
                </div>

                {/* gramofon — kao ispod stiha, s crticom */}
                <div className="flex flex-col items-center gap-6 text-center">
                  <SongCredit verse={verse} />
                  <span className="h-px w-16 shrink-0" style={{ background: `linear-gradient(to right, transparent, ${m.accent}59, transparent)` }} aria-hidden />
                </div>
              </div>
            </motion.div>
          </SheetSlide>
        </SheetLayer>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/**
 * Podloga tombole (boja stiha i zlatni sjaj na sredini), naslov kao kod
 * tombole — "Poklon" s ikonicom i "Stih za tebe" — a dole potpis | Magaza.
 */
function Stage({ verse, onSkip }: { verse: Verse; onSkip: () => void }) {
  const m = MOODS[verse.mood]
  return (
    <motion.div
      className="fixed inset-0 z-[116] touch-none select-none overflow-hidden"
      role="dialog"
      aria-label="Stih za tebe — poklon"
      data-gift-stage
      onPointerDown={onSkip}
      initial={{ opacity: 1 }}
      // pretopi se dok slova lete — ispod je drawer sa stihom
      exit={{ opacity: 0, transition: { duration: 0.6, delay: 0.1, ease: 'easeInOut' } }}
    >
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 80% 45% at 50% 47%, ${m.accent}26, transparent 70%), ${m.gradient[0]}` }} />

      {/* naslov — kao "Tvoj stih te čeka" na tomboli */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 px-8 text-center"
        style={{ top: 'max(10vh, calc(var(--sat, 0px) + 3rem))' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: m.accent }}>
          <GiftIcon size={14} />
          Poklon
        </p>
        <p className="mt-3 text-[2rem] leading-tight text-white/95" style={{ fontFamily: 'var(--font-serif), serif' }}>
          Stih za tebe
        </p>
      </motion.div>

      {/* dole potpis | Magaza */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 flex justify-center"
        style={{ bottom: 'max(2.5rem, calc(env(safe-area-inset-bottom) + 1.25rem))' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.4, ease: 'easeOut' }}
      >
        <Brand />
      </motion.div>
    </motion.div>
  )
}

/**
 * Presavijen papirić — iste mjere, boja i slova kao listić iz tombole:
 * sleti na sredinu, otvori se s pola na cijeli, a stih izroni iz pregiba.
 * Kad slova odlete (`blank`), papirić bez njih padne i nestane.
 */
function Paper({ verse, opened, blank, quick = false }: { verse: Verse; opened: boolean; blank: boolean; quick?: boolean }) {
  // otvoren do kraja — od tad ravan (bez naličja i 3D-a); ništa se na papiru ne mijenja kad slova polete
  const [flat, setFlat] = useState(false)
  const W = Math.min(window.innerWidth * 0.8, 330)
  const H = W / 3.3
  // presavijen: vidi se desna polovina — pomakne se za W/4, da stoji na sredini
  const half = W / 4
  const color = COLORS[[...verse.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length]
  const paper = {
    // isti rez kao stih na ekranu (globals.css .verse) i na listiću iz tombole
    fontFamily: 'var(--font-serif), Georgia, serif',
    fontWeight: 400,
    letterSpacing: '-0.02em',
    fontVariationSettings: "'wght' 400, 'opsz' 144, 'SOFT' 30, 'WONK' 0",
    fontSize: W * 0.0676,
    lineHeight: 1.18,
    color: '#1d1a16',
  } as const

  return (
    <motion.div
      className="absolute"
      style={{ left: '50%', top: '47%', width: W, height: H, marginLeft: -W / 2, marginTop: -H / 2, perspective: 900, willChange: 'transform' }}
      initial={{ x: -half, y: -40, scale: 0.94, opacity: 0, rotate: -6 }}
      animate={opened ? { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 } : { x: -half, y: 0, scale: 1, opacity: 1, rotate: -2 }}
      // slova su odletjela — papirić padne i nestane (kao listić iz tombole)
      exit={{ y: 70, rotate: 8, opacity: 0, transition: { duration: 0.6, ease: [0.55, 0, 0.75, 0.4] } }}
      transition={opened ? { duration: 0.7, ease: EASE } : { duration: 0.7, delay: quick ? 0.05 : 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* otvoren papir je ravan — bez naličja i 3D-a, pa ga Safari pri letu slova i
          odlasku (prozirnost) ne može "spljoštiti" i bljesnuti naličjem */}
      <div className="absolute inset-0" style={{ transformStyle: flat ? 'flat' : 'preserve-3d' }}>
        {/* desna polovina — stoji */}
        <div className="absolute inset-y-0 left-1/2 w-1/2 overflow-hidden rounded-r-[3px]" style={{ background: color, boxShadow: SHADOW }}>
          <span className="absolute inset-y-0 left-0 w-[28%]" style={{ background: 'linear-gradient(270deg, transparent, rgba(0,0,0,0.035) 70%, rgba(0,0,0,0.05))' }} />
        </div>
        {/* lijeva — presavijena preko desne, pa se otvori */}
        <motion.div
          className="absolute inset-y-0 left-0 w-1/2"
          style={{ transformOrigin: '100% 50%', transformStyle: flat ? 'flat' : 'preserve-3d' }}
          initial={{ rotateY: 180 }}
          animate={{ rotateY: opened ? 0 : 180 }}
          transition={{ duration: 0.7, ease: EASE }}
          onAnimationComplete={() => opened && setFlat(true)}
        >
          <div className="absolute inset-0 overflow-hidden rounded-l-[3px]" style={{ background: color, boxShadow: SHADOW, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
            <span className="absolute inset-y-0 -right-px w-[28%]" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.035) 70%, rgba(0,0,0,0.05))' }} />
          </div>
          {/* naličje — vidi se dok je presavijen */}
          {!flat && (
          <div
            className="absolute inset-0 rounded-l-[3px]"
            style={{
              background: `linear-gradient(270deg, rgba(0,0,0,0.16), rgba(0,0,0,0) 16%), linear-gradient(170deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 50%), ${color}`,
              transform: 'rotateY(180deg)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          />
          )}
        </motion.div>
      </div>
      {/* stih iznutra — izroni iz pregiba; kad slova odlete, ova se odmah sklone (kopija leti) */}
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center px-[0.6em] text-center"
        style={paper}
        initial={{ opacity: 0, clipPath: 'inset(0% 50% 0% 50%)' }}
        animate={blank ? { opacity: 0 } : opened ? { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)' } : {}}
        // kopija (iscrtana unaprijed, tačno preko ovih slova) se pokaže u istom kadru kad se
        // ova sklone — bez preklapanja (dvostruka slova bi na tren bila deblja)
        transition={blank ? { duration: 0 } : { delay: 0.3, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* kao listić iz tombole — samo tekst, bez fontova stiha */}
        <PaperVerse text={paperText(verse.text)} />
      </motion.div>
    </motion.div>
  )
}

/** Poklon — kutija s mašnom, zlatnim potezom. */
export function GiftIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
      <path d="M5 12.5v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7M12 8.5v12" />
      <path d="M12 8.5c-1.6-3.6-5.6-4.2-5.6-1.6 0 1.2 1.4 1.6 5.6 1.6zM12 8.5c1.6-3.6 5.6-4.2 5.6-1.6 0 1.2-1.4 1.6-5.6 1.6z" />
    </svg>
  )
}
