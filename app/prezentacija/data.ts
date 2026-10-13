import { MOOD_KEYS, type Mood } from '@/data/moods'
import type { Verse } from '@/data/verses'
import { getCatalog, verseForDay } from '@/lib/catalog'
import { todayInTz } from '@/lib/date'
import { qrMatrix } from '@/lib/qr'
import { PUBLIC_URL } from '@/lib/site'
import type { DeckData } from '@/components/deck/types'

/**
 * Sve što prezentaciji i plakatu treba, iz istog kataloga kao aplikacija —
 * stih na slajdu je stih koji je stvarno u rasporedu.
 */
export async function deckData(): Promise<DeckData> {
  const cat = await getCatalog()
  const active = cat.verses.filter((v) => v.active)
  // `active` je oznaka kataloga — klijentu ide čist stih
  const pool: Verse[] = (active.length ? active : cat.verses).map((cv) => {
    const v: Verse & { active?: boolean } = { ...cv }
    delete v.active
    return v
  })
  const today = todayInTz()
  // plakat je izlog, ne raspored: odabrani stih vrijedi i kad je arhiviran
  const pick = (id: string, mood: Mood) => {
    const any = cat.verses.find((v) => v.id === id)
    if (any) {
      const v: Verse & { active?: boolean } = { ...any }
      delete v.active
      return v
    }
    return pool.find((v) => v.mood === mood) ?? pool[0]
  }
  const host = PUBLIC_URL.replace(/^https?:\/\//, '')

  return {
    url: PUBLIC_URL,
    host,
    today,
    todayVerse: await verseForDay(today),
    count: active.length,
    moods: MOOD_KEYS.map((mood) => ({ mood, verse: pool.find((v) => v.mood === mood) ?? pool[0] })),
    poster: {
      qr: qrMatrix(PUBLIC_URL),
      host,
      // plakat visi mjesecima — stihovi koji ne stare, ne današnji
      hero: pick('zove-se-prilika', 'nada'),
      notify: pick('ruzo-moja', 'ljubav'),
      date: today,
    },
  }
}
