/**
 * Katalog stihova — SAMO SERVER.
 *
 * Stihove uređuje admin (`/admin`), ali javni sajt i dalje NE pita bazu po
 * korisniku:
 *
 *   admin promijeni nešto → upis u bazu → revalidateTag('catalog')
 *   posjetilac            → statični HTML s CDN-a (ISR), u kojem je lista već upisana
 *
 * Baza se čita jednom po promjeni (i najviše jednom na sat), ne jednom po
 * posjeti. 10 i 100.000 posjetilaca koštaju isto.
 *
 * ── Ko dobije koji stih ────────────────────────────────────────────────
 *
 *   Ovdje se NE odlučuje. Svako izvlači svoj stih na svom uređaju
 *   (lib/draw.ts), iz liste aktivnih stihova koju stranica nosi. Katalog je
 *   samo ta lista: dodaj, uredi, arhiviraj, vrati. Nema rasporeda ni
 *   kalendara — izmjena ulazi u izvlačenje od sljedećeg dana.
 *
 * Gdje se čuva, po redu:
 *   1. Supabase (`verses` — supabase/schema.sql)
 *   2. lokalni fajl `.data/catalog.json` — samo u razvoju, dok shema nije
 *      pokrenuta, da se admin može isprobati i pokazati bez baze
 *   3. `data/verses.ts` — početna lista; samo za čitanje
 */

import { parseFont, stringifyFont } from './fonts'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { unstable_cache, revalidatePath, revalidateTag } from 'next/cache'
import { VERSES, type Verse } from '@/data/verses'
import { MOOD_KEYS, type Mood } from '@/data/moods'
import { supabase } from './supabase'

export type CatalogVerse = Verse & {
  /** arhiviran stih se više ne izvlači, ali sačuvani stihovi i linkovi ostaju */
  active: boolean
}

export type Catalog = {
  verses: CatalogVerse[]
  source: 'supabase' | 'file' | 'static'
}

const TAG = 'catalog'
const FILE = join(process.cwd(), '.data', 'catalog.json')
const DEV = process.env.NODE_ENV !== 'production'

/* ── čitanje ────────────────────────────────────────────────── */

type VerseRow = {
  id: string
  text: string
  song: string
  album: string
  year: number
  mood: string
  youtube: string | null
  /** font stiha (lib/fonts.ts); kolone nema dok se ne pokrene shema */
  font?: string | null
  sort: number
  active: boolean | null
}

function fromRow(r: VerseRow): CatalogVerse {
  return {
    id: r.id,
    text: r.text,
    song: r.song,
    album: r.album,
    year: r.year,
    mood: (MOOD_KEYS as string[]).includes(r.mood) ? (r.mood as Mood) : 'nostalgija',
    ...(r.youtube ? { youtube: r.youtube } : {}),
    ...(r.font ? { font: r.font } : {}),
    active: r.active !== false,
  }
}

/** Tabela/kolona ne postoji — shema još nije pokrenuta. To nije greška, to je stanje. */
function missing(code?: string) {
  return code === 'PGRST205' || code === '42P01' || code === '42703' || code === 'PGRST204'
}

async function readSupabase(): Promise<Catalog | null> {
  const db = supabase()
  if (!db) return null
  const read = (cols: string) => db.from('verses').select(cols).order('sort').order('id').range(0, 9999)
  let v = await read('id,text,song,album,year,mood,youtube,font,sort,active')
  // kolona `font` još nije dodana u bazu — stihovi i dalje rade, bez fonta
  if (v.error?.code === '42703') v = await read('id,text,song,album,year,mood,youtube,sort,active')
  if (v.error) {
    if (missing(v.error.code)) return null
    throw new Error(`verses: ${v.error.message}`)
  }
  // prazna tabela = admin još ništa nije upisao → početna lista
  if (!v.data?.length) return null
  return { verses: (v.data as unknown as VerseRow[]).map(fromRow), source: 'supabase' }
}

async function readFile(): Promise<Catalog | null> {
  if (!DEV) return null
  try {
    const raw = JSON.parse(await fs.readFile(FILE, 'utf8')) as Partial<Catalog>
    if (!raw.verses?.length) return null
    return { verses: raw.verses.map((v) => ({ ...v, active: v.active !== false })), source: 'file' }
  } catch {
    return null
  }
}

const STATIC: Catalog = { verses: VERSES.map((v) => ({ ...v, active: true })), source: 'static' }

/** Bez keša — za admina, koji mora vidjeti tačno stanje. */
export async function readCatalog(): Promise<Catalog> {
  try {
    return (await readSupabase()) ?? (await readFile()) ?? STATIC
  } catch (e) {
    // Baza pala → sajt i dalje radi, sa zadnjim poznatim ili početnim stihovima.
    console.error('[catalog]', (e as Error).message)
    return (await readFile()) ?? STATIC
  }
}

/**
 * Za javni sajt: keširano, osvježava se na izmjenu iz admina ili najkasnije
 * za sat. Ovo je jedini put kojim posjetilac ikad "dodirne" bazu — i to ne
 * on, nego regeneracija stranice.
 */
export const getCatalog = unstable_cache(readCatalog, ['catalog-v4'], { tags: [TAG], revalidate: 3600 })

/* ── za sajt ────────────────────────────────────────────────── */

/** Bez `active` — klijentu ne treba. */
function plain({ active: _a, ...v }: CatalogVerse): Verse {
  void _a
  return v
}

