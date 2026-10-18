'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
import { SavedVerses, SavedViewToggle } from './SavedVerses'
import { DrawerIcon } from './DrawerIcon'
import { loadVerses } from '@/lib/verses-client'
import { pruneFavorites } from '@/lib/storage'
import { AfterOpen, SheetLayer, SheetSlide, useSheetOpen } from './Sheet'

/** Sačuvani stihovi kao donji panel — isti kao panel za dijeljenje. */
export default function SavedPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [verses, setVerses] = useState<Verse[] | null>(null)
  // Povlači se CIJELI panel, ali se hvata samo za zaglavlje — inače bi
  // skrolanje liste vuklo panel umjesto da skrola.
  const drag = useDragControls()

  useEffect(() => {
    if (!open) return
    let alive = true
    loadVerses().then((v) => {
      if (!alive) return
      setVerses(v)
      // obrisani stihovi ispadnu iz sačuvanih — brojač na zaglavlju se ispravi
      if (v.length) pruneFavorites(new Set(v.map((x) => x.id)))
    })
    return () => {
      alive = false
    }
  }, [open])

  useSheetOpen(open)

  // Escape zatvara, a stranica ispod ne skrola dok je panel otvoren
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <SheetLayer className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <button aria-label="Zatvori" className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

          <SheetSlide>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Sačuvani stihovi"
            className="os-sheet relative flex max-h-[85dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[30px] border border-white/10 shadow-[0_-20px_80px_rgba(0,0,0,0.7)] sm:rounded-[30px]"
            style={{
              background: `radial-gradient(120% 60% at 50% 0%, ${BRAND.gold}1a 0%, transparent 60%), linear-gradient(180deg, #121010 0%, #0a0909 100%)`,
            }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) onClose()
            }}
          >
            <span
              className="pointer-events-none absolute inset-x-10 top-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${BRAND.gold}80, transparent)` }}
              aria-hidden
            />

            {/* zaglavlje se povlači za zatvaranje; lista ispod normalno skrola */}
            <div
              className="shrink-0 cursor-grab touch-none px-5 pt-3 active:cursor-grabbing"
              onPointerDown={(e) => drag.start(e)}
            >
              <span className="os-grabber mx-auto mb-3 block h-1 w-10 rounded-full bg-white/15 sm:hidden" aria-hidden />
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* ista ikona kao dugme za sačuvano: dvije kartice, srce na prednjoj */}
                  <DrawerIcon>
                    <path d="M8 3.5h9.5A2.5 2.5 0 0 1 20 6v11" />
                    <rect x="4" y="6.5" width="13" height="14" rx="2.5" />
                    <path d="M10.5 16.8s-3-1.8-3-4a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2.2-3 4-3 4z" fill="currentColor" stroke="none" />
                  </DrawerIcon>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.28em]" style={{ color: BRAND.gold }}>
                      Stih dana
                    </p>
                    <p className="text-[1.1rem] text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
                      Sačuvani stihovi
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <SavedViewToggle />
                  <button
                    onClick={onClose}
                    aria-label="Zatvori"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:text-white"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-[200px] overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {verses ? (
                // karte i plejeri se slože dok panel već klizi
                <AfterOpen fallback={<Skeleton />}>
                  <SavedVerses verses={verses} onClose={onClose} />
                </AfterOpen>
              ) : (
                <Skeleton />
              )}
            </div>
          </motion.div>
          </SheetSlide>
        </SheetLayer>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1].map((i) => (
        <div key={i} className="h-[140px] animate-pulse rounded-[22px] bg-white/[0.04]" />
      ))}
    </div>
  )
}
