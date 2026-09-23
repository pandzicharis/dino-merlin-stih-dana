/**
 * Stih se u `data/verses.ts` piše bez tačke na kraju — tako se lakše unosi
 * i lakše mijenja. Tačka je stvar prikaza, pa se dodaje ovdje, na jednom
 * mjestu, da ekran, share slika i notifikacija završe isto.
 *
 * Stih koji već nosi svoj znak (upitnik, uzvičnik, trotačka) ostaje netaknut.
 */
export function withPeriod(text: string): string {
  const t = text.trimEnd()
  return /[.!?…]$/.test(t) ? t : `${t}.`
}

/** Stih u jednom redu — za notifikaciju, gdje prelom ne postoji. */
export function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ')
}
