import { DailyVerse } from '@/components/DailyVerse'
import { dayWindow } from '@/lib/catalog'
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
  return <DailyVerse serverDate={today} days={await dayWindow(today)} />
}
