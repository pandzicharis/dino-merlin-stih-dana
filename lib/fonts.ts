import type { CSSProperties } from 'react'

/**
 * Fontovi stiha — urednik bira glavni font i, po želji, drugi font za
 * pojedine riječi ili redove ("Kako da ti kažem / *koliko mi značiš*").
 *
 * Fontovi se učitavaju iz app/layout.tsx bez preloada: preglednik ih
 * preuzme tek kad ih stih zaista koristi, pa ne usporavaju aplikaciju.
 * `scale`: pisani su optički sitniji — da izgledaju iste veličine.
 */
export const VERSE_FONTS = {
  fraunces: { label: 'Fraunces', kind: 'klasicni', family: 'var(--font-serif)', scale: 1, lh: 1.18 },
  playfair: { label: 'Playfair', kind: 'klasicni', family: 'var(--font-playfair)', scale: 0.94, lh: 1.18 },
  cormorant: { label: 'Cormorant', kind: 'klasicni', family: 'var(--font-cormorant)', scale: 1.12, lh: 1.12 },
  greatvibes: { label: 'Great Vibes', kind: 'pisani', family: 'var(--font-greatvibes)', scale: 1.3, lh: 1.22 },
  dancing: { label: 'Dancing', kind: 'pisani', family: 'var(--font-dancing)', scale: 1.06, lh: 1.2 },
  parisienne: { label: 'Parisienne', kind: 'pisani', family: 'var(--font-parisienne)', scale: 1.18, lh: 1.24 },
} as const

export type VerseFont = keyof typeof VERSE_FONTS
export const VERSE_FONT_KEYS = Object.keys(VERSE_FONTS) as VerseFont[]

const isFont = (k: string | undefined): k is VerseFont => Boolean(k && k in VERSE_FONTS)

/** Font riječi s oznakama: podebljano (b) i ukoso (i; samo klasični). */
export type WordStyle = { font: VerseFont; bold?: boolean; italic?: boolean }

/**
 * Fontovi stiha po riječi: glavni stil i izuzeci po rednom broju riječi
 * (kroz cijeli stih, od 0). Zapis: `"cormorant;4-5:greatvibes.b;7:playfair.i"`.
 */
export type FontMap = { main: WordStyle; words: Record<number, WordStyle> }

function parseToken(t: string | undefined): WordStyle | null {
  const [k, flags = ''] = (t ?? '').split('.')
  if (!isFont(k)) return null
  const italic = flags.includes('i') && VERSE_FONTS[k].kind === 'klasicni'
  return { font: k, ...(flags.includes('b') ? { bold: true } : {}), ...(italic ? { italic: true } : {}) }
}
function token(w: WordStyle): string {
  const flags = `${w.bold ? 'b' : ''}${w.italic ? 'i' : ''}`
  return flags ? `${w.font}.${flags}` : w.font
}
export const sameStyle = (a: WordStyle, b: WordStyle) => token(a) === token(b)
export const DEFAULT_STYLE: WordStyle = { font: 'fraunces' }

export function parseFont(font?: string): FontMap {
  const [head, ...rest] = (font ?? '').split(';')
  const words: Record<number, WordStyle> = {}
  for (const part of rest) {
    const [range, t] = part.split(':')
    const w = parseToken(t)
    if (!w) continue
    const [a, b = a] = range.split('-').map(Number)
    if (!Number.isInteger(a) || !Number.isInteger(b)) continue
    for (let i = a; i <= Math.min(b, a + 60); i++) words[i] = w
  }
  return { main: parseToken(head) ?? DEFAULT_STYLE, words }
}

/** Nazad u zapis — uzastopne riječi istog stila kao raspon; prazno za podrazumijevani. */
export function stringifyFont({ main, words }: FontMap): string | undefined {
  const idx = Object.keys(words)
    .map(Number)
    .filter((i) => !sameStyle(words[i], main))
    .sort((a, b) => a - b)
  const parts: string[] = []
  for (let k = 0; k < idx.length; ) {
    let j = k
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1 && sameStyle(words[idx[j + 1]], words[idx[k]])) j++
    parts.push(`${idx[k] === idx[j] ? idx[k] : `${idx[k]}-${idx[j]}`}:${token(words[idx[k]])}`)
    k = j + 1
  }
  if (sameStyle(main, DEFAULT_STYLE) && !parts.length) return undefined
  return [token(main), ...parts].join(';')
}

/** Stil riječi `i` (redni broj kroz cijeli stih). */
export function styleOf(map: FontMap, i: number): WordStyle {
  return map.words[i] ?? map.main
}
/** Samo font riječi `i`. */
export function fontOf(map: FontMap, i: number): VerseFont {
  return styleOf(map, i).font
}

/** CSS za stil — za ekran stiha i za uzorke u adminu. */
export function styleCss(w: WordStyle): CSSProperties | undefined {
  const f = VERSE_FONTS[w.font]
  if (w.font === 'fraunces') {
    if (!w.bold && !w.italic) return undefined
    return {
      // ukoso je zaseban rez (bez preloada); debljina preko ose 'wght'
      ...(w.italic ? { fontFamily: 'var(--font-serif-italic), var(--font-serif), serif', fontStyle: 'italic' } : {}),
      fontVariationSettings: `'wght' ${w.bold ? 620 : 400}, 'opsz' 144, 'SOFT' 30, 'WONK' 0`,
    }
  }
  return {
    fontFamily: `${f.family}, ui-serif, Georgia, serif`,
    fontVariationSettings: 'normal',
    fontWeight: w.bold ? 700 : 400,
    fontStyle: w.italic ? 'italic' : 'normal',
    fontSize: `${f.scale}em`,
    lineHeight: f.lh,
    letterSpacing: f.kind === 'pisani' ? '0' : undefined,
    // pisani nemaju "zraka" sa strane — uz klasičnu riječ bi se slijepili
    paddingInline: f.kind === 'pisani' ? '0.09em' : undefined,
  }
}

/** Stil jedne riječi stiha — prazan za podrazumijevani (Fraunces iz `.verse`). */
export function wordFont(map: FontMap, i: number): CSSProperties | undefined {
  return styleCss(styleOf(map, i))
}

/** Riječi stiha po redovima — isto brojanje kao na ekranu (VerseText). */
export function verseWords(text: string): string[][] {
  return text
    .split('\n')
    .map((l) => l.trim().split(/\s+/).filter(Boolean))
    .filter((l) => l.length)
}

/**
 * Učitaj fontove stiha odmah (bez čekanja da se tekst prikaže) — da papirić
 * u tomboli i splashu od prvog kadra ima pravi font, bez zamjene usred animacije.
 */
export function preloadFonts(font?: string) {
  if (!font || typeof document === 'undefined' || !document.fonts?.load) return
  const map = parseFont(font)
  const used = new Map<string, WordStyle>()
  for (const w of [map.main, ...Object.values(map.words)]) used.set(token(w), w)
  const root = getComputedStyle(document.documentElement)
  for (const w of used.values()) {
    const v = w.font === 'fraunces' ? (w.italic ? '--font-serif-italic' : '--font-serif') : VERSE_FONTS[w.font].family.slice(4, -1)
    const family = root.getPropertyValue(v).trim()
    if (family) void document.fonts.load(`${w.italic ? 'italic ' : ''}${w.bold ? 700 : 400} 40px ${family}`, 'AaČćŠšŽžĐđ').catch(() => {})
  }
}
