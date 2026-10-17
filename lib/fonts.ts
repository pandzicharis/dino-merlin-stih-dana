import type { CSSProperties } from 'react'

/**
 * Fontovi stiha i dizajn — urednik bira glavni font, pa riječ po riječ
 * (ili red po red) drugi font, debljinu, ukoso, veličinu, boju naglaska i
 * velika slova; za cijeli stih još veličinu, prored, razmak slova i
 * velika/mala slova (admin: components/admin/VerseDesigner.tsx).
 *
 * Fontovi se učitavaju iz app/layout.tsx bez preloada: preglednik ih
 * preuzme tek kad ih stih zaista koristi, pa ne usporavaju aplikaciju.
 * `scale`: optička veličina prema Frauncesu (izmjerena visina malih i velikih
 * slova; pisani su sitniji) — da riječi različitih fontova izgledaju iste veličine. `google`: isti rez za OG slike.
 */
export const VERSE_FONTS = {
  fraunces: { label: 'Fraunces', kind: 'klasicni', family: 'var(--font-serif)', scale: 1, lh: 1.18, google: 'Fraunces', bold: true, italic: true },
  playfair: { label: 'Playfair', kind: 'klasicni', family: 'var(--font-playfair)', scale: 0.94, lh: 1.18, google: 'Playfair+Display', bold: true, italic: true },
  cormorant: { label: 'Cormorant', kind: 'klasicni', family: 'var(--font-cormorant)', scale: 1.12, lh: 1.12, google: 'Cormorant+Garamond', bold: true, italic: true },
  ebgaramond: { label: 'Garamond', kind: 'klasicni', family: 'var(--font-ebgaramond)', scale: 1.05, lh: 1.14, google: 'EB+Garamond', bold: true, italic: true },
  bodoni: { label: 'Bodoni', kind: 'klasicni', family: 'var(--font-bodoni)', scale: 0.96, lh: 1.16, google: 'Bodoni+Moda', bold: true, italic: true },
  dmserif: { label: 'DM Serif', kind: 'klasicni', family: 'var(--font-dmserif)', scale: 0.95, lh: 1.14, google: 'DM+Serif+Display', bold: false, italic: true },
  instrument: { label: 'Instrument', kind: 'klasicni', family: 'var(--font-instrument)', scale: 0.94, lh: 1.1, google: 'Instrument+Serif', bold: false, italic: true },
  cinzel: { label: 'Cinzel', kind: 'klasicni', family: 'var(--font-cinzel)', scale: 0.82, lh: 1.22, google: 'Cinzel', bold: true, italic: false },
  josefin: { label: 'Josefin', kind: 'moderni', family: 'var(--font-josefin)', scale: 1.0, lh: 1.2, google: 'Josefin+Sans', bold: true, italic: true },
  montserrat: { label: 'Montserrat', kind: 'moderni', family: 'var(--font-montserrat)', scale: 0.88, lh: 1.2, google: 'Montserrat', bold: true, italic: true },
  greatvibes: { label: 'Great Vibes', kind: 'pisani', family: 'var(--font-greatvibes)', scale: 1.3, lh: 1.22, google: 'Great+Vibes', bold: false, italic: false },
  parisienne: { label: 'Parisienne', kind: 'pisani', family: 'var(--font-parisienne)', scale: 1.18, lh: 1.24, google: 'Parisienne', bold: false, italic: false },
  dancing: { label: 'Dancing', kind: 'pisani', family: 'var(--font-dancing)', scale: 1.06, lh: 1.2, google: 'Dancing+Script', bold: true, italic: false },
  allura: { label: 'Allura', kind: 'pisani', family: 'var(--font-allura)', scale: 1.4, lh: 1.22, google: 'Allura', bold: false, italic: false },
  pinyon: { label: 'Pinyon', kind: 'pisani', family: 'var(--font-pinyon)', scale: 1.25, lh: 1.3, google: 'Pinyon+Script', bold: false, italic: false },
  alexbrush: { label: 'Alex Brush', kind: 'pisani', family: 'var(--font-alexbrush)', scale: 1.08, lh: 1.22, google: 'Alex+Brush', bold: false, italic: false },
  caveat: { label: 'Caveat', kind: 'pisani', family: 'var(--font-caveat)', scale: 1.1, lh: 1.14, google: 'Caveat', bold: true, italic: false },
} as const

export type VerseFont = keyof typeof VERSE_FONTS
export type FontKind = (typeof VERSE_FONTS)[VerseFont]['kind']
export const VERSE_FONT_KEYS = Object.keys(VERSE_FONTS) as VerseFont[]
export const FONT_KINDS: { kind: FontKind; label: string }[] = [
  { kind: 'klasicni', label: 'Klasični' },
  { kind: 'moderni', label: 'Moderni' },
  { kind: 'pisani', label: 'Pisani' },
]

