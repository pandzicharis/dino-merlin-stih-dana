'use client'

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { ALBUMS, albumOf, softOf, thumbOf } from '@/data/albums'
import { MOODS } from '@/data/moods'
import type { Verse } from '@/data/verses'
import { audioFile } from '@/lib/audio-name'
import { dragScroll } from '@/lib/drag-scroll'
import { haptic } from '@/lib/haptic'
import { asWritten, loose, paperText } from '@/lib/text'
import { videoOf } from '@/lib/youtube'
import { primeLyrics } from '../Lyrics'

/*
 * Prikazi sačuvanih stihova u ladici (components/tube/TubePanel.tsx) — kao u
 * starom plejeru (components/SavedPlayer.tsx), samo bez plejera: dodir na
 * stih ili pjesmu otvori pjesmu (`onPick`), video i tekst su drugi nivo ladice.
 *
 *   Slips      papirići iz tombole — jednaki, u mreži, različiti po boji
 *   SongList   pjesme — omot, naziv, cijeli stih
 *   Albums     po albumima — kartice koje se listaju, u svakoj njene pjesme
 * (Kartice su špil iz components/SavedCarousel.tsx.)
 */

export type TubeView = 'cards' | 'slips' | 'list' | 'albums'

/** prikazi redom — natpis i znak (dugmad na dnu ladice, kao u starom plejeru) */
export const VIEWS: [TubeView, string, ReactNode][] = [
  ['cards', 'Stihovi', <path key="c" d="M8 3.5h9.5A2.5 2.5 0 0 1 20 6v11M4 6.5h13v14H4z" />],
  [
    'slips',
    'Papirići',
    <g key="s">
      <rect x="2.5" y="5" width="13" height="5.5" rx="1" />
      <rect x="8.5" y="13.5" width="13" height="5.5" rx="1" />
    </g>,
  ],
  ['list', 'Pjesme', <path key="l" d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />],
  [
    'albums',
    'Albumi',
    <g key="a">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="12" cy="12" r="0.6" />
    </g>,
  ],
]

/** pjesma — dva stiha iste pjesme su ista pjesma */
export const songKey = (v: Verse) => audioFile(v.song)

