import ALIAS from '../data/audio-alias.json'
import { audioSlug } from './text'

/**
 * Fajl pjesme u public/audio (bez .m4a). Po nazivu pjesme, osim kad je
 * urednik fajlu dao drugo ime (admin → uredi pjesmu) — tad je u
 * data/audio-alias.json: { naziv-pjesme: ime-fajla }.
 */
export function audioFile(song: string, alias: Record<string, string> = ALIAS): string {
  const s = audioSlug(song)
  return alias[s] ?? s
}
