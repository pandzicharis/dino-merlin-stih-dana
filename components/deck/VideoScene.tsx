'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
import { audioFile } from '@/lib/audio-name'
import { seedMonth } from '@/lib/storage'
import { recapDate } from '../RecapHost'
import { LivePhone } from './Stages'
import { MagazaMark } from './Screens'
import { Backdrop, Sheet } from './Poster'
import type { Simulation } from './types'

export type VideoFormat = 'story' | 'objava'

/** Koraci videa — svaki ima svoj natpis. */
type Step = 'notify' | 'tombola' | 'verse' | 'save' | 'play' | 'lyrics' | 'month' | 'end'

const CAPTIONS: Record<Step, { eyebrow: string; a: string; b: string }> = {
  notify: { eyebrow: 'Svaki dan u 12:00', a: 'Stigne obavijest.', b: 'Tvoj stih te čeka.' },
  tombola: { eyebrow: 'Jedan dodir', a: 'Listići zaplešu,', b: 'jedan je tvoj.' },
  verse: { eyebrow: 'Stih dana', a: 'Riječi koje', b: 'danas trebaš.' },
  save: { eyebrow: 'Sačuvaj', a: 'Da ti ostane', b: 'za kasnije.' },
  play: { eyebrow: 'Player pjesama', a: 'Sačuvani stihovi', b: 'su tvoj plejer.' },
  lyrics: { eyebrow: 'Tekst pjesme', a: 'Riječi idu', b: 'uz muziku.' },
  month: { eyebrow: 'Moj mjesec', a: 'Svaki mjesec', b: 'kao priča.' },
  end: { eyebrow: 'Besplatno · iPhone · Android', a: 'Jedan stih.', b: 'Svaki dan.' },
}

