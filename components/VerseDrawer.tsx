'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { MOODS } from '@/data/moods'
import { albumOf, softOf } from '@/data/albums'
import { BRAND } from '@/lib/brand'
import { SheetBackdrop, SheetLayer, SheetSlide, useSheetDrag, useSheetOpen } from './Sheet'

/** Okrugla ikonica u zaglavlju — kao na ostalim panelima. */
export const ROUND = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/70 transition-colors hover:text-white active:scale-95'

/**
 * Drawer stiha — tekst pjesme (components/Lyrics.tsx). Donji panel kao
 * ostali (components/Sheet.tsx): izlazi odozdo, povuci nadolje bilo gdje i
 * zatvori se. U boji stiha, s omotom albuma koji se pretapa u tamu; gore
 * zaglavlje (`header`).
 */
export function VerseDrawer({
  open,
  verse,
  label,
  height = 'h-[96dvh] sm:h-[88dvh]',
  above,
  header,
  children,
  onClose,
  ...rest
}: {
  open: boolean
  verse: Verse
  /** za čitač ekrana */
  label: string
  height?: string
  /** iznad panela, na zatamnjenoj pozadini */
  above?: ReactNode
  /** zaglavlje, ispod hvataljke */
  header: ReactNode
  children: ReactNode
  onClose: () => void
} & { [k: `data-${string}`]: boolean | string | undefined }) {
  useSheetOpen(open)
  const sheetDrag = useSheetDrag(onClose, open)
  const m = MOODS[verse.mood]
  const cover = albumOf(verse.album)?.cover
  const bg = softOf(cover) ?? cover

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
        <SheetLayer className="fixed inset-0 z-[115] flex items-end justify-center sm:items-center">
          <SheetBackdrop onClose={onClose} />
          {above}
          <SheetSlide>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={label}
              {...rest}
              className={`os-sheet relative flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[30px] border border-b-0 border-white/10 sm:rounded-[30px] sm:border-b ${height}`}
              {...sheetDrag}
              style={{ ...sheetDrag.style, background: m.gradient[0] }}
            >
              {/* omot: zamućen preko cijelog panela (unaprijed — bez CSS blura), a gore
                  oštar, koji se pretapa u tamu — kao album iza stiha. Druga pjesma: pretopi se */}
              <AnimatePresence initial={false}>
                {bg && (
                  <motion.div
                    key={cover ?? bg}
                    className="pointer-events-none absolute inset-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7 }}
                    aria-hidden
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bg} alt="" draggable={false} className="absolute inset-0 h-full w-full scale-125 object-cover opacity-35" style={softOf(cover) ? undefined : { filter: 'blur(48px)' }} />
                    {cover && (
                      <motion.img
                        src={cover}
                        alt=""
                        draggable={false}
                        className="absolute inset-x-0 top-0 h-[68%] w-full object-cover"
                        style={{
                          maskImage: 'linear-gradient(180deg, #000 0%, rgba(0,0,0,0.55) 45%, transparent 100%)',
                          WebkitMaskImage: 'linear-gradient(180deg, #000 0%, rgba(0,0,0,0.55) 45%, transparent 100%)',
                        }}
                        initial={{ opacity: 0, scale: 1.06 }}
                        animate={{ opacity: 0.26, scale: 1 }}
                        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: `radial-gradient(120% 60% at 50% 0%, ${m.gradient[2]}66, transparent 62%), linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.85) 80%)` }}
                aria-hidden
              />
              <span className="pointer-events-none absolute inset-x-10 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${BRAND.gold}80, transparent)` }} aria-hidden />

              {/* zaglavlje */}
              <div className="relative z-10 shrink-0 px-5 pb-2 pt-3">
                <span className="os-grabber mx-auto mb-3 block h-1 w-10 rounded-full bg-white/15 sm:hidden" aria-hidden />
                {header}
              </div>

              {children}
            </motion.div>
          </SheetSlide>
        </SheetLayer>
      )}
    </AnimatePresence>,
    document.body,
  )
}