/** Svaka pjesma jednom (prvi sačuvani stih je nosi). */
export function uniqueSongs(list: Verse[]): Verse[] {
  const seen = new Set<string>()
  return list.filter((v) => {
    const k = songKey(v)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Pretraga pjesama: svaka riječ upita negdje u nazivu, albumu ili stihu (bez
 * kvačica — "sta" nađe "šta"). Pjesme kojima naziv odgovara su prve.
 */
export function searchSongs(songs: Verse[], query: string): Verse[] {
  const words = loose(query).split(' ').filter(Boolean)
  if (!words.length) return songs
  const hits: [Verse, number][] = []
  for (const v of songs) {
    const title = loose(v.song)
    const all = `${title} ${loose(v.album)} ${loose(v.description)} ${loose(v.text)}`
    if (!words.every((w) => all.includes(w))) continue
    hits.push([v, title.startsWith(words[0]) ? 0 : words.every((w) => title.includes(w)) ? 1 : 2])
  }
  return hits.sort((a, b) => a[1] - b[1]).map(([v]) => v)
}

/** 1 pjesma, 2–4 pjesme, 5 pjesama (i 21 pjesma, 22 pjesme…) */
function pjesme(n: number) {
  const d = n % 10
  const t = n % 100
  if (d === 1 && t !== 11) return `${n} pjesma`
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return `${n} pjesme`
  return `${n} pjesama`
}

/** stih u jednom komadu, kao rečenica */
const oneLine = (text: string) => {
  const t = asWritten(text).split('\n').map((l) => l.trim()).filter(Boolean).join(' ').toLocaleLowerCase('bs')
  return t.charAt(0).toLocaleUpperCase('bs') + t.slice(1)
}

/** omot albuma (sličica) — bez albuma logo aplikacije */
const art = (cover?: string) => `url(${cover ? (thumbOf(cover) ?? cover) : '/icons/icon-192.png?v=2'})`

/* ── papirići ── */

/** boje papirića redom — topla do hladne, pa susjedi nikad nisu iste boje (tombola, components/deck/PaperToPhone.tsx) */
const PAPERS = ['#E8473B', '#3FA2E0', '#F6D23A', '#4BB86A', '#E9B8E6', '#F28C38', '#8EDBE8', '#D7E87C', '#F7A35C']

/* slova na papiriću — isti rez kao u tomboli (components/IntroSplash.tsx) */
const PAPER = {
  fontFamily: 'var(--font-serif), Georgia, serif',
  fontWeight: 400,
  letterSpacing: '-0.02em',
  fontVariationSettings: "'wght' 400, 'opsz' 144, 'SOFT' 30, 'WONK' 0",
  color: '#1d1a16',
} as const

/**
 * Papirić iz Magaze je 5,3 × 1,7 cm (components/admin/PrintSlips.tsx) — ovdje
 * u istoj razmjeri i otprilike veličine papirića iz tombole: dva u redu.
 * Slova (u širinama papirića, `cqw`): stih stane u najviše tri reda.
 */
const SLIP_RATIO = '53 / 17'
const slipFont = (text: string) => `${Math.min(8.2, 560 / Math.max(text.length, 1)).toFixed(2)}cqw`

/**
 * Papirići iz tombole, jedan do drugog kao na listu za štampu: svi iste
 * veličine (kao u Magazi) i ravni, samo boje različite — susjedi nikad iste.
 * Na papiriću samo stih. Dodir raširi stih (components/SavedFull.tsx — nađe
 * papirić po `data-stih`, raste iz njega i vrati se na njega).
 */
export function Slips({ verses, onPick }: { verses: Verse[]; onPick: (v: Verse) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 pb-8 pt-1">
      {verses.map((v, i) => (
        <Slip key={v.id} v={v} n={i} onPick={onPick} />
      ))}
    </div>
  )
}

const Slip = memo(function Slip({ v, n, onPick }: { v: Verse; n: number; onPick: (v: Verse) => void }) {
  const text = paperText(v.text)
  return (
    <motion.button
      type="button"
      data-stih={v.id}
      onClick={() => onPick(v)}
      aria-label={`${text} — ${v.song}`}
      className="relative flex w-full items-center justify-center overflow-hidden rounded-[2px] text-center shadow-[0_3px_10px_rgba(0,0,0,0.35)]"
      style={{
        ...PAPER,
        aspectRatio: SLIP_RATIO,
        containerType: 'inline-size',
        padding: '0 6%',
        // čista slova — bez sjene i bez tamnog pretapanja preko njih (samo blag sjaj papira gore)
        textShadow: 'none',
        background: `linear-gradient(175deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 50%), ${PAPERS[n % PAPERS.length]}`,
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: 0.03 + Math.min(n, 10) * 0.03, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.97 }}
    >
      <span className="relative line-clamp-3 [text-wrap:balance]" style={{ fontSize: slipFont(text), lineHeight: 1.12 }}>
        {text}
      </span>
    </motion.button>
  )
})

/* ── pjesme ── */

/**
 * Red pjesme — isti u "Pjesme" i u karticama albuma: omot, naziv velikim
 * slovima, cijeli stih običnim. Dodir otvori pjesmu.
 */
const SongRow = memo(function SongRow({ v, onPick }: { v: Verse; onPick: (v: Verse) => void }) {
  const m = MOODS[v.mood]
  return (
    <button
      type="button"
      disabled={!videoOf(v)}
      onPointerDown={() => primeLyrics(v.song)}
      onClick={() => {
        haptic(6)
        onPick(v)
      }}
      className="flex w-full items-center gap-3 rounded-[14px] px-2 py-2.5 text-left transition-colors duration-300 hover:bg-white/[0.05] active:bg-white/[0.07] disabled:opacity-50"
    >
      <span
        className="block h-[46px] w-[46px] shrink-0 rounded-[10px] bg-cover bg-center"
        style={{ backgroundImage: art(albumOf(v.album)?.cover), backgroundColor: m.gradient[2], boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold uppercase leading-tight tracking-[0.18em] text-white/90">{v.song}</span>
        <span className="mt-1 block text-[12.5px] leading-snug text-white/50">{oneLine(v.text)}</span>
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-white/30" aria-hidden>
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  )
})

/** Pjesme: lista sačuvanih (najnovija prva), svaka jednom. */
export function SongList({ verses, onPick }: { verses: Verse[]; onPick: (v: Verse) => void }) {
  if (!verses.length) return <p className="flex h-full items-center justify-center pb-6 text-[13px] text-white/45">Nema takve pjesme</p>
  return (
    <ul className="flex flex-col pb-4 pt-1 [&>li+li]:border-t [&>li+li]:border-white/[0.06]">
      {verses.map((v) => (
        <li key={v.id}>
          <SongRow v={v} onPick={onPick} />
        </li>
      ))}
    </ul>
  )
}

/* ── albumi ── */

/** razmak između kartica albuma (px) */
const GAP = 12

/**
 * Sačuvani po albumima, od najnovijeg. Svi albumi su tu — oni iz kojih još
 * nema stiha su prazni (zatamnjeni), na svom mjestu u diskografiji. Pjesme
 * bez (poznatog) albuma — jedna kartica, zadnja.
 */
function byAlbum(verses: Verse[]) {
  const got = new Map<string, Verse[]>()
  const rest: Verse[] = []
  for (const v of verses) {
    const name = albumOf(v.album)?.title
    if (!name) rest.push(v)
    else if (got.has(name)) got.get(name)!.push(v)
    else got.set(name, [v])
  }
  // ALBUMS su poredani od najstarijeg
  const all = [...ALBUMS].reverse().map((a) => ({ name: a.title, list: got.get(a.title) ?? [] }))
  return rest.length ? [...all, { name: 'Bez albuma', list: rest }] : all
}

/**
 * Albumi kao kartice — prevuci lijevo/desno za sljedeći album (vodoravni
 * skrol sa zaustavljanjem na kartici). Kartica nosi omot (zamućen iza), naziv
 * i godinu, a ispod svoje pjesme. Tačkice ispod pokazuju koji je; prazan
 * kružić je album iz kog još nema stiha.
 */
export function Albums({ verses, onPick }: { verses: Verse[]; onPick: (v: Verse) => void }) {
  const albums = useMemo(() => byAlbum(verses), [verses])
  const n = albums.length
  const strip = useRef<HTMLDivElement>(null)
  // na početku je ispred prvi album koji ima pjesme
  const first = Math.max(0, albums.findIndex((a) => a.list.length))
  const [at, setAt] = useState(first)
  const i = Math.min(at, n - 1)
  const scrollTo = useCallback((k: number, smooth: boolean) => {
    const el = strip.current
    const c = el?.querySelectorAll<HTMLElement>('[data-album]')[k]
    if (!el || !c) return
    el.scrollTo({ left: c.offsetLeft + c.offsetWidth / 2 - el.clientWidth / 2, behavior: smooth ? 'smooth' : 'instant' })
  }, [])
  const go = (k: number) => {
    const t = Math.max(0, Math.min(n - 1, k))
    if (t !== i) haptic(5)
    scrollTo(t, true)
  }
  useLayoutEffect(() => {
    scrollTo(first, false)
  }, [first, scrollTo])
  // koji je album na sredini — jednom po kadru dok se lista
  useEffect(() => {
    const el = strip.current
    if (!el || n < 2) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const cs = el.querySelectorAll<HTMLElement>('[data-album]')
        const step = cs.length > 1 ? cs[1].offsetLeft - cs[0].offsetLeft : 0
        if (step > 0) setAt(Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / step))))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    // mišem (računar) — prst i trackpad ionako skrolaju sami
    const undrag = dragScroll(el, () => {
      const cs = el.querySelectorAll<HTMLElement>('[data-album]')
      return cs.length > 1 ? cs[1].offsetLeft - cs[0].offsetLeft : 0
    })
    return () => {
      undrag()
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', onScroll)
    }
  }, [n])

  return (
    <div className="flex h-full min-h-0 flex-col pt-1">
      <div className="-mx-5 min-h-0 flex-1">
        <div
          ref={strip}
          data-hscroll
          className="relative flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ gap: GAP }}
        >
          {/* razmak do prvog/zadnjeg — da i oni stanu u liniju sa zaglavljem */}
          <div aria-hidden className="shrink-0" style={{ width: 20 - GAP }} />
          {albums.map(({ name, list }, k) => (
            <AlbumCard key={name} name={name} list={list} ahead={k === i} onBring={() => go(k)} onPick={onPick} />
          ))}
          <div aria-hidden className="shrink-0" style={{ width: 20 - GAP }} />
        </div>
      </div>

      {/* tačkice — koji je album; dodir skoči na njega */}
      {n > 1 && (
        <div className="mt-2 flex shrink-0 items-center justify-center gap-1.5">
          {albums.map(({ name, list }, k) => (
            <button key={name} type="button" onClick={() => go(k)} aria-label={name} aria-current={k === i} className="flex h-6 items-center px-0.5">
              <span
                className="block h-1.5 w-1.5 rounded-full"
                style={list.length ? { background: k === i ? '#fff' : 'rgba(255,255,255,0.22)' } : { boxShadow: `inset 0 0 0 1px rgba(255,255,255,${k === i ? 0.7 : 0.22})` }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const AlbumCard = memo(function AlbumCard({
  name,
  list,
  ahead,
  onBring,
  onPick,
}: {
  name: string
  list: Verse[]
  /** ova je ispred */
  ahead: boolean
  /** dodir na susjednu karticu je dovede naprijed */
  onBring: () => void
  onPick: (v: Verse) => void
}) {
  const album = albumOf(name)
  const cover = album?.cover
  const soft = softOf(cover)
  const empty = !list.length
  return (
    <section
      aria-label={name}
      data-album
      className="relative flex h-full shrink-0 snap-center snap-always flex-col overflow-hidden rounded-[24px] border border-white/[0.07]"
      style={{ width: 'calc(100% - 40px)', contain: 'layout paint' }}
      onClickCapture={(e) => {
        if (ahead) return
        e.stopPropagation()
        onBring()
      }}
    >
      {/* boje albuma — zamućen omot; album bez stiha je zatamnjen */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${empty ? 'rgba(10,10,12,0.8) 0%, rgba(8,8,10,0.92) 100%' : 'rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.7) 100%'})${soft ? `, url(${soft}) center / cover` : ''}, #141416`,
        }}
        aria-hidden
      />
      <div className="relative flex shrink-0 items-center gap-3 px-4 pb-3 pt-4">
        <span
          className={`block h-[72px] w-[72px] shrink-0 rounded-[14px] bg-cover bg-center ${empty ? 'opacity-35' : ''}`}
          style={{ backgroundImage: art(cover), backgroundColor: '#141416', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className={`truncate text-[14px] font-semibold uppercase leading-tight tracking-[0.2em] ${empty ? 'text-white/45' : 'text-white'}`}>{name}</p>
          <p className={`mt-1 text-[10px] uppercase tracking-[0.22em] ${empty ? 'text-white/30' : 'text-white/55'}`}>
            {empty ? `${album?.year} · još bez stiha` : album ? `${album.year} · ${pjesme(list.length)}` : pjesme(list.length)}
          </p>
        </div>
      </div>
      {empty ? (
        // ploča — mjesto za album koji tek dođe
        <div className="relative flex flex-1 items-center justify-center pb-6 text-white/[0.08]" aria-hidden>
          <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6.5" />
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="0.5" fill="currentColor" />
          </svg>
        </div>
      ) : (
        // njegove pjesme — isti redovi kao u "Pjesme", lista se skrola u kartici
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-none px-2 pb-2 [&>*+*]:border-t [&>*+*]:border-white/[0.06]">
          {list.map((v) => (
            <div key={v.id}>
              <SongRow v={v} onPick={onPick} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
})
