'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'motion/react'
import { useFavorites } from '@/lib/client-store'

/** Panel se učita tek kad prst dotakne ikonicu — kao i panel za dijeljenje. */
const load = () => import('./SavedPanel')
const SavedPanel = dynamic(load, { ssr: false })

/**
 * Sačuvani stihovi — tiha ikonica u zaglavlju, bez brojke (brojka izgleda
 * kao obavijest, a ovo nije obavijest). Otvara donji panel s listom.
 * Pojavi se tek kad postoji bar jedan sačuvan stih.
 */
export function SavedLink() {
  const count = useFavorites().length
  const [open, setOpen] = useState(false)
  // jednom otvoren panel ostaje montiran, da zatvaranje ima svoju animaciju
  const [used, setUsed] = useState(false)

  return (
    <>
      <AnimatePresence initial={false}>
        {count > 0 && (
          <motion.span
            key="saved"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className="flex"
          >
            <button
              onPointerEnter={load}
              onTouchStart={load}
              onClick={() => {
                navigator.vibrate?.(8)
                setUsed(true)
                setOpen(true)
              }}
              aria-label={`Sačuvani stihovi (${count})`}
              title="Sačuvani stihovi"
              className="-m-2 p-2 text-white/40 transition-all hover:text-white/70 active:scale-90"
            >
              {/* dvije kartice jedna iza druge, srce na prednjoj */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 3.5h9.5A2.5 2.5 0 0 1 20 6v11" />
                <rect x="4" y="6.5" width="13" height="14" rx="2.5" />
                <path d="M10.5 16.8s-3-1.8-3-4a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2.2-3 4-3 4z" fill="currentColor" stroke="none" />
              </svg>
            </button>
          </motion.span>
        )}
      </AnimatePresence>
      {used && <SavedPanel open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
