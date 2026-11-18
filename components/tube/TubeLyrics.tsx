'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { MOODS } from '@/data/moods'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
import { haptic } from '@/lib/haptic'
import { asWritten } from '@/lib/text'
import { seekTube, tubeTime, useTube } from '@/lib/youtube'
import { EqBars } from '../EqBars'
import { loadLyrics, lyricsNow, verseMatcher, type LyricsData } from '../Lyrics'

/*
 * Tekst pjesme ispod videa (components/tube/NowPlaying.tsx) — isti tekst kao
 * panel "Tekst pjesme" (components/Lyrics.tsx), a vrijeme iz YouTube plejera.
 *
 * Svaka pjesma ima svoj slučaj:
 *   s vremenom    (LRCLIB) tekst prati pjesmu, dodir na red premota
 *   bez vremena   tekst stoji i čita se rukom — ne glumi praćenje
 *   bez teksta    na tom mjestu stih
 * Vremena vrijede samo za snimak te dužine: video druge dužine (uživo, duži
 * uvod) ide kao tekst bez vremena. Pjesma koja ide samo preko YouTubea (server
 * joj ne zna trajanje) pita opet kad plejer javi trajanje videa.
 */

/** koliko trajanje videa smije odstupati od snimka za koji vrijede vremena (s) */
const SLACK = 4

/** Tekst pjesme stiha za video u plejeru: 'loading' dok stiže, null kad ga nema. */
export function useTubeLyrics(verse: Verse): LyricsData | null | 'loading' {
  const song = verse.song
  const [got, setGot] = useState<{ song: string; data: LyricsData | null } | null>(null)
  useEffect(() => {
    let on = true
    loadLyrics(song).then(
      (data) => on && setGot({ song, data }),
      () => on && setGot({ song, data: null }),
    )
    return () => {
      on = false
    }
  }, [song])
  // nova pjesma: tekst koji je već stigao (pripremljen) odmah — bez praznog kadra
  const data = got?.song === song ? got.data : lyricsNow(song)

  // trajanje videa — plejer ga zna tek kad se video učita
  const tube = useTube()
  const vid = tube.verseId === verse.id ? tube.videoId : null
  const [video, setVideo] = useState<{ id: string; d: number } | null>(null)
  useEffect(() => {
    if (!vid) return
    const id = window.setInterval(() => {
      const d = Math.round(tubeTime().d)
      if (!d) return
      clearInterval(id)
      setVideo({ id: vid, d })
    }, 400)
    return () => clearInterval(id)
  }, [vid])
  const dur = video && video.id === vid ? video.d : 0

  // trajanje se ne sazna (video ne krene, greška) — tekst se pokaže i bez njega
  const [late, setLate] = useState<string | null>(null)
  useEffect(() => {
    if (!vid) return
    const t = window.setTimeout(() => setLate(vid), 2500)
    return () => clearTimeout(t)
  }, [vid])
  const gaveUp = late === vid

  // server ne zna trajanje pjesme: s trajanjem videa se možda nađu vremena redova
  const open = Boolean(data?.open && !data.synced?.length)
  /** odgovor na pitanje s trajanjem stigao (s vremenima ili bez) — `pjesma|trajanje` */
  const [asked, setAsked] = useState<string | null>(null)
  useEffect(() => {
    if (!open || !dur) return
    let on = true
    const key = `${song}|${dur}`
    loadLyrics(song, dur).then(
      (d) => {
        if (!on) return
        if (d?.synced?.length) setGot({ song, data: d })
        setAsked(key)
      },
      () => on && setAsked(key),
    )
    return () => {
      on = false
    }
  }, [open, dur, song])

  return useMemo(() => {
    if (data === undefined) return 'loading'
    if (!data) return null
    // vremena redova zavise od trajanja videa: dok se ono ne zna (i dok ne stigne odgovor s
    // njim), tekst čeka — pokaže se jednom, u konačnom obliku, ne preslaže se pred očima
    const needs = open || Boolean(data.synced?.length && data.duration)
    if (needs && !gaveUp && (!dur || (open && asked !== `${song}|${dur}`))) return 'loading'
    const fits = !data.duration || !dur || Math.abs(dur - data.duration) <= SLACK
    if (fits || !data.synced?.length) return data
    // vremena ne vrijede za ovaj video: isti tekst, ali stoji
    return { ...data, synced: undefined, lines: data.lines.length ? data.lines : data.synced.map((s) => s.l) }
  }, [data, dur, open, gaveUp, asked, song])
}

/* ── tekst ispod videa ── */

/** red zasvijetli malo prije svog vremena (kao components/Lyrics.tsx) */
const LEAD = 0.35
const SERIF = 'var(--font-serif), serif'
/** pauza (uvod, instrumental): razmak među redovima od ovoliko sekundi ili više */
const PAUSE = 9
/** uvod kraći od ovoga nije pauza */
const INTRO = 4

