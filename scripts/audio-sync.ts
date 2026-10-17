/**
 * Svaki stih mora imati pjesmu koja se pušta odmah. Ova skripta to provjeri
 * i sredi što fali: preuzme pjesmu, kodira je (HE-AAC) i upiše trajanje —
 * isto što admin uradi sam kad se stih sačuva lokalno (lib/audio-files.ts).
 *
 *   npm run audio                  stihovi s produkcije (/api/verses)
 *   npm run audio -- --local       stihovi iz lokalnog admina (.data/catalog.json)
 *   npm run audio -- --check       samo provjera, ništa ne preuzima (izlaz 1 ako fali)
 *
 * Poslije preuzimanja: commit public/audio + data/audio.json i push. Na
 * GitHubu (.github/workflows/audio.yml) to ide samo, kad admin na produkciji
 * sačuva stih — pjesmu koju je poslao dobije i kroz AUDIO_SONG/AUDIO_YOUTUBE,
 * za slučaj da /api/verses na CDN-u još nije osvježen.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PUBLIC_URL } from '../lib/site'
import { audioSlug, youtubeId } from '../lib/text'
import { prepareSong, readDurations, songState } from '../lib/audio-files'

type V = { id: string; song: string; youtube?: string; active?: boolean }

const local = process.argv.includes('--local')
const check = process.argv.includes('--check')

async function verses(): Promise<V[]> {
  const sent: V[] = process.env.AUDIO_SONG ? [{ id: '(iz admina)', song: process.env.AUDIO_SONG, youtube: process.env.AUDIO_YOUTUBE || undefined }] : []
  return [...(await catalog()), ...sent]
}

async function catalog(): Promise<V[]> {
  if (local) return (JSON.parse(await readFile(join(process.cwd(), '.data', 'catalog.json'), 'utf8')) as { verses: V[] }).verses
  const r = await fetch(`${PUBLIC_URL}/api/verses`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${PUBLIC_URL}/api/verses → ${r.status}`)
  return (await r.json()) as V[]
}

async function main() {
  const list = await verses()
  console.log(`\n${list.length} stihova · ${local ? '.data/catalog.json' : PUBLIC_URL}\n`)

  // pjesma → stihovi iz nje (više stihova može biti iz iste pjesme)
  const songs = new Map<string, { song: string; youtube?: string; ids: string[] }>()
  let noLink = 0
  for (const v of list) {
    if (!youtubeId(v.youtube)) {
      noLink++
      console.log(`  ✖  ${v.id}: nema YouTube linka — plejer ne radi bez njega`)
    }
    const k = audioSlug(v.song)
    const s = songs.get(k) ?? { song: v.song, ids: [] }
    s.ids.push(v.id)
    if (!s.youtube && youtubeId(v.youtube)) s.youtube = v.youtube
    songs.set(k, s)
  }

  const durations = await readDurations()
  const todo: string[] = []
  for (const [k, s] of [...songs].sort()) {
    const st = await songState(s.song, durations)
    const ok = st.state === 'ready'
    if (!ok) todo.push(k)
    console.log(`  ${ok ? '✓' : '·'}  ${s.song.padEnd(26)} ${ok ? `${durations[k].toFixed(0)} s` : 'fali'}   ${s.ids.join(', ')}`)
  }

  if (todo.length && !check) {
    console.log(`\nPreuzimam ${todo.length}…`)
    for (const k of todo) {
      const s = songs.get(k)!
      try {
        await prepareSong(s.song, s.youtube)
        console.log(`  ✓  ${s.song}`)
      } catch (e) {
        console.log(`  ✖  ${s.song}: ${(e as Error).message.split('\n').pop()}`)
      }
    }
  }

  const left = (await Promise.all(todo.map((k) => songState(songs.get(k)!.song)))).filter((s) => s.state !== 'ready').length
  console.log(`\n${songs.size} pjesama za ${list.length} stihova · ${left ? `${left} bez zvuka` : 'sve spremne'}${noLink ? ` · ${noLink} bez linka` : ''}\n`)
  if (todo.length && !left && !check) console.log('Sad: git add public/audio data/audio.json, commit i push.\n')
  // preuzimanje: greška samo kad pjesma fali (stih bez linka javi provjera)
  if (left || (check && noLink)) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