const isFont = (k: string | undefined): k is VerseFont => Boolean(k && k in VERSE_FONTS)
/** Ukoso postoji samo gdje font ima pravi kosi rez (pisani su već ukoso). */
export const canItalic = (k: VerseFont) => VERSE_FONTS[k].italic

/**
 * Stil riječi: font, podebljano (b), ukoso (i), boja naglaska (a — boja
 * raspoloženja), velika slova (u), veličina u % (s120) i vlastita boja
 * (heks bez #, treći dio zapisa: `greatvibes.b.f2a7b8` — starije verzije ga
 * preskoče, a u oznakama ne smije biti jer heks ima slova a i b).
 */
export type WordStyle = { font: VerseFont; bold?: boolean; italic?: boolean; accent?: boolean; upper?: boolean; size?: number; color?: string }

/** Cijeli stih: veličina (%), prored (×100), razmak slova (stotinke em), mala/velika slova. */
export type VerseLook = { size?: number; lh?: number; ls?: number; case?: 'upper' | 'lower' }

/** Granice — ista pravila za admin, server i čitanje zapisa. */
export const LIMITS = {
  word: { min: 50, max: 200 },
  size: { min: 60, max: 150 },
  lh: { min: 90, max: 180, base: 118 },
  ls: { min: -5, max: 30 },
} as const

/**
 * Fontovi stiha po riječi: glavni stil, izuzeci po rednom broju riječi
 * (kroz cijeli stih, od 0) i izgled cijelog stiha.
 * Zapis: `"cormorant;4-5:greatvibes.ba;7:playfair.is120.e8c39e;@size=110,lh=130,case=upper"`.
 * Starije verzije aplikacije nepoznate dijelove preskoče (`@…`, nove oznake).
 */
export type FontMap = { main: WordStyle; words: Record<number, WordStyle>; look: VerseLook }

const clamp = (n: number, { min, max }: { min: number; max: number }) => Math.round(Math.min(max, Math.max(min, n)))

const isHex = (c: string | undefined): c is string => Boolean(c && /^[0-9a-f]{6}$/.test(c))

function parseToken(t: string | undefined): WordStyle | null {
  const [k, raw = '', color] = (t ?? '').split('.')
  if (!isFont(k)) return null
  const sm = raw.match(/s(\d{2,3})/)
  const size = sm ? clamp(Number(sm[1]), LIMITS.word) : 100
  const flags = raw.replace(/s\d+/g, '')
  return normalize({
    font: k,
    bold: flags.includes('b'),
    italic: flags.includes('i'),
    accent: flags.includes('a'),
    upper: flags.includes('u'),
    size,
    color: color?.toLowerCase(),
  })
}
function token(w: WordStyle): string {
  const flags = `${w.bold ? 'b' : ''}${w.italic ? 'i' : ''}${w.accent ? 'a' : ''}${w.upper ? 'u' : ''}${w.size && w.size !== 100 ? `s${w.size}` : ''}`
  if (w.color) return `${w.font}.${flags}.${w.color}`
  return flags ? `${w.font}.${flags}` : w.font
}

/** Bez praznih oznaka; ukoso samo gdje font ima kosi rez; vlastita boja ima prednost pred naglaskom. */
export function normalize(w: WordStyle): WordStyle {
  const size = w.size == null ? 100 : clamp(w.size, LIMITS.word)
  const color = w.color?.replace('#', '').toLowerCase()
  return {
    font: w.font,
    ...(w.bold ? { bold: true } : {}),
    ...(w.italic && canItalic(w.font) ? { italic: true } : {}),
    ...(w.accent && !isHex(color) ? { accent: true } : {}),
    ...(w.upper ? { upper: true } : {}),
    ...(size !== 100 ? { size } : {}),
    ...(isHex(color) ? { color } : {}),
  }
}

export const sameStyle = (a: WordStyle, b: WordStyle) => token(a) === token(b)
export const DEFAULT_STYLE: WordStyle = { font: 'fraunces' }

function parseLook(part: string): VerseLook {
  const look: VerseLook = {}
  for (const kv of part.slice(1).split(',')) {
    const [k, v] = kv.split('=')
    const n = Number(v)
    if (k === 'size' && Number.isFinite(n)) look.size = clamp(n, LIMITS.size)
    else if (k === 'lh' && Number.isFinite(n)) look.lh = clamp(n, LIMITS.lh)
    else if (k === 'ls' && Number.isFinite(n)) look.ls = clamp(n, LIMITS.ls)
    else if (k === 'case' && (v === 'upper' || v === 'lower')) look.case = v
  }
  // podrazumijevane vrijednosti se ne pamte
  if (look.size === 100) delete look.size
  if (look.lh === LIMITS.lh.base) delete look.lh
  if (look.ls === 0) delete look.ls
  return look
}
function lookToken(l: VerseLook): string {
  const parts = [
    l.size && l.size !== 100 ? `size=${l.size}` : '',
    l.lh && l.lh !== LIMITS.lh.base ? `lh=${l.lh}` : '',
    l.ls ? `ls=${l.ls}` : '',
    l.case ? `case=${l.case}` : '',
  ].filter(Boolean)
  return parts.length ? `@${parts.join(',')}` : ''
}

