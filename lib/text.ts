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
/** Iz punog linka ili golog ID-a izvuci YouTube video ID. */
export function youtubeId(input?: string): string | null {
  if (!input) return null
  if (/^[\w-]{11}$/.test(input)) return input
  const m = input.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)
  return m ? m[1] : null
}

/** `Moj je život Švicarska` → `moj-je-zivot-svicarska` — ime fajla pjesme u public/audio */
export function audioSlug(song: string): string {
  return song
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ')
}

/**
 * Stih na papiriću: sve malim slovima, samo prvo slovo veliko — i kad je
 * dio stiha napisan velikim (papirići na pultu tako izgledaju).
 */
export function paperCase(text: string): string {
  const low = text.toLocaleLowerCase('bs')
  const i = low.search(/\p{L}/u)
  return i < 0 ? low : low.slice(0, i) + low.charAt(i).toLocaleUpperCase('bs') + low.slice(i + 1)
}