/** Ono što skripta za snimanje čita (scripts/export-video.mjs). */
type VideoApi = {
  ready: boolean
  done: boolean
  /** sekunde od početka — zvuk obavijesti i pjesme se lijepe na ova mjesta */
  marks: Partial<Record<'notify' | 'play' | 'end', number>>
  audio: string
  start: () => number
}
declare global {
  interface Window {
    __video?: VideoApi
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Video za story (9:16) i objavu (4:5): cijeli tok u pravom telefonu —
 * obavijest → dodir → tombola → stih → sačuvaj → pjesma iz sačuvanih → moj
 * mjesec (pregled mjeseca prođe sam, na probnim podacima) — uz natpise.
 * `rec`: bez dugmadi, čeka da ga skripta pokrene (snimanje kroz Chrome).
 */
export function VideoScene({
  format,
  verse,
  verses,
  date,
  host,
  rec = false,
}: {
  format: VideoFormat
  verse: Verse
  /** svi stihovi — probni podaci za pregled mjeseca */
  verses: Verse[]
  date: string
  host: string
  rec?: boolean
}) {
  const story = format === 'story'
  const ratio = story ? 16 / 9 : 1.25
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [sim, setSim] = useState<Simulation | null>(null)
  const [simKey, setSimKey] = useState(0)
  const [step, setStep] = useState<Step | null>(null)
  const [tap, setTap] = useState<{ x: number; y: number; n: number } | null>(null)
  const run = useRef(0)
  const t0 = useRef(0)
  const marks = useRef<VideoApi['marks']>({})
  const opened = useRef<(() => void) | null>(null)
  const mark = (k: keyof VideoApi['marks']) => (marks.current[k] = (performance.now() - t0.current) / 1000)

  const doc = () => {
    try {
      return frameRef.current?.contentDocument ?? null
    } catch {
      return null
    }
  }
  const until = useCallback(async (ok: () => boolean, ms = 30000) => {
    const end = performance.now() + ms
    while (performance.now() < end) {
      if (ok()) return true
      await wait(100)
    }
    return false
  }, [])

  // dodir prezentacije: krug iznad dugmeta, pa pravi klik u aplikaciji
  const press = useCallback(async (sel: string, id: number) => {
    const el = doc()?.querySelector<HTMLElement>(sel)
    if (!el || run.current !== id) return
    const r = el.getBoundingClientRect()
    setTap({ x: r.left + r.width / 2, y: r.top + r.height / 2, n: Date.now() })
    await wait(260)
    if (run.current !== id) return
    el.click()
    window.setTimeout(() => setTap(null), 500)
  }, [])

  const play = useCallback(async () => {
    const id = ++run.current
    const alive = () => run.current === id
    // ispočetka: stih nije sačuvan, pjesma stoji, aplikacija na stihu
    try {
      localStorage.setItem('stihdana:favorites', '[]')
      localStorage.setItem('stihdana:notify', 'true')
    } catch {
      /* privatni prozor */
    }
    frameRef.current?.contentWindow?.dispatchEvent(new Event('stihdana:stop-audio'))
    marks.current = {}
    setTap(null)
    setStep(null)
    t0.current = performance.now()

    // 1 — zaključan ekran, u podne stigne obavijest; dodir je otvori (LockNotify)
    setSim('lock')
    setSimKey((k) => k + 1)
    await wait(300)
    setStep('notify')
    await wait(1700)
    mark('notify')
    const open = new Promise<void>((r) => (opened.current = r))
    await open
    if (!alive()) return

    // 2 — aplikacija se otvori, tombola se zavrti i izvuče stih
    setStep('tombola')
    frameRef.current?.contentWindow?.postMessage({ type: 'stihdana:izvuci' }, window.location.origin)
    await until(() => Boolean(doc()?.querySelector('[data-izvlacenje]')), 4000)
    await until(() => !doc()?.querySelector('[data-izvlacenje]'))
    if (!alive()) return
    setStep('verse')
    await wait(2600)

    // 3 — sačuvaj
    if (!alive()) return
    setStep('save')
    await wait(700)
    await press('[data-tip="save"]', id)
    // srce se upali i iskoči ikonica s brojem — pa odmah u sačuvane
    await wait(1300)

    // 4 — otvori Player pjesama (ikonica gore) — pjesma prednje karte krene
    // sama; nazad na stih dana — pjesma svira dalje, na početnoj pluta mini plejer
    if (!alive()) return
    setStep('play')
    await press('[data-tip="saved"]', id)
    mark('play')
    await until(() => Boolean(doc()?.querySelector('[data-player] [aria-label="Pauza"]')), 5000)
    await wait(2400)
    if (!alive()) return
    await press('[role="dialog"][aria-label="Player pjesama"] button[aria-label="Spusti"]', id)
    await wait(1800)

    // 5 — tekst pjesme iz mini plejera: redovi svijetle uz muziku
    if (!alive()) return
    setStep('lyrics')
    await press('[data-mini] button[aria-label="Tekst pjesme"]', id)
    // dodir na red — pjesma skoči tamo, red svijetli i tekst ide dalje s njom
    await until(() => Boolean(doc()?.querySelector('[data-lyric-row="2"]')), 4000)
    await wait(700)
    await press('[data-lyric-row="2"]', id)
    await wait(4200)
    if (!alive()) return
    await press('[role="dialog"][aria-label^="Tekst —"] [data-drawer-close]', id)
    await wait(1200)

    // 5 — moj mjesec: probni podaci mjeseca (telefon dijeli localStorage s
    // ovom stranicom), ikonica kalendara gore — priča prođe sama, pa se zatvori
    if (!alive()) return
    setStep('month')
    const day = Number(date.slice(8, 10))
    const prev = recapDate(date)
    if (day <= 7) seedMonth(verses, prev.slice(0, 7), Number(prev.slice(8, 10)))
    else seedMonth(verses, date.slice(0, 7), day - 1)
    await wait(900)
    await press('button[aria-label="Moj mjesec"]', id)
    await until(() => Boolean(doc()?.querySelector('[data-recap-end]')), 40000)
    await wait(2600)
    if (!alive()) return
    await press('[data-recap-end]', id)
    await wait(1200)

    // 5 — kraj: poruka i link
    if (!alive()) return
    setStep('end')
    mark('end')
    await wait(4000)
    if (alive() && window.__video) window.__video.done = true
  }, [press, until, date, verses])

  // aplikacija je spremna kad je stih na ekranu (iframe se zna učitati prije
  // hidratacije, pa se ne čeka njegov onLoad)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let off = false
    void until(() => Boolean(doc()?.querySelector('[data-tip="mine"]'))).then((ok) => !off && ok && setReady(true))
    return () => {
      off = true
    }
  }, [until])

  useEffect(() => {
    window.__video = {
      ready,
      done: false,
      marks: marks.current,
      audio: `/audio/${audioFile(verse.song)}.m4a`,
      start: () => {
        void play()
        return Date.now()
      },
    }
    Object.defineProperty(window.__video, 'marks', { get: () => marks.current })
  }, [ready, play, verse.song])

  // bez snimanja: kreće sam čim je aplikacija spremna
  useEffect(() => {
    if (!ready || rec) return
    const t = window.setTimeout(() => void play(), 0)
    return () => clearTimeout(t)
  }, [ready, rec, play])

  const c = step ? CAPTIONS[step] : null
  const width = rec ? '100vw' : `min(100vw, calc(100dvh / ${ratio}))`

  return (
    <div className="flex min-h-[100dvh] items-center justify-center" style={{ background: '#070708' }}>
      <Sheet width={width} ratio={ratio}>
        <Backdrop portrait={story ? { right: '-26em', top: '6em', width: '100em', height: '133em' } : { right: '-30em', top: '-6em', width: '90em', height: '120em' }} />

        {/* potpis */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/signature.webp?v=2"
          alt="Dino Merlin"
          style={{
            position: 'absolute',
            zIndex: 4,
            height: story ? '7.5em' : '6.5em',
            width: 'auto',
            top: story ? '15em' : '7em',
            ...(story ? { left: '50%', transform: 'translateX(-50%)' } : { left: '7em' }),
          }}
        />

        {/* natpis koraka */}
        <div
          style={{
            position: 'absolute',
            zIndex: 4,
            ...(story
              ? { left: '6em', right: '6em', top: '28em', textAlign: 'center' as const }
              : { left: '7em', width: '39em', top: '42em', textAlign: 'left' as const }),
          }}
        >
          <AnimatePresence mode="wait">
            {c && (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: '1.2em' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '-0.8em' }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <p
                  style={{
                    fontSize: story ? '2.3em' : '1.7em',
                    fontWeight: 500,
                    letterSpacing: story ? '0.38em' : '0.3em',
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase',
                    color: BRAND.gold,
                  }}
                >
                  {c.eyebrow}
                </p>
                <Title size={story ? '8.6em' : '6.1em'}>
                  {c.a}
                  <br />
                  <span style={{ fontStyle: 'italic', color: '#E9D9B6' }}>{c.b}</span>
                </Title>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* telefon s pravom aplikacijom */}
        <motion.div
          style={{
            position: 'absolute',
            zIndex: 3,
            ...(story ? { left: '8em', right: '8em', top: '58em', height: '86em' } : { right: '3em', width: '50em', top: '7em', height: '108em' }),
          }}
        >
          <LivePhone
            kind="iphone"
            src="/"
            frameRef={frameRef}
            onLoad={() => {}}
            sim={sim}
            simKey={simKey}
            onSim={(a) => {
              setSim(null)
              if (a === 'open') opened.current?.()
            }}
            verse={verse}
            tap={tap}
            date={date}
            host={host}
          />
        </motion.div>

        {/* kraj: link i znak */}
        <div
          style={{
            position: 'absolute',
            zIndex: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: story ? 'center' : 'flex-start',
            gap: '3em',
            ...(story ? { left: 0, right: 0, bottom: '17em' } : { left: '7em', bottom: '7em' }),
          }}
        >
          <MagazaMark height={story ? 3.25 : 2.8} color="rgba(255,255,255,0.85)" />
        </div>
      </Sheet>

      {!rec && (
        <button
          type="button"
          onClick={() => void play()}
          className="fixed bottom-4 right-4 z-10 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-[12px] text-white/80 backdrop-blur hover:text-white"
        >
          Ponovi
        </button>
      )}
    </div>
  )
}

function Title({ size, children }: { size: string; children: ReactNode }) {
  return (
    <h1
      style={{
        marginTop: '0.25em',
        fontFamily: 'var(--font-serif), serif',
        fontVariationSettings: "'opsz' 144, 'SOFT' 30, 'WONK' 0",
        fontWeight: 360,
        fontSize: size,
        lineHeight: 0.98,
        letterSpacing: '-0.03em',
        color: '#FBF6EC',
      }}
    >
      {children}
    </h1>
  )
}
