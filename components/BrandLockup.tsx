'use client'

import { motion } from 'motion/react'
import { MAGAZA_BESIDE, MAGAZA_DROP_CSS } from '@/lib/brand'
import { MagazaLogo } from './MagazaLogo'
import { Signature } from './Signature'

/**
 * Potpis | Magaza — kao u zaglavlju ekrana stiha, samo krupnije.
 *
 * Isti ulaz kao u zaglavlju: oba znaka zajedno, istim fade-om. Odnos
 * veličina i optički centar Magaze su isti svugdje (lib/brand.ts).
 */
export function BrandLockup({ height = 42, delay = 0.1 }: { height?: number; delay?: number }) {
  return (
    <motion.div
      className="inline-flex items-center"
      style={{ gap: Math.round(height * 0.36) }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7, delay, ease: 'easeOut' }}
    >
      <Signature height={height} wipe={false} className="opacity-90" />
      <span className="w-px bg-white/20" style={{ height: Math.round(height * 0.62) }} aria-hidden />
      <MagazaLogo height={Math.round(height * MAGAZA_BESIDE)} color="#FFFFFF" className="opacity-90" style={{ transform: MAGAZA_DROP_CSS }} />
    </motion.div>
  )
}
