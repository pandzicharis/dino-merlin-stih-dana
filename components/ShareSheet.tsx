'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Verse } from '@/data/verses'

/**
 * Panel, pregled i crtanje slike (~15 KB) ne idu uz prvo učitavanje — stih
 * se mora pojaviti odmah, a dijeli ga manjina. Kod se povuče kad prst
 * dotakne dugme (ili miš pređe preko), pa je do klika već tu.
 */
const load = () => import('./SharePanel')
const SharePanel = dynamic(load, { ssr: false })

/**
 * Dijeljenje stiha kao slike — za Story, objavu ili kvadrat.
 *
 * Slika se crta u pregledniku (`lib/share-image.ts`) istim fontovima i
 * paletom kao ekran, pa je pregled trenutan i ono što vidiš je tačno ono
 * što odlazi. Svaki share je reklama u publici koja već voli Merlina —
 * zato ovo mora izgledati kao poster, ne kao screenshot.
 */
export function ShareButton({ verse, accent, date }: { verse: Verse; accent: string; date: string }) {
  const [open, setOpen] = useState(false)
  // jednom otvoren panel ostaje montiran, da zatvaranje ima svoju animaciju
  const [used, setUsed] = useState(false)
  // panel se preuzme u tišini kad se ekran smiri — prvi dodir ga otvara odmah
  useEffect(() => {
    const t = setTimeout(load, 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <button
        onPointerEnter={load}
        onTouchStart={load}
        onClick={() => {
          navigator.vibrate?.(8)
          setUsed(true)
          setOpen(true)
        }}
        aria-label="Podijeli stih"
        data-tip="share"
        className="-m-2 p-2 text-white/40 transition-all hover:text-white/70 active:scale-90"
        style={open ? { color: accent } : undefined}
      >
        <ShareIcon />
      </button>
      {used && <SharePanel open={open} onClose={() => setOpen(false)} verse={verse} date={date} />}
    </>
  )
}


function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v13M12 3 8 7M12 3l4 4" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}
