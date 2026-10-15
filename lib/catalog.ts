/**
 * Katalog stihova i raspored — SAMO SERVER.
 *
 * Stihove uređuje admin (`/admin`), ali javni sajt i dalje NE pita bazu po
 * korisniku:
 *
 *   admin promijeni nešto → upis u bazu → revalidateTag('catalog')
 *   posjetilac            → statični HTML s CDN-a (ISR), u kojem je stih već upisan
 *
 * Baza se čita jednom po promjeni (i najviše jednom na sat), ne jednom po
 * posjeti. 10 i 100.000 posjetilaca koštaju isto.
 *
 * ── Kako nastaje raspored ──────────────────────────────────────────────
 *
 *   Stihovi idu REDOM KOJIM SU DODANI, u krug: prvi, drugi, … zadnji, pa
 *   opet prvi. Novi stih se doda na kraj liste, pa dolazi poslije zadnjeg.
 *
 *   prošlost i današnji dan   zapisani (pinovi), nikad se ne mijenjaju
 *   ručno postavljeni dani     admin ih zamijenio; ostali dani ostaju redom
 *   sve ostalo                 računa se iz reda: (planIndex + broj dana) % n
 *
 * Svaka izmjena "zapamti" gdje je red stao danas, pa se sutra nastavlja od
 * sljedećeg stiha — dodavanje ili arhiviranje ne preskače i ne vraća red.
 * Kalendar ide unaprijed koliko god treba, u naredne godine.
 *
 * Gdje se čuva, po redu:
 *   1. Supabase (`verses`, `verse_schedule`, `catalog_meta` — supabase/schema.sql)
 *   2. lokalni fajl `.data/catalog.json` — samo u razvoju, dok shema nije
 *      pokrenuta, da se admin može isprobati i pokazati bez baze
 *   3. `data/verses.ts` — početna lista; samo za čitanje
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { unstable_cache, revalidatePath, revalidateTag } from 'next/cache'
import { VERSES, type Verse } from '@/data/verses'
import { MOOD_KEYS, type Mood } from '@/data/moods'
import { EPOCH, addDays, daysSinceEpoch, todayInTz } from './date'
import { supabase } from './supabase'

export type CatalogVerse = Verse & {
  /** arhiviran stih ne ulazi u raspored, ali prošli dani i linkovi ostaju */
  active: boolean
}

export type Catalog = {
  verses: CatalogVerse[]
  /** zaključani i ručno postavljeni dani: 'YYYY-MM-DD' → id stiha */
  pins: Record<string, string>
  /** dani koje je admin sam postavio (za oznaku u kalendaru) */
  manual: string[]
  /** od ovog dana red se računa; prije njega su pinovi */
  planStart: string | null
  /** koji (aktivni) stih po redu ide na `planStart` */
  planIndex: number
  source: 'supabase' | 'file' | 'static'
}


/** Isti stih ranije od ovoga je upozorenje u adminu. */
export const REPEAT_WARN = 14
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
  const [v, s, m] = await Promise.all([
    db.from('verses').select('id,text,song,album,year,mood,youtube,sort,active').order('sort').order('id').range(0, 9999),
    db.from('verse_schedule').select('day,verse_id,manual').range(0, 19999),
    db.from('catalog_meta').select('key,value').in('key', ['plan_start', 'plan_index']),
  ])
  if (v.error) {
    if (missing(v.error.code)) return null
    throw new Error(`verses: ${v.error.message}`)
  }
  if (s.error && !missing(s.error.code)) throw new Error(`verse_schedule: ${s.error.message}`)
  // prazna tabela = admin još ništa nije upisao → početna lista
  if (!v.data?.length) return null
  return {
    verses: (v.data as VerseRow[]).map(fromRow),
    pins: Object.fromEntries((s.data ?? []).map((r) => [r.day as string, r.verse_id as string])),
    manual: (s.data ?? []).filter((r) => r.manual).map((r) => r.day as string),
    planStart: (m.data?.find((r) => r.key === 'plan_start')?.value as string | undefined) ?? null,
    planIndex: Number(m.data?.find((r) => r.key === 'plan_index')?.value ?? 0) || 0,
    source: 'supabase',
  }
}

async function readFile(): Promise<Catalog | null> {
  if (!DEV) return null
  try {
    const raw = JSON.parse(await fs.readFile(FILE, 'utf8')) as Partial<Catalog>
    if (!raw.verses?.length) return null
    return {
      verses: raw.verses.map((v) => ({ ...v, active: v.active !== false })),
      pins: raw.pins ?? {},
      manual: raw.manual ?? [],
      planStart: raw.planStart ?? null,
      planIndex: raw.planIndex ?? 0,
      source: 'file',
    }
  } catch {
    return null
  }
}

