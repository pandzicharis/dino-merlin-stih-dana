/**
 * ═══════════════════════════════════════════════════════════════
 *  VERSES — JEDINI FAJL KOJI TI DIRAŠ KAD DODAJEŠ STIHOVE
 * ═══════════════════════════════════════════════════════════════
 *
 * KAKO DODATI STIH:
 *   1. Kopiraj bilo koji blok ispod i promijeni sadržaj.
 *   2. `id` mora biti jedinstven, kebab-case. NE mijenjaj ga naknadno —
 *      po njemu se čuvaju favoriti i share linkovi.
 *   3. `text`: novi red je `\n`. Prelom prati način na koji se pjeva.
 *   4. `youtube`: pun link ili samo ID — oba rade.
 *
 * PRAVILA (`npm run verses:check` ovo provjerava):
 *   • stihovi su kratki — par riječi do jedne rečenice
 *   • max 3 reda, max ~90 znakova
 *   • bez praznog teksta u produkcijskom buildu
 *
 * TESTIRANJE:
 *   /?verse=<id>        prikaži tačno ovaj stih
 *   /?mood=nostalgija   forsiraj paletu
 *   /?d=2026-12-31      simuliraj datum
 *   /dev/moods          sve palete na jednom ekranu
 *   tipke [ ] \ m       dan nazad / naprijed / danas / sljedeći mood
 */

import type { Mood } from './moods'

export type Verse = {
  /** jedinstven, kebab-case, NE mijenjati nakon objave */
  id: string
  /** stih; novi red = \n; max 3 reda */
  text: string
  song: string
  album: string
  year: number
  /** paleta / atmosfera — vidi data/moods.ts */
  mood: Mood
  /** YouTube link ili ID — dugme za slušanje ispod stiha */
  youtube?: string
}

export const VERSES: Verse[] = [
  /* ─────────────────────────────────────────────  LJUBAV  ── */
  {
    id: 'hitna-upomoc',
    text: 'Ili dođi\nili zovi hitnu upomoć',
    song: 'Hitna',
    album: 'Sredinom',
    year: 2000,
    mood: 'ljubav',
    youtube: 'https://www.youtube.com/watch?v=gmu5cCWNI1A',
  },
  {
    id: 'ruzo-moja',
    text: 'I ja tebe imam,\nružo moja',
    song: 'Ruža',
    album: 'Hotel Nacional',
    year: 2014,
    mood: 'ljubav',
    youtube: 'https://www.youtube.com/watch?v=nU0V1lU3obE',
  },
  {
    id: 'duse-putuju',
    text: 'Duše jedna drugoj putuju',
    song: 'Godinama',
    album: 'Sredinom',
    year: 2000,
    mood: 'ljubav',
    youtube: 'https://www.youtube.com/watch?v=Td9tYLNjSRc',
  },
  {
    id: 'ostala-dijete',
    text: 'Ti si sve ovo vrijeme\nostala dijete',
    song: 'Uzmi ovaj dar',
    album: 'Hotel Nacional',
    year: 2014,
    mood: 'ljubav',
    youtube: 'https://www.youtube.com/watch?v=gyvR-Fx3Kb8',
  },

  /* ────────────────────────────────────────  NOSTALGIJA  ── */
  {
    id: 'ruke-pruza',
    text: 'I svako ima nekog\nda mu ruke pruža',
    song: 'Ruža',
    album: 'Hotel Nacional',
    year: 2014,
    mood: 'nostalgija',
    youtube: 'https://www.youtube.com/watch?v=nU0V1lU3obE',
  },
  {
    id: 'koliko-mi-znacis',
    text: 'Kako da ti kažem\nkoliko mi značiš',
    song: 'Krive karte',
    album: 'Mi',
    year: 2025,
    mood: 'nostalgija',
    youtube: 'https://www.youtube.com/watch?v=upJrhMMfawQ',
  },
  {
    id: 'behar-mirise',
    text: 'Svuda behar\nna nju miriše',
    song: 'Bosnom behar probeharao',
    album: 'Sredinom',
    year: 2000,
    mood: 'nostalgija',
    youtube: 'https://www.youtube.com/watch?v=XPIySJJSpIU',
  },
  {
    id: 'moja-svila',
    text: 'Gdje je moja svila?',
    song: 'Svila',
    album: 'Burek',
    year: 2004,
    mood: 'nostalgija',
    youtube: 'https://www.youtube.com/watch?v=Cd0x779UeoI',
  },

  /* ──────────────────────────────────────────────  NADA  ── */
  {
    id: 'dodajem-gas',
    text: 'Dodajem gas',
    song: 'Mi',
    album: 'Mi',
    year: 2025,
    mood: 'nada',
    youtube: 'https://www.youtube.com/watch?v=juPe7ADppkA',
  },
  {
    id: 'zove-se-prilika',
    text: 'Ono jučer bi dobra škola,\novo danas se zove prilika',
    song: 'Grudobolja',
    album: 'Ispočetka',
    year: 2008,
    mood: 'nada',
    youtube: 'https://www.youtube.com/watch?v=jPBx1H36T8k',
  },
  {
    id: 'danas-mi-sunce-sja',
    text: 'Danas se osjećam bolje,\ndanas mi sunce sja',
    song: 'Danas sam OK',
    album: 'Sredinom',
    year: 2000,
    mood: 'nada',
    youtube: 'https://www.youtube.com/watch?v=R8gfK0iDUb4',
  },
  {
    id: 'ptica-srca',
    text: 'Pusti pticu srca\nda poleti',
    song: 'Sve dok te bude imalo',
    album: 'Hotel Nacional',
    year: 2014,
    mood: 'nada',
    youtube: 'https://www.youtube.com/watch?v=xsHxrGpRJck',
  },
  {
    id: 'potraziti-put',
    text: 'Ja ću promijeniti sebe,\nja ću potražiti put',
    song: 'Krive karte',
    album: 'Mi',
    year: 2025,
    mood: 'nada',
    youtube: 'https://www.youtube.com/watch?v=upJrhMMfawQ',
  },

  /* ─────────────────────────────────  SLOBODA I SREĆA  ── */
  {
    id: 'biti-dijete',
    text: 'Biti dijete —\nto je dar',
    song: 'Uzmi ovaj dar',
    album: 'Hotel Nacional',
    year: 2014,
    mood: 'sloboda',
    youtube: 'https://www.youtube.com/watch?v=gyvR-Fx3Kb8',
  },
  {
    id: 'svim-morima-svijeta',
    text: 'Plovit ćemo noćas ti i ja\nsvim morima svijeta',
    song: 'Ako izgovorim ljubav',
    album: 'Hotel Nacional',
    year: 2014,
    mood: 'sloboda',
    youtube: 'https://www.youtube.com/watch?v=3gqV2rZh1CQ',
  },
  {
    id: 'sve-sto-pozelim',
    text: 'Imam sve\nšto poželim',
    song: 'Moj je život Švicarska',
    album: 'Sredinom',
    year: 2000,
    mood: 'sloboda',
    youtube: 'https://www.youtube.com/watch?v=0plwQq2zeME',
  },
]

/** Brz lookup po id-u (share linkovi, favoriti, ?verse=). */
export const VERSE_BY_ID = new Map(VERSES.map((v) => [v.id, v]))

/** Iz punog linka ili golog ID-a izvuci YouTube video ID. */
export function youtubeId(input?: string): string | null {
  if (!input) return null
  if (/^[\w-]{11}$/.test(input)) return input
  const m = input.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)
  return m ? m[1] : null
}
