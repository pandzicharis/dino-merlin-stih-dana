'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { lockScroll } from '@/lib/scroll-lock'
import { closeTube, minimizeTube, tubeVerse, useTube } from '@/lib/youtube'
import { SheetBackdrop, SheetLayer, SheetSlide, useSheetDrag, useSheetOpen } from '../Sheet'
import { NowPlaying, SongBackdrop } from './NowPlaying'

/**
 * Ladica s pjesmom (YouTube — lib/youtube.ts) — ponaša se kao ostale
 * (components/Sheet.tsx): zatamnjenje iza, povuci nadolje bilo gdje,
 * Escape. Unutra pjesma koja svira (components/tube/NowPlaying.tsx).
 * Zatvaranjem pjesma stane; `minimize` (sačuvani): ladica se spusti, a
 * pjesma čeka — dodir na pjesmu je vrati i nastavi.
 */
export function TubeDrawer({ scope, z = 90, minimize = false }: { scope: string; z?: number; minimize?: boolean }) {
  const tube = useTube()
  const open = tube.scope === scope && Boolean(tube.videoId) && !tube.min
  const verse = open ? tubeVerse() : null
  const close = minimize ? minimizeTube : closeTube

  // visina koju pjesma traži (zatvoren tekst — sadržaj, otvoren — do vrha)
  const [height, setHeight] = useState(0)

  useSheetOpen(open)
  const sheetDrag = useSheetDrag(close, open)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const unlock = lockScroll()
    window.addEventListener('keydown', onKey)
    return () => {
      unlock()
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && verse && tube.videoId && (
        <SheetLayer key="tube" className="fixed inset-0 flex items-end justify-center wide:items-center" z={z}>
          <SheetBackdrop onClose={close} />
          <SheetSlide edge>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`Pjesma — ${verse.song}`}
              data-tube-drawer
              className="os-sheet relative flex w-full flex-col overflow-hidden rounded-t-[30px] border border-b-0 border-white/10 wide:max-w-[440px] wide:rounded-[30px] wide:border-b"
              {...sheetDrag}
              initial={false}
              animate={height ? { height } : undefined}
              // visina klizi mirno (bez opruge — ne odbija se na kraju)
              transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
              style={{ ...sheetDrag.style, background: '#0c0b0b' }}
            >
              <SongBackdrop verse={verse} />
              <NowPlaying verse={verse} id={tube.videoId} onClose={close} onHeight={setHeight} minimize={minimize} />
            </motion.div>
          </SheetSlide>
        </SheetLayer>
      )}
    </AnimatePresence>,
    document.body,
  )
}
