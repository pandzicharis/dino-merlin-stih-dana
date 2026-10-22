'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react'
import type { Verse } from '@/data/verses'
import { albumOf, cardArtOf, softOf, thumbOf, type Album } from '@/data/albums'
import { audioFile } from '@/lib/audio-name'
import { BRAND, MAGAZA_BESIDE, MAGAZA_DROP } from '@/lib/brand'
import { formatDateBs, getActiveDate, monthBs, shownDay } from '@/lib/date'
import { haptic } from '@/lib/haptic'
import { favoriteDate, getFavorites, monthCount, openedIn } from '@/lib/storage'
import { albumLine } from '@/lib/text'
import { inDeck } from '@/lib/deck'
import { pauseSaved, playSaved, playable, savedVerse, useSavedPlayerSelect } from '@/lib/player'
import { BrandLockup } from './BrandLockup'
import { EqBars } from './EqBars'
import { Icon, TOAST_BAD, TOAST_OK, toast } from './Toast'

/*
 * Mjesečni pregled — "Moj oktobar", kao priča. Isti okvir na svakoj kartici:
 * gore traka napretka i "Moj oktobar" (slovima stiha s početnog ekrana),
 * dolje ikonice kartica (dodir skoči na nju) i logotipi (potpis | Magaza);
 * u sredini zlatni natpis i sadržaj. Kartica bez podataka se ne prikazuje:
 *
 *   0  početna — lepeza najslušanijih albuma na pozadini albuma, veliki naslov
 *   1  kalendar izvučenih stihova — dodir na dan: pjesma, kad i kako je otvoren
 *   2  sačuvano — kolekcija gramofonskih ploča koje se vrte, i broj
 *   3  najslušanija pjesma — omot, naziv, broj puštanja ispod
 *   4  najslušaniji album — isto; dodir na omot pusti
 *   5  sažetak — tri broja (izvučeno, sačuvano, pušteno) i tri najslušanije
 *      pjesme (popis); dodir na red vodi na karticu; "Podijeli" preuzme
 *      upravo ovu karticu kao sliku ekrana
 *
 * Kartice idu same; dodir desno/lijevo naprijed/nazad, prst na ekranu
 * zaustavi, povlačenje dolje zatvori (pregled prati prst, pa se spusti). Dodir
 * u kartici (dan, pjesma) je zaustavi dok se ne ode dalje. Sve je lokalno na
 * telefonu (lib/storage.ts). U prezentaciji (korak "Priča o tvom mjesecu",
 * components/deck/slides.tsx) isti pregled sam prođe sve kartice, brže.
 */

/** koliko traje jedna kartica (ms) */
const DUR = 6500
/** u prezentaciji kartice idu brže, a u videu za mreže najbrže */
const DECK_DUR = 4200
const VIDEO_DUR = 2100

/** pregled se snima za video za mreže (/prezentacija/video) */
function inVideo(): boolean {
  try {
    return window.top !== window.self && window.top!.location.pathname.startsWith('/prezentacija/video')
  } catch {
    return false
  }
}
/** pjesma bez albuma — znak aplikacije, kao u plejeru */
const ICON = '/icons/icon-192.png?v=2'
const GOLD = BRAND.gold
const serif = { fontFamily: 'var(--font-serif), serif' }
const ease = [0.22, 1, 0.36, 1] as const

/** 1 dan, 2–4 dana, 5 dana (21 dan, 22 dana…) */
function pl(n: number, one: string, few: string, many: string) {
  const d = n % 10
  const t = n % 100
  if (d === 1 && t !== 11) return one
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return few
  return many
}

function readDraw(): Record<string, { id?: string }> {
  try {
    return JSON.parse(localStorage.getItem('stihdana:draw') ?? '{}')?.days ?? {}
  } catch {
    return {}
  }
}

/** sličica omota stiha (240 px) — bez albuma znak aplikacije */
const thumb = (v?: Verse) => thumbOf(albumOf(v?.album)?.cover) ?? ICON

