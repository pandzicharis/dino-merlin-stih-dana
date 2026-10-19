'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'motion/react'
import { useFavorites } from '@/lib/client-store'
import { haptic } from '@/lib/haptic'
import { OPEN_SAVED } from '@/lib/player'

/** Panel se učita tek kad prst dotakne ikonicu — kao i panel za dijeljenje. */
const load = () => import('./SavedPanel')
const SavedPanel = dynamic(load, { ssr: false })

/**
 * Sačuvani stihovi — tiha ikonica u zaglavlju s malim brojačem u tonu
 * ikonice (ne crvena "obavijest"). Otvara donji panel s listom.
 * Pojavi se tek kad postoji bar jedan sačuvan stih.
 */
export function SavedLink() {
  const ids = useFavorites()
  // Broj se ne provjerava listom stihova pri svakom otvaranju (jedan zahtjev
  // manje po korisniku): nevažeći zapisi (obrisan stih) se očiste kad se
  // panel otvori i stihovi stignu, pa se broj tad sam ispravi.
  const count = ids.length
  const [open, setOpen] = useState(false)
  // jednom otvoren panel ostaje montiran, da zatvaranje ima svoju animaciju
  const [used, setUsed] = useState(false)
  // panel se preuzme u tišini kad se ekran smiri — prvi dodir ga otvara odmah
  useEffect(() => {
    const t = setTimeout(load, 3000)
    return () => clearTimeout(t)
  }, [])
  // pilula sačuvanih na početnoj vraća panel
  useEffect(() => {
    const show = () => {
      setUsed(true)
      setOpen(true)
    }
    window.addEventListener(OPEN_SAVED, show)
    return () => window.removeEventListener(OPEN_SAVED, show)
  }, [])

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
                haptic(8)
                setUsed(true)
                setOpen(true)
              }}
              aria-label={`Sačuvani stihovi (${count})`}
              title="Sačuvani stihovi"
              data-tip="saved"
              className="relative -m-[10.5px] p-[10.5px] text-white/60 transition-all hover:text-white/85 active:scale-90"
            >
              {/* dvije kartice jedna iza druge, srce na prednjoj */}
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 3.5h9.5A2.5 2.5 0 0 1 20 6v11" />
                <rect x="4" y="6.5" width="13" height="14" rx="2.5" />
                <path d="M10.5 16.8s-3-1.8-3-4a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2.2-3 4-3 4z" fill="currentColor" stroke="none" />
              </svg>
              {/* mali brojač, puna zlatna — u boji brenda, ne kao crvena obavijest */}
              <span
                className="tabular absolute right-0 top-0.5 inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-[3px] text-[8.5px] font-bold leading-none"
                style={{
                  background: 'linear-gradient(135deg, #F1E2BF, #BFA87F 55%, #9C8458)',
                  color: '#16110A',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                }}
                aria-hidden
              >
                {count}
              </span>
            </button>
          </motion.span>
        )}
      </AnimatePresence>
      {used && <SavedPanel open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
