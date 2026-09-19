import { DailyVerse } from '@/components/DailyVerse'
import { todayInTz } from '@/lib/date'

/**
 * Stranica se regeneriše na sat vremena i servira se s CDN-a.
 * Nema query-ja po korisniku — 500 i 500.000 korisnika koštaju isto.
 */
export const revalidate = 3600

export default function Page() {
  return <DailyVerse serverDate={todayInTz()} />
}
