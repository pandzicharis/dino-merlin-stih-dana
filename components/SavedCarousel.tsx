'use client'

import { memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { motion, useDragControls, useMotionValue, useReducedMotion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { ExpandIcon } from './ExpandIcon'
import { FavoriteButton } from './FavoriteButton'
import { ShareButton } from './ShareSheet'
import { MOODS } from '@/data/moods'
import { albumOf, blurOf, cardArtOf } from '@/data/albums'
import { lookCss, lookScale, parseFont, preloadFonts } from '@/lib/fonts'
import { asWritten } from '@/lib/text'
import { savedDay, toggleFavorite } from '@/lib/storage'
import { formatFullDateBs } from '@/lib/date'
import { haptic } from '@/lib/haptic'
import { MAGAZA_BESIDE, MAGAZA_DROP_CSS } from '@/lib/brand'
import { FontedLines, MagazaMark, MoodStill, Notes } from './deck/Screens'
import { FitLines } from './deck/FitLines'
import { LoveButton } from './SavedPlayer'
import { SongRow } from './SongCredit'
import { SAVED_TRACK, playSaved, savedVerse, setSavedPlaylist, useSavedPlayerSelect } from '@/lib/player'
import { whenCalm } from '@/lib/calm'

/**
 * Sačuvani kao špil karata: svaka karta je ekran aplikacije u malom (isti
 * raspored, atmosfera i font stiha), prednja je istaknuta, a ispod nje
 * vire susjedne: prethodne s lijeve, sljedeće s desne strane. Prevuci
 * lijevo/desno za sljedeći/prethodni — u krug: poslije zadnjeg je prvi.
 *
 * Unutra je sve u `em` kao na mockupima (1em = 1 piksel ekrana širokog W),
 * pa karta izgleda isto na svakoj veličini. Plejer je pravi, u pikselima.
 */

/** ekran telefona u pikselima — karta je on, umanjen */
const W = 390
const H = 620
/**
 * Koliko zraka ostaje od ivice ekrana do karte ispod (px): prva susjeda,
 * druga (vidi se tanka traka iza prve) — i lijevo i desno, nikad do same
 * ivice. Treća je skrivena iza druge.
 */
const GAP = [0, 28, 14, 14]
/** najmanje mjesta sa svake strane prednje karte, kad je karta široka */
const SIDE = 54
/** zraka unutar karte, lijevo i desno (em od W) */
const SIDE_PAD = 32
/**
 * Dno karte (em od H) se pretapa u plejer ispod špila — karta kao da izlazi
 * iz plejera. Stih stoji iznad toga, na sredini vidljivog dijela.
 */
const FADE = 190
// prozirnost tek ispod plejera (on prekriva dno karte) — gdje se karta vidi,
// pretapa se u NEPROZIRNU boju panela (sloj ispod), pa se karte iza ne naziru
const CARD_MASK = 'linear-gradient(to bottom, black 86%, transparent 100%)'
/** atmosfera se pri dnu pretopi u boju karte — na raširenoj, višoj karti nema ruba */
const STILL_MASK = 'linear-gradient(to bottom, black 80%, transparent 100%)'

/** Isto pravilo kao `verseFontSize` (i VerseMock) — za ekran širok W. */
function verseSize(text: string) {
  const longest = Math.max(...text.split('\n').map((l) => l.trim().length), 1)
  const vw = Math.min(16, Math.max(6.4, 174 / longest))
  return Math.min(76, Math.max(28, (vw * W) / 100))
}

/**
 * Gdje stoji karta: 0 prednja; po dvije vire ispod nje s lijeve (prethodne) i
 * desne (sljedeće). `side`: slobodan prostor od prednje karte do ivice ekrana.
 */
function place(o: number, cw: number, side: number) {
  if (o === 0) return { x: 0, scale: 1, opacity: 1 }
  const d = Math.min(Math.abs(o), 3)
  const scale = 1 - d * 0.04
  // umanjena oko središta — pomjeri se taman da joj ivica stane GAP[d] od ivice ekrana
  const x = Math.sign(o) * ((cw * (1 - scale)) / 2 + Math.max(0, side - GAP[d]))
  return { x, scale, opacity: Math.abs(o) > 2 ? 0 : 1 }
}

export function SavedCarousel({
  verses,
  size,
  onOpen,
  onFront,
  dots = true,
}: {
  verses: Verse[]
  size: string
  /** dodir na prednju kartu — stih preko cijelog ekrana (components/SavedFull.tsx) */
  onOpen?: (verse: Verse) => void
  /** prednja karta se promijenila — plejer ispod pokazuje njenu pjesmu */
  onFront?: (verse: Verse) => void
  /** tačkice ispod špila (u panelu ih zamijeni plejer: "2 / 4") */
  dots?: boolean
}) {
  const n = verses.length
  // samo pjesma i svira li — spuštanje i podizanje panela ne crtaju špil iznova
  const player = { id: useSavedPlayerSelect((s) => s.id), playing: useSavedPlayerSelect((s) => s.playing) }
  // otvoren dok sačuvani sviraju (s početne) — prednja je pjesma koja svira
  const [index, setIndex] = useState(() => Math.max(0, verses.findIndex((v) => v.id === player.id)))
  // povratak na pjesmu koja svira klizi mekano preko više karata; prevlačenje ostaje opruga
  const [glide, setGlide] = useState(false)
  // u krug — i kad se neki ukloni pa ih je manje
  const wrap = useCallback((k: number) => (n ? ((k % n) + n) % n : 0), [n])
  const at = wrap(index)
  const go = useCallback(
    (k: number, soft = false) => {
      if (n < 2) return
      if (wrap(k) !== at) haptic(6)
      setGlide(soft)
      setIndex(wrap(k))
    },
    [n, at, wrap],
  )
  // korak lijevo/desno — stalna funkcija, pa se karte (memo) ne crtaju iznova zbog nje
  const step = useCallback(
    (dir: 1 | -1) => {
      if (n < 2) return
      haptic(6)
      setGlide(false)
      setIndex((i) => wrap(i + dir))
    },
    [n, wrap],
  )

  // Špil stoji: prst je podignut i karte su sjele. Tek tad sav teži posao —
  // plejer ispod, pjesma karte, priprema novih karata — da nijedan ne uzme
  // kadar pokretu ni prstu (kao paging na telefonu)
  const hold = useRef(false)
  const onHold = useCallback((on: boolean) => {
    hold.current = on
  }, [])
  const [rest, setRest] = useState(at)
  useEffect(() => {
    let t = 0
    const wait = () => {
      t = window.setTimeout(() => (hold.current ? wait() : setRest(at)), REST)
    }
    wait()
    return () => clearTimeout(t)
  }, [at])

  // plejer sačuvanih svira ovim redom; kad pređe na drugu pjesmu, špil klizi za njom
  useEffect(() => setSavedPlaylist(verses), [verses])
  // Prednja karta za plejer ispod i pjesmu: brzo poslije prevlačenja (karte
  // klize na grafičkom procesoru, pa im to ne smeta), a pri brzom listanju tek
  // na karti gdje se stane — ne za svaku usput
  const [pick, setPick] = useState(at)
  useEffect(() => {
    const t = window.setTimeout(() => setPick(at), PICK)
    return () => clearTimeout(t)
  }, [at])
  // plejer ispod (pjesma, atmosfera) pokazuje prednju kartu
  useEffect(() => {
    const v = verses[pick]
    if (v) startTransition(() => onFront?.(v))
  }, [pick, verses, onFront])
  // i obrnuto: prevučena karta dok muzika svira — svira njena pjesma. Samo
  // kad se ŠPIL pomjeri (prst, tačkice); kad plejer pređe na drugu pjesmu,
  // špil je stiže kadar kasnije — tad se ništa ne pušta (inače bi vratio staru).
  // Kad špil stane — ne usred kretnje, i ne za svaku kartu pri brzom prevlačenju
  const lastPick = useRef(pick)
  const live = useRef({ playing: player.playing, verses })
  useEffect(() => {
    live.current = { playing: player.playing, verses }
  }, [player.playing, verses])
  useEffect(() => {
    if (lastPick.current === pick) return
    lastPick.current = pick
    const v = live.current.verses[pick]
    if (live.current.playing && v && v.id !== savedVerse()?.id) playSaved(v)
  }, [pick])
  // prikaz opet vidljiv (Activity) — prednja je pjesma koja sad svira
  useEffect(() => {
    const i = verses.findIndex((v) => v.id === savedVerse()?.id)
    if (i < 0) return
    const r = requestAnimationFrame(() => setIndex(i))
    return () => cancelAnimationFrame(r)
    // samo pri pokazivanju prikaza
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const onTrack = (e: Event) => {
      const i = verses.findIndex((v) => v.id === (e as CustomEvent).detail)
      // kadar poslije: prvo se složi plejer (nova pjesma), pa špil krene — dva
      // posla u dva kadra, ne jedan dug
      if (i >= 0) requestAnimationFrame(() => go(i, true))
    }
    window.addEventListener(SAVED_TRACK, onTrack)
    return () => window.removeEventListener(SAVED_TRACK, onTrack)
  }, [verses, go])

  /** mjesto karte u odnosu na prednju, u krug: lijevo prethodne, desno sljedeće */
  const rel = (i: number, from = at) => {
    const o = wrap(i - from)
    return o > n / 2 ? o - n : o
  }
  // U DOM-u su samo karte koje se vide (do dvije sa svake strane prednje) i,
  // kad špil stoji, po dvije skrivene iza njih — spremne za sljedeća
  // prevlačenja (lazy). Špil od 5 i od 500 sačuvanih je isto lak
  const shown = (i: number) => Math.abs(rel(i)) <= 2 || Math.abs(rel(i, rest)) <= 4
  // Slike karata oko mjesta gdje špil stoji se dekodiraju unaprijed, kad je
  // mirno — otvaranje panela i prevlačenje ih samo nacrtaju, ne dekodiraju
  useEffect(() => {
    const urls = new Set<string>(['/brand/signature.webp?v=2'])
    for (let k = -2; k <= 2; k++) {
      const v = verses[wrap(rest + k)]
      const cover = v && albumOf(v.album)?.cover
      const art = cardArtOf(cover)
      const soft = blurOf(cover, Math.round(W * 0.14) / (1.3 * Math.max(W, H)))
      if (art) urls.add(art)
      if (soft) urls.add(soft)
    }
    return whenCalm(() => urls.forEach(decodeOnce), 800)
  }, [rest, verses, wrap])

  // ulaz (karte izlete iz plejera) samo pri prvom slaganju — kasnije karte stoje na mjestu
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const r = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(r)
  }, [])

  // širina karte i cijelog špila u pikselima — koliko daleko odleti i koliko vire susjede
  const box = useRef<HTMLDivElement>(null)
  const deck = useRef<HTMLDivElement>(null)
  const [cw, setCw] = useState(260)
  const [fw, setFw] = useState(375)
  useLayoutEffect(() => {
    const el = box.current
    const all = deck.current
    if (!el || !all) return
    const measure = () => {
      // sakriven prikaz (0) se ne mjeri — karte ostanu gdje su
      const a = el.getBoundingClientRect().width
      const b = all.getBoundingClientRect().width
      if (a) setCw(a)
      if (b) setFw(b)
    }
    // odmah, prije prvog crtanja — karte ne krenu od 260 px pa poskoče
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(all)
    return () => ro.disconnect()
  }, [])
  const side = Math.max(SIDE, (fw - cw) / 2)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  return (
    <div
      // do ruba ekrana — karta što šira, a susjedne vire sa strane
      className="-mx-5 flex flex-col items-center"
      style={
        {
          // karta koliko god širine ima — sa svake strane vire dvije ispod
          containerType: 'inline-size',
          '--cw': `min(calc(${size} * ${W / H}), calc(100cqw - ${SIDE * 2}px))`,
        } as CSSProperties
      }
    >
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Karte"
        ref={deck}
        className="relative w-full"
        style={{ height: `calc(var(--cw) * ${H / W})` }}
      >
        {/* mjera karte, nevidljiva */}
        <div ref={box} className="pointer-events-none invisible absolute" style={{ width: 'var(--cw)' }} aria-hidden />
        {verses.map((v, i) =>
          shown(i) ? (
            <Card
              key={v.id}
              verse={v}
              o={rel(i)}
              front={rel(i, rest) === 0}
              cw={cw}
              side={side}
              glide={glide}
              enter={!settled}
              onStep={step}
              onHold={onHold}
              onOpen={onOpen}
            />
          ) : null,
        )}
      </div>

      {dots &&
        verses.length > 1 &&
        (verses.length <= 8 ? (
          <div className="mt-3 flex items-center gap-1.5">
            {verses.map((v, i) => (
              <button
                key={v.id}
                onClick={() => go(i, true)}
                aria-label={`Stih ${i + 1}`}
                aria-current={i === at}
                className="flex h-6 items-center justify-center px-0.5"
              >
                <span
                  className="block h-1.5 rounded-full transition-all duration-300"
                  style={{ width: i === at ? 18 : 6, background: i === at ? MOODS[verses[at].mood].accent : 'rgba(255,255,255,0.22)' }}
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="tabular mt-3 h-6 text-[11px] tracking-[0.2em] text-white/50">
            {at + 1} / {verses.length}
          </p>
        ))}

    </div>
  )
}

/** slike već dekodirane (iste kao pozadine karata — dekodiranje se dijeli) */
const decoded = new Set<string>()
function decodeOnce(src: string) {
  if (decoded.has(src)) return
  decoded.add(src)
  const img = new Image()
  img.src = src
  img.decode().catch(() => decoded.delete(src))
}

/** tamnjenje karte ispod prednje (0, 0.07, 0.14, 0.2) — od mjesta u špilu */
const dimOf = (o: number) => Math.min(Math.abs(o) * 0.07, 0.2)

/** prednja karta → plejer ispod i pjesma: kratko poslije prevlačenja (brzo listanje preskoči usputne) */
const PICK = 150
/** koliko špil mora mirovati (bez prsta) prije težeg posla — opruga je tad skoro sjela */
const REST = 420
/** opruga špila: brzo krene, mekano sjedne — kao listanje na telefonu */
const STIFF = 380
const DAMP = 36
/** povratak na pjesmu koja svira, tačkice: mekano preko više karata */
const GLIDE: KeyframeAnimationOptions = { duration: 800, easing: 'cubic-bezier(0.45, 0, 0.15, 1)' }
const LINEAR = typeof CSS !== 'undefined' && CSS.supports?.('transition-timing-function', 'linear(0, 1)')
const springs = new Map<number, KeyframeAnimationOptions>()

/**
 * Opruga kao WAAPI kriva (`linear()`), s početnom brzinom `v` (dio puta u
 * sekundi) — kretnju vrti grafički procesor, a brz potez prsta se nastavi
 * brzinom prsta. Stariji preglednik bez `linear()`: bezier blizu opruge.
 */
function springTiming(v = 0): KeyframeAnimationOptions {
  if (!LINEAR) return { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  const key = Math.round(Math.max(0, Math.min(15, v)) * 4) / 4
  let t = springs.get(key)
  if (t) return t
  const dt = 1 / 60
  let x = 0
  let vel = key
  let time = 0
  const pts = ['0']
  do {
    vel += (-STIFF * (x - 1) - DAMP * vel) * dt
    x += vel * dt
    time += dt
    pts.push(x.toFixed(4))
  } while (time < 1.5 && (Math.abs(1 - x) > 0.002 || Math.abs(vel) > 0.03))
  pts[pts.length - 1] = '1'
  t = { duration: Math.round(time * 1000), easing: `linear(${pts.join(', ')})` }
  springs.set(key, t)
  return t
}

type Slot = { x: number; scale: number; opacity: number }

/**
 * Pomjeri mjesto karte u špilu na `to` — od mjesta gdje se karta upravo vidi
 * (i usred kretnje), uz pomak prsta `d` koji se u nju "upije", i brzinu prsta
 * `v` (px/s). WAAPI na grafičkom procesoru: ne čeka glavnu nit, pa ništa što
 * se tad slaže (plejer, nove karte) ne zaustavi kartu.
 */
function slide(el: HTMLElement, to: Slot, running: Animation[], how: { d?: number; v?: number; glide?: boolean; instant?: boolean }): Animation[] {
  const cs = getComputedStyle(el)
  const m = new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform)
  const op = Number(cs.opacity)
  running.forEach((a) => a.cancel())
  const target = `translateX(${to.x}px) scale(${to.scale})`
  el.style.transform = target
  el.style.opacity = String(to.opacity)
  if (how.instant) return []
  // pomak prsta je unutar ove karte (već umanjen njenim `scale`)
  const fx = m.e + m.a * (how.d ?? 0)
  const dist = to.x - fx
  const out: Animation[] = []
  if (Math.abs(dist) > 0.5 || Math.abs(m.a - to.scale) > 0.001)
    out.push(el.animate([{ transform: `translateX(${fx}px) scale(${m.a})` }, { transform: target }], how.glide ? GLIDE : springTiming(Math.abs(dist) > 1 ? (how.v ?? 0) / dist : 0)))
  if (Math.abs(op - to.opacity) > 0.01) out.push(el.animate([{ opacity: op }, { opacity: to.opacity }], how.glide ? GLIDE : springTiming()))
  return out
}

/**
 * Jedna karta u špilu — tri sloja:
 *   ulaz      karte izlete iz plejera (samo pri prvom slaganju)
 *   mjesto    gdje je u špilu: WAAPI na grafičkom procesoru (`slide`)
 *   prst      prednja karta prati prst; kad se pusti, pomak se upije u mjesto
 * Memo: kad se špil pomjeri, crta se iznova samo omotač — lice karte tek kad
 * špil stane (`front`), pa u kadru u kojem karte krenu nema crtanja.
 */
const Card = memo(function Card({
  verse,
  o,
  front: still,
  cw,
  side,
  glide = false,
  enter = false,
  onStep,
  onHold,
  onOpen,
}: {
  verse: Verse
  /** mjesto u špilu u odnosu na prednju kartu */
  o: number
  /** prednja kad špil stoji — lice (rub) se mijenja tek tad */
  front: boolean
  cw: number
  /** slobodan prostor od prednje karte do ivice ekrana */
  side: number
  /** mekano klizanje (povratak na pjesmu, tačkice) umjesto opruge */
  glide?: boolean
  /** prvo slaganje špila — karta izleti iz plejera ispod */
  enter?: boolean
  onStep: (dir: 1 | -1) => void
  /** prst je na karti — špil ne radi ništa teže dok se ne pusti */
  onHold: (on: boolean) => void
  onOpen?: (verse: Verse) => void
}) {
  const front = o === 0
  const reduced = useReducedMotion()
  const drag = useDragControls()
  const x = useMotionValue(0)

  const to = place(o, cw, side)
  const slot = useRef<HTMLDivElement>(null)
  const running = useRef<Animation[]>([])
  // pomak i brzina prsta kad je karta puštena — upiju se u sljedeće pomjeranje
  const fold = useRef<{ d: number; v: number } | null>(null)
  const placed = useRef(false)
  // mjesto u špilu kad je karta zadnji put pomjerena — promjena same širine je bez kretnje
  const lastO = useRef(o)
  const soft = useRef(glide)
  useEffect(() => {
    soft.current = glide
  }, [glide])
  useLayoutEffect(() => {
    const el = slot.current
    if (!el) return
    const f = fold.current
    fold.current = null
    running.current = slide(el, to, running.current, {
      d: f?.d,
      v: f?.v,
      glide: soft.current,
      instant: !placed.current || Boolean(reduced) || (lastO.current === o && !f),
    })
    placed.current = true
    lastO.current = o
    // prst se upio u mjesto — u istom kadru, bez skoka
    if (f) x.set(0)
    // samo kad se mjesto promijeni
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to.x, to.scale, to.opacity])
  useEffect(() => () => running.current.forEach((a) => a.cancel()), [])

  // dodir (ne povlačenje) na prednju kartu je otvara — dugmad i plejer rade svoje
  const down = useRef<{ x: number; y: number } | null>(null)
  const tap = (e: React.MouseEvent) => {
    const d = down.current
    down.current = null
    if (!front || !onOpen) return
    // bez pritiska prije (prezentacija klikne sama) — to je dodir
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return
    if ((e.target as Element).closest('button, a, input, [data-nodrag]')) return
    onOpen(verse)
  }
  return (
    // ulaz: karte izlete iz plejera ispod — odozdo, iz magle, prednja prva
    <motion.div
      className="absolute top-0"
      style={{
        // na sredini špila — susjede se rašire do ivica
        left: 'calc(50% - var(--cw) / 2)',
        width: 'var(--cw)',
        aspectRatio: `${W} / ${H}`,
        zIndex: 50 - Math.abs(o),
        pointerEvents: front ? undefined : 'none',
        // skrivene iza druge susjede: složene (spremne), ali se ne crtaju
        visibility: Math.abs(o) > 3 ? 'hidden' : undefined,
      }}
      // treća (ispod druge, prozirna): crta se tek kad panel sjedne (globals.css)
      data-far={Math.abs(o) === 3 ? '' : undefined}
      initial={reduced || !enter ? false : { y: 60, scale: 0.95, opacity: 0 }}
      animate={{ y: 0, scale: 1, opacity: 1 }}
      transition={
        reduced
          ? { duration: 0 }
          : {
              type: 'spring',
              stiffness: 320,
              damping: 32,
              y: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 * Math.abs(o) },
              opacity: { duration: 0.35, ease: 'easeOut', delay: 0.05 * Math.abs(o) },
            }
      }
      aria-hidden={!front}
    >
      {/* mjesto u špilu: svoj sloj (GPU), pomjeranje ne crta kartu iznova */}
      <div ref={slot} className="absolute inset-0" style={{ willChange: 'transform' }}>
        {/* prednja karta prati prst; `data-stih` — po njemu je nađe raširena karta */}
        <motion.div
          data-stih={front && onOpen ? verse.id : undefined}
          className={`absolute inset-0 ${front && onOpen ? 'cursor-pointer' : ''}`}
          style={{ x, touchAction: 'pan-y', willChange: 'transform' }}
          drag={front ? 'x' : false}
          dragControls={drag}
          dragListener={false}
          dragMomentum={false}
          onPointerDown={(e) => {
            down.current = { x: e.clientX, y: e.clientY }
            // plejer se ne vuče — premotavanje i ploča rade svoje
            if (!front || (e.target as Element).closest('[data-nodrag]')) return
            onHold(true)
            const up = () => {
              onHold(false)
              window.removeEventListener('pointerup', up)
              window.removeEventListener('pointercancel', up)
            }
            window.addEventListener('pointerup', up)
            window.addEventListener('pointercancel', up)
            drag.start(e)
          }}
          onClick={tap}
          onDragEnd={(_, info) => {
            const d = x.get()
            const swipe = Math.abs(info.offset.x) > cw * 0.28 || Math.abs(info.velocity.x) > 450
            if (swipe) {
              // sljedeća/prethodna: pomak prsta se upije u novo mjesto (useLayoutEffect)
              fold.current = { d, v: info.velocity.x }
              onStep(info.offset.x < 0 ? 1 : -1)
              return
            }
            // nazad na mjesto — i to na grafičkom procesoru
            const el = slot.current
            if (el) running.current = slide(el, to, running.current, { d, v: info.velocity.x, instant: Boolean(reduced) })
            x.set(0)
          }}
        >
          <CardFace verse={verse} o={still ? 0 : 1} onOpen={onOpen} />
        </motion.div>
        {/* karte ispod su tamnije — prednja se ističe. Sloj jedne boje (bez
            slike), svoj na grafičkom procesoru: tamnjenje ne crta kartu iznova */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[26px] bg-black"
          style={{ willChange: 'opacity' }}
          initial={false}
          animate={{ opacity: dimOf(o) }}
          transition={{ duration: 0.3 }}
          aria-hidden
        />
      </div>
    </motion.div>
  )
})

/**
 * Lice karte — isto u špilu i raširenoj karti (components/SavedFull.tsx).
 * Sve je u `em` od `--cw` (širina karte), pa raširena karta izgleda isto,
 * samo veća. `o`: mjesto u špilu (karte ispod su tamnije).
 */
function CardFaceView({
  verse,
  o = 0,
  onOpen,
  onCollapse,
  actionsZoom,
}: {
  verse: Verse
  o?: number
  /** "Raširi" — samo prednja karta u špilu */
  onOpen?: (verse: Verse) => void
  /** "Skupi" — raširena karta */
  onCollapse?: () => void
  /**
   * Raširena karta: "Sačuvano" i "Podijeli" ispod stiha, kao na ekranu stiha.
   * Karta je uvećana (CSS `zoom`), pa se dugmad vrate na pravu veličinu ovim.
   */
  actionsZoom?: number
}) {
  const m = MOODS[verse.mood]
  const album = albumOf(verse.album)
  const text = asWritten(verse.text)
  const look = parseFont(verse.font).look
  const front = o === 0

  useEffect(() => preloadFonts(verse.font), [verse.font])
  // karte postoje samo na klijentu (poslije hidratacije) — smije se čitati odmah
  const [saved] = useState(() => savedDay(verse.id))
  // isti elementi iz rendera u render: FitLines mjeri samo kad se stih stvarno
  // promijeni, a ne pri svakom prevlačenju špila (inače mjere sve karte — trzaj)
  const dateLine = useMemo(() => <span>{formatFullDateBs(saved)}</span>, [saved])
  const lines = useMemo(() => <FontedLines text={text} font={verse.font} />, [text, verse.font])

  // raširena karta je viša (do dna ekrana), a raspored joj je isti kao na
  // maloj (gornjih H em) — prvi i zadnji kadar su tačno mala karta. Stih
  // (i dugmad ispod njega) mekano klizne na sredinu visoke karte (SavedFull,
  // `data-drop`: koliko em niže kad je raširena)
  const root = useRef<HTMLDivElement>(null)
  const mid = useRef<HTMLDivElement>(null)
  // gramofon samo na raširenoj karti: ploča se pojavi (data-big) i klizne na
  // dno (`data-grow`) dok karta raste — u špilu je pjesma u plejeru ispod
  const row = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const r = root.current
    const box = mid.current
    if (!actionsZoom || !r || !box) return
    const rr = r.getBoundingClientRect()
    if (!rr.width) return
    const em = rr.width / W
    const tall = rr.height / em
    box.dataset.drop = String(Math.max(0, Math.round((tall - H) / 2)))
    const g = row.current
    if (g) {
      // donja zona iPhonea (traka za početni ekran), u em karte
      const probe = document.createElement('div')
      probe.style.cssText = 'position:fixed;bottom:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden'
      document.body.appendChild(probe)
      const safe = (parseFloat(getComputedStyle(probe).paddingBottom) || 0) / em
      probe.remove()
      // dno ploče iznad trake za početni ekran
      const down = tall - H + 18 - 30 - safe
      g.dataset.grow = `translateY(${down.toFixed(1)}em)`
    }
  }, [actionsZoom])

  return (
    <div
      ref={root}
      // raširena karta ide do dna ekrana — zaobljena samo gore
      className={`relative h-full w-full select-none overflow-hidden ${onCollapse ? 'rounded-t-[26px]' : 'rounded-[26px]'} ${onCollapse ? 'shadow-[0_24px_60px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]' : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'}`}
      style={{
        fontSize: `calc(var(--cw) / ${W})`,
        color: '#f5f5f5',
        background: m.gradient[0],
        // font ekrana stiha — i u panelu (koji ima sistemski font) i na
        // raširenoj karti isti, pa se pri pretapanju slova poklope slovo u slovo
        fontFamily: 'var(--font-sans), sans-serif',
        // karta u špilu se pri dnu stvarno izgubi (i rubovi) — izlazi iz plejera
        ...(onCollapse ? {} : { maskImage: CARD_MASK, WebkitMaskImage: CARD_MASK }),
      }}
    >
      {/* atmosfera je uvijek visoka kao karta u špilu (H em) — raširena,
          viša karta je ima istu na vrhu, pa prvi kadar uvećanja = mala karta */}
      {/* isolate: slojevi atmosfere (z-index unutra) ostaju ispod sadržaja karte */}
      <div className="absolute inset-x-0 top-0 isolate" style={{ height: `${H}em`, maskImage: STILL_MASK, WebkitMaskImage: STILL_MASK }}>
        <MoodStill mood={verse.mood} w={W} h={H} cover={album?.cover} art={onCollapse ? undefined : cardArtOf(album?.cover)} lift={album?.lift} />
        <Notes
          accent={m.accent}
          // note sa strane, ne preko stiha ni dugmadi (ni na raširenoj karti)
          spots={[
            [8, 36, 26, '♫'],
            [88, 50, 18, '♪'],
            [84, 22, 16, '♩'],
          ]}
        />
      </div>

      <div
        className={`absolute inset-x-0 top-0 z-[1] flex flex-col justify-between ${actionsZoom ? '' : 'bottom-0'}`}
        // zraka od lijeve i desne ivice karte (isto za zaglavlje, stih i gramofon)
        style={{ padding: `26em ${SIDE_PAD}em ${FADE * 0.75}em`, height: actionsZoom ? `${H}em` : undefined }}
      >
        {/* zaglavlje — potpis | Magaza, kao na ekranu stiha; desno raširi i srce */}
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: '14em' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/signature.webp?v=2" alt="" draggable={false} style={{ height: '36em', width: 'auto', opacity: 0.9 }} />
            <span style={{ width: '1em', height: '24em', background: 'rgba(255,255,255,0.2)' }} />
            <MagazaMark height={36 * MAGAZA_BESIDE} style={{ opacity: 0.9, transform: MAGAZA_DROP_CSS }} />
          </div>
          <div data-shrink className="flex items-center gap-2" style={{ transformOrigin: 'right center' }}>
            {/* raširi kartu preko cijelog ekrana / skupi je nazad */}
            {(onOpen || onCollapse) && (
              <button
                data-nodrag
                onClick={() => (onCollapse ? onCollapse() : onOpen?.(verse))}
                aria-label={onCollapse ? 'Skupi' : 'Raširi'}
                title={onCollapse ? 'Skupi' : 'Raširi'}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white/80 transition-transform active:scale-90"
              >
                {/* na raširenoj karti obje ikone, jedna preko druge — pretapaju se dok
                    karta raste (components/SavedFull.tsx `data-small` / `data-big`) */}
                <span className="relative block h-[15px] w-[15px]">
                  <span data-small className="absolute inset-0">
                    <ExpandIcon />
                  </span>
                  {onCollapse && (
                    <span data-big className="absolute inset-0" style={{ opacity: 0 }}>
                      <ExpandIcon collapse />
                    </span>
                  )}
                </span>
              </button>
            )}
            {/* srce — i na raširenoj karti */}
            <button
              data-nodrag
              onClick={() => toggleFavorite(verse.id)}
              aria-label="Ukloni iz sačuvanih"
              title="Ukloni iz sačuvanih"
              className="flex h-8 w-8 items-center justify-center rounded-full border transition-transform active:scale-90"
              style={{ borderColor: `${m.accent}55`, background: `${m.accent}1a`, color: m.accent }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z" />
              </svg>
            </button>
          </div>
        </div>

        {/* dan kad je sačuvan → stih — datum isti kao na ekranu stiha */}
        {/* razmaci isti kao na ekranu stiha: datum → stih → dugmad (32 / 52) */}
        <div ref={mid} className="flex flex-1 flex-col items-center justify-center" style={{ gap: '32em' }}>
          <p
            className="tabular"
            style={{
              fontSize: '11em',
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: m.accent,
              textShadow: '0 1px 2px rgba(0,0,0,0.85), 0 0 14px rgba(0,0,0,0.65)',
              alignSelf: 'stretch',
              textAlign: 'center',
            }}
          >
            {/* dug dan (ČETVRTAK, SEPTEMBAR) se smanji — ne izlazi iz razmaka */}
            <FitLines cacheKey={`d|${saved}`}>{dateLine}</FitLines>
          </p>
          <p
            className="verse"
            style={{
              ...lookCss(look, m.accent),
              fontSize: `${verseSize(text) * lookScale(look)}em`,
              color: m.text,
              textShadow: `0 0.07em 1em rgba(0,0,0,0.5), 0 0 1.6em ${m.accent}2e`,
              alignSelf: 'stretch',
            }}
          >
            <FitLines cacheKey={`v|${verse.id}|${verse.font ?? ''}|${text}`}>{lines}</FitLines>
          </p>
          {/* radnje stiha — mjesto je i na maloj karti, pa se pri uvećanju ništa ne pomjeri */}
          <div className="flex items-center justify-center" style={{ height: '44em', marginTop: '20em' }}>
            {actionsZoom && (
              <div data-nodrag data-big className="flex items-center gap-2.5" style={{ zoom: actionsZoom, opacity: 0 }}>
                <FavoriteButton id={verse.id} accent={m.accent} />
                <ShareButton verse={verse} accent={m.accent} date={saved} pill />
              </div>
            )}
          </div>
        </div>

        {/* gramofon — samo na raširenoj karti; ne mijenja raspored stiha (apsolutno, pri dnu) */}
        {onCollapse && (
          <div
            ref={row}
            data-nodrag
            data-big
            className="absolute flex items-center gap-2.5"
            style={{ left: `${SIDE_PAD}em`, right: `${SIDE_PAD}em`, bottom: '18em', opacity: 0, transformOrigin: 'center bottom' }}
          >
            <SongRow verse={verse} accent={m.accent} fit vinyl={46} />
          </div>
        )}
      </div>


      {/* pjesma i album na dnu male karte — tik iznad mjesta gdje se karta
          pretapa u plejer; na raširenoj ih nosi gramofon (data-small → nestanu) */}
      <div
        data-small
        className="pointer-events-none absolute z-[1] flex flex-col items-center text-center"
        style={{ left: `${SIDE_PAD}em`, right: `${SIDE_PAD}em`, top: `${H - FADE - 46}em`, gap: '7em' }}
      >
        {/* zvjezdica — pjesma u "Omiljene" (isto kao u plejeru), na sredini iznad naziva */}
        <span data-nodrag className="pointer-events-auto" style={{ marginBottom: '2em' }}>
          <LoveButton song={verse.song} accent={m.accent} size={30} icon={16} />
        </span>
        <p className="max-w-full truncate font-semibold uppercase" style={{ fontSize: '12.5em', letterSpacing: '0.2em', color: m.accent }}>
          {verse.song}
        </p>
        <p className="max-w-full truncate uppercase" style={{ fontSize: '9.5em', letterSpacing: '0.24em', color: 'rgba(255,255,255,0.55)' }}>
          {verse.album} · {verse.year}
        </p>
      </div>

      {/* rub male karte (i na raširenoj u prvom kadru) — pretopi se u rub velike */}
      <span
        data-small
        className={`pointer-events-none absolute inset-x-0 top-0 rounded-[26px] border ${front ? 'border-white/15' : 'border-white/30'}`}
        style={{ height: `${H}em` }}
        aria-hidden
      />
      <span
        data-big
        className="pointer-events-none absolute inset-0 rounded-[inherit] border border-b-0 border-white/15"
        style={{ opacity: 0 }}
        aria-hidden
      />

      {/* dno se pretopi u boju panela, pa u plejer ispod — na raširenoj karti
          (data-small) nestane dok raste */}
      <span
        data-small
        className="pointer-events-none absolute inset-x-[-1px]"
        style={{ top: `${H - FADE}em`, height: `${FADE + 1}em`, background: 'linear-gradient(180deg, rgba(12,11,11,0) 0%, rgba(12,11,11,0.75) 40%, #0c0b0b 68%)' }}
        aria-hidden
      />

    </div>
  )
}

/**
 * Lice karte, memoizovano: pri prevlačenju svaka karta promijeni mjesto u
 * špilu (`o`), ali se iscrta iznova samo kad postane (ili prestane biti)
 * prednja — atmosfera i stih su skupi za crtanje; tamnjenje je van lica.
 */
export const CardFace = memo(
  CardFaceView,
  (a, b) =>
    a.verse === b.verse &&
    ((a.o ?? 0) === 0) === ((b.o ?? 0) === 0) &&
    a.onOpen === b.onOpen &&
    a.onCollapse === b.onCollapse &&
    a.actionsZoom === b.actionsZoom,
)