/** red teksta (`i` — indeks u `lines`) ili pauza (`i` = -1) — i od kad traje (s vremenom) */
type Item = { i: number; t: number }

/**
 * Redovi i pauze (muzika bez pjevanja — znak koji titra), po vremenu. Pauza je
 * na početku (uvod) i između strofa: s vremenom svaki duži razmak među redovima
 * (počne kad se red otpjeva — obično trajanje reda u pjesmi, traje do
 * sljedećeg), bez vremena prazan red. Dvije pauze nikad jedna do druge.
 */
function itemsOf(lines: string[], synced: { t: number }[] | null): Item[] {
  const out: Item[] = []
  const gap = () => !out.length || out[out.length - 1].i < 0 || !lines[out[out.length - 1].i]
  const push = (it: Item) => {
    // pauza (ili prazan red) poslije pauze — preskoči
    if ((it.i < 0 || !lines[it.i]) && out.length && gap()) return
    out.push(it)
  }
  if (!synced) {
    out.push({ i: -1, t: 0 })
    lines.forEach((_, i) => push({ i, t: 0 }))
    // prazno na kraju — ne treba
    while (out.length > 1 && gap()) out.pop()
    return out
  }
  const gaps = synced.slice(1).map((s, k) => s.t - synced[k].t)
  const usual = gaps.filter((g) => g < PAUSE).sort((a, b) => a - b)
  const sung = Math.min(6, Math.max(2.5, usual.length ? usual[Math.floor(usual.length / 2)] : 4))
  if (synced[0].t >= INTRO) out.push({ i: -1, t: 0 })
  synced.forEach((s, i) => {
    push({ i, t: s.t })
    const next = synced[i + 1]
    if (next && lines[i] && next.t - s.t >= PAUSE) push({ i: -1, t: s.t + sung })
  })
  return out
}

/**
 * Tekst pjesme ispod videa (components/tube/NowPlaying.tsx): centriran,
 * serifna slova. S vremenom: red koji se pjeva je pun, krupniji i
 * stoji na sredini prozora (`anchor`), ostali utihnu, tekst sam klizi (prst ga preuzme na par sekundi),
 * dodir na red premota; na pauzi (uvod, instrumental) između redova titra
 * znak muzike. Bez vremena: stoji i otvori se od početka. Tvoj
 * stih je u zlatu. Bez teksta: samo stih.
 */
/** red koji se pjeva: uvećanje i svjetlo mekano (slova ostaju iste veličine); veličina slova
 *  se mijenja samo s tekstom preko cijelog ekrana — u istom potezu kao ladica */
const LINE_TRANSITION =
  'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease, color 0.5s ease, font-size 0.5s cubic-bezier(0.4, 0, 0.2, 1), line-height 0.5s cubic-bezier(0.4, 0, 0.2, 1)'

