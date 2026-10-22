/**
 * Slika za dijeljenje — crta se U PREGLEDNIKU, na canvasu.
 *
 * Ranije se slika tražila od servera (`/og/...`) pa je dijeljenje čekalo
 * mrežu, a slika nije ličila na ekran. Ovdje se crta odmah, istim fontovima
 * koje je stranica već učitala, istim paletama i istim portretom — pa je to
 * ista ruka kao ekran sa stihom. `/og` ostaje samo za pregled linka.
 *
 * Svi razmaci su udio širine (W), pa svaki format drži isti ritam.
 */

import { MOODS, FIGURE_SRC, type Mood } from '@/data/moods'
import { albumOf } from '@/data/albums'
import type { Verse } from '@/data/verses'
import { BRAND, MAGAZA_BESIDE, MAGAZA_DROP, MAGAZA_RATIO } from './brand'
import { formatFullDateBs } from './date'
import { albumLine, asWritten } from './text'
import { VERSE_FONTS, caseOf, lookScale, lookSpacing, parseFont, styleOf, type FontMap } from './fonts'

/* ── formati i stilovi ──────────────────────────────────────── */

export const SHARE_FORMATS = {
  story: { label: 'Story', hint: '9:16', w: 1080, h: 1920 },
  post: { label: 'Objava', hint: '4:5', w: 1080, h: 1350 },
  square: { label: 'Kvadrat', hint: '1:1', w: 1080, h: 1080 },
  // zaključan ekran (iPhone 1290 × 2796; Android ga samo malo obreže)
  pozadina: { label: 'Pozadina', hint: '', w: 1290, h: 2796 },
} as const

export type ShareFormat = keyof typeof SHARE_FORMATS


type Palette = {
  base: string
  blobs: [string, string]
  text: string
  accent: string
  /** potpis, naziv pjesme */
  chrome: string
  /** tihi metapodaci */
  muted: string
  /** vidljivost portreta; 0 = bez njega */
  figure: number
  figureMode: 'screen' | 'gild'
  bloom: number
  grain: number
  /** jačina vinjete (0 … 1) */
  vignette: number
  /** svijetla podloga traži tamnu sjenu teksta, ne crnu auru */
  light: boolean
}

/** Slika uvijek nosi boju svog stiha — isto što korisnik vidi na ekranu. */
function palette(mood: Mood): Palette {
  const m = MOODS[mood]
  return {
    base: m.gradient[0],
    blobs: [m.gradient[1], m.gradient[2]],
    text: m.text,
    accent: m.accent,
    chrome: BRAND.gold,
    muted: 'rgba(255,255,255,0.4)',
    // na slici portret mora biti malo jači nego na ekranu — nema pokreta
    // koji bi ga otkrio, a Instagram još i sabije kontrast
    figure: m.figure * 1.35,
    figureMode: 'screen',
    bloom: m.bloom,
    grain: m.grain,
    vignette: m.vignette,
    light: false,
  }
}

/* ── boje ───────────────────────────────────────────────────── */

/** `#RRGGBB` + alfa → `rgba(...)`. Canvas `transparent` je prozirna CRNA, pa
 *  preliv koji na njoj završi usput posivi — zato uvijek ista boja, alfa 0. */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1, 7), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/* ── resursi ────────────────────────────────────────────────── */

const images = new Map<string, Promise<HTMLImageElement | null>>()

function loadImage(src: string): Promise<HTMLImageElement | null> {
  let p = images.get(src)
  if (!p) {
    p = new Promise((res) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => res(img)
      img.onerror = () => res(null) // slika izađe i bez ovog sloja
      img.src = src
    })
    images.set(src, p)
  }
  return p
}

/**
 * Fraunces stiha za platno — isti rez kao na ekranu. Ekran ga crta s osama
 * `opsz 144, SOFT 30, WONK 0` (globals.css `.verse`), a platno ose ne zna
 * postaviti (bez njih je Fraunces "krivi" rez: WONK 1, SOFT 0, opsz po
 * veličini). Zato su te ose unaprijed upečene u ovaj font (public/fonts).
 */
const SHARE_SERIF = '"Fraunces Share"'
let shareFaces: Promise<unknown> | null = null
function loadShareSerif(): Promise<unknown> {
  if (shareFaces || typeof FontFace === 'undefined') return shareFaces ?? Promise.resolve()
  const faces = [
    new FontFace('Fraunces Share', 'url(/fonts/fraunces-share.woff2) format("woff2")', { weight: '100 900', style: 'normal' }),
    new FontFace('Fraunces Share', 'url(/fonts/fraunces-share-italic.woff2) format("woff2")', { weight: '100 900', style: 'italic' }),
  ]
  faces.forEach((f) => document.fonts.add(f))
  shareFaces = Promise.all(faces.map((f) => f.load().catch(() => null)))
  return shareFaces
}

/** Imena porodica — ista koja crta ekran (Fraunces stiha s osama ekrana). */
function fontFamilies() {
  const cs = getComputedStyle(document.documentElement)
  return {
    serif: `${SHARE_SERIF}, ${cs.getPropertyValue('--font-serif').trim() || 'Georgia, serif'}`,
    sans: cs.getPropertyValue('--font-sans').trim() || 'system-ui, sans-serif',
  }
}

/* ── stih po riječima, svaka u svom fontu (lib/fonts.ts) — kao na ekranu ── */

