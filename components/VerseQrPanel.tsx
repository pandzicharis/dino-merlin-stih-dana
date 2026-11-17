'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
import { lockScroll } from '@/lib/scroll-lock'
import { DrawerHeader } from './DrawerIcon'
import { GiftCard, GiftLinkActions, useGiftLink } from './GiftLink'
import { SheetBackdrop, SheetLayer, SheetSlide, useSheetDrag, useSheetOpen } from './Sheet'
import { QrIcon } from './tube/icons'

/**
 * Ladica s QR kodom stiha (components/VerseQr.tsx) — isto kao „Link i QR“ u
 * dijeljenju: QR kartica (kod, stih, pjesma, album), adresa, pošalji i
 * kopiraj. Kod nosi link poklona: skeniran, stih doleti drugom telefonu.
 */
export default function VerseQrPanel({ open, onClose, verse }: { open: boolean; onClose: () => void; verse: Verse }) {
  const { qr, send } = useGiftLink(verse, open)

  useSheetOpen(open)
  const sheetDrag = useSheetDrag(onClose, open)

  // Escape zatvara samo ovu ladicu; stranica ispod ne skrola dok je otvorena
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onClose()
    }
    const unlock = lockScroll()
    window.addEventListener('keydown', onKey, true)
    return () => {
      unlock()
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <SheetLayer className="fixed inset-0 z-[130] flex items-end justify-center wide:items-center">
          <SheetBackdrop onClose={onClose} />

          <SheetSlide>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="QR kod stiha"
              className="os-sheet relative flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-[30px] border border-b-0 border-white/10 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 wide:max-w-[440px] wide:rounded-[30px] wide:border-b wide:pb-6"
              {...sheetDrag}
              style={{
                ...sheetDrag.style,
                background: `radial-gradient(120% 60% at 50% 0%, ${BRAND.gold}1a 0%, transparent 60%), linear-gradient(180deg, #121010 0%, #0a0909 100%)`,
              }}
            >
              {/* zaglavlje preko cijele širine (panel ima unutrašnji razmak) */}
              <DrawerHeader className="-mx-5 -mt-3 mb-4" icon={<QrIcon size={17} />} eyebrow="QR kod stiha" title={verse.song} onClose={onClose} />

              {/* kartica na istom mjestu i iste veličine kao pregled u dijeljenju */}
              <div className="relative flex h-[min(38dvh,380px)] items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  className="absolute inset-0 flex"
                >
                  <GiftCard verse={verse} qr={qr} className="w-full" />
                </motion.div>
              </div>

              <GiftLinkActions send={send} onDone={onClose} />
            </motion.div>
          </SheetSlide>
        </SheetLayer>
      )}
    </AnimatePresence>,
    document.body,
  )
}
