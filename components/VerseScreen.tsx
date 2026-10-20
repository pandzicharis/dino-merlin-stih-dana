'use client'

import { useEffect } from 'react'
import { motion } from 'motion/react'
import { MOODS, FIGURE_SRC, type Mood } from '@/data/moods'
import type { Verse } from '@/data/verses'
import { OVERRIDE_ON, formatFullDateBs } from '@/lib/date'
import { BRAND, MAGAZA_BESIDE, MAGAZA_DROP_CSS } from '@/lib/brand'
import { MoodBackground } from './MoodBackground'
import { albumOf } from '@/data/albums'
import { SPLASH_ARRIVE, VerseText, verseTail } from './VerseText'
import { SongCredit } from './SongCredit'
import { NotifySync } from './Notify'
import { SettingsButton } from './Settings'
import { ShareButton } from './ShareSheet'
import { Signature } from './Signature'
import { FavoriteButton } from './FavoriteButton'
import { SavedLink } from './SavedLink'
import { MagazaLogo } from './MagazaLogo'
import { StreakLine } from './Streak'
import { useSavedPlayer } from '@/lib/player'

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
  replay = 0,
  instant = false,
  preview = false,
  streak = 0,
}: {
  verse: Verse
  date: string
  /** override palete (dev); default je mood samog stiha */
  mood?: Mood
  compact?: boolean
  /** promjena ponovo ispiše stih i podnožje — kad papirić iz splasha sleti */
  replay?: number
  /** pregled u adminu: stih je tu odmah, bez ispisa riječ po riječ */
  instant?: boolean
  /** pregled (admin, prezentacija): gramofon i za pjesmu koja još nije preuzeta */
  preview?: boolean
  /** dana zaredom (lib/storage.ts) — tiho iznad datuma, tek od drugog dana */
  streak?: number
}) {
  const m = MOODS[mood ?? verse.mood]
  // mini plejer pjesama pluta na dnu — sadržaj se podigne iznad njega. Mjesto
  // stoji dok god je pjesma u plejeru (i dok je panel otvoren), pa se početna
  // ne preslaže usred otvaranja i zatvaranja panela
  const player = useSavedPlayer()
  const peek = !compact && Boolean(player.id)

  // Sve na ekranu ide po JEDNOM rasporedu izvedenom iz dužine stiha.
  // Ranije se čekalo da zadnja riječ javi da je gotova, pa se osjećao zastoj
  // između stiha i potpisa; sada nota i podnožje ulaze dok stih još sjeda.
  // poslije splasha stih se ne ispisuje ponovo — pojavi se kad mu slova s
  // papira stignu na mjesto (pretope se), pa izgleda kao da su prenesena
  // dok sačuvani sviraju, novi stih ulazi cio, zajedno s mekanim pretapanjem
  // ekrana (DailyVerse) — bez ispisivanja koje bi kasnilo iza prelaza
  const arrive = instant ? 0 : replay > 0 ? SPLASH_ARRIVE : undefined
  // pregled (admin): dugmad i gramofon su odmah na mjestu, ne ulaze poslije stiha
  const settled = instant
  const tail = compact ? 0 : arrive != null ? arrive + 0.3 : verseTail(verse.text)

  // Statusna traka (Android, Chrome) preuzme gornju boju pozadine stiha,
  // pa se stopi s ekranom; odlaskom se vrati crna iz layouta.
  const top = m.gradient[0]
  useEffect(() => {
    if (compact) return
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) return
    const prev = meta.content
    meta.content = top
    return () => {
      meta.content = prev
    }
  }, [top, compact])

  return (
    <div className={compact ? 'relative isolate overflow-hidden rounded-2xl' : ''}>
      <div className={compact ? 'absolute inset-0 -z-10' : ''}>
        <MoodBackgroundSlot mood={mood ?? verse.mood} compact={compact} seed={verse.id} cover={albumOf(verse.album)?.cover} coverLift={albumOf(verse.album)?.lift} />
      </div>

      <main
        className={
          compact
            ? 'flex min-h-[260px] flex-col justify-between p-5'
            : `relative flex min-h-[100dvh] flex-col justify-between px-6 pt-[max(3rem,calc(var(--sat)+1.75rem))] ${
                OVERRIDE_ON ? 'dev-pad pb-12' : 'pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+0.5rem))]'
              }`
        }
      >
        {/* zaglavlje — potpis | Magaza gore lijevo, isti znak kao u prezentaciji */}
        <header className="relative z-10 flex items-center justify-between">
          {compact ? (
            <p className="meta" style={{ color: m.accent }}>
              {m.label}
            </p>
          ) : (
            // oba znaka ulaze zajedno, istim fade-om
            <motion.div
              className="flex items-center gap-3.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
            >
              <Signature height={36} wipe={false} className="opacity-90" />
              <span className="h-6 w-px bg-white/20" aria-hidden />
              <a href="https://magaza.com.ba" target="_blank" rel="noopener noreferrer" aria-label="Magaza" className="opacity-90">
                <MagazaLogo height={Math.round(36 * MAGAZA_BESIDE)} color="#FFFFFF" style={{ transform: MAGAZA_DROP_CSS }} />
              </a>
            </motion.div>
          )}
          {!compact && (
            <motion.div
              className="flex items-center gap-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.7, ease: 'easeOut' }}
            >
              {/* obavijesti rade u pozadini; prekidač je u postavkama */}
              <NotifySync />
              <SavedLink />
              <SettingsButton />
            </motion.div>
          )}
        </header>

        {/* datum → stih → nota */}
        <div
          className={
            compact
              ? 'flex flex-col items-center gap-3 py-4'
              : // malo iznad sredine — više zraka ispod stiha, prema gramofonu
                'flex flex-1 flex-col items-center justify-center gap-8 pb-[min(10vh,80px)] pt-4'
          }
        >
          {!compact && (
            // niz dana iznad datuma, tiho — tek od drugog dana; više zraka do
            // stiha (i ispod njega), da stih dođe do izražaja
            <div className="flex flex-col items-center gap-3">
              {streak > 1 && <StreakLine n={streak} accent={m.accent} />}
              <motion.p
                data-tip="mine"
                className="tabular whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.2em]"
                // čitljiv na svakoj pozadini (i preko svijetlog dijela omota): puna boja + tamni oreol
                style={{ color: m.accent, textShadow: '0 1px 2px rgba(0,0,0,0.85), 0 0 14px rgba(0,0,0,0.65)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.9, delay: 0.2, ease: 'easeOut' }}
              >
                {formatFullDateBs(date)}
              </motion.p>
            </div>
          )}

          <VerseText key={`${verse.id}-${replay}`} text={verse.text} color={m.text} glow={m.accent} appearAt={arrive} font={verse.font} />

          {/* odmah ispod stiha — sačuvati se želi baš ono što se upravo pročitalo */}
          {!compact && (
            <motion.div
              className="mt-5"
              key={`s-${verse.id}-${replay}`}
              initial={settled ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: Math.max(0.15, tail - 0.5), ease: [0.22, 1, 0.36, 1] }}
            >
              {/* radnje stiha: sačuvaj i podijeli, jedno do drugog */}
              <div className="flex items-center gap-2.5">
                <FavoriteButton id={verse.id} accent={m.accent} />
                <ShareButton verse={verse} accent={m.accent} date={date} pill />
              </div>
            </motion.div>
          )}
        </div>

        {/* podnožje — uvijek prisutno, samo se stiša */}
        <motion.footer
          key={`f-${verse.id}-${replay}`}
          className="flex flex-col items-center gap-6 text-center"
          initial={settled ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          // podnožje (gramofon, plejer) ne čeka da stih sjedne — ulazi dok se još ispisuje
          transition={{ duration: 0.75, delay: compact ? 0 : Math.max(0.3, tail - 0.3), ease: [0.22, 1, 0.36, 1] }}
        >
          {compact ? (
            <div>
              <p
                className="text-[0.8rem] font-semibold uppercase tracking-[0.18em]"
                style={{ color: BRAND.gold }}
              >
                {verse.song}
              </p>
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.22em] text-white/50">
                {verse.album} &middot; {verse.year}
              </p>
            </div>
          ) : (
            <>
              <SongCredit verse={verse} preview={preview} />
              {/* crtica ispod gramofona — uvijek na mjestu (ne mijenja raspored),
                  samo se pretopi: dok pluta mini plejer, nje nema */}
              <span
                className="h-px w-16 shrink-0 transition-opacity duration-500"
                style={{ background: `linear-gradient(to right, transparent, ${m.accent}59, transparent)`, opacity: peek ? 0 : 1 }}
                aria-hidden
              />
            </>
          )}
        </motion.footer>
        {/* mjesto za spušten plejer na dnu — gramofon ostane odvojen od njega */}
        {/* mini plejer ode — gramofon se mekano spusti (visina se pretapa), ne skoči */}
        {!compact && <div aria-hidden className={`peek-slot shrink-0 ${peek ? 'peek-space' : 'h-0'}`} />}
      </main>
    </div>
  )
}

/** U compact modu pozadina se ne smije fiksirati preko cijelog ekrana. */
function MoodBackgroundSlot({
  mood,
  compact,
  seed,
  cover,
  coverLift,
}: {
  mood: Mood
  compact: boolean
  seed: string
  cover?: string
  coverLift?: number
}) {
  const m = MOODS[mood]
  if (!compact) return <MoodBackground mood={mood} seed={seed} cover={cover} coverLift={coverLift} />
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