type Run = { text: string; css: string; width: number; pad: number; ls: number; accent: boolean; color?: string }
type VLine = { runs: Run[]; width: number }

/** CSS font riječi `i` za canvas — porodica iz next/font, veličina × `scale` fonta. */
function runCss(map: FontMap, i: number, size: number, serif: string): string {
  const st = styleOf(map, i)
  const f = VERSE_FONTS[st.font]
  const cs = getComputedStyle(document.documentElement)
  // Fraunces (i kurziv) iz istog upečenog fonta kao ekran — `serif` ga već nosi
  const family = st.font === 'fraunces' ? serif : cs.getPropertyValue(f.family.slice(4, -1)).trim() || serif
  const px = size * (st.font === 'fraunces' ? 1 : f.scale) * ((st.size ?? 100) / 100)
  // podebljan Fraunces je na ekranu wght 620 (lib/fonts.ts), ne 700
  return `${st.italic ? 'italic ' : ''}${st.bold ? (st.font === 'fraunces' ? 620 : 700) : 400} ${px}px ${family}`
}

/** Razmak slova na platnu (dizajn stiha) — gdje ga preglednik zna; pisani bez razmaka. */
function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`
}

/*
 * Razmak slova stiha (na ekranu -0.02em) — Safari na iPhoneu `letterSpacing`
 * na platnu nema, pa je stih na slici bio širi i rjeđi nego uživo. Tamo se
 * riječ crta slovo po slovo: svako slovo na mjestu koje mu daje širina
 * riječi do njega (parovi slova ostaju kao u fontu) + razmak, kao u CSS-u.
 */
const nativeLs = (ctx: CanvasRenderingContext2D) => typeof (ctx as { letterSpacing?: unknown }).letterSpacing === 'string'
function wordWidth(ctx: CanvasRenderingContext2D, word: string, ls: number) {
  if (nativeLs(ctx)) {
    setSpacing(ctx, ls)
    return ctx.measureText(word).width
  }
  return ctx.measureText(word).width + [...word].length * ls
}
function fillWord(ctx: CanvasRenderingContext2D, word: string, x: number, y: number, ls: number) {
  if (nativeLs(ctx) || !ls) {
    setSpacing(ctx, ls)
    return ctx.fillText(word, x, y)
  }
  const chars = [...word]
  let before = ''
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x + (before ? ctx.measureText(before).width : 0) + i * ls, y)
    before += ch
  })
}

/** Redovi stiha (prelom kako se pjeva, pa po širini) — riječi s izmjerenim širinama u svom fontu. */
function layoutVerse(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, map: FontMap, serif: string): VLine[] {
  setSpacing(ctx, 0)
  ctx.font = `400 ${size}px ${serif}`
  const space = ctx.measureText(' ').width
  const out: VLine[] = []
  let n = 0
  for (const raw of text.split('\n')) {
    let cur: Run[] = []
    let w = 0
    for (const raw2 of raw.trim().split(/\s+/).filter(Boolean)) {
      const st = styleOf(map, n)
      const css = runCss(map, n++, size, serif)
      const f = VERSE_FONTS[st.font]
      // velika/mala slova i razmak slova kao na ekranu (lib/fonts.ts)
      const word = caseOf(raw2, st, map.look)
      const em = size * (st.font === 'fraunces' ? 1 : f.scale) * ((st.size ?? 100) / 100)
      const ls = f.kind === 'pisani' ? 0 : em * (lookSpacing(map.look) + (st.upper ? 0.05 : 0))
      ctx.font = css
      // pisani nemaju "zraka" sa strane — isto kao na ekranu (0.09em)
      const pad = f.kind === 'pisani' ? em * 0.09 : 0
      const ww = wordWidth(ctx, word, ls) + pad * 2
      if (cur.length && w + space + ww > maxW) {
        out.push({ runs: cur, width: w })
        cur = []
        w = 0
      }
      w += (cur.length ? space : 0) + ww
      cur.push({ text: word, css, width: ww, pad, ls, accent: Boolean(st.accent), color: st.color && `#${st.color}` })
    }
    if (cur.length) out.push({ runs: cur, width: w })
  }
  setSpacing(ctx, 0)
  return out
}

/**
 * Najveća veličina (≤ `size`) na kojoj svaki red stiha stane cio u `maxW`.
 * U koracima, ne jednim dijeljenjem: Fraunces na manjoj veličini crta šira
 * slova (optička veličina), pa širina ne pada linearno.
 */
function fitWhole(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, min: number, map: FontMap, serif: string): number {
  const widest = (s: number) => Math.max(...layoutVerse(ctx, text, Infinity, s, map, serif).map((l) => l.width))
  const w0 = widest(size)
  if (w0 <= maxW) return size
  let s = Math.max(min, size * (maxW / w0) * 0.98)
  for (let k = 0; k < 40 && s > min && widest(s) > maxW * 0.99; k++) s *= 0.97
  return Math.max(min, s)
}

/** Gdje je koja riječ stiha na slici — za video (lib/share-video.ts). */
export type WordBox = { x: number; y: number; w: number; h: number; line: number }
/** Gdje je koji element Story slike — za video, da svaki uđe svojim pokretom. */
export type Mark = { kind: 'sig' | 'date' | 'song' | 'album' | 'label'; x: number; y: number; w: number; h: number }
/**
 * `bare`: samo pozadina — bez potpisa, datuma, stiha, pjesme, albuma i znaka;
 * `boxes`: zapiši gdje je koja riječ stiha; `marks`: gdje je koji ostali element.
 */
