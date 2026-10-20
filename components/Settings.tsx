'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { haptic } from '@/lib/haptic'

/** Panel se učita tek kad prst dotakne zupčanik — kao i ostali paneli. */
const load = () => import('./SettingsPanel')
const SettingsPanel = dynamic(load, { ssr: false })

/** Postavke — zupčanik u zaglavlju, pored sačuvanih. Otvara donji panel. */
export function SettingsButton() {
  const [open, setOpen] = useState(false)
  // jednom otvoren panel ostaje montiran, da zatvaranje ima svoju animaciju
  const [used, setUsed] = useState(false)
  // panel se preuzme u tišini kad se ekran smiri — prvi dodir ga otvara odmah
  useEffect(() => {
    const t = setTimeout(load, 3500)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <button
        onPointerEnter={load}
        onTouchStart={load}
        onClick={() => {
          haptic(8)
          setUsed(true)
          setOpen(true)
        }}
        aria-label="Postavke"
        title="Postavke"
        // stari savjet za obavijesti (i prezentacija) traži ovaj znak — prekidač je sad ovdje
        data-tip="notify"
        className="hdr-btn w-[34px]"
      >
        <GearIcon size={16} />
      </button>
      {used && <SettingsPanel open={open} onClose={() => setOpen(false)} />}
    </>
  )
}

export function GearIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
