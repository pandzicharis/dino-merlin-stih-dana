/**
 * Albumi Dine Merlina — zakucana lista. Stih nosi naziv albuma (`verse.album`),
 * a `albumOf` ga veže za pravi album: id, godinu i omot iz `public/albumi/hq`
 * (izoštrene verzije originala iz `public/albumi`, 1200+ px).
 * Admin bira album s ove liste, pa naziv uvijek tačno odgovara.
 */
import made from '../public/albumi/precache.json'

export type Album = {
  id: string
  title: string
  year: number
  cover: string
  /** pomak omota (dio njegove visine): + gore, − dole */
  lift?: number
  /** boja iznad omota — kad je gornji rub omota pun (npr. bijeli papir), da se nastavi do vrha */
  fill?: string
}

export const ALBUMS: Album[] = [
  { id: 'kokuzna-vremena', title: 'Kokuzna vremena', year: 1985, cover: '/albumi/hq/kokuzna-vremena.webp' },
  {
    id: 'tesko-meni-sa-tobom',
    title: 'Teško meni sa tobom',
    year: 1986,
    cover: '/albumi/hq/tesko-meni-sa-tobom.webp',
  },
  { id: 'merlin', title: 'Merlin', year: 1987, cover: '/albumi/hq/merlin.webp' },
  {
    id: 'nesto-lijepo-treba-da-se-desi',
    title: 'Nešto lijepo treba da se desi',
    year: 1989,
    cover: '/albumi/hq/nesto-lijepo-treba-da-se-desi.webp',
  },
  { id: 'peta-strana-svijeta', title: 'Peta strana svijeta', year: 1990, cover: '/albumi/hq/peta-strana-svijeta.webp' },
  { id: 'moja-bogda-sna', title: 'Moja bogda sna', year: 1993, cover: '/albumi/hq/moja-bogda-sna.webp' },
  { id: 'fotografija', title: 'Fotografija', year: 1995, cover: '/albumi/hq/fotografija.webp' },
  { id: 'sredinom', title: 'Sredinom', year: 2000, cover: '/albumi/hq/sredinom.webp' },
  { id: 'burek', title: 'Burek', year: 2004, cover: '/albumi/hq/burek.webp' },
  // bijeli papir s rukopisom — malo spušten, a iznad bijelo, kao da se papir nastavlja
  { id: 'ispocetka', title: 'Ispočetka', year: 2008, cover: '/albumi/hq/ispocetka.webp', lift: -0.05, fill: '#ffffff' },
  { id: 'hotel-nacional', title: 'Hotel Nacional', year: 2014, cover: '/albumi/hq/hotel-nacional.webp' },
  { id: 'mi', title: 'Mi', year: 2025, cover: '/albumi/hq/mi.webp' },
]

/** "Teško meni sa tobom (a još…)" → "tesko-meni-sa-tobom-a-jos…" — bez kvačica i velikih slova. */
function key(s: string): string {
  return s
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Album stiha po nazivu (ili id-u); stariji zapisi s drugačijim pisanjem se i dalje nađu. */
export function albumOf(name?: string | null): Album | undefined {
  if (!name) return undefined
  const k = key(name)
  // skraćeni naziv dužeg albuma ("Teško meni sa tobom") — samo za duge, da "Mi" ne uhvati sve
  return ALBUMS.find((a) => a.id === k || key(a.title) === k) ?? ALBUMS.find((a) => a.id.length > 8 && k.startsWith(a.id))
}

/*
 * Male i unaprijed zamućene varijante omota — `npm run brand:covers`
 * (scripts/make-covers.ts; poslije svakog novog albuma). Omot `.cover` i dalje
 * ostaje hq (oštri omot, dijeljenje, admin, prezentacija, MediaSession).
 */

/** varijante koje je skripta stvarno napravila — album bez njih ostaje na hq/CSS blur */
const MADE = new Set<string>(made)

/** Id omota iz '/albumi/hq/<id>.webp' — samo za omote s ove liste. */
function coverId(cover?: string): string | undefined {
  if (!cover || !ALBUMS.some((a) => a.cover === cover)) return undefined
  return cover.match(/^\/albumi\/hq\/([a-z0-9-]+)\.webp$/)?.[1]
}

/** Omot za sličice (46–72 px): 240 px umjesto 1200+. Nepoznat → undefined (ostaje stari). */
export function thumbOf(cover?: string): string | undefined {
  const id = coverId(cover)
  const url = id && `/albumi/sm/${id}.webp`
  return url && MADE.has(url) ? url : undefined
}

/**
 * Zamućene varijante (blur pa saturate(1.2), zapečeno). `sigma` = CSS blur
 * podijeljen s prikazanom stranicom omota (račun u scripts/make-covers.ts).
 */
export const COVER_BLURS = [
  // MoodBackground, telefon 390×844: blur(56px), omot 1.3 × 844 px
  { dir: 'blur', sigma: 56 / (844 * 1.3) },
  // MoodStill karte u panelu (390×620 em): blur(55em), omot 1.3 × 620 em
  { dir: 'blur-card', sigma: 55 / (620 * 1.3) },
] as const

/**
 * Unaprijed zamućen omot za `blur(...) saturate(1.2)` čije je zamućenje `sigma`
 * (dio prikazane stranice omota). Nema varijante unutar ±10% → undefined (ostaje CSS blur).
 */
export function blurOf(cover: string | undefined, sigma: number): string | undefined {
  const id = coverId(cover)
  const b = COVER_BLURS.find((b) => Math.abs(b.sigma / sigma - 1) < 0.1)
  const url = id && b && `/albumi/${b.dir}/${id}.webp`
  return url && MADE.has(url) ? url : undefined
}
