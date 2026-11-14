'use client'

import { albumOf, thumbOf } from '@/data/albums'
import { MOODS } from '@/data/moods'
import type { Verse } from '@/data/verses'
import { haptic } from '@/lib/haptic'
import { albumLine } from '@/lib/text'
import { closeTube, restoreTube } from '@/lib/youtube'
import { Btn, Transport } from './Transport'

/**
 * Spuštena pjesma u sačuvanima (lib/youtube.ts `minimizeTube`) — tiha traka
 * iznad prikaza: omot, pjesma i album, nazad / pusti / sljedeća i zatvori.
 * Pjesma čeka (YouTube ne pušta zvuk bez videa na ekranu) — dodir je vrati
 * gore i nastavi gdje je stala.
 */
export function MiniSong({ verse }: { verse: Verse }) {
  const m = MOODS[verse.mood]
  const cover = albumOf(verse.album)?.cover
  const back = () => {
    haptic(6)
    restoreTube('saved')
  }
  return (
    <div className="flex items-center gap-1 rounded-[18px] border border-white/10 bg-white/[0.06] p-1.5 pr-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <button type="button" onClick={back} aria-label={`Vrati pjesmu "${verse.song}"`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          className="block h-10 w-10 shrink-0 rounded-[10px] bg-cover bg-center"
          style={{
            backgroundImage: `url(${cover ? (thumbOf(cover) ?? cover) : '/icons/icon-192.png?v=2'})`,
            backgroundColor: m.gradient[1],
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
          }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11.5px] font-semibold uppercase leading-tight tracking-[0.16em]" style={{ color: m.accent }}>
            {verse.song}
          </span>
          <span className="mt-1 block truncate text-[9.5px] uppercase leading-tight tracking-[0.2em] text-white/50">{albumLine(verse)}</span>
        </span>
      </button>
      {/* nazad, pusti, sljedeća — svaki vrati pjesmu gore (svira samo dok se video vidi) */}
      <Transport />
      {/* × — pjesma stane, traka ode (kao u mini plejeru iza prekidača) */}
      <Btn label="Zatvori pjesmu" onPress={closeTube} size={32} color="rgba(255,255,255,0.5)" zoom={1.3}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </Btn>
    </div>
  )
}
