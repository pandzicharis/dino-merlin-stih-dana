'use client'

import { lookCss, lookScale, parseFont, wordFont } from '@/lib/fonts'
import { Fragment, useEffect, useRef, useState, type RefObject } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { withPeriod } from '@/lib/text'

/** Red stiha se ne lomi — veličinu slova sredi useFit. */
const NOWRAP = { whiteSpace: 'nowrap' } as const

/**
 * Koliko treba smanjiti slova (0…1) da najduži red stane u širinu stiha.
 * Mjeri se stvarni tekst (Range), pa vrijedi za svaki font i kombinaciju;
 * ponovo kad se promijeni širina ili se učita font.
 */
function useFit(box: RefObject<HTMLElement | null>, key: string): number {
  const [fit, setFit] = useState(1)
  useEffect(() => {
    const p = box.current
    const inner = p?.querySelector<HTMLElement>('[data-fit]')
    if (!p || !inner) return
    let raf = 0
    const measure = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const avail = p.clientWidth
        if (!avail) return
        const cur = parseFloat(inner.style.fontSize) || 1
        const range = document.createRange()
        let widest = 0
        for (const line of Array.from(inner.children)) {
          range.selectNodeContents(line)
          widest = Math.max(widest, range.getBoundingClientRect().width)
        }
        if (!widest) return
        const next = Math.min(1, (avail * 0.98 * cur) / widest)
        setFit((f) => (Math.abs(f - next) > 0.004 ? next : f))
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(p)
    document.fonts?.addEventListener('loadingdone', measure)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.fonts?.removeEventListener('loadingdone', measure)
    }
  }, [box, key])
  return fit
}

/** Ispis počinje ovoliko sekundi nakon učitavanja. */
/** splash: koliko slova s papira putuju do mjesta stiha (s) — tad se stih pojavi */
export const SPLASH_ARRIVE = 0.9

export const VERSE_START = 0.25
/** Razmak između riječi. */
export const VERSE_STEP = 0.06
/** Trajanje po riječi. */
export const VERSE_WORD = 0.55

/** Kad zadnja riječ sjedne — po tome se ravna sve ostalo na ekranu. */
export function verseTail(text: string): number {
  const words = text.trim().split(/\s+/).length
  return VERSE_START + (words - 1) * VERSE_STEP + VERSE_WORD * 0.55
}

/**
 * Veličina se računa iz NAJDUŽEG reda, ne iz ukupne dužine.
 *
 * Bez ovoga kratak stih izgleda izgubljeno, a dug se lomi na četiri reda.
 * Konstanta 174 je empirijska: ~0.48 širine znaka u Frauncesu, minus margine.
 */
export function verseFontSize(text: string): string {
  const longest = Math.max(...text.split('\n').map((l) => l.trim().length), 1)
  const vw = Math.min(16, Math.max(6.4, 174 / longest))
  return `clamp(1.75rem, ${vw.toFixed(1)}vw, 4.75rem)`
}

/**
 * Stih se ispisuje riječ po riječ — osjećaj da neko pjeva,
 * a ne da si otvorio tekst fajl. Ovo je srce proizvoda.
 */
export function VerseText({
  text,
  color,
  glow,
  appearAt,
  font,
}: {
  text: string
  color: string
  glow?: string
  /** splash: stih se ne ispisuje — cijeli se pojavi u ovom trenutku, kad mu
   *  slova s papira stignu na mjesto, pa izgleda kao da su prenesena */
  appearAt?: number
  /** font stiha (lib/fonts.ts) — glavni i po riječi */
  font?: string
}) {
  const reduced = useReducedMotion()
  // Tačka dolazi iz `withPeriod` — u podacima je stih bez nje.
  const full = withPeriod(text)
  const lines = full.split('\n')
  const fonts = parseFont(font)
  // svaki red stiha u jednom redu — slova se smanje koliko treba (i za pisane fontove)
  const box = useRef<HTMLParagraphElement>(null)
  const fit = useFit(box, `${full}|${font ?? ''}`)
  // dizajn cijelog stiha (lib/fonts.ts): veličina, prored, razmak, slova; naglasak u boji raspoloženja
  const scale = lookScale(fonts.look)
  const style = {
    ...lookCss(fonts.look, glow ?? color),
    color,
    fontSize: scale === 1 ? verseFontSize(full) : `calc(${verseFontSize(full)} * ${scale})`,
    // dvostruka sjena: crna za čitljivost, naglasak za dubinu
    textShadow: glow
      ? `0 2px 30px rgba(0,0,0,0.5), 0 0 48px ${glow}2e`
      : '0 2px 30px rgba(0,0,0,0.45)',
  }

  if (reduced) {
    return (
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="verse"
        style={style}
        ref={box}
      >
        <span data-fit className="block" style={{ fontSize: `${fit}em` }}>
        {(() => {
          let n = 0
          return lines.map((l, i) => (
            <span key={i} className="block" style={NOWRAP}>
              {l
                .trim()
                .split(/\s+/)
                .map((word, j) => {
                  const k = n++
                  return (
                    <Fragment key={j}>
                      <span style={wordFont(fonts, k)}>{word}</span>{' '}
                    </Fragment>
                  )
                })}
            </span>
          ))
        })()}
        </span>
      </motion.p>
    )
  }

  // globalni index riječi kroz sve redove -> stagger ne resetuje po redu
  let w = 0

  return (
    <p className="verse" style={style} ref={box}>
      <span data-fit className="block" style={{ fontSize: `${fit}em` }}>
      {lines.map((line, li) => (
        <span key={li} className="block" style={NOWRAP}>
          {line
            .trim()
            .split(/\s+/)
            .map((word) => {
              const i = w++
              return (
                // razmak je pravi tekstualni čvor IZVAN inline-block spana —
                // inače se stih kopira i čita bez razmaka
                <Fragment key={`${li}-${i}`}>
                  <motion.span
                    className="inline-block"
                    style={wordFont(fonts, i)}
                    // bez blur filtera — po riječi je na iPhoneu preskup i koči ispis
                    initial={appearAt != null ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      appearAt != null
                        ? { delay: appearAt, duration: 0 }
                        : { delay: VERSE_START + i * VERSE_STEP, duration: VERSE_WORD, ease: [0.22, 1, 0.36, 1] }
                    }
                  >
                    {word}
                  </motion.span>{' '}
                </Fragment>
              )
            })}
        </span>
      ))}
      </span>
    </p>
  )
}
