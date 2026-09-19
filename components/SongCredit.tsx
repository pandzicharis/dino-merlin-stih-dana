'use client'

import { motion } from 'motion/react'
import { youtubeId, type Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'

/**
 * Potpis pjesme ispod stiha.
 *
 * Naziv je u zlatnoj, verzalom — jedina zlatna stvar na ekranu osim
 * zaglavlja. YouTube znak pored njega vodi na pjesmu u novoj kartici;
 * namjerno nije ugrađeni plejer, da ekran ostane stih, a ne media player.
 */
export function SongCredit({ verse }: { verse: Verse }) {
  const id = youtubeId(verse.youtube)

  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex items-center gap-3">
        <span
          className="text-[1rem] font-semibold uppercase leading-none tracking-[0.2em]"
          style={{ color: BRAND.gold }}
        >
          {verse.song}
        </span>

        {id && (
          <motion.a
            href={`https://www.youtube.com/watch?v=${id}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Poslušaj "${verse.song}" na YouTubeu`}
            title="Poslušaj na YouTubeu"
            className="group relative flex h-6 w-[34px] items-center justify-center rounded-[7px] border transition-colors duration-300"
            style={{ borderColor: `${BRAND.gold}4d` }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 460, damping: 20 }}
          >
            <span
              className="absolute inset-0 rounded-[7px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: `radial-gradient(circle, ${BRAND.gold}26 0%, transparent 72%)` }}
              aria-hidden
            />
            <svg width="9" height="10" viewBox="0 0 12 12" fill={BRAND.gold} className="relative" aria-hidden>
              <path d="M3.4 1.7v8.6a.4.4 0 0 0 .61.34l6.4-4.3a.4.4 0 0 0 0-.68l-6.4-4.3a.4.4 0 0 0-.61.34z" />
            </svg>
          </motion.a>
        )}
      </div>

      <p className="mt-4 text-[10px] uppercase tracking-[0.26em] text-white/28">
        {verse.album} &middot; {verse.year}
      </p>
    </div>
  )
}
