'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { motion, useIsPresent, useMotionValue } from 'motion/react'

/*
 * Donji paneli (sačuvani, dijeljenje) kao na nativnoj aplikaciji:
 *   - panel izlazi odozdo cijelom visinom, bez fade-a — samo se zatamnjenje
 *     iza njega pojavi
 *   - kretnja je `transform` kao string uz bezier krivu — Motion je pusti kroz
 *     WAAPI, pa ide na grafičkom procesoru i ne zastaje dok se sadržaj slaže
 *   - dok je panel otvoren, pozadina iza zatamnjenja miruje (globals.css
 *     `html[data-sheet]`) — blur se inače računa iznova svaki kadar
 *   - teški sadržaj se slaže dva kadra poslije dodira (`AfterOpen`)
 * Na širokom ekranu panel je na sredini, pa tamo ostaje kratko klizanje uz fade.
 */

// otvaranje: kriva iOS panela — brzo krene, mekano sjedne
const OPEN = { duration: 0.5, ease: [0.32, 0.72, 0, 1] as const }
// zatvaranje: krene polako pa ubrza — bez trzaja iz mirovanja
const CLOSE = { duration: 0.5, ease: [0.4, 0.1, 0.2, 1] as const }

/**
 * Povlačenje nadolje prati prst 1:1, kao na telefonu. Kad se pusti dovoljno
 * nisko, panel ne skače nazad nego nastavi dolje odatle gdje ga je prst ostavio.
 */
export function useSheetDrag(onClose: () => void) {
  const y = useMotionValue(0)
  return {
    style: { y },
    drag: 'y',
    dragConstraints: { top: 0, bottom: 0 },
    dragElastic: { top: 0, bottom: 1 },
    onDragEnd: (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
      if (info.offset.y > 90 || info.velocity.y > 600) {
        y.stop() // bez vraćanja na vrh — izlazak kreće odavde
        onClose()
      }
    },
  } as const
}

/**
 * Sloj preko ekrana. Čim se panel zatvara, dodiri prolaze do ekrana ispod —
 * ne čekaju da se kretnja smiri do kraja.
 */
export function SheetLayer({ children, className }: { children: ReactNode; className: string }) {
  const present = useIsPresent()
  return (
    <div className={className} style={{ pointerEvents: present ? undefined : 'none' }}>
      {children}
    </div>
  )
}

/** Zatamnjenje iza panela — samo ono se pojavljuje postepeno. */
export function SheetBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <motion.button
      aria-label="Zatvori"
      className="absolute inset-0 bg-black/75 backdrop-blur-md"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, transition: CLOSE }}
    />
  )
}

/** Panel: na telefonu odozdo cijelom visinom, na širokom ekranu 48px uz fade. */
export function SheetSlide({ children }: { children: ReactNode }) {
  const [wide] = useState(() => window.matchMedia('(min-width: 640px)').matches)
  const from = wide
    ? { transform: 'translateY(48px)', opacity: 0 }
    : { transform: 'translateY(100%)' }
  const to = wide ? { transform: 'translateY(0px)', opacity: 1 } : { transform: 'translateY(0%)' }
  return (
    <motion.div
      className="relative flex w-full max-w-[440px] justify-center"
      style={{ willChange: 'transform' }}
      initial={from}
      animate={{ ...to, transition: OPEN }}
      exit={{ ...from, transition: CLOSE }}
    >
      {children}
    </motion.div>
  )
}

/** Sadržaj tek dva kadra poslije otvaranja — klizanje krene odmah. */
export function AfterOpen({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let b = 0
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setOn(true))
    })
    return () => {
      cancelAnimationFrame(a)
      cancelAnimationFrame(b)
    }
  }, [])
  return <>{on ? children : fallback}</>
}

/** Dok je panel otvoren, pozadina iza zatamnjenja miruje (vidi globals.css). */
export function useSheetOpen(open: boolean) {
  useEffect(() => {
    if (!open) return
    const d = document.documentElement
    d.dataset.sheet = ''
    return () => {
      delete d.dataset.sheet
    }
  }, [open])
}
