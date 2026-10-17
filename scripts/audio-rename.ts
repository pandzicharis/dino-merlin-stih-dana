/**
 * Preimenuj pjesmu u repou (fajl, trajanje, nadimak) — GitHub to pokrene kad
 * admin na produkciji uredi pjesmu (.github/workflows/audio.yml, audio-rename).
 *   AUDIO_FROM="Stari naziv" AUDIO_TO="Novi naziv" AUDIO_FILE=ime-fajla tsx scripts/audio-rename.ts
 */
import { renameSong } from '../lib/audio-files'

const { AUDIO_FROM: from, AUDIO_TO: to, AUDIO_FILE: file } = process.env
if (!from || !to || !file) throw new Error('Treba AUDIO_FROM, AUDIO_TO i AUDIO_FILE.')
renameSong(from, to, file).then(
  ({ changed }) => console.log(changed ? `✓ ${from} → ${to} (${file}.m4a)` : 'Nema promjene u fajlovima.'),
  (e: Error) => {
    console.error(`✖ ${e.message}`)
    process.exit(1)
  },
)
