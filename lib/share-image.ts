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
import { BRAND } from './brand'
import { formatFullDateBs } from './date'
import { withPeriod } from './text'

/* ── formati i stilovi ──────────────────────────────────────── */

export const SHARE_FORMATS = {
  story: { label: 'Story', hint: '9:16', w: 1080, h: 1920 },
  post: { label: 'Objava', hint: '4:5', w: 1080, h: 1350 },
  square: { label: 'Kvadrat', hint: '1:1', w: 1080, h: 1080 },
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

/** Imena porodica iz next/font — ista koja crta ekran. */
function fontFamilies() {
  const cs = getComputedStyle(document.documentElement)
  return {
    serif: cs.getPropertyValue('--font-serif').trim() || 'Georgia, serif',
    sans: cs.getPropertyValue('--font-sans').trim() || 'system-ui, sans-serif',
  }
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
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const raw of text.split('\n')) {
    let line = ''
    for (const word of raw.trim().split(/\s+/)) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line)
        line = word
      } else line = test
    }
    if (line) out.push(line)
  }
  return out
}

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
  return [verse.id, verse.text, verse.mood, verse.song, verse.album, verse.year, date, format].join('|')
}

function show(target: HTMLCanvasElement, c: HTMLCanvasElement) {
  target.width = c.width
  target.height = c.height
  target.getContext('2d')!.drawImage(c, 0, 0)
}