type VerseOpts = { bare?: boolean; boxes?: WordBox[]; marks?: Mark[] }

/**
 * Stih sa sjenom kao na ekranu (VerseText): `0 2px 30px rgba(0,0,0,.5)` i
 * aura u boji naglaska `0 0 48px accent/18%` — u pikselima ekrana širokog
 * 390, pa umnoženo na širinu slike. Ranije je sjena bila oko dva puta uža i
 * tik uz slova, pa su slova izgledala udvostručeno. Aura se crta samo kao
 * sjena: slova su tad van platna (pomak), pa se ne pojačaju dvaput.
 */
function drawVerseShadowed(ctx: CanvasRenderingContext2D, W: number, light: boolean, draw: (opts?: { quiet?: boolean }) => void) {
  if (light) return draw()
  const k = W / 390
  const glow = ctx.fillStyle
  ctx.save()
  const off = W * 4
  ctx.translate(-off, 0)
  ctx.shadowOffsetX = off
  ctx.shadowColor = typeof glow === 'string' && glow.startsWith('#') ? rgba(glow, 0.18) : 'rgba(0,0,0,0)'
  ctx.shadowBlur = 48 * k
  draw({ quiet: true })
  ctx.restore()
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 30 * k
  ctx.shadowOffsetY = 2 * k
  draw()
  ctx.restore()
}

/** Nacrtaj redove centrirano; `y` je sredina prvog reda. Riječi s naglaskom u boji `accent`. */
function drawVerse(ctx: CanvasRenderingContext2D, lines: VLine[], cx: number, y: number, lh: number, size: number, serif: string, accent?: string, opts: VerseOpts = {}) {
  if (opts.bare) return
  setSpacing(ctx, 0)
  ctx.font = `400 ${size}px ${serif}`
  const space = ctx.measureText(' ').width
  const base = ctx.fillStyle
  ctx.textAlign = 'left'
  lines.forEach((l, i) => {
    let x = cx - l.width / 2
    for (const r of l.runs) {
      ctx.font = r.css
      ctx.fillStyle = r.color ?? (r.accent && accent ? accent : base)
      fillWord(ctx, r.text, x + r.pad, y + i * lh, r.ls)
      opts.boxes?.push({ x, y: y + i * lh - lh / 2, w: r.width, h: lh, line: i })
      x += r.width + space
    }
  })
  setSpacing(ctx, 0)
  ctx.fillStyle = base
  ctx.textAlign = 'center'
}

let grainTile: HTMLCanvasElement | null = null
function grain(): HTMLCanvasElement {
  if (grainTile) return grainTile
  const s = 160
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')!
  const d = ctx.createImageData(s, s)
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v
    d.data[i + 3] = 255
  }
  ctx.putImageData(d, 0, 0)
  grainTile = c
  return c
}

/** Isti stih uvijek dobije isti raspored čestica i nota. */
function seeded(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ── tipografija ────────────────────────────────────────────── */

/**
 * Razmaknut verzal, slovo po slovo. `ctx.letterSpacing` Safari ne zna
 * pouzdano, a baš na iPhoneu se najviše dijeli.
 */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, gap: number) {
  const chars = [...text]
  const widths = chars.map((ch) => ctx.measureText(ch).width)
  const total = widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1)
  let cx = x - total / 2
  const align = ctx.textAlign
  ctx.textAlign = 'left'
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cx, y)
    cx += widths[i] + gap
  })
  ctx.textAlign = align
  return total
}

function spacedWidth(ctx: CanvasRenderingContext2D, text: string, gap: number) {
  const chars = [...text]
  return chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0) + gap * (chars.length - 1)
}

/** Red preširok za zadanu širinu → lomi se po riječima. Prelom iz podataka
 *  (kako se pjeva) uvijek ostaje. */

/* ── crtanje ────────────────────────────────────────────────── */

export type ShareInput = {
  verse: Verse
  date: string
  format: ShareFormat
}

/**
 * Gotove slike, da se panel otvori odmah. Crtanje 1080×1920 sa sjenama i
 * zrnom na telefonu traje i sekundu-dvije — zato se slika nacrta unaprijed
 * (`warmShareImage`, dok korisnik čita stih), a panel je samo prepiše.
 * Najviše tri — svaka je ~8 MB memorije.
 */
const drawn = new Map<string, HTMLCanvasElement>()
const pending = new Map<string, Promise<HTMLCanvasElement>>()

function key({ verse, date, format }: ShareInput) {
  return [verse.id, verse.text, verse.mood, verse.song, verse.album, verse.description ?? '', verse.year, verse.font ?? '', date, format].join('|')
}

function show(target: HTMLCanvasElement, c: HTMLCanvasElement) {
  target.width = c.width
  target.height = c.height
  target.getContext('2d')!.drawImage(c, 0, 0)
}

export async function drawShareImage(target: HTMLCanvasElement, input: ShareInput) {
  show(target, await shareCanvas(input))
}

/**
 * Za video (lib/share-video.ts): sama pozadina i cijela slika, i gdje je
 * koji element — video na pozadinu unosi element po element iz cijele slike.
 */
export async function storyLayers(input: ShareInput) {
  const words: WordBox[] = []
  const marks: Mark[] = []
  const full = await render(input, { boxes: words, marks })
  const bare = await render(input, { bare: true })
  return { full, bare, words, marks }
}

