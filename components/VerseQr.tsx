'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
import { haptic } from '@/lib/haptic'
import { ROUND } from './DrawerIcon'
import { QrIcon } from './tube/icons'

/** Ladica i biblioteka za QR se učitaju tek kad prst dotakne dugme — kao i ostali paneli. */
const load = () => import('./VerseQrPanel')
const VerseQrPanel = dynamic(load, { ssr: false })
const warmQr = () => import('@/lib/qr')
const warm = () => {
  load()
  warmQr()
}

/**
 * QR kod stiha na početnoj — gore desno, nasuprot potpisu i Magazi. Zlatni
 * krug kao znak u zaglavlju ladica (DrawerIcon): odmah se vidi da je poseban.
 * Otvori ladicu s QR kodom (VerseQrPanel), istu kao „Link i QR“ u dijeljenju.
 */
export function QrButton({ verse }: { verse: Verse }) {
  const [open, setOpen] = useState(false)
  // jednom otvorena ladica ostaje montirana, da zatvaranje ima svoju animaciju
  const [used, setUsed] = useState(false)
  return (
    <>
      <button
        type="button"
        onPointerEnter={warm}
        onTouchStart={warm}
        onClick={() => {
          haptic(8)
          setUsed(true)
          setOpen(true)
        }}
        aria-label="QR kod stiha"
        title="QR kod stiha"
        className="flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-sm transition-[transform,border-color,background-color] duration-200 hover:border-[var(--gold)] active:scale-[0.92] wide:h-[34px] wide:w-[34px]"
        style={
          {
            '--gold': `${BRAND.gold}cc`,
            color: BRAND.gold,
            borderColor: `${BRAND.gold}73`,
            background: `radial-gradient(circle at 50% 38%, ${BRAND.gold}38 0%, ${BRAND.gold}12 55%, rgba(255,255,255,0.03) 80%)`,
            boxShadow: `0 8px 22px rgba(0,0,0,0.35), 0 0 18px ${BRAND.gold}1f`,
          } as React.CSSProperties
        }
      >
        <QrIcon size={18} className="wide:h-4 wide:w-4" />
      </button>
      {used && <VerseQrPanel open={open} onClose={() => setOpen(false)} verse={verse} />}
    </>
  )
}

/** U zaglavlju ladice s pjesmom: QR kod stiha umjesto svega ispod videa — dodir opet vraća pjesmu. */
export function QrToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onPointerEnter={warmQr}
      onTouchStart={warmQr}
      onClick={onClick}
      aria-label="QR kod stiha"
      aria-pressed={on}
      title="QR kod stiha"
      className={ROUND}
      style={on ? { color: BRAND.gold, borderColor: `${BRAND.gold}99`, background: `${BRAND.gold}24` } : undefined}
    >
      <QrIcon size={17} />
    </button>
  )
}
