import { Deck } from '@/components/deck/Deck'
import { deckData } from './data'

/**
 * Prezentacija za Magazu — na istoj adresi kao aplikacija, da telefon i
 * računar na slajdovima mogu nositi PRAVU aplikaciju (iframe na istom sajtu).
 *
 * Tastatura: ← → (i daljinski), O pregled, F cijeli ekran, R učitaj ponovo.
 * Link na slajd: /prezentacija#atmosfera
 */
export const revalidate = 3600

export default async function PrezentacijaPage() {
  return <Deck data={await deckData()} />
}
