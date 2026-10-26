/**
 * Pomak teksta pjesme u repou (data/lyrics.json) — GitHub to pokrene kad
 * admin na produkciji podesi pomak (.github/workflows/audio.yml, lyrics-offset).
 *   AUDIO_SONG="Naziv" LYRICS_OFFSET=0.5 tsx scripts/lyrics-offset.ts
 */
import { readAlias } from '../lib/audio-files'
import { audioFile } from '../lib/audio-name'
import { setLyricsOffset } from '../lib/lyrics-store'

const { AUDIO_SONG: song, LYRICS_OFFSET: raw } = process.env
if (!song || raw === undefined) throw new Error('Treba AUDIO_SONG i LYRICS_OFFSET.')
const offset = Number(raw) || 0
readAlias()
  .then((alias) => setLyricsOffset(audioFile(song, alias), offset))
  .then(
    () => console.log(`✓ ${song}: pomak ${offset} s`),
    (e: Error) => {
      console.error(`✖ ${e.message}`)
      process.exit(1)
    },
  )
