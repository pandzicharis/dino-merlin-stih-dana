/**
 * MOODS — paleta i atmosfera po raspoloženju stiha.
 *
 * Ovaj fajl NE diraš kad dodaješ stihove — ovdje se samo podešava izgled.
 * Stihove ubacuješ u `data/verses.ts`.
 *
 * Svaki mood definiše boje i ponašanje pozadine:
 *
 *   gradient   3 boje mrlja koje se sporo kreću
 *   accent     boja naglaska (naziv pjesme, ornament, sjaj)
 *   text       boja stiha
 *
 *   speed      brzina kretanja mrlja (0.4 mirno … 1.5 uzburkano)
 *   drift      koliko daleko putuju, u pikselima
 *   bloom      sjaj iza stiha, u boji naglaska (0 … 1)
 *   figure     vidljivost portreta u pozadini (0.05 … 0.2 — nagovještaj, ne slika)
 *   blend      kako se portret stapa s pozadinom
 *   focus      gdje portret stoji (CSS background-position)
 *   sweep      spori dijagonalni prelaz svjetla preko ekrana
 *   notes      koliko nota pluta u pozadini (0 = nijedna)
 *   grain      zrnatost (0 … 1); preko 0.5 dobija i filmsko podrhtavanje
 *   vignette   zatamnjenje rubova (0 … 1)
 */

export type MoodStyle = {
  label: string
  gradient: [string, string, string]
  accent: string
  text: string
  speed: number
  drift: number
  bloom: number
  figure: number
  blend: 'soft-light' | 'screen' | 'overlay' | 'luminosity'
  focus: string
  sweep: boolean
  notes: number
  grain: number
  vignette: number
}

export const MOODS = {
  ljubav: {
    label: 'Ljubav',
    gradient: ['#2A0A18', '#5C1730', '#7A2340'],
    accent: '#F2A7B8',
    text: '#FFF4F6',
    speed: 0.9,
    drift: 40,
    bloom: 0.55,
    figure: 0.16,
    blend: 'screen',
    focus: '50% 10%',
    sweep: false,
    notes: 5,
    grain: 0.35,
    vignette: 0.55,
  },
  nostalgija: {
    label: 'Nostalgija',
    gradient: ['#0F1219', '#232838', '#3A3E52'],
    accent: '#D9C3A0',
    text: '#F3EEE6',
    speed: 0.55,
    drift: 24,
    bloom: 0.3,
    figure: 0.19,
    blend: 'screen',
    focus: '50% 8%',
    sweep: false,
    notes: 3,
    grain: 0.62,
    vignette: 0.68,
  },
  nada: {
    label: 'Nada',
    gradient: ['#0B1420', '#153244', '#1E4A5C'],
    accent: '#F4C77B',
    text: '#FBF6EC',
    speed: 1,
    drift: 46,
    bloom: 0.7,
    figure: 0.14,
    blend: 'screen',
    focus: '50% 12%',
    sweep: true,
    notes: 6,
    grain: 0.28,
    vignette: 0.42,
  },
  sloboda: {
    label: 'Sloboda i sreća',
    gradient: ['#0A0F1C', '#132844', '#1B3A6B'],
    accent: '#7FD0E8',
    text: '#EEF7FB',
    speed: 1.35,
    drift: 62,
    bloom: 0.6,
    figure: 0.12,
    blend: 'screen',
    focus: '50% 14%',
    sweep: true,
    notes: 8,
    grain: 0.24,
    vignette: 0.4,
  },
} as const satisfies Record<string, MoodStyle>

export type Mood = keyof typeof MOODS

export const MOOD_KEYS = Object.keys(MOODS) as Mood[]

/** Portret u pozadini — vidi public/brand/README.md. */
export const FIGURE_SRC = '/brand/figure.webp'
