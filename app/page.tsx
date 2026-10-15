import { DailyVerse } from '@/components/DailyVerse'
import { dayWindow, findVerse } from '@/lib/catalog'
import { DECK_VERSE } from '@/lib/deck'
import { todayInTz } from '@/lib/date'

/**
 * Stranica se regeneriše na sat vremena (i odmah kad admin nešto promijeni)
 * i servira se s CDN-a. Nema query-ja po korisniku — 500 i 500.000
 * korisnika koštaju isto.
 *
 * Uz današnji ide i stih za par dana oko njega: aplikacija s početnog
 * ekrana zna stajati otvorena preko ponoći i mora znati sutrašnji stih bez
 * odlaska na mrežu.
 */
export const revalidate = 3600

export default async function Page() {
  const today = todayInTz()
  const [days, deck] = await Promise.all([dayWindow(today), findVerse(DECK_VERSE)])
  // stih prezentacije ide uz stranicu — telefon u prezentaciji ga ima odmah,
  // bez bljeska današnjeg stiha dok se ne dohvati
  return <DailyVerse serverDate={today} days={days} deckVerse={deck} />
}