const STATIC: Catalog = {
  verses: VERSES.map((v) => ({ ...v, active: true })),
  pins: {},
  manual: [],
  planStart: null,
  planIndex: 0,
  source: 'static',
}

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
export const getCatalog = unstable_cache(readCatalog, ['catalog-v3'], { tags: [TAG], revalidate: 3600 })

/* ── raspored ───────────────────────────────────────────────── */

function activeOf(cat: Pick<Catalog, 'verses'>) {
  const a = cat.verses.filter((v) => v.active)
  return a.length ? a : cat.verses
}

/** Koji stih je po REDU na dati dan, bez obzira na ručne izmjene. */
export function sequenceId(date: string, cat: Pick<Catalog, 'verses' | 'planStart' | 'planIndex'>): string {
  const list = activeOf(cat)
  const start = cat.planStart ?? EPOCH
  const n = list.length
  // `|| 0`: katalog iz starijeg keša nema planIndex
  const i = ((((cat.planIndex || 0) + daysSinceEpoch(date) - daysSinceEpoch(start)) % n) + n) % n
  return list[i].id
}

export function resolveId(date: string, cat: Catalog): string {
  const pinned = cat.pins[date]
  if (pinned && cat.verses.some((v) => v.id === pinned)) return pinned
  return sequenceId(date, cat)
}

export function resolveDay(date: string, cat: Catalog): Verse {
  const id = resolveId(date, cat)
  return cat.verses.find((v) => v.id === id) ?? cat.verses[0]
}

/** Bez `active` — klijentu ne treba. */
function plain({ active: _a, ...v }: CatalogVerse): Verse {
  void _a
  return v
}

export async function verseForDay(date: string): Promise<Verse> {
  return plain(resolveDay(date, await getCatalog()) as CatalogVerse)
}

/**
 * Bez keša — za slanje obavijesti. Keš poslije izmjene jednom servira staro
 * stanje dok se osvježava; sajtu to ne smeta, ali obavijest ide svima
 * odjednom i mora nositi baš ono što je u adminu. Jedno čitanje baze dnevno.
 */
export async function verseForDayFresh(date: string): Promise<Verse> {
  return plain(resolveDay(date, await readCatalog()) as CatalogVerse)
}

/** I arhivirani: share linkovi i sačuvani stihovi moraju i dalje raditi. */
export async function findVerse(id: string): Promise<Verse | undefined> {
  const v = (await getCatalog()).verses.find((x) => x.id === id)
  return v && plain(v)
}

export async function allVerses(): Promise<Verse[]> {
  return (await getCatalog()).verses.map(plain)
}

/** Stihovi za nekoliko dana oko danas — ugrađuju se u stranicu. */
export async function dayWindow(today: string, from = -1, to = 3): Promise<Record<string, Verse>> {
  const cat = await getCatalog()
  const out: Record<string, Verse> = {}
  for (let i = from; i <= to; i++) {
    const d = addDays(today, i)
    out[d] = plain(resolveDay(d, cat) as CatalogVerse)
  }
  return out
}

/** Prvi dan od `from` na koji dolazi stih (gleda do godinu i po unaprijed). */
export function nextDate(id: string, cat: Catalog, from: string): string | null {
  for (let i = 0; i < 550; i++) {
    const d = addDays(from, i)
    if (resolveId(d, cat) === id) return d
  }
  return null
}

/** Koliko dana je prošlo od istog stiha, ako je to manje od REPEAT_WARN. */
export function nearGap(date: string, cat: Catalog): number | null {
  const id = resolveId(date, cat)
  for (let k = 1; k < REPEAT_WARN; k++) {
    const d = addDays(date, -k)
    if (d < EPOCH) break
    if (resolveId(d, cat) === id) return k
  }
  return null
}

/* ── upis (samo admin) ──────────────────────────────────────── */

export class CatalogError extends Error {}

/** Može li se uopšte pisati. U produkciji bez sheme — ne može. */
export async function writable(): Promise<'supabase' | 'file' | null> {
  const db = supabase()
  if (db) {
    const { error } = await db.from('catalog_meta').select('key', { head: true }).limit(1)
    if (!error) return 'supabase'
    if (!missing(error.code)) throw new CatalogError(error.message)
  }
  return DEV ? 'file' : null
}

