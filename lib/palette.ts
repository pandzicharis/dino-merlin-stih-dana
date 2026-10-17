/**
 * Prijedlozi boje za stih — iz pozadine na kojoj će stajati.
 *
 * Pozadina ekrana stiha su boje raspoloženja (mrlje) i omot albuma preko
 * njih. Iz toga se uzmu nijanse — naglasak raspoloženja, mrlje, dominantne
 * boje omota, pa zlatna — i svaka se posvijetli tek toliko da stih ostane
 * čitljiv (kontrast ≥ 4.5 : 1, kao za tekst na webu) i na najsvjetlijem
 * dijelu pozadine. Tako boja uvijek "pripada" ekranu, a ne bori se s njim.
 */
import { MOODS, type Mood } from '@/data/moods'
import { BRAND } from './brand'

type RGB = [number, number, number]

const hexToRgb = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbToHex = ([r, g, b]: RGB) => [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

/** Relativna svjetlina (WCAG). */
function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(hexToRgb(a)), luminance(hexToRgb(b))].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** Ista nijansa, posvijetljena dok ne bude čitljiva na `bg`. */
function readable(hex: string, bg: string, min = 4.5): string {
  const [h, s0, l0] = rgbToHsl(hexToRgb(hex))
  // jako zasićene boje na tamnom bodu oči — malo ih smiri
  const s = Math.min(s0, 0.78)
  let l = Math.max(l0, 0.55)
  let out = rgbToHex(hslToRgb(h, s, l))
  while (contrast(out, bg) < min && l < 0.94) {
    l += 0.02
    out = rgbToHex(hslToRgb(h, s, l))
  }
  return out
}

/** Dominantne boje slike (omot albuma) — šarene, ne sive i ne crne. */
async function coverColors(src: string, max = 4): Promise<string[]> {
  const img = new Image()
  // `load`, ne decode(): decode u skrivenoj kartici čeka da postane vidljiva;
  // a i omot koji kasni ne smije zadržati prijedloge iz raspoloženja
  await Promise.race([
    new Promise((ok, fail) => {
      img.onload = ok
      img.onerror = fail
      img.src = src
    }),
    new Promise((_, fail) => setTimeout(() => fail(new Error('omot kasni')), 1500)),
  ])
  const S = 48
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []
  ctx.drawImage(img, 0, 0, S, S)
  const data = ctx.getImageData(0, 0, S, S).data
  // kante po 4 bita na kanal; težina = broj piksela × zasićenost
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i < data.length; i += 4) {
    const rgb: RGB = [data[i], data[i + 1], data[i + 2]]
    const [, s, l] = rgbToHsl(rgb)
    if (l < 0.12 || l > 0.95 || s < 0.18) continue
    const key = ((rgb[0] >> 4) << 8) | ((rgb[1] >> 4) << 4) | (rgb[2] >> 4)
    const k = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    const w = 0.4 + s
    k.n += w
    k.r += rgb[0] * w
    k.g += rgb[1] * w
    k.b += rgb[2] * w
    buckets.set(key, k)
  }
  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).map((k) => rgbToHex([k.r / k.n, k.g / k.n, k.b / k.n]))
  const out: string[] = []
  for (const hex of ranked) {
    if (out.length >= max) break
    if (out.every((o) => hueGap(o, hex) > 28)) out.push(hex)
  }
  return out
}

function hueGap(a: string, b: string): number {
  const d = Math.abs(rgbToHsl(hexToRgb(a))[0] - rgbToHsl(hexToRgb(b))[0])
  return Math.min(d, 360 - d)
}

export type Suggestion = { hex: string; from: 'raspoloženje' | 'omot' | 'zlatna' }

/**
 * Prijedlozi za raspoloženje i omot: do 7 čitljivih boja (heks bez #),
 * različitih nijansi i različitih od naglaska. Omot je opcija — bez njega
 * samo raspoloženje i zlatna.
 */
export async function suggestColors(mood: Mood, cover?: string): Promise<Suggestion[]> {
  const m = MOODS[mood]
  // najsvjetliji dio pozadine — ako je čitljivo tu, čitljivo je svuda
  const bg = [...m.gradient].sort((a, b) => luminance(hexToRgb(b)) - luminance(hexToRgb(a)))[0]
  // naglasak raspoloženja ima svoje dugme u adminu — ovdje samo da se ne ponovi
  const taken = [readable(m.accent, bg)]
  const sources: Suggestion[] = [
    { hex: m.gradient[2], from: 'raspoloženje' },
    { hex: m.gradient[1], from: 'raspoloženje' },
  ]
  if (cover) {
    try {
      for (const hex of await coverColors(cover)) sources.push({ hex, from: 'omot' })
    } catch {
      /* omot se nije učitao — ostaju boje raspoloženja */
    }
  }
  sources.push({ hex: BRAND.gold, from: 'zlatna' })

  const out: Suggestion[] = []
  const add = (s: Suggestion) => {
    const hex = readable(s.hex, bg)
    const [, , l] = rgbToHsl(hexToRgb(hex))
    // isti ton kao neki već predložen (ili skoro bijela) — preskoči
    if ([...taken, ...out.map((o) => o.hex)].some((o) => hueGap(o, hex) < 16 && Math.abs(rgbToHsl(hexToRgb(o))[2] - l) < 0.12)) return
    out.push({ hex, from: s.from })
  }
  for (const s of sources) if (out.length < 7) add(s)
  // omot bez boja (crno-bijeli) — dopuni srodnim nijansama naglaska:
  // susjedne, pa suprotna; uvijek iz iste pozadine, samo pomjerene po krugu boja
  const [h] = rgbToHsl(hexToRgb(m.accent))
  for (const dh of [32, -32, 180, 64, -64]) {
    if (out.length >= 4) break
    add({ hex: rgbToHex(hslToRgb((h + dh + 360) % 360, 0.5, 0.72)), from: 'raspoloženje' })
  }
  return out
}