export function parseFont(font?: string): FontMap {
  const [head, ...rest] = (font ?? '').split(';')
  const words: Record<number, WordStyle> = {}
  let look: VerseLook = {}
  for (const part of rest) {
    if (part.startsWith('@')) {
      look = parseLook(part)
      continue
    }
    const [range, t] = part.split(':')
    const w = parseToken(t)
    if (!w) continue
    const [a, b = a] = range.split('-').map(Number)
    if (!Number.isInteger(a) || !Number.isInteger(b)) continue
    for (let i = a; i <= Math.min(b, a + 60); i++) words[i] = w
  }
  return { main: parseToken(head) ?? DEFAULT_STYLE, words, look }
}

/** Nazad u zapis — uzastopne riječi istog stila kao raspon; prazno za podrazumijevani. */
export function stringifyFont({ main, words, look }: FontMap): string | undefined {
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
  const l = lookToken(look ?? {})
  if (l) parts.push(l)
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

/** Riječ u velikim/malim slovima — za crtanje na platnu (slike), gdje nema CSS-a. */
export function caseOf(word: string, w: WordStyle, look: VerseLook): string {
  if (w.upper || look.case === 'upper') return word.toLocaleUpperCase('bs')
  if (look.case === 'lower') return word.toLocaleLowerCase('bs')
  return word
}

/** Uvećanje cijelog stiha (1 = kako ga aplikacija sama složi). */
export const lookScale = (look: VerseLook) => (look.size ?? 100) / 100
/** Razmak slova cijelog stiha, u em (osnovni je -0.02, kao `.verse`). */
export const lookSpacing = (look: VerseLook) => (-2 + (look.ls ?? 0)) / 100

/**
 * CSS cijelog stiha — ide na element `.verse`. Riječi ga nasljeđuju, a kroz
 * varijable i one u drugom fontu (prored, razmak, boja naglaska).
 */
export function lookCss(look: VerseLook, accent?: string): CSSProperties {
  const lh = (look.lh ?? LIMITS.lh.base) / 100
  return {
    ...(look.lh ? { lineHeight: lh } : {}),
    ...(look.ls ? { letterSpacing: `${lookSpacing(look)}em` } : {}),
    ...(look.case ? { textTransform: look.case === 'upper' ? 'uppercase' : 'lowercase' } : {}),
    ...({
      '--verse-lh': String(lh / (LIMITS.lh.base / 100)),
      '--verse-ls': `${lookSpacing(look)}em`,
      ...(accent ? { '--verse-accent': accent } : {}),
    } as CSSProperties),
  }
}

/** CSS za stil — za ekran stiha i za uzorke u adminu. */
export function styleCss(w: WordStyle): CSSProperties | undefined {
  const f = VERSE_FONTS[w.font]
  const size = (w.size ?? 100) / 100
  const extra: CSSProperties = {
    // vlastita boja, ili boja raspoloženja (VerseText postavi --verse-accent)
    ...(w.color ? { color: `#${w.color}` } : w.accent ? { color: 'var(--verse-accent, currentColor)' } : {}),
    ...(w.upper ? { textTransform: 'uppercase', letterSpacing: f.kind === 'pisani' ? '0' : 'calc(var(--verse-ls, -0.02em) + 0.05em)' } : {}),
  }
  if (w.font === 'fraunces') {
    const css: CSSProperties = {
      // ukoso je zaseban rez (bez preloada); debljina preko ose 'wght'
      ...(w.italic ? { fontFamily: 'var(--font-serif-italic), var(--font-serif), serif', fontStyle: 'italic' } : {}),
      ...(w.bold || w.italic ? { fontVariationSettings: `'wght' ${w.bold ? 620 : 400}, 'opsz' 144, 'SOFT' 30, 'WONK' 0` } : {}),
      ...(size !== 1 ? { fontSize: `${size}em` } : {}),
      ...extra,
    }
    return Object.keys(css).length ? css : undefined
  }
  return {
    fontFamily: `${f.family}, ui-serif, Georgia, serif`,
    fontVariationSettings: 'normal',
    fontWeight: w.bold ? 700 : 400,
    fontStyle: w.italic ? 'italic' : 'normal',
    fontSize: `${+(f.scale * size).toFixed(3)}em`,
    // prored stiha (dizajn) vrijedi i za riječi u drugom fontu
    lineHeight: `calc(${f.lh} * var(--verse-lh, 1))`,
    letterSpacing: f.kind === 'pisani' ? '0' : undefined,
    // pisani nemaju "zraka" sa strane — uz klasičnu riječ bi se slijepili
    paddingInline: f.kind === 'pisani' ? '0.09em' : undefined,
    ...extra,
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
