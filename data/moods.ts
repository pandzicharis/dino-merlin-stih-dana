/**
 * MOODS — paleta i atmosfera po raspoloženju stiha.
 *
 * Ključ (ljubav, nostalgija…) je ono što stih nosi u bazi — NE mijenjati ga.
 * `label` je naziv stila u adminu (Velvet, Sepia…) — slobodno.
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
    label: 'Velvet',
    gradient: ['#260E18', '#541F32', '#702D43'],
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
    label: 'Sepia',
    gradient: ['#101218', '#252936', '#3D404F'],
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
    label: 'Halo',
    gradient: ['#0D141E', '#1A313F', '#254755'],
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
    label: 'Azure',
    gradient: ['#0C101A', '#18293F', '#243C62'],
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
  // sporo i tamno ljubičasto — sjeta, rastanak
  tuga: {
    label: 'Dusk',
    gradient: ['#100E1C', '#221B3A', '#352A55'],
    accent: '#B9A7F0',
    text: '#F5F2FD',
    speed: 0.5,
    drift: 22,
    bloom: 0.35,
    figure: 0.18,
    blend: 'screen',
    focus: '50% 9%',
    sweep: false,
    notes: 2,
    grain: 0.5,
    vignette: 0.7,
  },
  // žar — crveno prema narandžastom, brže i toplije od ljubavi
  strast: {
    label: 'Ember',
    gradient: ['#1E0A0A', '#4A1414', '#6E2116'],
    accent: '#FF9B6A',
    text: '#FFF3EE',
    speed: 1.2,
    drift: 52,
    bloom: 0.65,
    figure: 0.15,
    blend: 'screen',
    focus: '50% 10%',
    sweep: true,
    notes: 6,
    grain: 0.3,
    vignette: 0.5,
  },
  // Bosna, kuća, behar — tamna šuma i blaga zelena
  zavicaj: {
    label: 'Moss',
    gradient: ['#0B1410', '#16301F', '#22472E'],
    accent: '#B5DDA4',
    text: '#F1F8EF',
    speed: 0.75,
    drift: 34,
    bloom: 0.45,
    figure: 0.17,
    blend: 'screen',
    focus: '50% 10%',
    sweep: false,
    notes: 4,
    grain: 0.4,
    vignette: 0.55,
  },
  // mirno i toplo, kao svitanje — breskva na tamnom
  mir: {
    label: 'Dawn',
    gradient: ['#14100F', '#2C2220', '#45332D'],
    accent: '#F3C6A5',
    text: '#FCF4EE',
    speed: 0.45,
    drift: 20,
    bloom: 0.5,
    figure: 0.16,
    blend: 'screen',
    focus: '50% 9%',
    sweep: true,
    notes: 3,
    grain: 0.38,
    vignette: 0.6,
  },
  // crno i grafit, srebrni naglasak — strogo, kao film
  noir: {
    label: 'Noir',
    gradient: ['#0A0A0B', '#1A1B1E', '#2A2C31'],
    accent: '#D9DCE1',
    text: '#F7F7F8',
    speed: 0.6,
    drift: 26,
    bloom: 0.3,
    figure: 0.2,
    blend: 'screen',
    focus: '50% 9%',
    sweep: false,
    notes: 2,
    grain: 0.55,
    vignette: 0.72,
  },
  // tamno smeđe i zlato — svečano
  aurum: {
    label: 'Aurum',
    gradient: ['#0F0B06', '#2A1E0E', '#3E2C12'],
    accent: '#E9C46A',
    text: '#FFF8EA',
    speed: 0.8,
    drift: 34,
    bloom: 0.6,
    figure: 0.15,
    blend: 'screen',
    focus: '50% 10%',
    sweep: true,
    notes: 5,
    grain: 0.32,
    vignette: 0.5,
  },
  // hladno plavo-sivo, ledeni naglasak — zima, daljina
  frost: {
    label: 'Frost',
    gradient: ['#0B1016', '#1A2632', '#2A3B4D'],
    accent: '#BFE3FF',
    text: '#F2F8FD',
    speed: 0.65,
    drift: 30,
    bloom: 0.45,
    figure: 0.16,
    blend: 'screen',
    focus: '50% 9%',
    sweep: false,
    notes: 3,
    grain: 0.35,
    vignette: 0.55,
  },
  // ljubičasto u tirkizno, neon menta — apstraktno, moderno
  abstract: {
    label: 'Abstract',
    gradient: ['#0E0A1A', '#2B1446', '#0F3A4A'],
    accent: '#7DF2C8',
    text: '#F3FFFA',
    speed: 1.15,
    drift: 56,
    bloom: 0.6,
    figure: 0.12,
    blend: 'screen',
    focus: '50% 12%',
    sweep: true,
    notes: 6,
    grain: 0.3,
    vignette: 0.45,
  },
  // nježna romansa — šljiva i ruž
  rose: {
    label: 'Rosé',
    gradient: ['#1B1018', '#3E2333', '#63384F'],
    accent: '#FFD1DD',
    text: '#FFF6F9',
    speed: 0.7,
    drift: 32,
    bloom: 0.55,
    figure: 0.15,
    blend: 'screen',
    focus: '50% 10%',
    sweep: true,
    notes: 5,
    grain: 0.3,
    vignette: 0.5,
  },
  // noćna romansa — ponoć i mjesečina
  moonlight: {
    label: 'Moonlight',
    gradient: ['#070B18', '#141C38', '#222C55'],
    accent: '#F4E7C2',
    text: '#FBF8EE',
    speed: 0.55,
    drift: 26,
    bloom: 0.5,
    figure: 0.17,
    blend: 'screen',
    focus: '50% 9%',
    sweep: true,
    notes: 3,
    grain: 0.36,
    vignette: 0.62,
  },
  // sevdah — čežnja i ljubav, bordo u tamni tirkiz, ružičasto zlato
  sevdah: {
    label: 'Sevdah',
    gradient: ['#160A10', '#3A1222', '#123236'],
    accent: '#E9B49B',
    text: '#FFF4EF',
    speed: 0.6,
    drift: 30,
    bloom: 0.5,
    figure: 0.18,
    blend: 'screen',
    focus: '50% 9%',
    sweep: false,
    notes: 4,
    grain: 0.45,
    vignette: 0.62,
  },
  // behar — proljeće, cvijet na tamnoj grani
  behar: {
    label: 'Behar',
    gradient: ['#0E120F', '#1F2B22', '#3A2A35'],
    accent: '#F4F1E6',
    text: '#FBFAF4',
    speed: 0.85,
    drift: 40,
    bloom: 0.5,
    figure: 0.15,
    blend: 'screen',
    focus: '50% 10%',
    sweep: true,
    notes: 6,
    grain: 0.3,
    vignette: 0.48,
  },
  // serenada — ljubičasta noć i toplo zlato
  serenade: {
    label: 'Serenade',
    gradient: ['#0D0A1C', '#211A42', '#3B2A5E'],
    accent: '#F2C879',
    text: '#FFF8EC',
    speed: 0.75,
    drift: 36,
    bloom: 0.6,
    figure: 0.15,
    blend: 'screen',
    focus: '50% 10%',
    sweep: true,
    notes: 5,
    grain: 0.32,
    vignette: 0.52,
  },
} as const satisfies Record<string, MoodStyle>

export type Mood = keyof typeof MOODS

export const MOOD_KEYS = Object.keys(MOODS) as Mood[]

/** Portret u pozadini — vidi public/brand/README.md. */
export const FIGURE_SRC = '/brand/figure-mi.webp'