/** I arhivirani: share linkovi i sačuvani stihovi moraju i dalje raditi. */
export async function findVerse(id: string): Promise<Verse | undefined> {
  const v = (await getCatalog()).verses.find((x) => x.id === id)
  return v && plain(v)
}

export async function allVerses(): Promise<Verse[]> {
  return (await getCatalog()).verses.map(plain)
}

/**
 * Lista koju nosi glavna stranica: svi stihovi, s oznakom aktivnog. Iz
 * aktivnih uređaj izvlači; arhivirani ostaju za sačuvane i stare linkove.
 */
export async function catalogVerses(): Promise<CatalogVerse[]> {
  return (await getCatalog()).verses
}

/** Aktivni stihovi; ako su svi arhivirani, svi — izvlačenje nikad nema prazan špil. */
export function activeOf(verses: CatalogVerse[]): CatalogVerse[] {
  const a = verses.filter((v) => v.active)
  return a.length ? a : verses
}

/* ── upis (samo admin) ──────────────────────────────────────── */

export class CatalogError extends Error {}

/** Može li se uopšte pisati. U produkciji bez sheme — ne može. */
export async function writable(): Promise<'supabase' | 'file' | null> {
  const db = supabase()
  if (db) {
    const { error } = await db.from('verses').select('id', { head: true }).limit(1)
    if (!error) return 'supabase'
    if (!missing(error.code)) throw new CatalogError(error.message)
  }
  return DEV ? 'file' : null
}

export type Draft = Omit<Catalog, 'source'>

async function save(next: Draft, target: 'supabase' | 'file') {
  if (target === 'file') {
    await fs.mkdir(join(process.cwd(), '.data'), { recursive: true })
    await fs.writeFile(FILE, JSON.stringify(next, null, 2))
    return
  }
  const db = supabase()!
  // Stihovi se nikad ne brišu iz baze — arhiviraju se, da sačuvani stihovi
  // i stari linkovi ne ostanu bez teksta.
  const rows = next.verses.map((v, i) => ({
    id: v.id,
    text: v.text,
    song: v.song,
    album: v.album,
    year: v.year,
    mood: v.mood,
    youtube: v.youtube ?? null,
    // font samo kad ga neki stih ima — tako upis radi i bez kolone u bazi
    ...(next.verses.some((x) => x.font) ? { font: v.font ?? null } : {}),
    sort: i,
    active: v.active,
    updated_at: new Date().toISOString(),
  }))
  const up = await db.from('verses').upsert(rows)
  if (up.error && missing(up.error.code)) {
    throw new CatalogError(
      'Font se ne može sačuvati — u Supabase SQL Editoru pokreni: alter table verses add column if not exists font text;',
    )
  }
  if (up.error) throw new CatalogError(up.error.message)
}

/**
 * Svaka izmjena prolazi ovuda: pročita tačno stanje, primijeni izmjenu,
 * upiše i javi sajtu da se osvježi.
 *
 * Današnji stih se izmjenom ne mijenja nikome — uređaj ga je već izvukao i
 * zapamtio. Nova lista ulazi u izvlačenje od sljedećeg dana.
 */
export async function mutateCatalog(fn: (cat: Draft) => void): Promise<Catalog> {
  const target = await writable()
  if (!target) {
    throw new CatalogError('Baza nije postavljena — pokreni supabase/schema.sql u Supabase SQL Editoru.')
  }
  const cur = await readCatalog()
  const next: Draft = { verses: cur.verses.map((v) => ({ ...v })) }

  fn(next)

  await save(next, target)

  // `expire: 0`: admin mora odmah vidjeti izmjenu na sajtu, ne nakon
  // jednog zastarjelog prikaza.
  revalidateTag(TAG, { expire: 0 })
  revalidatePath('/')
  revalidatePath('/sacuvano')
  revalidatePath('/api/verses')
  revalidatePath('/stih/[id]', 'page')

  return { ...next, source: target }
}

/* ── validacija stiha iz admina ─────────────────────────────── */

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 5)
    .join('-')
}

export function validateVerse(input: Partial<Verse>): { verse?: Omit<Verse, 'id'>; error?: string } {
  const text = String(input.text ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
  const song = String(input.song ?? '').trim()
  const album = String(input.album ?? '').trim()
  const year = Number(input.year)
  const mood = String(input.mood ?? '')
  const youtube = String(input.youtube ?? '').trim()
  // font: provjeren i sređen zapis (lib/fonts.ts); nepoznato se odbaci
  const font = String(input.font ?? '').trim().slice(0, 300)
  const cleanFont = font ? stringifyFont(parseFont(font)) : undefined

  if (!text) return { error: 'Stih je prazan.' }
  if (text.split('\n').length > 3) return { error: 'Najviše 3 reda.' }
  if (text.length > 110) return { error: 'Stih je predug (najviše ~110 znakova).' }
  if (!song) return { error: 'Nedostaje naziv pjesme.' }
  if (!album) return { error: 'Nedostaje album.' }
  if (!Number.isInteger(year) || year < 1970 || year > 2100) return { error: 'Godina nije ispravna.' }
  if (!(MOOD_KEYS as string[]).includes(mood)) return { error: 'Nepoznato raspoloženje.' }
  if (youtube && !/^(https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/|[\w-]{11}$)/.test(youtube)) {
    return { error: 'YouTube link nije ispravan.' }
  }
  return {
    verse: { text, song, album, year, mood: mood as Mood, ...(youtube ? { youtube } : {}), ...(cleanFont ? { font: cleanFont } : {}) },
  }
}
