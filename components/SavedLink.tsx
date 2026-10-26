'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'motion/react'
import { useFavorites } from '@/lib/client-store'
import { haptic } from '@/lib/haptic'
import { EqBars } from './EqBars'
import { OPEN_SAVED, savedVerse, useSavedPlayerSelect } from '@/lib/player'
import { albumOf, thumbOf } from '@/data/albums'
import { whenCalm } from '@/lib/calm'
import { useMounted } from '@/lib/client-store'
import { Pocket } from './Pocket'

/** Panel se učita tek kad prst dotakne ikonicu — kao i panel za dijeljenje. */
const load = () => import('./SavedPanel')
const SavedPanel = dynamic(load, { ssr: false })

/**
 * Plejer pjesama (sačuvani stihovi) — tiha ikonica u zaglavlju s malim
 * brojačem u tonu ikonice (ne crvena "obavijest"), i džep uz lijevu ivicu.
 * Oboje otvaraju plejer kao poseban ekran (SavedPanel); kad se vrati na
 * stih, a muzika svira, na dnu početne viri mini plejer. Pojavi se tek kad
 * postoji bar jedan sačuvan stih.
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
  // samo svira li — otvaranje i spuštanje panela ne crtaju zaglavlje iznova
  const playing = useSavedPlayerSelect((s) => s.playing)
  // pjesma u plejeru — njen omot je etiketa ploče u džepu
  const nowId = useSavedPlayerSelect((s) => s.id)
  const nowCover = albumOf(nowId ? savedVerse()?.album : undefined)?.cover
  // stalni (useCallback) — panel i sadržaj (memo) se ne crtaju iznova zbog njih
  const onOpen = useCallback(() => setOpen(true), [])
  const onClose = useCallback(() => setOpen(false), [])
  const mounted = useMounted()
  // panel se preuzme i SLOŽI u tišini kad se ekran smiri (sklonjen ispod
  // ekrana) — prvi dodir ga samo podigne, bez čekanja i treptaja. "Smiri":
  // bar 3 s, bez tombole i uvoda i bez prsta na ekranu (lib/calm.ts) — slaganje
  // je dug posao za glavnu nit i ne smije uzeti kadar animaciji
  // (najkasnije 5 s — i kad se ekran stalno dodiruje, da prvi dodir na plejer ne čeka slaganje)
  useEffect(() => whenCalm(() => void load().then(() => setUsed(true)), 3000, undefined, 5000), [])
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
              aria-label={`Player pjesama (${count})`}
              title="Player pjesama"
              data-tip="saved"
              data-live={playing ? '' : undefined}
              className="hdr-btn gap-1.5 pl-2.5 pr-3"
            >
              {/* dok svira: trake koje titraju; inače ikonica plejera (redovi i nota) */}
              {playing ? (
                <EqBars accent="currentColor" on h={12} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3.5 6h11M3.5 10.5h11M3.5 15h6.5" />
                  <path d="M18 16.5V5.2l3 1.1" />
                  <circle cx="15.7" cy="16.8" r="2.3" fill="currentColor" stroke="none" />
                </svg>
              )}
              {/* broj pjesama — pored ikonice, ne značka u uglu */}
              <span className="tabular text-[12px] font-semibold leading-none">{count}</span>
            </button>
          </motion.span>
        )}
      </AnimatePresence>
      {/* džep uz lijevu ivicu — plejer kao poseban ekran izađe odatle */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {count > 0 && !open && (
              <Pocket
                key="pocket"
                side="left"
                kind="vinyl"
                label="Player pjesama"
                spinning={playing}
                cover={nowCover ? (thumbOf(nowCover) ?? nowCover) : undefined}
                onOpen={() => {
                  void load()
                  setUsed(true)
                  setOpen(true)
                }}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
      {/* jednom otvoren ostaje montiran — spušten viri kao mini plejer */}
      {used && <SavedPanel open={open} onOpen={onOpen} onClose={onClose} />}
    </>
  )
}
