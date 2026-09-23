'use client'

import { useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'

const GLYPHS = ['♪', '♫', '♩', '♬']

/**
 * Koliko se moodov broj nota množi prije crtanja.
 * Odnos među moodovima ostaje onakav kakav je u `data/moods.ts` — ovdje se
 * podiže samo ukupna prisutnost, da se note stvarno vide.
 */
const DENSITY = 1.8

/** Deterministički raspored — izvan komponente, da render ostane čist. */
function buildNotes(count: number, speed: number, seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const rand = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296)

  return Array.from({ length: Math.round(count * DENSITY) }, () => ({
    left: 4 + rand() * 92,
    glyph: GLYPHS[Math.floor(rand() * GLYPHS.length)],
    size: 14 + rand() * 18,
    // kraći raspon kašnjenja — inače prvih pola minute ekran izgleda prazno
    delay: rand() * 9,
    duration: (22 + rand() * 16) / speed,
    drift: (rand() - 0.5) * 90,
  }))
}

/**
 * Note koje polako plutaju uvis. Broj i brzina dolaze iz mooda —
 * `sloboda` ih ima osam i brze, `nostalgija` tri i spore.
 *
 * Deterministički raspored po `seed`-u: isti stih izgleda isto pri svakom
 * renderu, pa nema treperenja pri hidrataciji.
 */
export function FloatingNotes({
  count,
  accent,
  speed,
  seed,
}: {
  count: number
  accent: string
  speed: number
  seed: string
}) {
  const reduced = useReducedMotion()

  const notes = useMemo(() => buildNotes(count, speed, seed), [count, speed, seed])

  if (reduced || count === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {notes.map((n, i) => (
        <motion.span
          key={i}
          className="absolute select-none leading-none"
          style={{
            left: `${n.left}%`,
            bottom: -40,
            fontSize: n.size,
            color: accent,
            // tihi sjaj u boji naglaska — nota tako ima težinu, a ne izgleda
            // kao znak nalijepljen preko pozadine
            textShadow: `0 0 14px ${accent}73`,
            willChange: 'transform, opacity',
          }}
          initial={{ opacity: 0 }}
          animate={{
            y: ['0vh', '-115vh'],
            x: [0, n.drift, 0],
            opacity: [0, 0.55, 0.55, 0],
            rotate: [0, n.drift > 0 ? 16 : -16, 0],
          }}
          transition={{
            duration: n.duration,
            delay: n.delay,
            repeat: Infinity,
            ease: 'linear',
            times: [0, 0.15, 0.8, 1],
          }}
        >
          {n.glyph}
        </motion.span>
      ))}
    </div>
  )
}
