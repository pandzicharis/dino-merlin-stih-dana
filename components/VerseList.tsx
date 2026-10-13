'use client'

import { MOODS } from '@/data/moods'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
import { oneLine, withPeriod } from '@/lib/text'

/**
 * Kartice stihova: stih gore, ispod tanke linije pjesma i album, a desno
 * u istom redu akcija (npr. ukloni iz sačuvanih). Staklo, jednobojno —
 * raspoloženje se vidi samo po maloj tački uz pjesmu.
 */
export function VerseList({
  items,
  empty,
  action,
}: {
  items: { verse: Verse }[]
  empty?: React.ReactNode
  /** dugme u podnožju kartice, npr. ukloni iz sačuvanih */
  action?: (verse: Verse) => React.ReactNode
}) {
  if (items.length === 0) return <>{empty}</>

  return (
    <ul className="flex flex-col gap-3">
      {items.map(({ verse }) => (
        <li
          key={verse.id}
          className="rounded-[22px] border border-white/10 bg-white/[0.05] px-5 pb-3.5 pt-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        >
          {/* u jednom redu, bez prelomâ iz pjesme — lista se čita kao lista */}
          <p
            className="text-[1.08rem] leading-snug text-white/95"
            style={{ fontFamily: 'var(--font-serif), serif', fontVariationSettings: "'opsz' 48, 'SOFT' 30" }}
          >
            {oneLine(withPeriod(verse.text))}
          </p>

          <div className="mt-3 flex items-center gap-3 border-t border-white/[0.07] pt-3">
            <i
              className="block h-2 w-2 shrink-0 rounded-full"
              style={{ background: MOODS[verse.mood].accent }}
              title={MOODS[verse.mood].label}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: BRAND.gold }}>
                {verse.song}
              </p>
              <p className="mt-1 truncate text-[10px] uppercase tracking-[0.16em] text-white/35">
                {verse.album} &middot; {verse.year}
              </p>
            </div>
            {action?.(verse)}
          </div>
        </li>
      ))}
    </ul>
  )
}
