/**
 * Vizuelni identitet preuzet sa dinomerlin.com:
 *   crna pozadina · Rubik · šampanj zlatna #BFA87F
 *
 * Mood palete (data/moods.ts) boje sam stih; brand boje drže "hrom" —
 * wordmark, datum, dugmad, chrome oko sadržaja.
 */
export const BRAND = {
  name: 'Dino Merlin',
  app: 'Stih dana',
  black: '#000000',
  gold: '#BFA87F',
  grayLight: '#F4F4F4',
  gray: '#878787',
  grayDark: '#484848',
} as const

/** Znak Magaze (public/brand/magaza.svg?v=2) — samo riječ s potezom, bez "Sarajevo": širina / visina. */
export const MAGAZA_RATIO = 316 / 67

/**
 * Potpis | Magaza, jedno do drugog: Magaza je ovoliki dio visine potpisa
 * (potpis je u dva reda, pa je viši) — isti odnos svugdje.
 */
export const MAGAZA_BESIDE = 0.48
/**
 * …i spuštena za ovoliki dio svoje visine: slova "magaza" su u gornjih ~72 %
 * znaka (ispod je potez), pa bi po sredini stajala iznad optičkog centra potpisa.
 */
export const MAGAZA_DROP = 0.2
/** Spuštanje kao CSS — postotak je od visine samog znaka. */
export const MAGAZA_DROP_CSS = `translateY(${MAGAZA_DROP * 100}%)`
