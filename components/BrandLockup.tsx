'use client'

import { motion } from 'motion/react'
import { BRAND } from '@/lib/brand'
import { Signature } from './Signature'

/**
 * Potpis + tanka linija + "STIH DANA".
 *
 * Ulazi u tri takta: potpis se ispiše, linija se povuče ispod njega,
 * pa se natpis pojavi. Linija se rasteže na širinu šireg elementa, pa
 * potpis i natpis stoje kao jedan znak umjesto kao dvije nabacane stvari.
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

      <motion.p
        className="whitespace-nowrap text-[8px] font-medium uppercase leading-none tracking-[0.46em]"
        style={{ color: BRAND.gold, textIndent: '0.46em' }}
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 0.85, y: 0 }}
        transition={{ duration: 0.8, delay: delay + write * 0.95, ease: 'easeOut' }}
      >
        Stih dana
      </motion.p>
    </div>
  )
}
