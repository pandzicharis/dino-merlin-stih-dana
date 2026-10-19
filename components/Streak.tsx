'use client'

import { useId } from 'react'
import { motion } from 'motion/react'

/** Vatrica — čist plamen (oblik kao Lucide "flame"), u bojama vatre. */
function Flame({ size }: { size: number }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD27A" />
          <stop offset="0.55" stopColor="#FF9A3D" />
          <stop offset="1" stopColor="#F2552C" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
      />
    </svg>
  )
}

/**
 * Niz dana zaredom (lib/storage.ts) — tiha pilula iznad datuma, tek od
 * drugog dana: vatrica i "7. stih dana".
 */
export function StreakLine({ n }: { n: number; accent?: string }) {
  return (
    // mala tamna pilula — čitka na svakoj pozadini, a ne viče
    <motion.p
      className="tabular flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 py-1 pl-2 pr-2.5 text-[9.5px] font-medium uppercase tracking-[0.24em] text-white/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9, delay: 0.1, ease: 'easeOut' }}
    >
      <Flame size={12} />
      {n}. stih dana
    </motion.p>
  )
}
