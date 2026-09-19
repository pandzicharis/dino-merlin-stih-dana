import { notFound } from 'next/navigation'
import { MOODS, MOOD_KEYS } from '@/data/moods'
import { VERSES } from '@/data/verses'
import { VerseScreen } from '@/components/VerseScreen'
import { OVERRIDE_ON, todayInTz } from '@/lib/date'

/** Svih 7 paleta na jednom ekranu — odmah vidiš ako neka ispada iz sistema. */
export default function MoodsPage() {
  if (!OVERRIDE_ON) notFound()
  const date = todayInTz()

  return (
    <div className="min-h-dvh bg-black p-6">
      <h1 className="meta mb-6 text-white/50">
        Moodovi &middot; {MOOD_KEYS.length} paleta &middot; {VERSES.length} stihova
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOOD_KEYS.map((mood) => {
          const verse = VERSES.find((v) => v.mood === mood) ?? VERSES[0]
          return (
            <div key={mood}>
              <VerseScreen verse={verse} date={date} mood={mood} compact />
              <p className="mt-2 px-1 font-mono text-[11px] text-white/35">
                {mood} &middot; {verse.id} &middot;{' '}
                <a className="underline" href={`/?mood=${mood}`}>
                  otvori
                </a>
              </p>
            </div>
          )
        })}
      </div>
      <p className="mt-8 font-mono text-[11px] text-white/30">
        Boje: {MOOD_KEYS.map((m) => `${m}=${MOODS[m].accent}`).join('  ')}
      </p>
    </div>
  )
}
