'use client'

import { motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { youtubeId } from '@/lib/text'
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
      {/* Naziv i znak su JEDAN link: hover i dodir zumiraju oboje zajedno,
          a prst pogodi bilo koji od njih. */}
      {id ? (
        <motion.a
          href={`https://www.youtube.com/watch?v=${id}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Poslušaj "${verse.song}" na YouTubeu`}
          title="Poslušaj na YouTubeu"
          className="group flex items-center gap-3 no-underline"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 460, damping: 20 }}
        >
          <span
            className="whitespace-nowrap font-semibold uppercase leading-none tracking-[0.2em]"
            style={{ color: BRAND.gold, fontSize: songSize(verse.song, Boolean(id)) }}
          >
            {verse.song}
          </span>
          <span className="relative flex h-[26px] w-[38px] items-center justify-center">
            {/* sjaj iza znaka — jača na hover */}
            <span
              className="absolute -inset-3 rounded-full opacity-50 blur-md transition-opacity duration-300 group-hover:opacity-90"
              style={{ background: `radial-gradient(circle, ${BRAND.gold}55 0%, transparent 70%)` }}
              aria-hidden
            />
              <svg width="38" height="26" viewBox="0 0 38 26" className="relative drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" aria-hidden>
                <defs>
                  <linearGradient id="yt-gold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#F1E2BF" />
                    <stop offset="0.45" stopColor={BRAND.gold} />
                    <stop offset="1" stopColor="#8A7148" />
                  </linearGradient>
                  <linearGradient id="yt-shine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
                    <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* oblik YouTube znaka: blago ispupčen pravougaonik */}
                <path
                  d="M37.2 4.1A4.8 4.8 0 0 0 33.8.7C30.8 0 19 0 19 0S7.2 0 4.2.7A4.8 4.8 0 0 0 .8 4.1C0 7.1 0 13 0 13s0 5.9.8 8.9a4.8 4.8 0 0 0 3.4 3.4C7.2 26 19 26 19 26s11.8 0 14.8-.7a4.8 4.8 0 0 0 3.4-3.4c.8-3 .8-8.9.8-8.9s0-5.9-.8-8.9z"
                  fill="url(#yt-gold)"
                />
                <path
                  d="M37.2 4.1A4.8 4.8 0 0 0 33.8.7C30.8 0 19 0 19 0S7.2 0 4.2.7A4.8 4.8 0 0 0 .8 4.1C.3 6 .1 9.2 0 11h38c-.1-1.8-.3-5-.8-6.9z"
                  fill="url(#yt-shine)"
                />
                <path d="M15.3 7.6v10.8L24.6 13z" fill="#16110A" />
              </svg>
          </span>
        </motion.a>
      ) : (
        <span
          className="whitespace-nowrap font-semibold uppercase leading-none tracking-[0.2em]"
          style={{ color: BRAND.gold, fontSize: songSize(verse.song, Boolean(id)) }}
        >
          {verse.song}
        </span>
      )}

      <p className="mt-4 text-[12px] uppercase tracking-[0.24em] text-white/55">
        {verse.album} &middot; {verse.year}
      </p>
    </div>
  )
}

/**
 * Naziv pjesme uvijek u jednom redu. Verzal Rubika s razmakom 0.2em je
 * ~0.92em po znaku; ako ne staje u širinu ekrana (minus margine i YouTube
 * znak), slova se smanje — nikad preko 1.15rem.
 */
function songSize(song: string, withIcon: boolean): string {
  const em = Math.max(song.length, 1) * 0.92 + 0.2
  const reserved = withIcon ? 110 : 60
  return `min(1.15rem, calc((100vw - ${reserved}px) / ${em.toFixed(2)}))`
}
