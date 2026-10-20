import { DailyVerse } from '@/components/DailyVerse'
import { catalogVerses, findVerse } from '@/lib/catalog'
import { DECK_VERSE } from '@/lib/deck'
import { verseDayInTz } from '@/lib/date'

/**
 * Stranica se regeneriše na sat vremena (i odmah kad admin nešto promijeni)
 * i servira se s CDN-a. Nema query-ja po korisniku — 500 i 500.000
 * korisnika koštaju isto.
 *
 * Stranica je ista za sve, a ipak svako dobije svoj stih: nosi listu, a
 * stih izvlači uređaj (lib/draw.ts). Lista je ovdje, a ne na posebnom
 * zahtjevu — stih se izvuče i bez mreže, i odmah.
 */
export const revalidate = 3600

export default async function Page() {
  const [verses, deck] = await Promise.all([catalogVerses(), findVerse(DECK_VERSE)])
  // stih prezentacije ide uz stranicu — telefon u prezentaciji ga ima odmah,
  // bez bljeska drugog stiha dok se ne dohvati
  return <DailyVerse serverDate={verseDayInTz()} verses={verses} deckVerse={deck} />
}
