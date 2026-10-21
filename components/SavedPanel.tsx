'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
import { SavedVerses, type SavedView } from './SavedVerses'
import { closeSaved, dismissSaved, expandSaved, stopSaved, useSavedPlayerSelect } from '@/lib/player'
import { MiniPlayer, PlayerIconPaths } from './SavedPlayer'
import { DrawerIcon } from './DrawerIcon'
import { loadVerses } from '@/lib/verses-client'
import { pruneFavorites } from '@/lib/storage'
import { AfterOpen, SheetBackdrop, SheetLayer, SheetSlide, useSheetDrag, useSheetOpen } from './Sheet'

/**
 * Zatvaranje: prvo samo kretnja, a sve ostalo (stanje plejera, gašenje
 * muzike, mini plejer, stranica ispod) ovoliko kasnije — kad panel već klizi
 * na grafičkom procesoru. Inače bi prvi kadar zatvaranja bio težak i panel bi
 * "preskočio" početak.
 */
const LAG = 120

/** zapamćen pogled: špil karata ili lista */
const VIEW = 'stihdana:savedView'

/**
 * Plejer pjesama — sačuvani stihovi kao donji panel: stihovi (špil karata),
 * pjesme ili albumi, a ispod plejer. Strelica (i povlačenje dolje) ga
 * spušta: muzika ide dalje, a iznad dna početne pluta mini plejer
 * (MiniPlayer). Dodir ga podigne; povlačenje dolje gasi muziku.
 */
