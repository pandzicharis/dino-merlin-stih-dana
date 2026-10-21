import { MOOD_KEYS, type Mood } from '@/data/moods'
import { ALBUMS, albumOf } from '@/data/albums'
import type { Verse } from '@/data/verses'
import { getCatalog } from '@/lib/catalog'
import { DECK_VERSE } from '@/lib/deck'
import { todayInTz } from '@/lib/date'
import { qrMatrix } from '@/lib/qr'
import { PUBLIC_URL } from '@/lib/site'
import type { DeckData } from '@/components/deck/types'

/**
 * Sve što prezentaciji i plakatu treba, iz istog kataloga kao aplikacija —
 * stihovi na slajdovima su stihovi koji su stvarno u katalogu.
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
  // plakat je izlog: odabrani stih vrijedi i kad je arhiviran
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
  // jedan, uvijek isti stih kroz cijelu prezentaciju: ekran, zaključan ekran,
  // plakati, objave — i na deployu i lokalno (lib/deck.ts)
  const todayVerse = pick(DECK_VERSE, 'nostalgija')

  return {
    url: PUBLIC_URL,
    host,
    today,
    todayVerse,
    count: active.length,
    verses: pool,
    moods: MOOD_KEYS.map((mood) => ({ mood, verse: pool.find((v) => v.mood === mood) ?? pool[0] })),
    albums: ALBUMS.map((a) => ({
      album: a.title,
      verse: pool.find((v) => albumOf(v.album)?.id === a.id) ?? { ...pool[0], id: `primjer-${a.id}`, album: a.title, year: a.year },
    })),
    poster: {
      qr: qrMatrix(PUBLIC_URL),
      host,
      // isti stih na ekranu i na zaključanom ekranu
      hero: todayVerse,
      notify: todayVerse,
      date: today,
    },
  }
}
