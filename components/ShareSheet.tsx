'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { haptic } from '@/lib/haptic'

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
export function ShareButton({
  verse,
  accent,
  date,
  pill = false,
}: {
  verse: Verse
  accent: string
  date: string
  /** dugme s natpisom pored "Sačuvaj" (radnje stiha); inače gola ikona */
  pill?: boolean
}) {
  const [open, setOpen] = useState(false)
  // jednom otvoren panel ostaje montiran, da zatvaranje ima svoju animaciju
  const [used, setUsed] = useState(false)
  // panel se preuzme u tišini kad se ekran smiri, a slika se nacrta unaprijed
  // za Story (panel se uvijek otvara na njemu) — prvi dodir je otvara odmah
  useEffect(() => {
    let idle = 0
    const t = setTimeout(() => {
      load()
      const warm = () =>
        import('@/lib/share-image').then(({ warmShareImage }) => warmShareImage({ verse, date, format: 'story' }))
      idle = window.requestIdleCallback?.(warm, { timeout: 2000 }) ?? window.setTimeout(warm, 0)
    }, 3000)
    return () => {
      clearTimeout(t)
      if (idle) (window.cancelIdleCallback ?? clearTimeout)(idle)
    }
  }, [verse, date])

  return (
    <>
      {pill ? (
        // isti oblik kao "Sačuvaj" (FavoriteButton) — dvije radnje stiha jedna do druge
        <motion.button
          onPointerEnter={load}
          onTouchStart={load}
          onClick={() => {
            haptic(8)
            setUsed(true)
            setOpen(true)
          }}
          aria-label="Podijeli stih"
          data-tip="share"
          className="flex h-11 items-center justify-center gap-2 rounded-full border px-5 text-[10px] font-medium uppercase tracking-[0.22em] backdrop-blur-sm transition-colors duration-300"
          style={{
            color: open ? accent : 'rgba(255,255,255,0.75)',
            borderColor: open ? `${accent}66` : 'rgba(255,255,255,0.14)',
            background: open ? `${accent}14` : 'rgba(255,255,255,0.03)',
          }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 460, damping: 20 }}
        >
          <ShareIcon size={14} />
          Podijeli
        </motion.button>
      ) : (
        <button
          onPointerEnter={load}
          onTouchStart={load}
          onClick={() => {
            haptic(8)
            setUsed(true)
            setOpen(true)
          }}
          aria-label="Podijeli stih"
          data-tip="share"
          className="-m-[10.5px] p-[10.5px] text-white/60 transition-all hover:text-white/85 active:scale-90"
          style={open ? { color: accent } : undefined}
        >
          <ShareIcon />
        </button>
      )}
      {used && <SharePanel open={open} onClose={() => setOpen(false)} verse={verse} date={date} />}
    </>
  )
}


function ShareIcon({ size = 23 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size < 20 ? 1.8 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v13M12 3 8 7M12 3l4 4" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}
