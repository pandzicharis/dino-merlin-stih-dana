import type { Mood } from '@/data/moods'
import { MOODS } from '@/data/moods'
import { MoodStill, Notes } from './deck/Screens'

/** karta je ekran telefona umanjen: W × H (u `em` karte) */
export const CARD_W = 390
export const CARD_H = 620
/** atmosfera se pri dnu pretopi u boju karte — na raširenoj, višoj karti nema ruba */
const STILL_MASK = 'linear-gradient(to bottom, black 80%, transparent 100%)'
/** note sa strane, ne preko stiha ni dugmadi (ni na raširenoj karti) */
const SPOTS: [number, number, number, string][] = [
  [8, 36, 26, '♫'],
  [88, 50, 18, '♪'],
  [84, 22, 16, '♩'],
]

/**
 * Atmosfera karte (omot, boje, zrno, vinjeta, note) — isto na karti u traci,
 * na raširenoj karti i na stranici /dev/karta s koje se ova slika unaprijed
 * ispeče u jednu (scripts/bake-cards.ts). Karta u traci crta tu jednu sliku,
 * ne desetak slojeva s maskama i miješanjem boja.
 */
export function CardAtmosphere({ mood, cover, art, lift }: { mood: Mood; cover?: string; art?: string; lift?: number }) {
  const m = MOODS[mood]
  return (
    // isolate: slojevi atmosfere (z-index unutra) ostaju ispod sadržaja karte
    <div className="absolute inset-x-0 top-0 isolate" style={{ height: `${CARD_H}em`, maskImage: STILL_MASK, WebkitMaskImage: STILL_MASK }}>
      <MoodStill mood={mood} w={CARD_W} h={CARD_H} cover={cover} art={art} lift={lift} />
      <Notes accent={m.accent} spots={SPOTS} />
    </div>
  )
}
