'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { motion, useIsPresent } from 'motion/react'

/*
 * Donji paneli (sačuvani, dijeljenje) — isti izgled i ista kretnja kao
 * ranije (klizne 48px uz fade, ista opruga), samo glatko:
 *   - kretnja je `transform` kao string — Motion je pusti kroz WAAPI, pa ide
 *     na grafičkom procesoru i ne zastaje dok se sadržaj slaže
 *   - dok je panel otvoren, pozadina iza zatamnjenja miruje (globals.css
 *     `html[data-sheet]`) — blur se inače računa iznova svaki kadar
 *   - teški sadržaj se slaže dva kadra poslije dodira (`AfterOpen`), dok je
 *     panel još gotovo providan — dodir odmah pokrene kretnju
 */

const SPRING = { type: 'spring', stiffness: 380, damping: 34 } as const

/**
 * Sloj preko ekrana (zatamnjenje + panel), isti fade kao i prije. Čim se
 * panel zatvara, dodiri prolaze do ekrana ispod — ne čekaju da se kretnja
 * smiri do kraja.
 */
export function SheetLayer({ children, className }: { children: ReactNode; className: string }) {
  const present = useIsPresent()
  return (
    <motion.div
      className={className}
      style={{ pointerEvents: present ? undefined : 'none' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.div>
  )
}

/** Panel: odozdo 48px uz fade, kao i prije — samo transform i opacity. */
export function SheetSlide({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="relative flex w-full max-w-[440px] justify-center"
      style={{ willChange: 'transform, opacity' }}
      initial={{ transform: 'translateY(48px)', opacity: 0 }}
      animate={{ transform: 'translateY(0px)', opacity: 1 }}
      exit={{ transform: 'translateY(48px)', opacity: 0 }}
      transition={SPRING}
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
