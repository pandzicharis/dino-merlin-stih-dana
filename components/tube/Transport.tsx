'use client'

import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { haptic } from '@/lib/haptic'
import { nextTube, prevTube, toggleTube, useTube } from '@/lib/youtube'

/*
 * Nazad, pusti/pauza i sljedeća — isti znakovi i dodir kao plejer iza
 * prekidača (components/SavedPlayer.tsx, mini plejer): krupni bijeli znakovi,
 * bez podloge, pod prstom se smanje, pusti ⇄ pauza se pretope. Uz pjesmu
 * (NowPlaying.tsx) i u traci spuštene pjesme (MiniSong.tsx). Nazad i sljedeća
 * samo za pjesmu iz liste (red). Spuštena se svakim dodirom vrati gore —
 * YouTube svira samo dok se video vidi.
 */

const PREV = (
  <>
    <path d="M11.5 6.2v11.6a.8.8 0 0 1-1.25.66L2.8 13.2a1.4 1.4 0 0 1 0-2.4l7.45-5.26a.8.8 0 0 1 1.25.66z" />
    <path d="M21.5 6.2v11.6a.8.8 0 0 1-1.25.66L12.8 13.2a1.4 1.4 0 0 1 0-2.4l7.45-5.26a.8.8 0 0 1 1.25.66z" />
  </>
)
const NEXT = (
  <>
    <path d="M2.5 6.2v11.6a.8.8 0 0 0 1.25.66l7.45-5.26a1.4 1.4 0 0 0 0-2.4L3.75 5.54a.8.8 0 0 0-1.25.66z" />
    <path d="M12.5 6.2v11.6a.8.8 0 0 0 1.25.66l7.45-5.26a1.4 1.4 0 0 0 0-2.4l-7.45-5.26a.8.8 0 0 0-1.25.66z" />
  </>
)
const PLAY = <path d="M6.5 4.6v14.8a1.1 1.1 0 0 0 1.68.93l11.8-7.4a1.1 1.1 0 0 0 0-1.86L8.18 3.67A1.1 1.1 0 0 0 6.5 4.6z" />
const PAUSE = (
  <>
    <rect x="5.5" y="4" width="4.4" height="16" rx="1.2" />
    <rect x="14.1" y="4" width="4.4" height="16" rx="1.2" />
  </>
)
const GLYPH = { type: 'spring', stiffness: 520, damping: 34 } as const

/** Dugme kao u plejeru iza prekidača: bijelo, bez podloge, pod prstom se smanji. */
export function Btn({
  label,
  onPress,
  size,
  color,
  disabled = false,
  zoom = 1.12,
  children,
}: {
  label: string
  onPress: () => void
  size: number
  color?: string
  disabled?: boolean
  /** koliko naraste pod mišem */
  zoom?: number
  children: ReactNode
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => {
        haptic(5)
        onPress()
      }}
      aria-label={label}
      className="relative flex shrink-0 items-center justify-center rounded-full transition-colors duration-200 active:bg-white/10 disabled:pointer-events-none"
      style={{ width: size, height: size, color: disabled ? 'rgba(255,255,255,0.3)' : (color ?? '#fff') }}
      whileHover={{ scale: zoom, color: '#fff' }}
      whileTap={{ scale: 0.86 }}
      transition={{ type: 'spring', stiffness: 460, damping: 26 }}
    >
      {children}
    </motion.button>
  )
}

/** Pusti ⇄ pauza — znakovi se pretope jedan u drugi. */
function PlayGlyph({ playing, size }: { playing: boolean; size: number }) {
  return (
    <>
      <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className="absolute" initial={false} animate={{ opacity: playing ? 1 : 0, scale: playing ? 1 : 0.5 }} transition={GLYPH}>
        {PAUSE}
      </motion.svg>
      <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className="absolute translate-x-[1px]" initial={false} animate={{ opacity: playing ? 0 : 1, scale: playing ? 0.5 : 1 }} transition={GLYPH}>
        {PLAY}
      </motion.svg>
    </>
  )
}

export function Transport() {
  const tube = useTube()
  const on = !tube.min && (tube.status === 'playing' || tube.status === 'loading')
  return (
    <div className="flex shrink-0 items-center">
      {tube.list && (
        <Btn label="Prethodna" onPress={prevTube} size={38}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            {PREV}
          </svg>
        </Btn>
      )}
      <Btn label={on ? 'Pauza' : 'Pusti'} onPress={toggleTube} size={44}>
        <PlayGlyph playing={on} size={28} />
      </Btn>
      {tube.list && (
        <Btn label="Sljedeća" onPress={nextTube} size={38} disabled={!tube.next}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            {NEXT}
          </svg>
        </Btn>
      )}
    </div>
  )
}
