'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { OPEN_SAVED, autoplaySaved } from '@/lib/player'
import { whenCalm } from '@/lib/calm'

/** Panel se učita tek kad zatreba — kao i panel za dijeljenje. */
const load = () => import('./SavedPanel')
const SavedPanel = dynamic(load, { ssr: false })

/**
 * Plejer pjesama (sačuvani stihovi) kao poseban ekran (SavedPanel). Otvara
 * ga gramofon ispod stiha (povuci ga gore ili dodirni naziv pjesme —
 * components/SongCredit.tsx → openSaved): ploča naraste u plejer. Kad se
 * vrati na stih, a muzika svira, na dnu početne viri mini plejer.
 */
export function SavedLink() {
  const [open, setOpen] = useState(false)
  // jednom otvoren panel ostaje montiran, da zatvaranje ima svoju animaciju
  const [used, setUsed] = useState(false)
  // stalni (useCallback) — panel i sadržaj (memo) se ne crtaju iznova zbog njih
  const onOpen = useCallback(() => setOpen(true), [])
  const onClose = useCallback(() => setOpen(false), [])
  // panel se preuzme i SLOŽI u tišini kad se ekran smiri (sklonjen ispod
  // ekrana) — prvi dodir ga samo podigne, bez čekanja i treptaja. "Smiri":
  // bar 3 s, bez tombole i uvoda i bez prsta na ekranu (lib/calm.ts) — slaganje
  // je dug posao za glavnu nit i ne smije uzeti kadar animaciji
  // (najkasnije 5 s — i kad se ekran stalno dodiruje, da prvi dodir na plejer ne čeka slaganje)
  useEffect(() => whenCalm(() => void load().then(() => setUsed(true)), 3000, undefined, 5000), [])
  // gramofon (ili pilula sačuvanih) otvara plejer — i pjesma krene, iz istog dodira (iPhone)
  useEffect(() => {
    const show = () => {
      setUsed(true)
      setOpen(true)
      autoplaySaved()
    }
    window.addEventListener(OPEN_SAVED, show)
    return () => window.removeEventListener(OPEN_SAVED, show)
  }, [])

  return used ? <SavedPanel open={open} onOpen={onOpen} onClose={onClose} /> : null
}
