'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { FIGURE_SRC } from '@/data/moods'
import { useMounted } from '@/lib/client-store'
import { BrandLockup } from './BrandLockup'

const KEY = 'stihdana:splashSeen'
const HOLD = 3000

/**
 * Uvodni ekran — portret, logotip, pa se rastvori u stih.
 *
 * Pojavljuje se jednom po sesiji: ritual treba uvod, ali ne svaki put
 * kad se aplikacija vrati iz pozadine.
 */
export function Splash() {
  const reduced = useReducedMotion()
  const mounted = useMounted()
  const [closed, setClosed] = useState(false)

  // sessionStorage se čita jednom, tek na klijentu
  const alreadySeen = useMemo(() => {
    if (typeof window === 'undefined') return false
    try {
      return Boolean(sessionStorage.getItem(KEY))
    } catch {
      return false
    }
  }, [])

  // Splash se ne renderuje na serveru — tako povratak u aplikaciju nema
  // bljesak uvoda. Stranica je ionako crna do prve riječi stiha.
  const show = mounted && !alreadySeen && !closed

  const close = () => {
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      /* private mode */
    }
    setClosed(true)
  }

  useEffect(() => {
    if (!show) return
    const t = setTimeout(close, reduced ? 700 : HOLD)
    return () => clearTimeout(t)
  }, [show, reduced])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-black"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: 'easeInOut' }}
          onClick={close}
        >
          {/* portret — crno-bijeli, utopljen u crno */}
          <motion.div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${FIGURE_SRC})`, backgroundPosition: '50% 12%' }}
            initial={{ scale: 1.14, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.62 }}
            transition={{ duration: 2.6, ease: [0.22, 1, 0.36, 1] }}
          />

          <div className="relative flex flex-col items-center gap-5 px-8">
            <BrandLockup height={96} delay={0.45} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
