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
