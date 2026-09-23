'use client'

import { useEffect } from 'react'
import { pickVerse, verseById } from '@/lib/pickVerse'
import { useDevParams } from '@/lib/client-store'
import { setLastSeen } from '@/lib/storage'
import { MOODS } from '@/data/moods'
import { VerseScreen } from './VerseScreen'
import { DevDateBar } from './DevDateBar'
import { Onboarding } from './Onboarding'
import { UpdatePrompt } from './UpdatePrompt'

/**
 * Rješava KOJI stih se prikazuje.
 *
 * Server proslijedi stvarni datum (ISR, revalidate 1h) pa nema treperenja
 * pri hidrataciji. Klijent onda primijeni dev override — u produkciji
 * OVERRIDE_ON je false, pa se ovdje nikad ništa ne mijenja.
 */
export function DailyVerse({ serverDate }: { serverDate: string }) {
  const { date, verseId, mood } = useDevParams(serverDate)
  const verse = (verseId ? verseById(verseId) : undefined) ?? pickVerse(date)

  useEffect(() => setLastSeen(date), [date])

  return (
    <>
      <Onboarding mood={mood ?? verse.mood} seed={verse.id} />
      <VerseScreen verse={verse} date={date} mood={mood} />
      <UpdatePrompt accent={MOODS[mood ?? verse.mood].accent} />
      <DevDateBar date={date} verseId={verse.id} mood={mood ?? verse.mood} />
    </>
  )
}
