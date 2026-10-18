'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { motion, useDragControls, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import type { Verse } from '@/data/verses'
import { MOODS } from '@/data/moods'
import { albumOf } from '@/data/albums'
import { lookCss, lookScale, parseFont, preloadFonts } from '@/lib/fonts'
import { asWritten } from '@/lib/text'
import { favoriteDate, toggleFavorite } from '@/lib/storage'
import { formatFullDateBs } from '@/lib/date'
import { haptic } from '@/lib/haptic'
import { FontedLines, MagazaMark, MoodStill, Notes } from './deck/Screens'
import { FitLines } from './deck/FitLines'
import { SongRow } from './SongCredit'

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
const H = 560
/** koliko karte ispod vire sa strane prednje: prva, pa druga iza nje */
const PEEK = [0, 14, 22, 26]
/** ukupno sa svake strane */
const SIDE = PEEK[2]

/** Isto pravilo kao `verseFontSize` (i VerseMock) — za ekran širok W. */
function verseSize(text: string) {
  const longest = Math.max(...text.split('\n').map((l) => l.trim().length), 1)
  const vw = Math.min(16, Math.max(6.4, 174 / longest))
  return Math.min(76, Math.max(28, (vw * W) / 100))
}

/** Gdje stoji karta: 0 prednja; po dvije vire ispod nje s lijeve (prethodne) i desne (sljedeće). */
function place(o: number, cw: number) {
  if (o === 0) return { x: 0, scale: 1, opacity: 1 }
  const d = Math.min(Math.abs(o), 3)
  const scale = 1 - d * 0.04
  // umanjena oko središta — pomjeri se taman da joj ivica viri PEEK[d]
  const x = Math.sign(o) * ((cw * (1 - scale)) / 2 + PEEK[d])
  return { x, scale, opacity: Math.abs(o) > 2 ? 0 : 1 }
}

