'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { MOODS, FIGURE_SRC, type Mood } from '@/data/moods'
import type { Verse } from '@/data/verses'
import { OVERRIDE_ON, formatFullDateBs } from '@/lib/date'
import { BRAND } from '@/lib/brand'
import { toggleFavorite } from '@/lib/storage'
import { useIsFavorite } from '@/lib/client-store'
import { MoodBackground } from './MoodBackground'
import { VerseText, verseTail } from './VerseText'
import { VerseOrnament } from './VerseOrnament'
import { SongCredit } from './SongCredit'
import { NotifyToggle } from './NotifyToggle'
import { ShareButton } from './ShareSheet'
import { BrandLockup } from './BrandLockup'

/**
 * Čista prezentacija — datum i stih dolaze izvana.
 *
 * NIJEDAN element se ne montira naknadno: sve je u DOM-u od prvog frejma,
 * a pojavljuje se kroz opacity. Inače ekran poskakuje dok se sadržaj slaže.
 */
export function VerseScreen({
  verse,
  date,
  mood,
  compact = false,
}: {
  verse: Verse
  date: string
  /** override palete (dev); default je mood samog stiha */
  mood?: Mood
  compact?: boolean
}) {
  const m = MOODS[mood ?? verse.mood]
  const fav = useIsFavorite(verse.id)

  // Sve na ekranu ide po JEDNOM rasporedu izvedenom iz dužine stiha.
  // Ranije se čekalo da zadnja riječ javi da je gotova, pa se osjećao zastoj
  // između stiha i potpisa; sada nota i podnožje ulaze dok stih još sjeda.
  const tail = compact ? 0 : verseTail(verse.text)

  return (
    <div className={compact ? 'relative isolate overflow-hidden rounded-2xl' : ''}>
      <div className={compact ? 'absolute inset-0 -z-10' : ''}>
        <MoodBackgroundSlot mood={mood ?? verse.mood} compact={compact} seed={verse.id} />
      </div>

      <main
        className={
          compact
            ? 'flex min-h-[260px] flex-col justify-between p-5'
            : `relative flex min-h-[100dvh] flex-col justify-between px-6 pt-[max(2rem,env(safe-area-inset-top))] ${
                OVERRIDE_ON ? 'pb-16' : 'pb-[max(2.25rem,env(safe-area-inset-bottom))]'
              }`
        }
      >
        {/* zaglavlje — brend stoji tiho gore lijevo */}
        <header className="flex items-start justify-between">
          {compact ? (
            <p className="meta" style={{ color: m.accent }}>
              {m.label}
            </p>
          ) : (
            <BrandLockup height={42} delay={0.15} />
          )}
          {!compact && (
            <motion.div
              className="flex items-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.35, ease: 'easeOut' }}
            >
              <ShareButton verse={verse} accent={m.accent} />
              <button
                aria-label={fav ? 'Ukloni iz favorita' : 'Dodaj u favorite'}
                aria-pressed={fav}
                onClick={() => {
                  toggleFavorite(verse.id)
                  navigator.vibrate?.(12)
                }}
                className="-m-2 p-2 text-white/40 transition-transform active:scale-90"
              >
                {/* opruga na spašavanju — jedini trenutak kad aplikacija uzvrati */}
                <motion.span
                  key={String(fav)}
                  className="block"
                  initial={{ scale: fav ? 0.6 : 1 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 15 }}
                >
                  <Heart filled={fav} color={m.accent} />
                </motion.span>
              </button>
            </motion.div>
          )}
        </header>

        {/* datum → stih → nota */}
        <div
          className={
            compact
              ? 'flex flex-col items-center gap-3 py-4'
              : 'flex flex-1 flex-col items-center justify-center gap-8 py-8'
          }
        >
          {!compact && (
            <motion.p
              className="tabular text-[11px] font-semibold uppercase tracking-[0.3em]"
              style={{ color: m.accent, opacity: 0.75 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.75 }}
              transition={{ duration: 0.9, delay: 0.2, ease: 'easeOut' }}
            >
              {formatFullDateBs(date)}
            </motion.p>
          )}

          <VerseText key={verse.id} text={verse.text} color={m.text} glow={m.accent} />

          <VerseOrnament key={`o-${verse.id}`} accent={m.accent} delay={tail - 0.15} />
        </div>

        {/* podnožje — uvijek prisutno, samo se stiša */}
        <motion.footer
          key={`f-${verse.id}`}
          className="flex flex-col items-center gap-6 text-center"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: tail, ease: [0.22, 1, 0.36, 1] }}
        >
          {compact ? (
            <div>
              <p
                className="text-[0.8rem] font-semibold uppercase tracking-[0.18em]"
                style={{ color: BRAND.gold }}
              >
                {verse.song}
              </p>
              <p className="mt-1.5 text-[9px] uppercase tracking-[0.22em] text-white/28">
                {verse.album} &middot; {verse.year}
              </p>
            </div>
          ) : (
            <>
              <SongCredit verse={verse} />
              <div className="flex w-full max-w-xs flex-col items-center gap-5">
                <span
                  className="h-px w-16"
                  style={{ background: `linear-gradient(to right, transparent, ${m.accent}59, transparent)` }}
                  aria-hidden
                />
                <div className="flex items-center gap-7">
                  <Link
                    href="/favoriti"
                    className="group flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-white/28 transition-colors hover:text-white/70"
                  >
                    <Heart filled={false} color={m.accent} size={14} />
                    Favoriti
                  </Link>
                  <NotifyToggle accent={m.accent} />
                </div>
              </div>
            </>
          )}
        </motion.footer>
      </main>
    </div>
  )
}

/** U compact modu pozadina se ne smije fiksirati preko cijelog ekrana. */
function MoodBackgroundSlot({ mood, compact, seed }: { mood: Mood; compact: boolean; seed: string }) {
  const m = MOODS[mood]
  if (!compact) return <MoodBackground mood={mood} seed={seed} />
  return (
    <div
      className="relative h-full w-full"
      style={{
        background: `radial-gradient(circle at 25% 15%, ${m.gradient[2]} 0%, transparent 60%), radial-gradient(circle at 80% 80%, ${m.gradient[1]} 0%, transparent 60%), ${m.gradient[0]}`,
      }}
    >
      <div
        className="absolute inset-0 bg-no-repeat"
        style={{
          backgroundImage: `url(${FIGURE_SRC})`,
          backgroundSize: 'auto 95%',
          backgroundPosition: m.focus,
          mixBlendMode: m.blend,
          opacity: m.figure,
          maskImage: 'radial-gradient(ellipse 72% 60% at 50% 26%, black 30%, transparent 82%)',
          WebkitMaskImage: 'radial-gradient(ellipse 72% 60% at 50% 26%, black 30%, transparent 82%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${m.vignette}) 100%)`,
        }}
      />
    </div>
  )
}

function Heart({ filled, color, size = 22 }: { filled: boolean; color: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={filled ? color : 'currentColor'}
      strokeWidth="1.6"
      className={filled ? undefined : 'text-current'}
      aria-hidden
    >
      <path d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13z" strokeLinejoin="round" />
    </svg>
  )
}