export default function SavedPanel({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  const [verses, setVerses] = useState<Verse[] | null>(null)

  useEffect(() => {
    if (verses) return
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
  }, [verses])

  useSheetOpen(open)
  // spušten (strelica, povlačenje, dodir pored) — stanje plejera se sredi kadar
  // poslije (dismiss), pa ga ovdje ne treba gasiti; ponovo otvoren prije toga — ništa
  const dismissing = useRef(false)
  // otvoren — mini plejer na dnu se sklopi u njega; zatvoren bez pjesme — sve
  // stane (samo pri zatvaranju — panel se montira unaprijed, zatvoren)
  const wasOpen = useRef(false)
  // otvoren baš sad — posao odgođen pri zatvaranju se ne radi ako je panel u međuvremenu opet otvoren
  const openNow = useRef(open)
  useEffect(() => {
    openNow.current = open
    if (open) {
      dismissing.current = false
      expandSaved()
    } else if (wasOpen.current && !dismissing.current) {
      const t = window.setTimeout(() => !openNow.current && closeSaved(), LAG)
      wasOpen.current = open
      return () => clearTimeout(t)
    }
    wasOpen.current = open
  }, [open])
  // spušten: panel stoji dolje, viri samo mini plejer. Sluša se samo ovo — promjena
  // pjesme ili pauza ne crta panel iznova
  const hasId = useSavedPlayerSelect((s) => Boolean(s.id))
  const mini = useSavedPlayerSelect((s) => s.mini)
  const [view, setView] = useState<SavedView>(() => {
    // ništa ne svira — otvara se na "Stihovi", pa se špil složi već sad (unaprijed)
    if (!hasId) return 'cards'
    try {
      const v = localStorage.getItem(VIEW)
      return v === 'list' || v === 'albums' || v === 'loved' ? v : 'cards'
    } catch {
      return 'cards'
    }
  })
  // stalan (useCallback) — sadržaj (SavedVerses, memo) se ne crta iznova pri otvaranju
  const pick = useCallback((v: SavedView) => {
    setView(v)
    try {
      localStorage.setItem(VIEW, v)
    } catch {
      /* privatni prozor */
    }
  }, [])
  // otvoren, a ništa ne svira — počinje od "Stihovi" (zapamćen pogled važi
  // dok se sluša)
  const idle = !hasId
  const [shown, setShown] = useState(open)
  // otvoren iz mini plejera — panel se podiže sporije, kao da izraste iz njega
  const [rise, setRise] = useState(false)
  if (shown !== open) {
    setShown(open)
    if (open && idle) setView('cards')
    setRise(open && mini && hasId)
  }

  const peek = !open && mini && hasId
  // spušten i muzika stala — "Stihovi" se vrate dok je panel dolje (poslije
  // spuštanja), ne pri otvaranju: otvaranje je onda samo kretnja, bez slaganja špila
  useEffect(() => {
    if (open || !idle || view === 'cards') return
    const t = window.setTimeout(() => setView('cards'), 600)
    return () => clearTimeout(t)
  }, [open, idle, view])
  // strelica, povlačenje dolje, dodir pored, Escape — panel se spusti; ima li
  // pjesmu, ona svira dalje i na dnu početne viri mini plejer. Prvo kretnja,
  // pa stanje plejera (LAG) — mini plejer i mjesto za njega ionako kreću tek
  // kad panel prođe, a prvi kadar zatvaranja ostaje lak
  const dismiss = useCallback(() => {
    dismissing.current = true
    onClose()
    window.setTimeout(() => {
      if (!dismissing.current || openNow.current) return
      dismissing.current = false
      dismissSaved()
      closeSaved()
    }, LAG)
  }, [onClose])
  // povuci nadolje bilo gdje — prst se samo prati, skrol unutra ne čeka JavaScript
  const sheetDrag = useSheetDrag(dismiss, open, { passive: true })

  // Escape zatvara, a stranica ispod ne skrola dok je panel otvoren
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismiss()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      // stranica se vrati kad panel ode — ne u prvom kadru zatvaranja (cijela stranica bi se iznova rasporedila)
      window.setTimeout(() => !openNow.current && (document.body.style.overflow = prev), 460)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, dismiss])

  if (typeof document === 'undefined') return null

  return createPortal(
    // uvijek montiran (SavedLink ga složi u tišini): otvoren, spušten do mini
    // plejera, ili sklonjen ispod ekrana — otvaranje je samo kretnja
    <SheetLayer className={`fixed inset-0 z-[100] flex items-end justify-center ${open ? 'sm:items-center' : 'pointer-events-none'}`}>
          {/* mini plejer je ispod zatamnjenja i panela — pri podizanju ga prirodno prekriju */}
          <AnimatePresence custom={open ? 'open' : 'stop'}>{peek && <MiniPlayer key="mini" onOpen={onOpen} />}</AnimatePresence>
          <AnimatePresence>{open && <SheetBackdrop key="backdrop" onClose={dismiss} />}</AnimatePresence>

          <SheetSlide away={!open} rise={rise}>
          <motion.div
            role="dialog"
            aria-modal={open}
            aria-label="Player pjesama"
            aria-hidden={!open}
            className={`os-sheet ${open ? 'pointer-events-auto' : ''} relative flex max-h-[96dvh] w-full max-w-[440px] flex-col rounded-t-[30px] border border-b-0 border-white/10 sm:border-b sm:rounded-[30px]`}
            {...sheetDrag}
            style={{
              ...sheetDrag.style,
              background: `radial-gradient(120% 60% at 50% 0%, ${BRAND.gold}1a 0%, transparent 60%), linear-gradient(180deg, #121010 0%, #0a0909 100%)`,
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
            >
              <span className="os-grabber mx-auto mb-3 block h-1 w-10 rounded-full bg-white/15 sm:hidden" aria-hidden />
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* ista ikona kao dugme u zaglavlju: plejer pjesama */}
                  <DrawerIcon>
                    <PlayerIconPaths />
                  </DrawerIcon>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.28em]" style={{ color: BRAND.gold }}>
                      Sačuvani stihovi
                    </p>
                    <p className="text-[1.1rem] text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
                      Player pjesama
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* spusti — muzika ide dalje, na dnu početne viri mini plejer */}
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={dismiss}
                    aria-label="Spusti"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:text-white"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {/* zatvori — muzika stane, plejer ode do kraja (bez mini plejera) */}
                  <motion.button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      onClose()
                      // muzika stane čim panel krene (LAG) — prvi kadar zatvaranja ostaje lak
                      window.setTimeout(() => !openNow.current && stopSaved(), LAG)
                    }}
                    aria-label="Zatvori plejer"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:text-white"
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.88 }}
                    transition={{ type: 'spring', stiffness: 460, damping: 24 }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </div>

            {/* špil (ili lista) i plejer ispod — SavedVerses sam rasporedi i skrola */}
            <div className="flex min-h-[200px] flex-1 flex-col">
              {verses ? (
                // karte i plejer se slože dok panel već klizi
                <AfterOpen fallback={<Skeleton />}>
                  <SavedVerses verses={verses} onClose={onClose} view={view} onView={pick} />
                </AfterOpen>
              ) : (
                <Skeleton />
              )}
            </div>
          </motion.div>
          </SheetSlide>
    </SheetLayer>,
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