export function SavedCarousel({ verses, size }: { verses: Verse[]; size: string }) {
  const n = verses.length
  const [index, setIndex] = useState(0)
  // u krug — i kad se neki ukloni pa ih je manje
  const wrap = useCallback((k: number) => (n ? ((k % n) + n) % n : 0), [n])
  const at = wrap(index)
  const go = useCallback(
    (k: number) => {
      if (n < 2) return
      if (wrap(k) !== at) haptic(6)
      setIndex(wrap(k))
    },
    [n, at, wrap],
  )
  /** mjesto karte u odnosu na prednju, u krug: lijevo prethodne, desno sljedeće */
  const rel = (i: number) => {
    const o = wrap(i - at)
    return o > n / 2 ? o - n : o
  }

  // širina karte u pikselima — koliko daleko odleti
  const box = useRef<HTMLDivElement>(null)
  const [cw, setCw] = useState(260)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setCw(el.getBoundingClientRect().width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(at + 1)
      if (e.key === 'ArrowLeft') go(at - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [at, go])

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
        className="relative mx-auto"
        style={{ width: `calc(var(--cw) + ${SIDE * 2}px)`, height: `calc(var(--cw) * ${H / W})` }}
      >
        {/* mjera karte, nevidljiva */}
        <div ref={box} className="pointer-events-none invisible absolute" style={{ width: 'var(--cw)' }} aria-hidden />
        {verses.map((v, i) => (
          <Card key={v.id} verse={v} o={rel(i)} cw={cw} onNext={() => go(at + 1)} onPrev={() => go(at - 1)} />
        ))}
      </div>

      {verses.length > 1 &&
        (verses.length <= 8 ? (
          <div className="mt-3 flex items-center gap-1.5">
            {verses.map((v, i) => (
              <button
                key={v.id}
                onClick={() => go(i)}
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

function Card({
  verse,
  o,
  cw,
  onNext,
  onPrev,
}: {
  verse: Verse
  /** mjesto u špilu u odnosu na prednju kartu */
  o: number
  cw: number
  onNext: () => void
  onPrev: () => void
}) {
  const m = MOODS[verse.mood]
  const album = albumOf(verse.album)
  const text = asWritten(verse.text)
  const look = parseFont(verse.font).look
  const front = o === 0
  const reduced = useReducedMotion()
  const drag = useDragControls()
  const x = useMotionValue(0)
  // karta se blago nagne dok se vuče
  const rotate = useTransform(x, [-cw, 0, cw], [-9, 0, 9])

  useEffect(() => preloadFonts(verse.font), [verse.font])
  // karte postoje samo na klijentu (poslije hidratacije) — smije se čitati odmah
  const [saved] = useState(() => favoriteDate(verse.id))

  const to = place(o, cw)
  return (
    <motion.div
      className="absolute top-0"
      style={{
        left: SIDE,
        width: 'var(--cw)',
        aspectRatio: `${W} / ${H}`,
        zIndex: 50 - Math.abs(o),
        x,
        rotate,
        visibility: Math.abs(o) > 3 ? 'hidden' : undefined,
        pointerEvents: front ? undefined : 'none',
        touchAction: 'pan-y',
      }}
      initial={false}
      animate={{ x: to.x, scale: to.scale, opacity: to.opacity }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 32 }}
      drag={front ? 'x' : false}
      dragControls={drag}
      dragListener={false}
      dragSnapToOrigin
      dragElastic={0.9}
      onPointerDown={(e) => {
        // plejer se ne vuče — premotavanje i ploča rade svoje
        if (front && !(e.target as Element).closest('[data-nodrag]')) drag.start(e)
      }}
      onDragEnd={(_, info) => {
        const swipe = Math.abs(info.offset.x) > cw * 0.28 || Math.abs(info.velocity.x) > 450
        if (!swipe) return
        if (info.offset.x < 0) onNext()
        else onPrev()
      }}
      aria-hidden={!front}
    >
      <div
        className="relative h-full w-full select-none overflow-hidden rounded-[26px] border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]"
        style={{ fontSize: `calc(var(--cw) / ${W})`, color: '#f5f5f5' }}
      >
        <MoodStill mood={verse.mood} w={W} h={H} cover={album?.cover} lift={album?.lift} />
        <Notes
          accent={m.accent}
          spots={[
            [12, 58, 28, '♫'],
            [80, 66, 20, '♪'],
            [84, 26, 16, '♩'],
          ]}
        />

        <div className="absolute inset-0 flex flex-col justify-between" style={{ padding: '26em 20em 18em' }}>
          {/* zaglavlje — potpis | Magaza, kao na ekranu stiha; desno srce */}
          <div className="flex items-center justify-between">
            <div className="flex items-center" style={{ gap: '14em' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/signature.webp?v=2" alt="" draggable={false} style={{ height: '36em', width: 'auto', opacity: 0.9 }} />
              <span style={{ width: '1em', height: '24em', background: 'rgba(255,255,255,0.2)' }} />
              <MagazaMark height={22} style={{ opacity: 0.9, transform: 'translateY(2em)' }} />
            </div>
            <button
              data-nodrag
              onClick={() => toggleFavorite(verse.id)}
              aria-label="Ukloni iz sačuvanih"
              title="Ukloni iz sačuvanih"
              className="flex h-9 w-9 items-center justify-center rounded-full border transition-transform active:scale-90"
              style={{ borderColor: `${m.accent}55`, background: `${m.accent}1a`, color: m.accent }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z" />
              </svg>
            </button>
          </div>

          {/* dan kad je sačuvan → stih (kao datum na ekranu stiha) */}
          <div className="flex flex-1 flex-col items-center justify-center" style={{ gap: '22em' }}>
            <p
              style={{
                fontSize: '11em',
                fontWeight: 600,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: m.accent,
                textShadow: '0 1px 2px rgba(0,0,0,0.85), 0 0 14px rgba(0,0,0,0.65)',
              }}
            >
              {saved ? formatFullDateBs(saved) : m.label}
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
              <FitLines>
                <FontedLines text={text} font={verse.font} />
              </FitLines>
            </p>
          </div>

          {/* pjesma — pravi plejer, kao ispod stiha */}
          <div data-nodrag className="flex items-center gap-3" style={{ padding: '0 10em 10em 18em' }}>
            <SongRow verse={verse} accent={m.accent} fit />
          </div>
        </div>

        {/* karte ispod su tamnije — prednja se ističe */}
        <motion.div
          className="pointer-events-none absolute inset-0 bg-black"
          initial={false}
          animate={{ opacity: front ? 0 : Math.min(Math.abs(o) * 0.07, 0.2) }}
          transition={{ duration: 0.3 }}
          aria-hidden
        />
      </div>
    </motion.div>
  )
}