export function LyricsView({
  verse,
  lyrics,
  anchor = 0.3,
  big = false,
}: {
  verse: Verse
  lyrics: LyricsData | null | 'loading'
  /** gdje stoji red koji se pjeva (dio visine) */
  anchor?: number
  /** tekst preko cijelog ekrana (plejer): krupnija slova */
  big?: boolean
}) {
  const mine = useMemo(() => verseMatcher(verse.text), [verse.text])
  const data = lyrics && lyrics !== 'loading' ? lyrics : null
  const synced = data?.synced?.length ? data.synced : null
  const shift = data?.offset ?? 0
  const lines = useMemo(() => (synced ? synced.map((s) => s.l.trim()) : (data?.lines ?? []).map((l) => l.trim())), [synced, data])
  // redovi i pauze; `active` i `rows` idu po njima
  const items = useMemo(() => itemsOf(lines, synced), [lines, synced])
  const scroller = useRef<HTMLDivElement>(null)
  const rows = useRef<(HTMLElement | null)[]>([])
  const [active, setActive] = useState(-1)
  const playing = useTube().status === 'playing'
  // mjesto reda se mijenja (skupljen / raširen tekst) — praćenje ga čita svaki kadar
  const at = useRef(anchor)
  useEffect(() => {
    at.current = anchor
  }, [anchor])

  // s vremenom: red (ili pauza) koji traje i tekst koji klizi za njim (svaki kadar, mekano)
  useEffect(() => {
    const el = scroller.current
    if (!el || !synced) return
    let raf = 0
    let hold = 0
    let pos = -1
    let last = -2
    // prvi put tekst odmah stoji na redu koji traje (dok se pretapa) — ne klizi od vrha
    let placed = false
    let prev = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      // korak po vremenu, ne po kadru — isto klizi na 60 i na 120 Hz (iPhone Pro)
      const dt = prev ? Math.min(64, now - prev) : 16.7
      prev = now
      const t = tubeTime().t
      let k = -1
      if (t > 0) while (k + 1 < items.length && items[k + 1].t <= t + LEAD + shift) k++
      if (k !== last) {
        last = k
        setActive(k)
      }
      const row = k >= 0 ? rows.current[k] : null
      const max = el.scrollHeight - el.clientHeight
      if (now < hold || max <= 0) return void (pos = -1)
      const target = row ? Math.max(0, Math.min(max, row.offsetTop + row.offsetHeight / 2 - el.clientHeight * at.current)) : 0
      if (!placed) {
        placed = true
        pos = target
        el.scrollTop = target
        return
      }
      if (pos < 0) pos = el.scrollTop
      const gap = target - pos
      // mekano usporavanje do reda — otprilike koliko traje i pretapanje reda (0,6 s)
      pos += gap * (1 - Math.pow(1 - (Math.abs(gap) > 80 ? 0.08 : 0.1), dt / 16.7))
      if (Math.abs(target - pos) < 0.4) pos = target
      el.scrollTop = pos
    }
    raf = requestAnimationFrame(tick)
    const take = () => void (hold = performance.now() + 3500)
    const kinds = ['wheel', 'touchstart', 'pointerdown'] as const
    for (const k of kinds) el.addEventListener(k, take, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      for (const k of kinds) el.removeEventListener(k, take)
    }
  }, [synced, items, shift])

  // bez vremena tekst se uvijek otvara od početka (tvoj stih je u zlatu, gdje god bio)

  if (lyrics === 'loading') return <div className="flex-1" />
  if (!data)
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <p className="text-[24px] leading-[1.25] [text-wrap:balance]" style={{ fontFamily: SERIF, color: BRAND.gold }}>
          {asWritten(verse.text)
            .split('\n')
            .map((l, i) => (
              <span key={i} className="block">
                {l}
              </span>
            ))}
        </p>
      </div>
    )

  // gore kratko pretapanje i malo mjesta — tekst počinje odmah ispod trake "Tekst pjesme"
  // dole kraće pretapanje i manje praznog — kraj teksta usklađen s početkom
  const fade = 'linear-gradient(180deg, transparent 0, #000 5%, #000 93%, transparent 100%)'
  return (
    // tekst se pretopi kad stigne (i kad stigne kasnije, dok je harmonika već otvorena) — ne iskoči
    <motion.div
      ref={scroller}
      data-lyrics-scroll
      className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 text-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ maskImage: fade, WebkitMaskImage: fade }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="pb-8 pt-5">
        {items.map(({ i }, j) => {
          const text = i < 0 ? '' : lines[i]
          // pauza (početak, između strofa): znak muzike, s razmakom oko sebe. S vremenom
          // jasan i titra dok traje, inače tih; bez vremena tih i titra dok pjesma svira
          if (!text) {
            const now = Boolean(synced) && j === active
            return (
              // na samom početku niža (iznad nje nema ničega), između strofa s razmakom oko sebe
              <div key={j} ref={(el) => void (rows.current[j] = el)} className={`flex items-center justify-center ${j === 0 ? 'h-8' : 'h-12'}`} aria-hidden>
                <span className="transition-opacity duration-500" style={{ opacity: now ? 1 : 0.4 }}>
                  {/* isti znak kao uz "Tekst pjesme" — boja stiha, iste veličine */}
                  <EqBars accent={MOODS[verse.mood].accent} on={playing && (now || !synced)} h={14} />
                </span>
              </div>
            )
          }
          const gold = mine(text)
          const now = synced ? j === active : false
          const past = synced ? j < active : false
          const note = !synced && text.startsWith('*')
          return (
            <p
              key={j}
              ref={(el) => void (rows.current[j] = el)}
              onClick={
                synced
                  ? () => {
                      haptic(5)
                      seekTube(Math.max(0, synced[i].t - 0.3 - shift))
                    }
                  : undefined
              }
              // isti razmak svuda: red koji se prelomi i dva reda su jednako razmaknuti
              // (bez dodatka među redovima) — veći razmak je samo pauza među strofama.
              // Svi redovi su iste veličine: red koji se pjeva se samo malo poveća (slika,
              // ne slova) i zasvijetli — ništa se ne preslaže ni ne prelama usput, pa prelaz s
              // reda na red teče glatko, a tekst za njim mekano klizi (ostaje na sredini)
              className={`origin-center [text-wrap:balance] ${note ? 'py-1 text-[13px] italic leading-snug' : big ? 'text-[24px] leading-[1.55]' : 'text-[20px] leading-[1.6]'} ${synced ? 'cursor-pointer' : ''}`}
              style={{
                fontFamily: SERIF,
                color: gold ? BRAND.gold : '#fff',
                opacity: synced ? (now ? 1 : past ? 0.3 : 0.45) : note ? 0.5 : gold ? 1 : 0.82,
                transform: now ? 'scale(1.1)' : undefined,
                transition: LINE_TRANSITION,
              }}
            >
              {note ? text.replace(/^\*\s*/, '') : text}
            </p>
          )
        })}
      </div>
    </motion.div>
  )
}
