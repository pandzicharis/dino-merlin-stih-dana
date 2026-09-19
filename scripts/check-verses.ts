/**
 * Validator data fajla. Pokreće se ručno (`npm run verses:check`)
 * i automatski prije builda (`prebuild`).
 *
 * U dev-u su TODO placeholderi samo upozorenje; u produkcijskom buildu su greška.
 */
import { VERSES, youtubeId } from '../data/verses'
import { MOODS, MOOD_KEYS } from '../data/moods'

const MAX_LINES = 3
const MAX_CHARS = 90
const MIN_POOL = 30

const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--strict')
const errors: string[] = []
const warnings: string[] = []

const seen = new Set<string>()

for (const v of VERSES) {
  const at = `[${v.id}]`

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.id)) errors.push(`${at} id mora biti kebab-case`)
  if (seen.has(v.id)) errors.push(`${at} duplikat id-a`)
  seen.add(v.id)

  if (!(v.mood in MOODS)) errors.push(`${at} nepoznat mood "${v.mood}"`)

  const lines = v.text.split('\n')
  if (lines.length > MAX_LINES) errors.push(`${at} ${lines.length} redova (max ${MAX_LINES})`)
  if (v.text.length > MAX_CHARS) errors.push(`${at} ${v.text.length} znakova (max ${MAX_CHARS})`)
  if (!v.text.trim()) errors.push(`${at} prazan tekst`)

  for (const [field, val] of [['song', v.song], ['album', v.album]] as const) {
    if (!String(val).trim()) errors.push(`${at} prazan "${field}"`)
  }
  if (!Number.isInteger(v.year) || v.year < 1980 || v.year > new Date().getFullYear() + 1) {
    errors.push(`${at} sumnjiva godina: ${v.year}`)
  }

  const todo = [v.text, v.song, v.album].some((s) => s.includes('TODO'))
  if (todo) (isProd ? errors : warnings).push(`${at} sadrži TODO placeholder`)

  if (!v.youtube) warnings.push(`${at} nema youtube link — nema dugmeta za slušanje`)
  else if (!youtubeId(v.youtube)) errors.push(`${at} neispravan youtube link: ${v.youtube}`)
}

for (const m of MOOD_KEYS) {
  if (!VERSES.some((v) => v.mood === m)) warnings.push(`mood "${m}" nema nijedan stih`)
}

if (VERSES.length < MIN_POOL) {
  warnings.push(`samo ${VERSES.length} stihova — ciklus se ponavlja svakih ${VERSES.length} dana (cilj: ${MIN_POOL}+)`)
}

for (const w of warnings) console.warn(`  ⚠  ${w}`)
for (const e of errors) console.error(`  ✖  ${e}`)

if (errors.length) {
  console.error(`\n✖ verses: ${errors.length} grešaka\n`)
  process.exit(1)
}
console.log(`\n✔ verses: ${VERSES.length} stihova, ${MOOD_KEYS.length} moodova, ${warnings.length} upozorenja\n`)
