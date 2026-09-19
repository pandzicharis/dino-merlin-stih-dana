'use client'

import { motion } from 'motion/react'

/**
 * Tanka linija s notom — potpis ispod stiha.
 *
 * Uvijek je u DOM-u i ulazi po zadatom kašnjenju, kao dio iste koreografije
 * kao i ispis stiha. Da se montira tek kad stih završi, ekran bi poskočio.
 */
export function VerseOrnament({ accent, delay }: { accent: string; delay: number }) {
  return (
    <motion.div
      className="flex w-full items-center justify-center gap-3"
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 1, delay, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden
    >
      <Rule accent={accent} dir="left" />
      <span className="select-none text-[12px] leading-none" style={{ color: accent, opacity: 0.6 }}>
        ♪
      </span>
      <Rule accent={accent} dir="right" />
    </motion.div>
  )
}

function Rule({ accent, dir }: { accent: string; dir: 'left' | 'right' }) {
  return (
    <span
      className="h-px w-14 sm:w-20"
      style={{
        background: `linear-gradient(to ${dir === 'left' ? 'right' : 'left'}, transparent, ${accent})`,
        opacity: 0.4,
      }}
    />
  )
}