function monthData(verses: Verse[], date: string) {
  const ym = date.slice(0, 7)
  const [y, m] = ym.split('-').map(Number)
  const byId = new Map(verses.map((v) => [v.id, v]))
  const draw = readDraw()
  const days = Object.keys(draw)
    .filter((d) => d.startsWith(ym))
    .sort()
  const byDay: Record<string, Verse | undefined> = {}
  for (const d of days) byDay[d] = byId.get(draw[d]?.id ?? '')
  const c = monthCount(ym)
  const favs = getFavorites()
  const saved = favs
    .filter((id) => favoriteDate(id)?.startsWith(ym))
    .map((id) => byId.get(id))
    .filter((v): v is Verse => Boolean(v))
  const pool = [...saved, ...days.map((d) => byDay[d]).filter((v): v is Verse => Boolean(v)), ...verses]
  const verseOf = (key: string) => pool.find((v) => audioFile(v.song) === key)
  // pjesme po slušanju, najslušanija prva
  const plays = Object.entries(c.songs ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => ({ v: verseOf(key), n }))
    .filter((x): x is { v: Verse; n: number } => Boolean(x.v))
  // najslušaniji album — zbir njegovih pjesama
  const byAlbum = new Map<Album, number>()
  for (const { v, n } of plays) {
    const a = albumOf(v.album)
    if (a) byAlbum.set(a, (byAlbum.get(a) ?? 0) + n)
  }
  const ranked = [...byAlbum].sort((a, b) => b[1] - a[1]).map(([a]) => a)
  const album = ranked[0]
  // albumi za početnu karticu: najslušaniji, pa oni iz stihova mjeseca (najnoviji prvi)
  const seen = [...[...days].reverse().map((dd) => albumOf(byDay[dd]?.album)), ...saved.map((v) => albumOf(v.album))].filter((a): a is Album => Boolean(a))
  const covers = [...new Set([...ranked, ...seen].map((a) => a.cover))].slice(0, 3)
  return {
    ym,
    month: monthBs(date),
    year: date.slice(0, 4),
    today: shownDay(getActiveDate()),
    /** dana u mjesecu i koliko praznih polja prije prvog (ponedjeljak prvi) */
    count: new Date(Date.UTC(y, m, 0)).getUTCDate(),
    lead: (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7,
    byDay,
    days,
    opened: openedIn(ym),
    drawn: days.length,
    plays: c.plays ?? 0,
    saved: saved.length,
    /** sačuvani stihovi (najnoviji prvi) — omoti za kolekciju ploča */
    savedList: saved,
    /** najslušanija pjesma (i koliko puta) */
    song: plays[0],
    /** tri najslušanije */
    top: plays.slice(0, 3),
    album,
    covers,
    albumPlays: album ? (byAlbum.get(album) ?? 0) : 0,
    /** najslušanija pjesma s tog albuma */
    albumSong: plays.find((x) => albumOf(x.v.album) === album)?.v,
  }
}
type Data = ReturnType<typeof monthData>

const isoOf = (d: Data, day: number) => `${d.ym}-${String(day).padStart(2, '0')}`

/** tri broja sažetka (samo oni koji nisu nula) — na zadnjoj kartici i na slici */
function statsOf(d: Data) {
  return [
    { key: 'days' as const, label: 'Izvučeno', sub: pl(d.drawn, 'stih', 'stiha', 'stihova'), n: d.drawn, to: 'days' },
    { key: 'saved' as const, label: 'Sačuvano', sub: pl(d.saved, 'stih', 'stiha', 'stihova'), n: d.saved, to: 'saved' },
    { key: 'plays' as const, label: 'Pušteno', sub: pl(d.plays, 'pjesma', 'pjesme', 'pjesama'), n: d.plays, to: 'song' },
  ].filter((x) => x.n > 0)
}

/* ── slika za dijeljenje — zadnja kartica, veličine ekrana telefona ── */

/** ekran ovog telefona u pikselima (uspravno); na računaru iPhone 1290 × 2796 */
function phoneSize(): [number, number] {
  if (!window.matchMedia('(pointer: coarse)').matches) return [1290, 2796]
  const dpr = Math.min(3, window.devicePixelRatio || 1)
  const a = Math.round(screen.width * dpr)
  const b = Math.round(screen.height * dpr)
  return [Math.min(a, b), Math.max(a, b)]
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  const img = new Image()
  img.src = src
  return img
    .decode()
    .then(() => img)
    .catch(() => null)
}

/** Magaza bijelom bojom (svg je crn) */
async function magazaWhite(): Promise<HTMLImageElement | null> {
  try {
    const svg = await (await fetch('/brand/magaza.svg?v=2')).text()
    const url = URL.createObjectURL(new Blob([svg.replace('<svg ', '<svg fill="#ffffff" ')], { type: 'image/svg+xml' }))
    const img = await loadImage(url)
    URL.revokeObjectURL(url)
    return img
  } catch {
    return null
  }
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Ikonica kartice (24 × 24 crtež, kao u SVG-u) u krugu sredine (cx, cy). */
function drawIcon(ctx: CanvasRenderingContext2D, kind: 'days' | 'saved' | 'plays', cx: number, cy: number, size: number) {
  ctx.save()
  ctx.translate(cx - size / 2, cy - size / 2)
  ctx.scale(size / 24, size / 24)
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (kind === 'days') {
    rr(ctx, 3.5, 5, 17, 15.5, 3)
    ctx.stroke()
    ctx.stroke(new Path2D('M3.5 10h17M8 3v4M16 3v4'))
  } else if (kind === 'saved') {
    ctx.stroke(new Path2D('M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z'))
  } else {
    ctx.stroke(new Path2D('M9 18V5l12-2v13'))
    ctx.beginPath()
    ctx.arc(6, 18, 3, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(18, 16, 3, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Isto što i zadnja kartica: "Moj oktobar" gore, tri broja s ikonicama,
 * logotipi dolje. Mjere su kao na ekranu od 390 px, pa se samo uvećaju.
 */
async function drawImage(d: Data): Promise<Blob | null> {
  const [W, H] = phoneSize()
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  if (!ctx) return null
  const k = W / 390
  const px = (n: number) => n * k
  const cs = getComputedStyle(document.documentElement)
  const fSerif = cs.getPropertyValue('--font-serif').trim() || 'Georgia, serif'
  const fSans = cs.getPropertyValue('--font-sans').trim() || 'system-ui, sans-serif'
  const fTitle = cs.getPropertyValue('--font-playfair').trim() || fSerif
  const [sig, mag] = await Promise.all([
    loadImage('/brand/signature.webp?v=2'),
    magazaWhite(),
    ...[`400 100px ${fSerif}`, `500 30px ${fSans}`, `italic 700 100px ${fTitle}`].map((f) => document.fonts?.load(f, 'Moj oktobar').catch(() => null)),
  ])
  const spaced = (n: number) => {
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${n}px`
  }
  const text = (s: string, x: number, y: number, font: string, color: string | CanvasGradient, align: CanvasTextAlign = 'left', sp = 0) => {
    ctx.font = font
    ctx.fillStyle = color
    ctx.textAlign = align
    spaced(sp)
    ctx.fillText(s, x, y)
  }

  // pozadina: crna sa zlatnim sjajem odozgo, kao kartica
  ctx.fillStyle = '#0b0b0d'
  ctx.fillRect(0, 0, W, H)
  const g = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, W * 0.95)
  g.addColorStop(0, 'rgba(191,168,127,0.2)')
  g.addColorStop(1, 'rgba(191,168,127,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // gore: Moj oktobar (slova stiha) i godina
  const hc = H / k
  const top = Math.max(70, hc * 0.085)
  // "Moj" i mjesec istim podebljanim kurzivom — kao na ekranu
  const tf = `italic 700 ${px(44)}px ${fTitle}, ${fSerif}`
  ctx.font = tf
  spaced(0)
  const w1 = ctx.measureText('Moj').width
  const w2 = ctx.measureText(d.month).width
  const tg = px(10)
  const tx0 = (W - (w1 + tg + w2)) / 2
  text('Moj', tx0, px(top + 42), tf, '#ffffff', 'left')
  text(d.month, tx0 + w1 + tg, px(top + 42), tf, '#D9C08F', 'left')
  text(d.year, W / 2, px(top + 70), `400 ${px(10)}px ${fSans}`, 'rgba(255,255,255,0.5)', 'center', px(5))

  // dolje: potpis | Magaza, kao u okviru kartice
  const sh = px(26)
  const sw = sig ? (sh * sig.naturalWidth) / sig.naturalHeight : 0
  const mh = sh * MAGAZA_BESIDE
  const mw = mag ? (mh * 316) / 67 : 0
  const gap = Math.round(26 * 0.36) * k
  const lx = (W - (sw + gap * 2 + mw)) / 2
  const ly = H - px(34) - sh
  ctx.globalAlpha = 0.92
  if (sig) ctx.drawImage(sig, lx, ly, sw, sh)
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.fillRect(lx + sw + gap, ly + sh * 0.19, Math.max(1, k), sh * 0.62)
  if (mag) ctx.drawImage(mag, lx + sw + gap * 2, ly + (sh - mh) / 2 + mh * MAGAZA_DROP, mw, mh)
  ctx.globalAlpha = 1

  // sredina: natpis, tri reda i najslušanije pjesme — između naslova i logotipa
  const stats = statsOf(d)
  const covers = await Promise.all(d.top.map(({ v }) => loadImage(thumb(v))))
  const rowH = 80
  const rowGap = 10
  const songH = 52
  const songsBlock = d.top.length ? 12 + d.top.length * songH : 0
  const block = 14 + 32 + stats.length * rowH + (stats.length - 1) * rowGap + songsBlock
  const mid = (top + 90 + (hc - 34 - 26 - 20)) / 2
  let y = mid - block / 2
  text('U BROJEVIMA', W / 2, px(y + 10), `500 ${px(10)}px ${fSans}`, GOLD, 'center', px(3.4))
  y += 14 + 32
  const x0 = px(28)
  const x1 = W - px(28)
  stats.forEach((t, i) => {
    const top0 = px(y + i * (rowH + rowGap))
    const h = px(rowH)
    // kartica reda
    rr(ctx, x0, top0, x1 - x0, h, px(22))
    const fill = ctx.createLinearGradient(0, top0, 0, top0 + h)
    fill.addColorStop(0, 'rgba(255,255,255,0.07)')
    fill.addColorStop(1, 'rgba(255,255,255,0.025)')
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = Math.max(1, k)
    ctx.stroke()
    // ikonica u zlatnom krugu
    const icx = x0 + px(18 + 22)
    const icy = top0 + h / 2
    ctx.beginPath()
    ctx.arc(icx, icy, px(22), 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(191,168,127,0.12)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(191,168,127,0.25)'
    ctx.stroke()
    drawIcon(ctx, t.key, icx, icy, px(20))
    // natpis i broj
    const tx = x0 + px(18 + 44 + 16)
    text(t.label.toLocaleUpperCase('bs'), tx, icy - px(2), `500 ${px(11)}px ${fSans}`, 'rgba(255,255,255,0.65)', 'left', px(2.4))
    text(t.sub.toLocaleUpperCase('bs'), tx, icy + px(15), `400 ${px(10)}px ${fSans}`, 'rgba(255,255,255,0.4)', 'left', px(2))
    const num = ctx.createLinearGradient(0, icy - px(20), 0, icy + px(20))
    num.addColorStop(0, '#ffffff')
    num.addColorStop(0.42, '#f4ead4')
    num.addColorStop(1, GOLD)
    text(String(t.n), x1 - px(22), icy + px(14), `400 ${px(40)}px ${fSerif}`, num, 'right')
  })

  // najslušanije pjesme — kartica s tri reda
  if (d.top.length) {
    const sy = px(y + stats.length * rowH + (stats.length - 1) * rowGap + 12)
    const sh2 = px(d.top.length * songH)
    rr(ctx, x0, sy, x1 - x0, sh2, px(18))
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = Math.max(1, k)
    ctx.stroke()
    d.top.forEach(({ v, n }, i) => {
      const ry = sy + px(i * songH)
      const cy2 = ry + px(songH / 2)
      if (i) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.fillRect(x0 + px(12), ry, x1 - x0 - px(24), Math.max(1, k))
      }
      text(String(i + 1), x0 + px(12), cy2 + px(4), `400 ${px(11)}px ${fSans}`, 'rgba(255,255,255,0.4)', 'left')
      // omot
      const cx2 = x0 + px(30)
      const cs2 = px(36)
      ctx.save()
      rr(ctx, cx2, cy2 - cs2 / 2, cs2, cs2, px(8))
      ctx.clip()
      const img = covers[i]
      if (img) ctx.drawImage(img, cx2, cy2 - cs2 / 2, cs2, cs2)
      else {
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(cx2, cy2 - cs2 / 2, cs2, cs2)
      }
      ctx.restore()
      const room = x1 - x0 - px(30 + 36 + 12 + 50)
      let title = v.song.toLocaleUpperCase('bs')
      ctx.font = `600 ${px(12)}px ${fSans}`
      spaced(px(1.7))
      while (ctx.measureText(title).width > room && title.length > 4) title = title.slice(0, -2).trimEnd() + '…'
      text(title, cx2 + cs2 + px(12), cy2 - px(2), `600 ${px(12)}px ${fSans}`, '#fff', 'left', px(1.7))
      text((albumOf(v.album)?.title ?? v.description ?? '').toLocaleUpperCase('bs'), cx2 + cs2 + px(12), cy2 + px(13), `400 ${px(9.5)}px ${fSans}`, 'rgba(255,255,255,0.45)', 'left', px(1.8))
      text(`${n}×`, x1 - px(14), cy2 + px(4), `400 ${px(11)}px ${fSans}`, 'rgba(255,255,255,0.5)', 'right')
    })
  }

  return new Promise((r) => c.toBlob(r, 'image/png'))
}

/* ── brojevi: brojčanik ───────────────────────────────────────── */

/** Jedna cifra — kolona 0–9 dvaput, okrene se barem krug pa stane na svoje. */
function Digit({ d, size, delay }: { d: number; size: number; delay: number }) {
  const w = size * 0.58
  const gold = {
    backgroundImage: `linear-gradient(180deg, #ffffff 0%, #f4ead4 42%, ${GOLD} 100%)`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
  } as const
  return (
    <span className="relative block overflow-hidden" style={{ height: size, width: w }}>
      <motion.span
        className="absolute left-0 top-0 flex flex-col"
        initial={{ y: 0 }}
        animate={{ y: -(10 + d) * size }}
        transition={{ duration: 1.25 + d * 0.06, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} className="block text-center" style={{ height: size, width: w, lineHeight: `${size}px`, ...serif, ...gold }}>
            {i % 10}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

/** Broj kao brojilo — cifre se okreću jedna za drugom. */
function Odometer({ n, size, delay = 0.45 }: { n: number; size: number; delay?: number }) {
  return (
    <span className="inline-flex leading-none" style={{ fontSize: size, height: size }} role="img" aria-label={String(n)}>
      {String(n)
        .split('')
        .map((ch, i) => (
          <Digit key={i} d={Number(ch)} size={size} delay={delay + i * 0.12} />
        ))}
    </span>
  )
}

/* ── kalup kartice: natpis, sadržaj ────────────────────────────── */

/** zlatni natpis na vrhu sadržaja kartice */
function Label({ children }: { children: ReactNode }) {
  return (
    <motion.p
      className="text-center text-[14px] font-medium uppercase tracking-[0.3em]"
      style={{ color: GOLD }}
      initial={{ opacity: 0, transform: 'translateY(8px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: 0.6, delay: 0.1, ease }}
    >
      {children}
    </motion.p>
  )
}

/** ulaz sadržaja kartice — redom, malo zakašnjeno */
const rise = (i: number) => ({
  initial: { opacity: 0, transform: 'translateY(12px)' },
  animate: { opacity: 1, transform: 'translateY(0px)' },
  transition: { duration: 0.6, delay: 0.15 + i * 0.1, ease },
})

/**
 * "Moj oktobar": obje riječi istim podebljanim kurzivom (Playfair Display 700 —
 * lib/fonts.ts), "Moj" bijelo, mjesec zlatno. Bez sjaja i obruba oko slova.
 */
const TITLE_FONT = { fontFamily: 'var(--font-playfair), var(--font-serif), serif', fontStyle: 'italic' as const, fontWeight: 700 }

function MonthTitle({ month, size }: { month: string; size: number }) {
  // font se učitava tek kad zatreba — odmah, da naslov od prvog kadra ima pravo pismo
  useEffect(() => {
    const family = getComputedStyle(document.documentElement).getPropertyValue('--font-playfair').trim()
    if (family) void document.fonts.load(`italic 700 40px ${family}`, `Moj ${month}`).catch(() => {})
  }, [month])
  return (
    <p className="flex items-baseline justify-center leading-none" style={{ ...TITLE_FONT, fontSize: size, gap: '0.24em', letterSpacing: '-0.01em' }}>
      <span className="text-white">Moj</span>
      <span style={{ color: '#D9C08F' }}>{month}</span>
    </p>
  )
}

/**
 * Gramofonska ploča — žljebovi i naljepnica s omotom; vrti se (CSS animacija,
 * grafički procesor). Odsjaj stoji, ne vrti se s pločom.
 */
function Vinyl({ cover, size, spin }: { cover: string; size: number; spin: number }) {
  return (
    <span className="relative block rounded-full" style={{ width: size, height: size, boxShadow: '0 16px 34px rgba(0,0,0,0.6)' }}>
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: 'repeating-radial-gradient(circle at 50% 50%, #0a0a0b 0 1.4px, #1a1a1c 1.4px 2.8px)',
          animation: `vinyl-spin ${spin}s linear infinite`,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
        }}
      >
        <span
          className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full bg-cover bg-center"
          style={{ width: size * 0.38, height: size * 0.38, backgroundImage: `url(${cover})`, boxShadow: `0 0 0 2px #0a0a0b, 0 0 0 3px ${GOLD}55` }}
        >
          <span className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0a0a0b]" style={{ width: size * 0.045, height: size * 0.045 }} />
        </span>
      </span>
      <span
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ background: 'conic-gradient(from 25deg, transparent 0 18%, rgba(255,255,255,0.13) 26%, transparent 34% 66%, rgba(255,255,255,0.09) 76%, transparent 84%)' }}
      />
    </span>
  )
}

/**
 * Kolekcija ploča: do četiri ploče u nizu (omoti sačuvanih), dolijeću jedna
 * po jedna i zavrte se; ispod polica sa sjenom. Najnovija je naprijed.
 */
function Records({ covers }: { covers: string[] }) {
  const n = covers.length
  // što više ploča, to manje i gušće — da stanu u širinu ekrana
  const S = n >= 6 ? 112 : n === 5 ? 128 : 150
  const GAP = n >= 6 ? 40 : n === 5 ? 47 : n > 3 ? 62 : 72
  return (
    <div className="relative mx-auto" style={{ width: S + (n - 1) * GAP, height: S + 36 }}>
      {covers.map((cover, i) => (
        // i = 0 je najnovija — naprijed (zadnja u nizu, preko ostalih)
        <motion.div
          key={i}
          className="absolute top-0"
          style={{ left: (n - 1 - i) * GAP, zIndex: n - i }}
          initial={{ opacity: 0, x: 120, y: 70, rotate: 40, scale: 0.7 }}
          animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 110, damping: 15, delay: 0.25 + (n - 1 - i) * 0.16 }}
        >
          <Vinyl cover={cover} size={S} spin={7 + i * 1.7} />
        </motion.div>
      ))}
      {/* polica */}
      <motion.span
        className="absolute inset-x-0 bottom-0 mx-auto block h-[14px] rounded-[50%]"
        style={{ width: '88%', background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, transparent 70%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        aria-hidden
      />
    </div>
  )
}

/** Koliko ploča u kolekciji: do 3 sve, pa 4, 5 (10+) i 6 (preko 20 sačuvanih). */
const recordsFor = (n: number) => (n <= 3 ? Math.max(1, n) : n <= 9 ? 4 : n <= 20 ? 5 : 6)

/** Natpis s brojem ispod — običan tekst, bez velikog brojača. */
function CountLine({ children }: { children: ReactNode }) {
  return (
    <motion.p
      className="mt-5 text-center text-[12px] font-medium uppercase tracking-[0.26em]"
      style={{ color: GOLD }}
      initial={{ opacity: 0, transform: 'translateY(8px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: 0.6, delay: 0.9, ease }}
    >
      {children}
    </motion.p>
  )
}

/** naziv (pjesme, albuma) i sitno ispod — isti na kartici pjesme i albuma */
function Title({ name, sub }: { name: string; sub: string }) {
  return (
    <motion.div
      className="mt-6 text-center"
      initial={{ opacity: 0, transform: 'translateY(10px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: 0.6, delay: 0.6, ease }}
    >
      <p className="text-[22px] font-semibold uppercase leading-tight tracking-[0.14em] text-white">{name}</p>
      <p className="mt-2 text-[10.5px] uppercase tracking-[0.24em] text-white/55">{sub}</p>
    </motion.div>
  )
}

/** pozadina u bojama albuma: zamućen omot, zatamnjen (`dark` — sredina) */
function albumBg(cover?: string, dark = 0.55) {
  const soft = softOf(cover)
  return soft
    ? `linear-gradient(180deg, rgba(0,0,0,${dark - 0.2}) 0%, rgba(0,0,0,${dark}) 50%, rgba(0,0,0,${dark + 0.27}) 100%), url(${soft}) center / cover, #0b0b0d`
    : glow('30')
}

function glow(a: string) {
  return `radial-gradient(90% 45% at 50% 32%, ${GOLD}${a} 0%, transparent 70%), #0b0b0d`
}

/** dodir unutar ovoga ne lista priču (povlačenje dolje i dalje zatvara, bilo gdje) */
const keep = { onClick: (e: SyntheticEvent) => e.stopPropagation() }

/* ── puštanje pjesme dodirom ──────────────────────────────────── */

const canPlay = (v?: Verse): v is Verse => Boolean(v?.youtube && playable(v))

/** svira li (ili je u plejeru) pjesma stiha `v` */
function useNow(v?: Verse) {
  const id = useSavedPlayerSelect((s) => s.id)
  const playing = useSavedPlayerSelect((s) => s.playing)
  const cur = id ? savedVerse() : null
  const on = Boolean(v && cur && audioFile(cur.song) === audioFile(v.song))
  return { on, playing: on && playing }
}

function toggleSong(v: Verse, playing: boolean) {
  haptic(6)
  if (playing) pauseSaved()
  else playSaved(v)
}

/** Veliki omot — dodir pusti/pauzira pjesmu `v`. */
function Cover({ cover, v, onPlay, ok }: { cover?: string; v?: Verse; onPlay: () => void; ok: () => boolean }) {
  const now = useNow(v)
  const can = canPlay(v)
  return (
    <motion.button
      type="button"
      disabled={!can}
      onClick={() => {
        // kraj povlačenja nije dodir
        if (!ok()) return
        onPlay()
        if (can) toggleSong(v, now.playing)
      }}
      aria-label={now.playing ? 'Pauza' : 'Pusti pjesmu'}
      className="relative mt-10 block h-[220px] w-[220px] rounded-[20px] bg-cover bg-center"
      style={{ backgroundImage: `url(${cover ? (cardArtOf(cover) ?? cover) : ICON})`, backgroundColor: '#141416', boxShadow: `0 24px 60px rgba(0,0,0,0.6), inset 0 0 0 1px ${GOLD}40` }}
      initial={{ opacity: 0, scale: 0.86 }}
      animate={{ opacity: 1, scale: now.playing ? 1.03 : 1 }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.7, delay: 0.3, ease }}
    >
      {/* bez dugmeta — dok svira, samo male trake u uglu */}
      {now.on && (
        <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-2">
          <EqBars accent={GOLD} on={now.playing} h={11} />
        </span>
      )}
    </motion.button>
  )
}

/** Red najslušanije pjesme u sažetku — samo popis (bez plejera). */
function SongRow({ v, n, i }: { v: Verse; n: number; i: number }) {
  return (
    <div className="flex w-full items-center gap-3 border-b border-white/[0.06] px-3 py-2 last:border-b-0">
      <span className="tabular w-3 text-[11px] text-white/40">{i}</span>
      <span className="block h-9 w-9 shrink-0 rounded-[8px] bg-cover bg-center" style={{ backgroundImage: `url(${thumb(v)})` }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold uppercase tracking-[0.14em] text-white">{v.song}</span>
        <span className="mt-0.5 block truncate text-[9.5px] uppercase tracking-[0.18em] text-white/45">{albumOf(v.album)?.title ?? v.description ?? ''}</span>
      </span>
      <span className="tabular text-[11px] text-white/50">{n}×</span>
    </div>
  )
}

/* ── ikonice kartica ─────────────────────────────────────────── */

const ICONS = {
  days: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  saved: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />,
  plays: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  albums: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  star: <path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.9l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z" />,
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
}

const DAYS = ['P', 'U', 'S', 'Č', 'P', 'S', 'N']

/**
 * Kalendar izvučenih stihova — dan sa stihom nosi omot albuma i datum, danas
 * je istaknut. Samo za gledanje (dodir ide priči: naprijed/nazad).
 */
function Calendar({ d }: { d: Data }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {DAYS.map((l, i) => (
        <span key={`h${i}`} className="pb-1 text-center text-[9px] font-medium uppercase tracking-[0.1em] text-white/35">
          {l}
        </span>
      ))}
      {Array.from({ length: d.lead }, (_, i) => (
        <span key={`e${i}`} />
      ))}
      {Array.from({ length: d.count }, (_, i) => {
        const iso = isoOf(d, i + 1)
        const on = iso in d.byDay
        // današnji dan — istaknut zlatnim obrubom i tačkicom
        const isToday = iso === d.today
        return (
          <motion.div
            key={iso}
            aria-label={formatDateBs(iso)}
            className="tabular relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[8px] bg-cover bg-center text-[10px]"
            style={{
              backgroundImage: on ? `url(${thumb(d.byDay[iso])})` : undefined,
              backgroundColor: on ? undefined : 'rgba(255,255,255,0.04)',
              color: isToday ? GOLD : iso > d.today ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.32)',
              fontWeight: isToday ? 700 : undefined,
              boxShadow: isToday ? `0 0 0 1.5px ${GOLD}, 0 0 14px ${GOLD}66` : on ? `inset 0 0 0 1px ${GOLD}66` : undefined,
            }}
            initial={{ opacity: 0, transform: 'scale(0.7)' }}
            animate={{ opacity: 1, transform: 'scale(1)' }}
            transition={{ duration: 0.4, delay: 0.45 + i * 0.014, ease }}
          >
            {isToday && <span className="absolute right-[3px] top-[3px] h-[5px] w-[5px] rounded-full" style={{ background: GOLD, boxShadow: `0 0 6px ${GOLD}` }} aria-hidden />}
            {on ? (
              // datum i preko omota — u donjem uglu, na tamnom
              <span
                className="absolute inset-x-0 bottom-0 pb-[2px] pr-[4px] pt-2 text-right text-[9.5px] font-semibold leading-none text-white"
                style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.75))', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
              >
                {i + 1}
              </span>
            ) : (
              i + 1
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

export default function MonthRecap({ verses, date, onClose }: { verses: Verse[]; date: string; onClose: () => void }) {
  const d = useMemo(() => monthData(verses, date), [verses, date])
  // u prezentaciji kartice idu brže, a okvir je malo niže (ispod statusne trake telefona)
  const deck = useMemo(() => inDeck(), [])
  const video = useMemo(() => inVideo(), [])
  const dur = video ? VIDEO_DUR : deck ? DECK_DUR : DUR
  // na iPhoneu traka priče ne smije biti uz samu statusnu traku (zamagli se) — malo niže
  const topPad = deck ? 'calc(var(--sat) + 18px)' : 'calc(max(14px, var(--sat)) + 40px)'
  const [k, setK] = useState(0)
  // smjer zadnjeg prelaza (1 naprijed, -1 nazad) — kartica klizne s te strane
  const [dir, setDir] = useState<1 | -1>(1)
  const [held, setHeld] = useState(false)
  // dodir u kartici (dan, pjesma) — kartica stoji dok se ne ode dalje
  const [stay, setStay] = useState(false)
  const [busy, setBusy] = useState(false)
  const down = useRef<number | null>(null)
  const downAt = useRef(0)
  const swiped = useRef(false)
  // pregled prati prst dok se vuče dolje (smanji se i zaobli), pa se spusti
  const y = useMotionValue(0)
  const scale = useTransform(y, [0, 320], [1, 0.9])
  // zaobljeni uglovi dok se vuče ili zatvara — uključe se jednom (ne mijenjaju se u svakom kadru)
  const [rounded, setRounded] = useState(false)
  const songCover = albumOf(d.song?.v.album)?.cover
  const hold = () => setStay(true)
  // dugme koje je bilo pod prstom kad se vuklo dolje ne reaguje (to nije dodir)
  const tapOk = () => !swiped.current
  const stats = statsOf(d)
  const few = d.drawn <= 3

  // sve slike priče se preuzmu i dekodiraju odmah pri otvaranju — prelaz na
  // sljedeću karticu ne čeka dekoder (omoti od 960 px su teški)
  const decoded = useRef<HTMLImageElement[]>([])
  useEffect(() => {
    const urls = new Set<string>()
    const add = (u?: string) => {
      if (u) urls.add(u)
    }
    for (const c of d.covers) {
      add(thumbOf(c) ?? c)
      add(softOf(c))
    }
    for (const iso of d.days) add(thumb(d.byDay[iso]))
    for (const v of d.savedList.slice(0, 6)) add(thumb(v))
    for (const { v } of d.top) add(thumb(v))
    for (const c of [albumOf(d.song?.v.album)?.cover, d.album?.cover]) {
      add(c ? (cardArtOf(c) ?? c) : undefined)
      add(softOf(c))
    }
    decoded.current = [...urls].map((u) => {
      const img = new Image()
      img.src = u
      void img.decode?.().catch(() => {})
      return img
    })
  }, [d])

  // "Podijeli" — zadnja kartica kao slika veličine ekrana se preuzme
  const save = async () => {
    if (busy || !tapOk()) return
    setBusy(true)
    haptic(6)
    try {
      const blob = await drawImage(d)
      if (!blob) throw new Error('canvas')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `moj-${d.month}-${d.year}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast({ id: 'recap', title: 'Slika je preuzeta', color: TOAST_OK, icon: <Icon.download /> })
    } catch {
      toast({ id: 'recap', title: 'Nije uspjelo', color: TOAST_BAD, icon: <Icon.bad /> })
    } finally {
      setBusy(false)
    }
  }

  // lepeza: najslušaniji album u sredini
  const fan = d.covers.length === 3 ? [d.covers[1], d.covers[0], d.covers[2]] : d.covers

  // kartice — one bez podataka se ne prikazuju
  const all: { key: string; bg: string; body: ReactNode; show?: boolean }[] = [
    // početna: lepeza najslušanijih albuma na pozadini albuma
    {
      key: 'intro',
      show: d.covers.length > 0,
      bg: albumBg(d.covers[0]),
      body: (
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-9 h-[150px] w-[260px]" style={{ display: fan.length ? undefined : 'none' }}>
            {fan.map((cover, i, arr) => {
              const mid = (arr.length - 1) / 2
              return (
                <motion.span
                  key={cover}
                  className="absolute left-1/2 top-0 block h-[130px] w-[130px] rounded-[16px] bg-cover bg-center shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
                  style={{ backgroundImage: `url(${thumbOf(cover) ?? cover})`, zIndex: i === Math.round(mid) ? 2 : 1, boxShadow: `0 18px 40px rgba(0,0,0,0.55), inset 0 0 0 1px ${GOLD}33` }}
                  initial={{ opacity: 0, transform: 'translateX(-50%) translateY(30px) rotate(0deg)' }}
                  animate={{ opacity: 1, transform: `translateX(calc(-50% + ${(i - mid) * 78}px)) translateY(${Math.abs(i - mid) * 10}px) rotate(${(i - mid) * 9}deg)` }}
                  transition={{ duration: 0.9, delay: 0.2 + i * 0.1, ease }}
                  aria-hidden
                />
              )
            })}
          </div>
          <Label>Stih dana</Label>
          <motion.div {...rise(2)} className="mt-5">
            <MonthTitle month={d.month} size={46} />
          </motion.div>
          <motion.p {...rise(3)} className="tabular mt-5 text-[11px] tracking-[0.5em] text-white/55">
            {d.year}
          </motion.p>
        </div>
      ),
    },
    // kalendar izvučenih stihova — ispod ništa
    {
      key: 'days',
      show: d.drawn > 0,
      bg: glow('2e'),
      body: (
        <>
          <Label>Izvučeni stihovi</Label>
          <motion.p {...rise(1)} className="mt-6 flex items-center justify-center gap-3">
            <Odometer n={d.drawn} size={44} />
            <span className="text-[11px] uppercase tracking-[0.24em] text-white/60">{pl(d.drawn, 'stih izvučen', 'stiha izvučena', 'stihova izvučeno')}</span>
          </motion.p>
          <div className="mt-7 w-full">
            <Calendar d={d} />
          </div>
        </>
      ),
    },
    // sačuvano — kolekcija gramofonskih ploča, i broj
    {
      key: 'saved',
      show: d.saved > 0,
      bg: glow('30'),
      body: (
        <>
          <Label>Sačuvano</Label>
          <div className="mt-12">
            <Records covers={d.savedList.length ? d.savedList.slice(0, recordsFor(d.saved)).map(thumb) : [ICON]} />
          </div>
          <motion.p {...rise(5)} className="mt-8 flex items-center justify-center gap-3">
            <Odometer n={d.saved} size={46} delay={0.9} />
            <span className="text-[11px] uppercase tracking-[0.24em] text-white/60">{pl(d.saved, 'stih sačuvan', 'stiha sačuvana', 'stihova sačuvano')}</span>
          </motion.p>
        </>
      ),
    },
    // najslušanija pjesma — u bojama svog albuma
    ...(d.song
      ? [
          {
            key: 'song',
            bg: albumBg(songCover),
            body: (
              <>
                <Label>Najslušanija pjesma</Label>
                <Cover cover={songCover} v={d.song.v} onPlay={hold} ok={tapOk} />
                <Title name={d.song.v.song} sub={albumLine(d.song.v)} />
                <CountLine>
                  {d.song.n} {pl(d.song.n, 'put puštena', 'puta puštena', 'puta puštena')}
                </CountLine>
              </>
            ),
          },
        ]
      : []),
    // najslušaniji album — u bojama albuma
    ...(d.album
      ? [
          {
            key: 'album',
            bg: albumBg(d.album.cover),
            body: (
              <>
                <Label>Najslušaniji album</Label>
                <Cover cover={d.album.cover} v={d.albumSong} onPlay={hold} ok={tapOk} />
                <Title name={d.album.title} sub={String(d.album.year)} />
                <CountLine>
                  {d.albumPlays} {pl(d.albumPlays, 'puštanje', 'puštanja', 'puštanja')}
                </CountLine>
              </>
            ),
          },
        ]
      : []),
    // prazan mjesec ili tek nekoliko dana (prva 3 dana u mjesecu): samo ova jedna priča
    {
      key: 'start',
      show: few,
      bg: glow('2e'),
      body: (
        <>
          <Label>Tek je početak</Label>
          <div className="mt-12">
            <Records covers={[ICON]} />
          </div>
          <motion.p {...rise(5)} className="mt-9 max-w-[17rem] text-center text-[13px] leading-relaxed text-white/60">
            Stihovi koje izvučeš, sačuvaš i poslušaš pojavit će se ovdje — kao priča na kraju mjeseca.
          </motion.p>
        </>
      ),
    },
    // sažetak — tri broja (izvučeno, sačuvano, pušteno); dodir vodi na karticu
    {
      key: 'summary',
      show: stats.length > 0,
      bg: glow('30'),
      body: (
        <>
          <Label>U brojevima</Label>
          <div {...keep} className="mt-8 flex w-full flex-col gap-2.5">
            {stats.map((t, i) => (
              <motion.button
                key={t.key}
                type="button"
                onClick={() => jump(t.to)}
                className="relative flex h-[80px] w-full items-center gap-4 rounded-[22px] border border-white/[0.09] px-[18px] text-left"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.55, delay: 0.2 + i * 0.1, ease }}
              >
                <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full" style={{ background: `${GOLD}1f`, boxShadow: `inset 0 0 0 1px ${GOLD}40` }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {ICONS[t.key]}
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.22em] text-white/65">{t.label}</span>
                  <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-white/40">{t.sub}</span>
                </span>
                <Odometer n={t.n} size={40} delay={0.45 + i * 0.12} />
                <svg className="text-white/30" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </motion.button>
            ))}
          </div>

          {/* najslušanije pjesme — dodir pusti */}
          {d.top.length > 0 && (
            <motion.div
              {...keep}
              className="mt-3 w-full overflow-hidden rounded-[18px] border border-white/[0.09] bg-white/[0.03]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.65, ease }}
            >
              {d.top.map(({ v, n }, i) => (
                <SongRow key={v.id} v={v} n={n} i={i + 1} />
              ))}
            </motion.div>
          )}

          <motion.div className="mt-5 flex w-full gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.9 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                save()
              }}
              disabled={busy}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[11px] font-semibold uppercase tracking-[0.2em] transition-opacity disabled:opacity-60"
              style={{ background: GOLD, color: '#14100A' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
              </svg>
              Podijeli
            </button>
            <button
              type="button"
              data-recap-end
              onClick={(e) => {
                e.stopPropagation()
                setRounded(true)
                onClose()
              }}
              className="h-12 rounded-full border border-white/15 px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80"
            >
              Zatvori
            </button>
          </motion.div>
        </>
      ),
    },
  ]
  // prazan mjesec ili do 3 izvučena dana: samo "Tek je početak"
  const slides = all.filter((x) => (few ? x.key === 'start' : x.show !== false))

  // ikonice kartica dolje — po jedna za svaku karticu koja se prikazuje
  const NAV_ICON: Record<string, ReactNode> = { intro: ICONS.star, days: ICONS.days, saved: ICONS.saved, song: ICONS.plays, album: ICONS.albums, summary: ICONS.grid }
  const nav = slides.filter((x) => NAV_ICON[x.key]).map((x) => ({ key: x.key, icon: NAV_ICON[x.key] }))
  // veći logotipi dolje: početna kartica i prazan mjesec ("Tek je početak")
  const big = slides[k].key === 'intro' || slides[k].key === 'start'
  const last = slides.length - 1
  const go = (to: 1 | -1) => {
    setStay(false)
    setDir(to)
    setK((x) => Math.max(0, Math.min(last, x + to)))
  }
  /** sa ikonice dolje ili reda sažetka na karticu */
  const jump = (key: string) => {
    const i = slides.findIndex((x) => x.key === key)
    if (i < 0 || !tapOk()) return
    haptic(5)
    setStay(false)
    setDir(i >= k ? 1 : -1)
    setK(i)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRounded(true)
        onClose()
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        setStay(false)
        setDir(e.key === 'ArrowRight' ? 1 : -1)
        setK((x) => Math.max(0, Math.min(last, x + (e.key === 'ArrowRight' ? 1 : -1))))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, last])

  return (
    // otvaranje i zatvaranje: cijeli pregled kao jedan sloj — samo pomak, veličina i
    // prozirnost (grafički procesor, ništa se ne iscrtava iznova), pa spuštanje ne zastaje
    <motion.div
      className="fixed inset-0 z-[120]"
      style={{ transformOrigin: '50% 100%', willChange: 'transform, opacity' }}
      initial={{ opacity: 0, transform: 'translateY(48px) scale(1)' }}
      animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
      // zatvaranje: klizne glatko do ispod ekrana i putem se malo smanji; tek pri dnu izblijedi
      exit={{
        opacity: 0,
        transform: 'translateY(100%) scale(0.92)',
        transition: { transform: { duration: 0.55, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.55, ease: [0.7, 0, 1, 1] } },
      }}
      transition={{ duration: 0.45, ease }}
    >
    <motion.div
      role="dialog"
      aria-modal
      aria-label={`Moj ${d.month}`}
      className="absolute inset-0 touch-none select-none overflow-hidden bg-black"
      // prst: pregled ga prati (pomak i veličina — samo transform); uglovi se zaoble
      // odjednom (jedno iscrtavanje), ne kroz tranziciju koja bi crtala u svakom kadru
      style={{ y, scale, transformOrigin: '50% 100%', borderRadius: rounded ? 34 : 0 }}
      onPointerDown={(e) => {
        down.current = e.clientY
        downAt.current = performance.now()
        setHeld(true)
      }}
      onPointerMove={(e) => {
        if (down.current == null) return
        const dy = e.clientY - down.current
        if (dy > 10) {
          swiped.current = true
          setRounded(true)
          y.set(dy * 0.9)
        }
      }}
      onPointerUp={(e) => {
        setHeld(false)
        const y0 = down.current
        down.current = null
        if (y0 == null) return
        // povučeno dolje (ili kratko, brzo potegnuto) — zatvori; dodir koji slijedi se ne broji; inače se vrati
        const dy = e.clientY - y0
        if (dy > 90 || (dy > 36 && performance.now() - downAt.current < 260)) {
          haptic(6)
          setRounded(true)
          onClose()
        } else if (y.get() > 0) {
          animate(y, 0, { type: 'spring', stiffness: 420, damping: 36, onComplete: () => setRounded(false) })
        } else swiped.current = false
      }}
      onPointerCancel={() => {
        setHeld(false)
        down.current = null
        animate(y, 0, { type: 'spring', stiffness: 420, damping: 36, onComplete: () => setRounded(false) })
      }}
      onClick={(e) => {
        if (swiped.current) return (swiped.current = false)
        if ((e.target as Element).closest('button')) return
        // dugo držanje (zaustavljena priča) — pusti i ostani, ne prebacuj
        if (performance.now() - downAt.current > 260) return
        // lijeva trećina nazad, ostalo naprijed
        const r = e.currentTarget.getBoundingClientRect()
        haptic(4)
        go(e.clientX - r.left < r.width / 3 ? -1 : 1)
      }}
    >
      <style>{`@keyframes recap-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>

      {/* kartice — pretapaju se jedna u drugu; sadržaj u istom kalupu, na sredini */}
      {/* prelaz: nova kartica klizne malo sa strane dodira i pretopi se — samo pomak i
          prozirnost (grafički procesor), slike su unaprijed dekodirane */}
      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={k}
          custom={dir}
          className="absolute inset-0"
          style={{ background: slides[k].bg, willChange: 'transform, opacity' }}
          variants={{
            enter: (to: number) => ({ opacity: 0, transform: `translateX(${to * 26}px)` }),
            center: { opacity: 1, transform: 'translateX(0px)' },
            exit: (to: number) => ({ opacity: 0, transform: `translateX(${to * -26}px)` }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="mx-auto flex h-full max-w-[440px] flex-col items-center justify-center px-7"
            // gore: okvir (traka i naslov); dolje: ikonice kartica (osim na sažetku —
            // tamo su redovi) i logotipi
            style={{ paddingTop: `calc(${topPad} + ${slides[k].key === 'intro' ? 30 : 136}px)`, paddingBottom: `calc(max(22px, env(safe-area-inset-bottom)) + ${big ? 84 : slides[k].key === 'summary' || nav.length < 2 ? 58 : 144}px)` }}
          >
            {slides[k].body}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* okvir priče, isti na svakoj kartici: gore napredak i "Moj oktobar",
          dolje ikonice kartica i logotipi. Zatvara se povlačenjem dolje (ili "Zatvori" na kraju) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto max-w-[440px] px-4" style={{ paddingTop: topPad }}>
        <div className="flex gap-1">
          {slides.map((_, i) => (
            <span key={i} className="block h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              <span
                key={i === k ? `on-${k}` : 'off'}
                className="block h-full w-full origin-left rounded-full bg-white"
                style={
                  i === k
                    ? // u videu kalendar stoji malo duže — ima šta da se vidi
                      { animation: `recap-fill ${video && slides[k].key === 'days' ? 3400 : dur}ms linear forwards`, animationPlayState: held || stay ? 'paused' : 'running' }
                    : { transform: i <= k ? 'scaleX(1)' : 'scaleX(0)' }
                }
                onAnimationEnd={() => go(1)}
              />
            </span>
          ))}
        </div>
        {/* "Moj oktobar" — elegantnim slovima; na početnoj kartici je veliki u sredini */}
        <div className="mt-9 text-center transition-opacity duration-500" style={{ opacity: slides[k].key === 'intro' ? 0 : 1 }}>
          <MonthTitle month={d.month} size={34} />
          <p className="tabular mt-3 text-[10px] tracking-[0.5em] text-white/50">{d.year}</p>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto flex max-w-[440px] flex-col items-center px-6 pb-[max(22px,env(safe-area-inset-bottom))]">
        {/* ikonice kartica — dodir skoči na nju (nema ih na početnoj, a na sažetku su redovi) */}
        {slides[k].key !== 'summary' && slides[k].key !== 'intro' && nav.length > 1 && (
          <div className="pointer-events-auto mb-12 flex items-center gap-2.5">
            {nav.map(({ key, icon }) => {
              const on = slides[k].key === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => jump(key)}
                  aria-label={key}
                  aria-current={on}
                  className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300"
                  style={{ background: on ? `${GOLD}26` : 'rgba(255,255,255,0.05)', boxShadow: `inset 0 0 0 1px ${on ? `${GOLD}88` : 'rgba(255,255,255,0.1)'}`, color: on ? GOLD : 'rgba(255,255,255,0.5)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {icon}
                  </svg>
                </button>
              )
            })}
          </div>
        )}
        {/* na početnoj kartici i na "Tek je početak" logotipi su veći (lagano narastu) */}
        <div style={{ transform: big ? 'scale(1.7)' : 'scale(1)', transformOrigin: '50% 100%', transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }}>
          <BrandLockup height={26} delay={0.15} />
        </div>
      </div>
    </motion.div>
    </motion.div>
  )
}
