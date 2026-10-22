/**
 * Aplikacija ugrađena u prezentaciju (`/prezentacija`).
 *
 * Prezentacija drži pravu aplikaciju u okviru telefona, na istoj adresi, pa
 * dijele i kolačiće i localStorage: srce sačuvano na jednom slajdu vidi se
 * na sljedećem, a prijava u admin važi i za okvir računara.
 *
 * Unutar nje aplikacija sluša nekoliko parametara koje inače čita samo dev
 * mod — `?uvod=`, `?verse=`, `?mood=` — da se svaki dio može
 * pokazati na komandu, bez pravog telefona. Van prezentacije ne mijenjaju
 * ništa. Okvir s drugog sajta je ionako nemoguć (`X-Frame-Options`).
 */
/**
 * Stih prezentacije — isti na slajdovima, plakatima, objavama i u telefonu
 * u prezentaciji (i na deployu i na localhostu) — telefon u prezentaciji
 * ne izvlači nasumično.
 * `?verse=` na koraku ga i dalje može zamijeniti.
 */
export const DECK_VERSE = 'koliko-mi-znacis'

/**
 * Stih uvoda u prezentaciji — kao novom korisniku: dozvola za obavijesti pa
 * papirići (`?uvod=dozvola`) i prvo otvaranje kod izloga (`?intro`). Poslije
 * (obavijest, plejer, plakati…) je opet DECK_VERSE.
 */
export const DECK_INTRO_VERSE = 'mir-svim-dobrim-ljudima'

export function inDeck(): boolean {
  if (typeof window === 'undefined' || window.self === window.top) return false
  try {
    return window.top!.location.pathname.startsWith('/prezentacija')
  } catch {
    // tuđe porijeklo ne da ni pročitati adresu
    return false
  }
}

/** Parametar iz adrese, samo kad je aplikacija u prezentaciji. */
export function deckParam(name: string): string | null {
  return inDeck() ? new URLSearchParams(window.location.search).get(name) : null
}

/** Stih telefona u prezentaciji za ovu adresu: `?verse=`, uvod, ili stih prezentacije. */
export function deckVerseId(): string {
  return deckParam('verse') ?? (deckParam('uvod') === 'dozvola' || deckParam('intro') !== null ? DECK_INTRO_VERSE : DECK_VERSE)
}
