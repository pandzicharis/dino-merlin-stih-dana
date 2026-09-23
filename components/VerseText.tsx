'use client'

import { Fragment } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { withPeriod } from '@/lib/text'

/** Ispis počinje ovoliko sekundi nakon učitavanja. */
export const VERSE_START = 0.4
/** Razmak između riječi. */
export const VERSE_STEP = 0.07
/** Trajanje po riječi. */
export const VERSE_WORD = 0.6

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
export function VerseText({ text, color, glow }: { text: string; color: string; glow?: string }) {
  const reduced = useReducedMotion()
  // Tačka dolazi iz `withPeriod` — u podacima je stih bez nje.
  const full = withPeriod(text)
  const lines = full.split('\n')
  const style = {
    color,
    fontSize: verseFontSize(full),
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
      >
        {lines.map((l, i) => (
          <span key={i} className="block">
            {l}
          </span>
        ))}
      </motion.p>
    )
  }

  // globalni index riječi kroz sve redove -> stagger ne resetuje po redu
  let w = 0

  return (
    <p className="verse" style={style}>
      {lines.map((line, li) => (
        <span key={li} className="block">
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
                    initial={{ opacity: 0, y: 16, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{
                      delay: VERSE_START + i * VERSE_STEP,
                      duration: VERSE_WORD,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    {word}
                  </motion.span>{' '}
                </Fragment>
              )
            })}
        </span>
      ))}
    </p>
  )
}