/** Nacrtaj sliku unaprijed, u tišini — prvi dodir na „Podijeli“ je onda trenutan. */
export function warmShareImage(input: ShareInput) {
  shareCanvas(input).catch(() => {})
}

function shareCanvas(input: ShareInput): Promise<HTMLCanvasElement> {
  const k = key(input)
  const hit = drawn.get(k)
  if (hit) return Promise.resolve(hit)
  let p = pending.get(k)
  if (!p) {
    p = render(input)
      .then((c) => {
        drawn.set(k, c)
        if (drawn.size > 3) drawn.delete(drawn.keys().next().value!)
        return c
      })
      .finally(() => pending.delete(k))
    pending.set(k, p)
  }
  return p
}

async function render(input: ShareInput, opts: VerseOpts = {}): Promise<HTMLCanvasElement> {
  const { verse, date, format } = input
  const { w: W, h: H } = SHARE_FORMATS[format]
  const p = palette(verse.mood)
  const fonts = fontFamilies()
  const text = asWritten(verse.text)
  const ratio = H / W

  const album = albumOf(verse.album)
  const coverSrc = album?.cover
  // fontovi stiha — učitani prije crtanja (canvas ne čeka sam)
  const map = parseFont(verse.font)
  // prored stiha kao na ekranu (dizajn: lib/fonts.ts)
  const lhOf = (map.look.lh ?? 118) / 100
  const words = text.split(/\s+/).filter(Boolean).length
  await loadShareSerif()
  const runFonts = [...new Set(Array.from({ length: words }, (_, i) => runCss(map, i, 100, fonts.serif)))]
  await Promise.all(runFonts.map((c) => document.fonts?.load(c, text).catch(() => null)))
  const [figure, signature, label, , , cover] = await Promise.all([
    // s albumom portreta nema — isto kao na ekranu
    p.figure > 0 && !coverSrc ? loadImage(FIGURE_SRC) : Promise.resolve(null),
    loadImage('/brand/signature.webp?v=2'),
    loadImage('/brand/magaza.svg?v=2'),
    document.fonts?.load(`400 100px ${fonts.serif}`, text).catch(() => null),
    document.fonts?.load(`500 40px ${fonts.sans}`).catch(() => null),
    coverSrc ? loadImage(coverSrc) : Promise.resolve(null),
  ])

  // Crta se van ekrana pa se prebaci odjednom — pregled ne trepće pri
  // promjeni formata ili stila, a gotova slika se pamti.
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!

  /* 1 — podloga i mrlje — iste kao na ekranu (MoodBackground): tri kruga od
     85vmax, na istim mjestima, s istim prelazom boje */
  ctx.fillStyle = p.base
  ctx.fillRect(0, 0, W, H)
  {
    const m = MOODS[verse.mood]
    const side = Math.max(W, H) * 0.85
    const r = (side / 2) * Math.SQRT2
    m.gradient.forEach((color, i) => {
      const x = W * [-0.15, 0.35, 0.05][i] + side / 2
      const y = H * [-0.1, 0.2, 0.55][i] + side / 2
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, rgba(color, 1))
      g.addColorStop(0.22, rgba(color, 0xb0 / 255))
      g.addColorStop(0.46, rgba(color, 0x38 / 255))
      g.addColorStop(0.7, rgba(color, 0))
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    })
  }

  /* 2 — portret, utopljen u gornji dio kao na ekranu */
  if (figure && p.figure > 0) {
    // Krupno i u gornjem desnom uglu, kao na ekranu: lice (na ~45% širine
    // slike) pada na 70% širine platna, stih ostaje na čistom.
    const fh = H * (ratio > 1.5 ? 0.8 : 1.12)
    const fw = fh * (figure.width / figure.height)
    const fx = W * 0.7 - fw * 0.45
    const fy = -H * 0.02
    const layer = document.createElement('canvas')
    layer.width = W
    layer.height = H
    const l = layer.getContext('2d')!
    l.drawImage(figure, fx, fy, fw, fh)
    if (p.figureMode === 'gild') {
      // svijetli dijelovi lica postaju topli zlatni odsjaj
      l.globalCompositeOperation = 'source-in'
      l.fillStyle = '#FFF3D6'
      l.fillRect(0, 0, W, H)
    }
    // meka maska: lice je tu, rubovi se gube
    l.globalCompositeOperation = 'destination-in'
    const cx = W * 0.72
    const cy = fy + fh * 0.3
    const rx = fw * 0.62
    const ry = fh * 0.55
    l.save()
    l.translate(cx, cy)
    l.scale(1, ry / rx)
    const mg = l.createRadialGradient(0, 0, 0, 0, 0, rx)
    mg.addColorStop(0, 'rgba(0,0,0,1)')
    mg.addColorStop(0.42, 'rgba(0,0,0,0.85)')
    mg.addColorStop(1, 'rgba(0,0,0,0)')
    l.fillStyle = mg
    l.fillRect(-W * 2, -H * 2, W * 4, H * 4)
    l.restore()

    ctx.save()
    ctx.globalAlpha = Math.min(1, p.figure)
    ctx.globalCompositeOperation = p.figureMode === 'gild' ? 'soft-light' : 'screen'
    ctx.drawImage(layer, 0, 0)
    ctx.restore()
  }

  /* 2b — album stiha, sloj po sloj kao na ekranu (MoodBackground + globals.css):
     zamućena atmosfera, podloga s odrazom, jasan omot, nijansa, tama, vinjeta */
  if (cover) {
    // zamućenje smanjivanjem pa uvećavanjem (Safari ne zna `ctx.filter`)
    const soft = (src: CanvasImageSource, w: number, h: number, k: number) => {
      const t = document.createElement('canvas')
      t.width = Math.max(2, Math.round(w / k))
      t.height = Math.max(2, Math.round(h / k))
      const tc = t.getContext('2d')!
      tc.imageSmoothingQuality = 'high'
      tc.drawImage(src, 0, 0, t.width, t.height)
      return t
    }
    const mask = (c: CanvasRenderingContext2D, w: number, h: number, stops: [number, number][], sides: [number, number][]) => {
      c.globalCompositeOperation = 'destination-in'
      const v = c.createLinearGradient(0, 0, 0, h)
      for (const [o, a] of stops) v.addColorStop(o, `rgba(0,0,0,${a})`)
      c.fillStyle = v
      c.fillRect(0, 0, w, h)
      const hz = c.createLinearGradient(0, 0, w, 0)
      for (const [o, a] of sides) hz.addColorStop(o, `rgba(0,0,0,${a})`)
      c.fillStyle = hz
      c.fillRect(0, 0, w, h)
      c.globalCompositeOperation = 'source-over'
    }
    const sides: [number, number][] = [[0, 0], [0.2, 1], [0.8, 1], [1, 0]]

    // atmosfera: omot preko cijelog ekrana (-15 %, ×1.1), jako zamućen, 0.32
    {
      const sq = Math.max(W, H) * 1.3 * 1.1
      ctx.save()
      ctx.globalAlpha = 0.32
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(soft(soft(cover, 64, 64, 1), 64, 64, 5.3), (W - sq) / 2, (H - sq) / 2, sq, sq)
      ctx.restore()
    }

    // omot: kao na telefonu — širina min(ekran, 74 % visine), malo spušten
    const art = Math.min(W, H * 0.74)
    const ax = (W - art) / 2
    const ay = (format === 'pozadina' ? H * 0.1 : H * 0.06 + art * 0.02) - art * (album?.lift ?? 0)

    // podloga: isti omot zamućen + odraz iznad njega — boje s vrha se nastave
    {
      const gh = art * 1.35
      const g = document.createElement('canvas')
      g.width = Math.ceil(art)
      g.height = Math.ceil(gh)
      const gc = g.getContext('2d')!
      gc.drawImage(cover, 0, art * 0.35, art, art)
      gc.save()
      gc.translate(0, art * 0.35)
      gc.scale(1, -1)
      gc.drawImage(cover, 0, 0, cover.width, cover.height * 0.35, 0, 0, art, art * 0.35)
      gc.restore()
      // isto zamućenje kao na ekranu (28px na omotu od ~390px ≈ 7 % širine) —
      // slabije bi pokazalo odraz kao blijedu kopiju albuma
      const blurred = soft(soft(g, art, gh, art / 48), art, gh, art / 14)
      const out = document.createElement('canvas')
      out.width = g.width
      out.height = g.height
      const oc = out.getContext('2d')!
      oc.imageSmoothingQuality = 'high'
      oc.drawImage(blurred, 0, 0, art, gh)
      mask(oc, art, gh, [[0, 0], [0.2, 1], [0.52, 1], [0.72, 0.3], [0.9, 0]], [[0, 0], [0.18, 1], [0.82, 1], [1, 0]])
      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.drawImage(out, ax, ay - art * 0.35)
      ctx.restore()
    }

    // jasan omot, utopljen gore, dole i u strane (globals.css .album-art)
    {
      const l = document.createElement('canvas')
      l.width = Math.ceil(art)
      l.height = Math.ceil(art)
      const lc = l.getContext('2d')!
      lc.drawImage(cover, 0, 0, art, art)
      mask(
        lc,
        art,
        art,
        [[0, 0], [0.07, 0.12], [0.15, 0.4], [0.23, 0.75], [0.31, 1], [0.42, 1], [0.64, 0.35], [0.86, 0]],
        sides,
      )
      ctx.save()
      ctx.globalAlpha = 0.42
      // boja iznad omota (npr. bijeli papir) — do vrha ekrana, iza mekog ruba
      if (album?.fill) {
        const top = ay + art * (0.3 + 0.02)
        const f = document.createElement('canvas')
        f.width = Math.ceil(art)
        f.height = Math.max(1, Math.ceil(top))
        const fc = f.getContext('2d')!
        fc.fillStyle = album.fill
        fc.fillRect(0, 0, art, top)
        mask(fc, art, top, [[0, 1], [0.62, 1], [1, 0]], sides)
        ctx.drawImage(f, ax, 0)
      }
      ctx.drawImage(l, ax, ay)
      ctx.restore()
    }

    // nijansa raspoloženja preko albuma
    ctx.save()
    ctx.globalCompositeOperation = 'color'
    ctx.globalAlpha = 0.4
    ctx.fillStyle = MOODS[verse.mood].gradient[1]
    ctx.fillRect(0, 0, W, H)
    ctx.restore()

    // tama odozdo — da stih ostane čitak
    const shade = ctx.createLinearGradient(0, 0, 0, H)
    shade.addColorStop(0, 'rgba(0,0,0,0.25)')
    shade.addColorStop(0.22, 'rgba(0,0,0,0.12)')
    shade.addColorStop(0.5, 'rgba(0,0,0,0.38)')
    shade.addColorStop(0.78, 'rgba(0,0,0,0.7)')
    shade.addColorStop(1, 'rgba(0,0,0,0.85)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, W, H)
  }

  /* 3 — vinjeta, kao na ekranu: elipsa, prozirno do 35 %, pa tama rubova */
  {
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.scale(1, H / W)
    const R = (W / 2) * Math.SQRT2
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R)
    g.addColorStop(0.35, 'rgba(0,0,0,0)')
    g.addColorStop(1, `rgba(0,0,0,${MOODS[verse.mood].vignette})`)
    ctx.fillStyle = g
    ctx.fillRect(-W, -W, W * 2, W * 2)
    ctx.restore()
  }

  /* 3b — atmosfera: čestice i note. Ekran je živ jer se
     kreće; slika se ne kreće, pa joj dubinu moraju dati slojevi. */
  const rand = seeded(verse.id)
  {
    // čestice — mekani krugovi u boji naglaska, gušći pri vrhu
    for (let i = 0; i < 22; i++) {
      const x = rand() * W
      const y = Math.pow(rand(), 1.4) * H
      const r = W * (0.004 + rand() * rand() * 0.03)
      const a = (p.light ? 0.18 : 0.12) * (0.3 + rand() * 0.7)
      const b = ctx.createRadialGradient(x, y, 0, x, y, r)
      b.addColorStop(0, rgba(p.light ? '#FFF8E8' : p.accent, a))
      b.addColorStop(1, rgba(p.light ? '#FFF8E8' : p.accent, 0))
      ctx.fillStyle = b
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // note uz rubove — nikad preko stiha
    const glyphs = ['♪', '♫', '♩', '♬']
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < 7; i++) {
      const left = i % 2 === 0
      const x = left ? W * (0.08 + rand() * 0.14) : W * (0.78 + rand() * 0.14)
      const y = H * (0.12 + rand() * 0.76)
      const sz = W * (0.03 + rand() * 0.035)
      ctx.globalAlpha = (p.light ? 0.2 : 0.16) + rand() * 0.14
      ctx.fillStyle = p.light ? p.text : p.accent
      ctx.font = `400 ${sz}px ${fonts.serif}`
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate((rand() - 0.5) * 0.5)
      ctx.fillText(glyphs[Math.floor(rand() * glyphs.length)], 0, 0)
      ctx.restore()
    }
    ctx.restore()
  }

  /** Pozadina: gore sat i datum — stih na sredini, ispod pjesma i album;
   *  na dnu, na sredini, potpis i znak Magaze jedan do drugog (kao zaglavlje
   *  aplikacije). Ništa u gornjih ~33 %. */
  function wallpaperText() {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const maxW = W * 0.8
    let size = W * 0.086 * lookScale(map.look)
    // svaki red stiha cio (u jednom redu) — slova se smanje koliko treba
    size = fitWhole(ctx, text, maxW, size, W * 0.035, map, fonts.serif)
    let lines: VLine[] = []
    for (;;) {
      lines = layoutVerse(ctx, text, maxW, size, map, fonts.serif)
      if (lines.length * size * lhOf <= H * 0.2 || size <= W * 0.05) break
      size *= 0.95
    }
    const lh = size * lhOf
    let songSize = W * 0.03
    let songGap = W * 0.0055
    ctx.font = `600 ${songSize}px ${fonts.sans}`
    while (spacedWidth(ctx, verse.song.toUpperCase(), songGap) > maxW && songSize > W * 0.014) {
      songSize *= 0.95
      songGap *= 0.95
      ctx.font = `600 ${songSize}px ${fonts.sans}`
    }
    const albumSize = W * 0.021
    const g1 = size * 0.8
    const g2 = W * 0.016
    const blockH = lines.length * lh + g1 + songSize + g2 + albumSize
    // malo ispod sredine — gore je sat
    let y = H * 0.5 - blockH / 2

    ctx.save()
    ctx.font = `400 ${size}px ${fonts.serif}`
    // aura u boji naglaska (kao na ekranu), pa slova u boji stiha
    ctx.fillStyle = p.accent
    drawVerseShadowed(ctx, W, p.light, (o) => {
      ctx.fillStyle = o?.quiet ? p.accent : p.text
      drawVerse(ctx, lines, W / 2, y + lh / 2, lh, size, fonts.serif, p.accent, o?.quiet ? { bare: opts.bare } : opts)
    })
    ctx.restore()
    y += lines.length * lh + g1

    ctx.font = `600 ${songSize}px ${fonts.sans}`
    ctx.fillStyle = p.chrome
    spaced(ctx, verse.song.toUpperCase(), W / 2, y + songSize / 2, songGap)
    y += songSize + g2
    ctx.font = `500 ${albumSize}px ${fonts.sans}`
    ctx.fillStyle = p.light ? 'rgba(27,20,11,0.7)' : 'rgba(255,255,255,0.62)'
    spaced(ctx, albumLine(verse).toUpperCase(), W / 2, y + albumSize / 2, W * 0.005)

    // dno: potpis | Magaza, na sredini, između svjetiljke i kamere
    const tint = (img: HTMLImageElement, w: number, h: number) => {
      const s = document.createElement('canvas')
      s.width = Math.ceil(w)
      s.height = Math.ceil(h)
      const sc = s.getContext('2d')!
      sc.drawImage(img, 0, 0, w, h)
      sc.globalCompositeOperation = 'source-in'
      sc.fillStyle = p.light ? p.text : '#F4F4F4'
      sc.fillRect(0, 0, w, h)
      return s
    }
    const sigH = W * 0.075
    const sigW = signature ? sigH * (signature.width / signature.height) : 0
    // crta između znakova ostaje iste visine kao prije (mjera je stari znak sa "Sarajevo")
    const rule = W * 0.034
    const magH = sigH * MAGAZA_BESIDE
    const magW = label ? magH * MAGAZA_RATIO : 0
    const gap = W * 0.035
    const both = signature && label
    const rowW = sigW + magW + (both ? gap * 2 : 0)
    const cy = H * 0.905
    let x = W / 2 - rowW / 2
    ctx.save()
    ctx.globalAlpha = 0.92
    if (signature) {
      ctx.drawImage(tint(signature, sigW, sigH), x, cy - sigH / 2)
      x += sigW
    }
    if (both) {
      ctx.fillStyle = p.light ? rgba('#000000', 0.25) : 'rgba(255,255,255,0.3)'
      ctx.fillRect(x + gap - 1, cy - rule * 0.75, 2, rule * 1.5)
      x += gap * 2
    }
    if (label) ctx.drawImage(tint(label, magW, magH), x, cy - magH / 2 + magH * MAGAZA_DROP)
    ctx.restore()
  }

  if (format === 'pozadina') {
    const top = ctx.createLinearGradient(0, 0, 0, H * 0.36)
    top.addColorStop(0, 'rgba(0,0,0,0.32)')
    top.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = top
    ctx.fillRect(0, 0, W, H * 0.36)
    wallpaperText()
  } else {
  /* 4 — slog: zaglavlje odozgo, podnožje odozdo, stih u sredini */
  const pad = W * 0.085
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // zaglavlje: samo potpis — datum ide uz stih, kao na ekranu
  let top = pad + (ratio > 1.5 ? W * 0.06 : 0)
  const sigH = W * (ratio > 1.5 ? 0.1 : 0.085)
  if (opts.bare) {
    /* samo pozadina */
  } else if (signature) {
    const sw = sigH * (signature.width / signature.height)
    const s = document.createElement('canvas')
    s.width = Math.ceil(sw)
    s.height = Math.ceil(sigH)
    const sc = s.getContext('2d')!
    sc.drawImage(signature, 0, 0, sw, sigH)
    sc.globalCompositeOperation = 'source-in'
    sc.fillStyle = p.light ? p.text : '#F4F4F4'
    sc.fillRect(0, 0, sw, sigH)
    ctx.save()
    ctx.globalAlpha = 0.92
    ctx.drawImage(s, W / 2 - sw / 2, top)
    ctx.restore()
    opts.marks?.push({ kind: 'sig', x: W / 2 - sw / 2, y: top, w: sw, h: sigH })
  } else {
    ctx.fillStyle = p.light ? p.text : '#F4F4F4'
    ctx.font = `700 ${W * 0.045}px ${fonts.sans}`
    spaced(ctx, BRAND.name.toUpperCase(), W / 2, top + sigH / 2, W * 0.008)
    opts.marks?.push({ kind: 'sig', x: pad, y: top, w: W - pad * 2, h: sigH })
  }
  top += sigH

  // podnožje — znak spušten bliže dnu, odvojen od pjesme i albuma
  let bottom = H - pad * 0.75 - (ratio > 1.5 ? W * 0.04 : 0)

  // na dnu znak izdavača; bez njega tihi natpis aplikacije
  if (label) {
    const lh = W * 0.037
    const lw = lh * MAGAZA_RATIO
    const s = document.createElement('canvas')
    s.width = Math.ceil(lw)
    s.height = Math.ceil(lh)
    const sc = s.getContext('2d')!
    sc.drawImage(label, 0, 0, lw, lh)
    sc.globalCompositeOperation = 'source-in'
    // ista boja i jačina kao potpis gore
    sc.fillStyle = p.light ? p.text : '#F4F4F4'
    sc.fillRect(0, 0, lw, lh)
    if (!opts.bare) {
      ctx.save()
      ctx.globalAlpha = 0.92
      ctx.drawImage(s, W / 2 - lw / 2, bottom - lh)
      ctx.restore()
      opts.marks?.push({ kind: 'label', x: W / 2 - lw / 2, y: bottom - lh, w: lw, h: lh })
    }
    // sadržaj ide gore, znak ostaje dolje — jasan razmak između njih
    bottom -= lh + W * (ratio > 1.5 ? 0.14 : 0.1)
  } else {
    const tagSize = W * 0.0165
    ctx.font = `500 ${tagSize}px ${fonts.sans}`
    ctx.fillStyle = p.muted
    if (!opts.bare) {
      spaced(ctx, 'STIH DANA', W / 2, bottom - tagSize / 2, W * 0.009)
      const tw = spacedWidth(ctx, 'STIH DANA', W * 0.009)
      opts.marks?.push({ kind: 'label', x: W / 2 - tw / 2, y: bottom - tagSize, w: tw, h: tagSize })
    }
    bottom -= tagSize + W * 0.05
  }

  const albumSize = W * 0.025
  ctx.font = `500 ${albumSize}px ${fonts.sans}`
  ctx.fillStyle = p.light ? 'rgba(27,20,11,0.7)' : 'rgba(255,255,255,0.62)'
  if (!opts.bare) {
    const t = albumLine(verse).toUpperCase()
    spaced(ctx, t, W / 2, bottom - albumSize / 2, W * 0.0055)
    const aw = spacedWidth(ctx, t, W * 0.0055)
    opts.marks?.push({ kind: 'album', x: W / 2 - aw / 2, y: bottom - albumSize, w: aw, h: albumSize })
  }
  bottom -= albumSize + W * 0.028

  let songSize = W * 0.043
  let songGap = W * 0.0075
  ctx.font = `600 ${songSize}px ${fonts.sans}`
  // naziv pjesme uvijek u jednom redu — dug naziv dobije manja slova
  while (spacedWidth(ctx, verse.song.toUpperCase(), songGap) > W - pad * 2 && songSize > W * 0.014) {
    songSize *= 0.95
    songGap *= 0.95
    ctx.font = `600 ${songSize}px ${fonts.sans}`
  }
  ctx.fillStyle = p.chrome
  if (!opts.bare) {
    spaced(ctx, verse.song.toUpperCase(), W / 2, bottom - songSize / 2, songGap)
    const sw2 = spacedWidth(ctx, verse.song.toUpperCase(), songGap)
    opts.marks?.push({ kind: 'song', x: W / 2 - sw2 / 2, y: bottom - songSize, w: sw2, h: songSize })
  }
  bottom -= songSize

  // Srednji blok, isti kao na ekranu: datum → stih, sa razmakom od ~0.62
  // visine slova stiha (na ekranu 2rem uz stih od ~3.2rem).
  // Blok se centrira u prostor između potpisa i pjesme.
  const dateSize = W * 0.021
  const GAP = 0.62
  const air = W * (ratio > 1.5 ? 0.09 : ratio > 1.1 ? 0.06 : 0.045)
  const areaTop = top + air
  const areaBottom = bottom - air
  // širina stiha kao na telefonu (px-6 na ~390 px) — ~86 % slike
  const maxW = W * 0.86

  // Prvo se font smanji da svaki red iz podataka stane CIJEO — prelom prati
  // kako se pjeva, pa jedna riječ sama u redu izgleda kao greška. Lomi se
  // tek ispod donje granice veličine.
  // početna veličina kao na ekranu (VerseText verseFontSize): po najdužem redu,
  // 6.4–16 % širine; pa se smanji koliko treba da redovi stanu cijeli
  const longest = Math.max(...text.split('\n').map((l) => l.trim().length), 1)
  let size = W * Math.min(0.16, Math.max(0.072, 1.74 / longest)) * lookScale(map.look)
  size = fitWhole(ctx, text, maxW, size, W * 0.04, map, fonts.serif)
  let lines: VLine[] = []
  let lh = 0
  for (;;) {
    lines = layoutVerse(ctx, text, maxW, size, map, fonts.serif)
    lh = size * lhOf
    const group = dateSize + size * GAP + lines.length * lh
    if (group <= areaBottom - areaTop || size <= W * 0.045) break
    size *= 0.96
  }
  const blockH = lines.length * lh
  const gap = size * GAP
  const groupH = dateSize + gap + blockH
  // optički centar je malo iznad geometrijskog
  const mid = (areaTop + areaBottom) / 2 - W * 0.01
  const groupTop = mid - groupH / 2
  const firstY = groupTop + dateSize + gap + lh / 2

  ctx.font = `600 ${dateSize}px ${fonts.sans}`
  ctx.fillStyle = p.accent
  if (!opts.bare) {
    const t = formatFullDateBs(date).toUpperCase()
    spaced(ctx, t, W / 2, groupTop + dateSize / 2, W * 0.0062)
    const dw = spacedWidth(ctx, t, W * 0.0062)
    opts.marks?.push({ kind: 'date', x: W / 2 - dw / 2, y: groupTop, w: dw, h: dateSize })
  }

  if (p.bloom > 0) {
    const g = ctx.createRadialGradient(W / 2, mid, 0, W / 2, mid, W * 0.55)
    g.addColorStop(0, rgba(p.accent, 0.16 * p.bloom))
    g.addColorStop(1, rgba(p.accent, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  ctx.save()
  ctx.font = `400 ${size}px ${fonts.serif}`
  // aura u boji naglaska (kao na ekranu), pa slova u boji stiha
  ctx.fillStyle = p.accent
  drawVerseShadowed(ctx, W, p.light, (o) => {
    ctx.fillStyle = o?.quiet ? p.accent : p.text
    drawVerse(ctx, lines, W / 2, firstY, lh, size, fonts.serif, p.accent, o?.quiet ? { bare: opts.bare } : opts)
  })
  ctx.restore()


  }

  /* 5 — zrno preko svega, da slika ima materijal a ne plastiku */
  if (p.grain > 0) {
    ctx.save()
    ctx.globalAlpha = (p.light ? 0.07 : 0.055) * (0.6 + p.grain)
    ctx.globalCompositeOperation = p.light ? 'multiply' : 'overlay'
    ctx.fillStyle = ctx.createPattern(grain(), 'repeat')!
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
  }

  return c
}

/** JPEG, ne PNG: zrno čini PNG teškim ~3 MB, a Instagram i WhatsApp ga
 *  ionako ponovo sabiju. Na 0.92 razlika se ne vidi, fajl je ~10× manji. */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
}