export type Draft = Omit<Catalog, 'source'>

async function save(next: Draft, prev: Catalog, target: 'supabase' | 'file') {
  if (target === 'file') {
    await fs.mkdir(join(process.cwd(), '.data'), { recursive: true })
    await fs.writeFile(FILE, JSON.stringify(next, null, 2))
    return
  }
  const db = supabase()!
  // Stihovi se nikad ne brišu iz baze — arhiviraju se, da prošli dani i
  // stari linkovi ne ostanu bez teksta.
  const rows = next.verses.map((v, i) => ({
    id: v.id,
    text: v.text,
    song: v.song,
    album: v.album,
    year: v.year,
    mood: v.mood,
    youtube: v.youtube ?? null,
    sort: i,
    active: v.active,
    updated_at: new Date().toISOString(),
  }))
  const up = await db.from('verses').upsert(rows)
  if (up.error) throw new CatalogError(up.error.message)

  const gone = Object.keys(prev.pins).filter((d) => !(d in next.pins))
  if (gone.length) {
    const del = await db.from('verse_schedule').delete().in('day', gone)
    if (del.error) throw new CatalogError(del.error.message)
  }
  const wasManual = new Set(prev.manual)
  const isManual = new Set(next.manual)
  const pins = Object.entries(next.pins)
    .filter(([d, id]) => prev.pins[d] !== id || wasManual.has(d) !== isManual.has(d))
    .map(([day, verse_id]) => ({ day, verse_id, manual: isManual.has(day) }))
  for (let i = 0; i < pins.length; i += 500) {
    const ins = await db.from('verse_schedule').upsert(pins.slice(i, i + 500))
    if (ins.error) throw new CatalogError(ins.error.message)
  }
  if (next.planStart !== prev.planStart || next.planIndex !== prev.planIndex) {
    const meta = await db.from('catalog_meta').upsert([
      { key: 'plan_start', value: next.planStart },
      { key: 'plan_index', value: String(next.planIndex) },
    ])
    if (meta.error) throw new CatalogError(meta.error.message)
  }
}

/**
 * Svaka izmjena prolazi ovuda:
 *   1. pročita tačno stanje
 *   2. ZAKLJUČA sve do kraja najavljene sedmice onako kako sad izgleda —
 *      ono što je najavljeno (i ono što je bilo) ne smije se promijeniti
 *   3. pomjeri početak plana iza te sedmice; sve dalje se preračuna samo
 *   4. primijeni izmjenu, upiše, i javi sajtu da se osvježi
 */
export async function mutateCatalog(fn: (cat: Draft, today: string) => void): Promise<Catalog> {
  const target = await writable()
  if (!target) {
    throw new CatalogError('Baza nije postavljena — pokreni supabase/schema.sql u Supabase SQL Editoru.')
  }
  const cur = await readCatalog()
  const next: Draft = {
    verses: cur.verses.map((v) => ({ ...v })),
    pins: { ...cur.pins },
    manual: [...cur.manual],
    planStart: cur.planStart,
    planIndex: cur.planIndex,
  }

  // Prošlost i današnji dan se zapišu onako kako su bili — izmjena nikad ne
  // mijenja ono što je već objavljeno.
  const today = todayInTz()
  for (let d = cur.planStart ?? EPOCH; d <= today; d = addDays(d, 1)) {
    if (!next.pins[d]) next.pins[d] = resolveId(d, cur)
  }
  // gdje je red danas stao (bez ručnih izmjena) — sutra ide sljedeći
  const anchor = sequenceId(today, cur)

  fn(next, today)

  // Sutra se nastavlja od prvog aktivnog stiha POSLIJE današnjeg, u novom
  // redu. Novi stih je na kraju liste, pa dolazi poslije zadnjeg.
  const all = next.verses
  const active = activeOf(next)
  const p = all.findIndex((v) => v.id === anchor)
  let follow = active[0]
  if (p >= 0) {
    for (let k = 1; k <= all.length; k++) {
      const v = all[(p + k) % all.length]
      if (v.active) {
        follow = v
        break
      }
    }
  }
  next.planStart = addDays(today, 1)
  next.planIndex = Math.max(0, active.findIndex((v) => v.id === follow.id))

  // ručna oznaka ima smisla samo dok dan postoji u rasporedu
  next.manual = [...new Set(next.manual)].filter((d) => d in next.pins)

  await save(next, cur, target)

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
  return { verse: { text, song, album, year, mood: mood as Mood, ...(youtube ? { youtube } : {}) } }
}