export async function drawShareImage(target: HTMLCanvasElement, input: ShareInput) {
  show(target, await shareCanvas(input))
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

async function render(input: ShareInput): Promise<HTMLCanvasElement> {
  const { verse, date, format } = input
  const { w: W, h: H } = SHARE_FORMATS[format]
  const p = palette(verse.mood)
  const fonts = fontFamilies()
  const text = withPeriod(verse.text)
  const ratio = H / W

  const album = albumOf(verse.album)
  const coverSrc = album?.cover
  const [figure, signature, label, , , cover] = await Promise.all([
    // s albumom portreta nema — isto kao na ekranu
    p.figure > 0 && !coverSrc ? loadImage(FIGURE_SRC) : Promise.resolve(null),
    loadImage('/brand/signature.webp'),
    loadImage('/brand/magaza.svg'),
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

  /* 1 — podloga i mrlje */
  ctx.fillStyle = p.base
  ctx.fillRect(0, 0, W, H)
  const blob = (x: number, y: number, r: number, color: string, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, rgba(color, a))
    g.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  blob(W * 0.22, H * 0.16, Math.max(W, H) * 0.62, p.blobs[1], 0.95)
  blob(W * 0.86, H * 0.84, Math.max(W, H) * 0.6, p.blobs[0], 0.9)
  blob(W * 0.5, H * 0.5, W * 0.7, p.blobs[1], 0.25)

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

  /* 2b — album stiha, kao na ekranu: zamućena atmosfera, jasan omot gore
     koji nestaje u strane i prema stihu, nijansa raspoloženja, tama odozdo */
  if (cover) {
    // Atmosfera: boje albuma razlivene preko cijele slike. Zamućuje se
    // smanjivanjem pa uvećavanjem, ne `ctx.filter` — Safari ga ne zna, pa je
    // na iPhoneu umjesto magle preko slike ležao oštar, uvećan omot.
    const s = Math.max(W, H) * 1.3
    const tiny = document.createElement('canvas')
    tiny.width = tiny.height = 12
    const tc = tiny.getContext('2d')!
    tc.imageSmoothingQuality = 'high'
    tc.drawImage(cover, 0, 0, 12, 12)
    // Koliko je omot svijetao (0 … 1). Svijetao omot (bijeli papir) se crta
    // tiše — inače bijeli potpis i stih nestanu na njemu.
    const px = tc.getImageData(0, 0, 12, 12).data
    let lum = 0
    for (let i = 0; i < px.length; i += 4) lum += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255
    const bright = Math.min(1, Math.max(0, lum / (px.length / 4) - 0.45) * 2.5)
    const soft = document.createElement('canvas')
    soft.width = soft.height = 96
    const sc = soft.getContext('2d')!
    sc.imageSmoothingQuality = 'high'
    sc.drawImage(tiny, 0, 0, 96, 96)
    ctx.save()
    ctx.imageSmoothingQuality = 'high'
    // tiho: jače podigne tamne dijelove i cijela slika ode u mlijeko
    ctx.globalAlpha = 0.2 - 0.08 * bright
    ctx.drawImage(soft, (W - s) / 2, (H - s) / 2, s, s)
    ctx.restore()

    // Kao na telefonu: omot preko cijele širine, gore. Kod nižih formata
    // (objava, kvadrat) podignut je, da utapanje stigne prije stiha.
    const art = W
    // spušten od vrha i utopljen i gore — kao na telefonu
    const ay = (format === 'story' ? H * 0.06 : format === 'post' ? -W * 0.02 : -W * 0.16) - art * (album?.lift ?? 0)
    const layer = document.createElement('canvas')
    layer.width = W
    layer.height = H
    const l = layer.getContext('2d')!
    const ax = 0
    l.drawImage(cover, ax, ay, art, art)
    l.globalCompositeOperation = 'destination-in'
    const down = l.createLinearGradient(0, ay, 0, ay + art)
    down.addColorStop(0, 'rgba(0,0,0,0)')
    down.addColorStop(0.18, 'rgba(0,0,0,1)')
    down.addColorStop(0.4, 'rgba(0,0,0,1)')
    down.addColorStop(0.64, 'rgba(0,0,0,0.35)')
    down.addColorStop(0.86, 'rgba(0,0,0,0)')
    l.fillStyle = down
    l.fillRect(0, 0, W, H)
    const side = l.createLinearGradient(ax, 0, ax + art, 0)
    side.addColorStop(0, 'rgba(0,0,0,0)')
    side.addColorStop(0.2, 'rgba(0,0,0,1)')
    side.addColorStop(0.8, 'rgba(0,0,0,1)')
    side.addColorStop(1, 'rgba(0,0,0,0)')
    l.fillStyle = side
    l.fillRect(0, 0, W, H)
    // boja iznad omota (npr. bijeli papir) — nastavi ga do vrha, iza njegovog
    // mekog gornjeg ruba, s istim stranama kao omot
    if (album?.fill) {
      const top = ay + art * 0.3
      const f = document.createElement('canvas')
      f.width = W
      f.height = H
      const fc = f.getContext('2d')!
      fc.fillStyle = album.fill
      fc.fillRect(ax, 0, art, top)
      fc.globalCompositeOperation = 'destination-in'
      const fade = fc.createLinearGradient(0, 0, 0, top)
      fade.addColorStop(0, 'rgba(0,0,0,1)')
      fade.addColorStop(0.62, 'rgba(0,0,0,1)')
      fade.addColorStop(1, 'rgba(0,0,0,0)')
      fc.fillStyle = fade
      fc.fillRect(0, 0, W, H)
      const fside = fc.createLinearGradient(ax, 0, ax + art, 0)
      fside.addColorStop(0, 'rgba(0,0,0,0)')
      fside.addColorStop(0.2, 'rgba(0,0,0,1)')
      fside.addColorStop(0.8, 'rgba(0,0,0,1)')
      fside.addColorStop(1, 'rgba(0,0,0,0)')
      fc.fillStyle = fside
      fc.fillRect(0, 0, W, H)
      l.globalCompositeOperation = 'destination-over'
      l.drawImage(f, 0, 0)
      l.globalCompositeOperation = 'source-over'
    }
    // Jače nego na ekranu: slika miruje i Instagram je još sabije, pa
    // prozirniji omot ispadne magla, a ne album.
    ctx.save()
    ctx.globalAlpha = 0.62 - 0.24 * bright
    ctx.drawImage(layer, 0, 0)
    ctx.restore()

    // nijansa raspoloženja — blaža nego na ekranu, da album zadrži svoje boje
    ctx.save()
    ctx.globalCompositeOperation = 'color'
    ctx.globalAlpha = 0.28
    ctx.fillStyle = MOODS[verse.mood].gradient[1]
    ctx.fillRect(0, 0, W, H)
    ctx.restore()

    // tama odozdo u dubokoj boji raspoloženja, ne crna — dno ostaje u boji
    const deep = MOODS[verse.mood].gradient[0]
    const shade = ctx.createLinearGradient(0, 0, 0, H)
    shade.addColorStop(0, rgba(deep, 0.22))
    shade.addColorStop(0.22, rgba(deep, 0.06))
    shade.addColorStop(0.5, rgba(deep, 0.3))
    shade.addColorStop(0.78, rgba(deep, 0.5))
    shade.addColorStop(1, rgba(deep, 0.62))
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, W, H)

    // dno ne smije biti prazna tama: blagi sjaj raspoloženja iza pjesme
    blob(W * 0.5, H * 1.02, W * 0.95, p.blobs[1], 0.5)
  }

  /* 3 — vinjeta; uz album blaža, inače rubovi i dno odu u crno */
  {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.78)
    const v = cover ? 0.6 : 1
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, `rgba(0,0,0,${p.vignette * v})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
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

  /* 4 — slog: zaglavlje odozgo, podnožje odozdo, stih u sredini */
  const pad = W * 0.085
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // zaglavlje: samo potpis — datum ide uz stih, kao na ekranu
  let top = pad + (ratio > 1.5 ? W * 0.06 : 0)
  const sigH = W * (ratio > 1.5 ? 0.1 : 0.085)
  if (signature) {
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
  } else {
    ctx.fillStyle = p.light ? p.text : '#F4F4F4'
    ctx.font = `700 ${W * 0.045}px ${fonts.sans}`
    spaced(ctx, BRAND.name.toUpperCase(), W / 2, top + sigH / 2, W * 0.008)
  }
  top += sigH

  // podnožje
  let bottom = H - pad - (ratio > 1.5 ? W * 0.05 : 0)

  // na dnu znak izdavača; bez njega tihi natpis aplikacije
  if (label) {
    const lh = W * 0.048
    const lw = lh * (316 / 87)
    const s = document.createElement('canvas')
    s.width = Math.ceil(lw)
    s.height = Math.ceil(lh)
    const sc = s.getContext('2d')!
    sc.drawImage(label, 0, 0, lw, lh)
    sc.globalCompositeOperation = 'source-in'
    sc.fillStyle = p.light ? p.text : '#FFFFFF'
    sc.fillRect(0, 0, lw, lh)
    ctx.save()
    ctx.globalAlpha = p.light ? 0.55 : 0.5
    ctx.drawImage(s, W / 2 - lw / 2, bottom - lh)
    ctx.restore()
    bottom -= lh + W * 0.05
  } else {
    const tagSize = W * 0.0165
    ctx.font = `500 ${tagSize}px ${fonts.sans}`
    ctx.fillStyle = p.muted
    spaced(ctx, 'STIH DANA', W / 2, bottom - tagSize / 2, W * 0.009)
    bottom -= tagSize + W * 0.05
  }

  const albumSize = W * 0.025
  ctx.font = `500 ${albumSize}px ${fonts.sans}`
  ctx.fillStyle = p.light ? 'rgba(27,20,11,0.7)' : 'rgba(255,255,255,0.62)'
  spaced(ctx, `${verse.album} · ${verse.year}`.toUpperCase(), W / 2, bottom - albumSize / 2, W * 0.0055)
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
  spaced(ctx, verse.song.toUpperCase(), W / 2, bottom - songSize / 2, songGap)
  bottom -= songSize

  // Srednji blok, isti kao na ekranu: datum → stih, sa razmakom od ~0.62
  // visine slova stiha (na ekranu 2rem uz stih od ~3.2rem).
  // Blok se centrira u prostor između potpisa i pjesme.
  const dateSize = W * 0.021
  const GAP = 0.62
  const air = W * (ratio > 1.5 ? 0.09 : ratio > 1.1 ? 0.06 : 0.045)
  const areaTop = top + air
  const areaBottom = bottom - air
  const maxW = W - pad * 2.2

  // Prvo se font smanji da svaki red iz podataka stane CIJEO — prelom prati
  // kako se pjeva, pa jedna riječ sama u redu izgleda kao greška. Lomi se
  // tek ispod donje granice veličine.
  let size = W * (ratio > 1.5 ? 0.115 : 0.1)
  ctx.font = `400 ${size}px ${fonts.serif}`
  const widest = Math.max(...text.split('\n').map((l) => ctx.measureText(l.trim()).width))
  // 0.97: tačno na granici measureText zna izaći za dlaku preko i slomiti red
  if (widest > maxW) size = Math.max(W * 0.062, ((size * maxW) / widest) * 0.97)
  let lines: string[] = []
  let lh = 0
  for (;;) {
    ctx.font = `400 ${size}px ${fonts.serif}`
    lines = wrap(ctx, text, maxW)
    lh = size * 1.18
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
  ctx.fillStyle = rgba(p.accent, 0.82)
  spaced(ctx, formatFullDateBs(date).toUpperCase(), W / 2, groupTop + dateSize / 2, W * 0.0062)

  if (p.bloom > 0) {
    const g = ctx.createRadialGradient(W / 2, mid, 0, W / 2, mid, W * 0.55)
    g.addColorStop(0, rgba(p.accent, 0.16 * p.bloom))
    g.addColorStop(1, rgba(p.accent, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  ctx.save()
  ctx.font = `400 ${size}px ${fonts.serif}`
  ctx.fillStyle = p.text
  if (!p.light) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = size * 0.4
    ctx.shadowOffsetY = size * 0.03
  }
  lines.forEach((line, i) => ctx.fillText(line, W / 2, firstY + i * lh))
  ctx.restore()


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
