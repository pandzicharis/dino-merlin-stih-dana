'use client'

import { motion } from 'motion/react'
import { BRAND } from '@/lib/brand'
import { Signature } from './Signature'

/**
 * Potpis i tanka linija ispod njega.
 *
 * Ulazi u dva takta: potpis se ispiše, pa se linija povuče ispod. Natpisa
 * nema — potpis je dovoljan znak, a riječi ispod su ga samo ponavljale.
 */
export function BrandLockup({ height = 42, delay = 0.1 }: { height?: number; delay?: number }) {
  const write = 1.25

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <Signature height={height} delay={delay} duration={write} className="opacity-90" />

      <motion.span
        className="h-px w-full origin-left"
        style={{ background: BRAND.gold, opacity: 0.3 }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.7, delay: delay + write * 0.72, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden
      />
    </div>
  )
}
