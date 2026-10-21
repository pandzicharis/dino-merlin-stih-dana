/**
 * Stih se prikazuje tačno kako je upisan — tačka (ili upitnik, uzvičnik,
 * trotačka) samo ako ju je urednik napisao; aplikacija ništa ne dodaje.
 * Ovo je jedino mjesto za to, da ekran, slike i pregled linka završe isto.
 */
export function asWritten(text: string): string {
  return text.trimEnd()
}

/** Stih u jednom redu — za notifikaciju, gdje prelom ne postoji. */
/** Iz punog linka ili golog ID-a izvuci YouTube video ID. */
export function youtubeId(input?: string): string | null {
  if (!input) return null
  if (/^[\w-]{11}$/.test(input)) return input
  const m = input.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)
  return m ? m[1] : null
}

/** tekst bez velikih slova, kvačica, interpunkcije i viška razmaka */
const loose = (s = '') =>
  s.toLowerCase().replace(/đ/g, 'dj').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

type VerseKey = { text: string; song: string; album?: string; youtube?: string }

/** Isti stih: isti tekst (bez obzira na interpunkciju i kvačice) iz iste pjesme ili s istog linka. */
export function sameVerse(a: VerseKey, b: VerseKey): boolean {
  if (loose(a.text) !== loose(b.text)) return false
  const ya = youtubeId(a.youtube)
  return loose(a.song) === loose(b.song) || (ya !== null && ya === youtubeId(b.youtube))
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
/**
 * Tekst na papiriću (tombola, gomila u uvodu): kako je upisan u adminu (velika
 * i mala slova, interpunkcija), u jednom redu — redovi stiha spojeni razmakom;
 * papirić ga sam prelomi po širini.
 */
export function paperText(text: string): string {
  return asWritten(text).replace(/\s*\n\s*/g, ' ').trim()
}

export function paperCase(text: string): string {
  const low = text.toLocaleLowerCase('bs')
  const i = low.search(/\p{L}/u)
  return i < 0 ? low : low.slice(0, i) + low.charAt(i).toLocaleUpperCase('bs') + low.slice(i + 1)
}
