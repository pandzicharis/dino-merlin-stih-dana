'use client'

import { albumOf } from '@/data/albums'
import { MOODS } from '@/data/moods'
import type { Verse } from '@/data/verses'
import { oneLine, withPeriod } from '@/lib/text'
import { BRAND } from '@/lib/brand'
import { SongRow } from './SongCredit'

/**
 * Gramofon (play) u sačuvanim stihovima. Isključen: pjesma se pušta samo
 * uz današnji stih, pa je manje preuzimanja zvuka (besplatni plan).
 * `true` vraća malu ploču s iglom i trakom u svaku karticu.
 */
const SAVED_PLAYER = false

/**
 * Kartice stihova: stih gore, ispod tanke linije pjesma i album, a desno
 * u istom redu akcija (npr. ukloni iz sačuvanih).
 * Kao ekran stiha, samo tiše: omot albuma desno, rastopljen prema tekstu, pod nijansom
 * raspoloženja — a stih ostaje na tamnom i čitak.
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
      {items.map(({ verse }) => {
        const m = MOODS[verse.mood]
        const cover = albumOf(verse.album)?.cover
        return (
          <li
            key={verse.id}
            className="relative isolate overflow-hidden rounded-[22px] border border-white/10 px-5 pb-3.5 pt-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)]"
            style={{
              background: `radial-gradient(120% 150% at 100% 0%, ${m.gradient[2]}2e 0%, transparent 62%), linear-gradient(180deg, ${m.gradient[0]}cc, ${m.gradient[0]}99)`,
            }}
          >
            {/* omot i boja — samo pozadina, ispod teksta i dugmeta */}
            <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
              {cover && (
                // soft-light: bijeli papir ne postane bijela mrlja, a crn omot
                // ne nestane — svaki album ostane tiha tekstura iste jačine.
                // Utopljen na sve strane (globals.css), pa se kvadrat nigdje ne vidi.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="card-art absolute inset-y-0 right-0 h-full w-[72%] object-cover"
                  style={{ opacity: 0.5, mixBlendMode: 'soft-light' }}
                />
              )}
              {/* nijansa raspoloženja preko omota, kao na ekranu stiha */}
              <div className="absolute inset-0" style={{ backgroundColor: m.gradient[1], mixBlendMode: 'color', opacity: 0.3 }} />
              {/* tama s lijeva i odozdo, da stih i pjesma ostanu čitki */}
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.04) 100%)' }}
              />
            </div>

            {/* u jednom redu, bez prelomâ iz pjesme — lista se čita kao lista */}
            <p
              className="text-[1.08rem] leading-snug text-white/95 [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]"
              style={{ fontFamily: 'var(--font-serif), serif', fontVariationSettings: "'opsz' 48, 'SOFT' 30" }}
            >
              {oneLine(withPeriod(verse.text))}
            </p>

            <div className="mt-3 flex items-center gap-3 border-t border-white/[0.08] pt-3">
              {SAVED_PLAYER ? <SongRow verse={verse} accent={m.accent} /> : <SongMeta verse={verse} />}
              {action?.(verse)}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Pjesma u kartici, bez plejera: naziv i album · godina. */
function SongMeta({ verse }: { verse: Verse }) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11.5px] font-semibold uppercase leading-tight tracking-[0.18em]" style={{ color: BRAND.gold }}>
          {verse.song}
        </p>
        <p className="mt-1 truncate text-[10px] uppercase tracking-[0.16em] text-white/55">
          {verse.album} &middot; {verse.year}
        </p>
      </div>
    </>
  )
}
