/**
 * Prebaci lokalne stihove (`.data/catalog.json`, admin na localhostu) u
 * Supabase tabelu `verses` — da objavljena verzija ima iste stihove.
 *
 *   npm run catalog:push            pregled: šta bi se upisalo (ništa ne mijenja)
 *   npm run catalog:push -- --yes   upiši
 *
 * Treba SUPABASE_URL i tajni ključ — SUPABASE_SERVICE_ROLE_KEY ili
 * SUPABASE_SECRET_KEY (u .env.local ili ispred komande). Stihovi se upisuju po id-u (upsert): postojeći se ažuriraju,
 * novi dodaju, a nijedan se ne briše. Redoslijed je isti kao lokalno.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { MOOD_KEYS } from '../data/moods'
import { parseFont, stringifyFont } from '../lib/fonts'

type LocalVerse = {
  id: string
  text: string
  song: string
  album: string
  year: number
  mood: string
  youtube?: string
  font?: string
  active?: boolean
}

const write = process.argv.includes('--yes')
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

async function main() {
  const raw = JSON.parse(await readFile(join(process.cwd(), '.data', 'catalog.json'), 'utf8')) as { verses?: LocalVerse[] }
  const verses = raw.verses ?? []
  if (!verses.length) throw new Error('.data/catalog.json nema stihova.')

  const bad = verses.filter((v) => !v.id || !v.text?.trim() || !v.song || !v.album || !(MOOD_KEYS as string[]).includes(v.mood))
  if (bad.length) throw new Error(`Neispravni stihovi: ${bad.map((v) => v.id || '(bez id-a)').join(', ')}`)

  const rows = verses.map((v, i) => ({
    id: v.id,
    text: v.text,
    song: v.song,
    album: v.album,
    year: v.year,
    mood: v.mood,
    youtube: v.youtube ?? null,
    font: v.font ? (stringifyFont(parseFont(v.font)) ?? null) : null,
    sort: i,
    active: v.active !== false,
    updated_at: new Date().toISOString(),
  }))

  const active = rows.filter((r) => r.active).length
  console.log(`Lokalno: ${rows.length} stihova (${active} aktivnih, ${rows.length - active} u arhivi), ${rows.filter((r) => r.font).length} s fontom.`)
  for (const r of rows) console.log(`  ${r.active ? '•' : '◦'} ${r.id.padEnd(28)} ${r.song} — ${r.text.split('\n')[0]}`)

  if (!url || !key) throw new Error('Nedostaje SUPABASE_URL ili tajni ključ (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY).')
  const db = createClient(url, key, { auth: { persistSession: false } })

  const cur = await db.from('verses').select('id')
  if (cur.error) throw new Error(`Supabase: ${cur.error.message} — je li pokrenut supabase/schema.sql?`)
  const there = new Set((cur.data ?? []).map((r) => r.id as string))
  const added = rows.filter((r) => !there.has(r.id)).length
  console.log(`\nU bazi je sada ${there.size} stihova → ${added} novih, ${rows.length - added} ažuriranih.`)

  if (!write) {
    console.log('\nPregled — ništa nije upisano. Za upis: npm run catalog:push -- --yes')
    return
  }
  const up = await db.from('verses').upsert(rows)
  if (up.error) throw new Error(`Upis nije uspio: ${up.error.message}`)
  console.log(`\n✓ Upisano ${rows.length} stihova u Supabase. Sajt ih prikaže u roku od sat vremena (ili odmah poslije sljedeće izmjene u adminu).`)
}

main().catch((e: Error) => {
  console.error(`✗ ${e.message}`)
  process.exit(1)
})
