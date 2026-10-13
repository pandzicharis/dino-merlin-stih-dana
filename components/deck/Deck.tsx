'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FIGURE_SRC } from '@/data/moods'
import type { Verse } from '@/data/verses'
import { MoodBackground } from '../MoodBackground'
import { MagazaLogo } from '../MagazaLogo'
import { DeckContext } from './context'
import { LiveDesktop, LivePhone } from './Stages'
import { DemoToggle, OsToggle } from './ui'
import { PaperToPhone } from './PaperToPhone'
import { SLIDES, cleanSlate } from './slides'
import { deviceOuter, type DeviceKind } from './Devices'
import type { DeckApi, DeckData, FeatureDef, Section, Simulation, SlideDef } from './types'

/* ── gdje smo: adresa (#stih/atmosfera) je jedini izvor istine ───── */

/**
 * Zaustavljanje = slajd, ili jedna funkcionalnost na slajdu koji ih ima.
 * Strelica naprijed ide kroz zaustavljanja, pa tako prvo otvara funkcije
 * jednu po jednu, a tek onda prelazi na sljedeći slajd — kao "build" u
 * Keynoteu. Nazad sa slajda vodi na zadnju funkciju prethodnog.
 */
type Stop = { slide: number; step: number; id: string }

const STOPS: Stop[] = SLIDES.flatMap((s, i) =>
  s.features
    ? [
        // uvodno zaustavljanje: slajd s zatvorenim koracima (step -1)
        ...(s.intro ? [{ slide: i, step: -1, id: s.id }] : []),
        ...s.features.map((f, k) => ({ slide: i, step: k, id: `${s.id}/${f.id}` })),
      ]
    : [{ slide: i, step: 0, id: s.id }],
)

function subscribeHash(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const hashSnapshot = () => decodeURIComponent(window.location.hash.slice(1))

function stopOf(hash: string): number {
  if (!hash) return 0
  const exact = STOPS.findIndex((s) => s.id === hash)
  if (exact >= 0) return exact
  // samo slajd (#stih) → njegovo prvo zaustavljanje
  const slide = SLIDES.findIndex((s) => s.id === hash.split('/')[0])
  if (slide >= 0) return STOPS.findIndex((s) => s.slide === slide)
  const n = Number(hash)
  return Number.isInteger(n) && n >= 1 && n <= SLIDES.length ? STOPS.findIndex((s) => s.slide === n - 1) : 0
}

/** Bez novog unosa u historiju — strelica nazad u pregledniku ne vrti slajdove. */
function showStop(i: number) {
  const s = STOPS[Math.max(0, Math.min(STOPS.length - 1, i))]
  if (hashSnapshot() === s.id) return
  window.history.replaceState(null, '', `#${s.id}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

const firstStop = (slide: number) => STOPS.findIndex((s) => s.slide === slide)

type Target = { enter?: SlideDef['enter'] }
const enterOf = (t: Target | undefined, d: DeckData, frame: DeviceKind = 'iphone') =>
  typeof t?.enter === 'function' ? t.enter(d, frame) : t?.enter

/** Ono što zaustavljanje traži od uređaja: slajd bez funkcija, ili njegova funkcija. */
function targetOf(stop: Stop): {
  slide: SlideDef
  feature?: FeatureDef
  enter: Target | undefined
} {
  const slide = SLIDES[stop.slide]
  const feature = slide.features?.[stop.step]
  // funkcija bez svoje adrese nasljeđuje adresu slajda
  return { slide, feature, enter: feature?.enter ? feature : slide }
}

/** Adresa telefona: zadnja zadana do ovog zaustavljanja. */
function phoneTarget(i: number, d: DeckData, frame?: DeviceKind): string {
  for (let j = i; j >= 0; j--) {
    const { slide, enter } = targetOf(STOPS[j])
    const src = enterOf(enter, d, frame)
    if (slide.mode === 'phone' && src) return src
  }
  return '/'
}

function where(frame: HTMLIFrameElement | null): string | null {
  try {
    const l = frame?.contentWindow?.location
    return l && l.href !== 'about:blank' ? l.pathname + l.search : null
  } catch {
    return null
  }
}

/** Polje za kucanje — tu strelice pripadaju tekstu, ne slajdovima. */
function typing(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))
}

const PORTFOLIO = 'https://harispandzic.dev'

const SECTIONS: Section[] = ['Uvod', 'Aplikacija', 'Plan za launch', 'Pitanja']

export function Deck({ data }: { data: DeckData }) {
  const pos = stopOf(useSyncExternalStore(subscribeHash, hashSnapshot, () => ''))
  const stop = STOPS[pos]
  const index = stop.slide
  const { slide, feature, enter } = targetOf(stop)
  const mode = slide.mode ?? 'none'

  const [overview, setOverview] = useState(false)
  const go = useCallback((i: number) => {
    setOverview(false)
    showStop(i)
  }, [])
  const goSlide = useCallback((i: number) => go(firstStop(Math.max(0, Math.min(SLIDES.length - 1, i)))), [go])
  const setStep = useCallback(
    (k: number) => go(firstStop(index) + (SLIDES[index].intro ? 1 : 0) + k),
    [go, index],
  )

  /* ── živi uređaji ─────────────────────────────────────────── */

  // iPhone / Android je JEDAN izbor za cijelu prezentaciju — prekidač ispod
  // telefona. Okvir, režirane scene i sama aplikacija (data-os) ga prate.
  const script = feature?.script
  const [os, pickOs] = useState<'ios' | 'android'>('ios')
  const [manual, setManual] = useState(false)
  // prezentacija uvijek kreće od čistog stanja aplikacije — u prvom renderu,
  // prije efekata koraka (koji možda nešto sačuvaju, npr. "Obavijest")
  useState(() => {
    if (typeof window !== 'undefined') cleanSlate()
  })
  // svaki korak kreće od iPhonea; Android dolazi u koraku (sam ili na prekidač)
  useEffect(() => {
    pickOs('ios')
  }, [stop.id])
  const osRef = useRef(os)

  const phoneRef = useRef<HTMLIFrameElement>(null)
  const phone = useCallback(() => phoneRef.current, [])
  const desk = useCallback(() => deskRef.current, [])
  // koraci koji sami nešto pritisnu u aplikaciji nacrtaju dodir iznad dugmeta
  const [tap, setTap] = useState<{ x: number; y: number; n: number } | null>(null)
  const tapTimer = useRef(0)
  const tapAt = useCallback((x: number, y: number) => {
    setTap({ x, y, n: Date.now() })
    clearTimeout(tapTimer.current)
    tapTimer.current = window.setTimeout(() => setTap(null), 700)
  }, [])
  const deskRef = useRef<HTMLIFrameElement>(null)
  const siteRef = useRef<HTMLIFrameElement>(null)
  // početna adresa se zamrzne: kasnije se iframe vodi imperativno, da React
  // ne bi ponovo učitao aplikaciju kad god se nešto promijeni
  const [phoneStart] = useState(() => phoneTarget(pos, data))
  const [phoneSrc, setPhoneSrc] = useState(phoneStart)
  const [deskSrc, setDeskSrc] = useState('/admin')
  const frame: DeviceKind = os === 'android' ? 'galaxy' : 'iphone'
  const [sim, setSim] = useState<{ kind: Simulation; stop: string; n: number } | null>(null)
  const activeSim = sim && sim.stop === stop.id ? sim.kind : null

  const navigate = useCallback((ref: React.RefObject<HTMLIFrameElement | null>, src: string) => {
    const w = ref.current?.contentWindow
    if (!w) return
    try {
      // replace: navigacija u okviru ne pravi unos u historiji preglednika
      w.location.replace(src)
    } catch {
      ref.current!.src = src
    }
  }, [])

  const openPhone = useCallback(
    (src: string, kind?: DeviceKind) => {
      if (kind) pickOs(kind === 'galaxy' ? 'android' : 'ios')
      setSim(null)
      setPhoneSrc(src)
      navigate(phoneRef, src)
    },
    [navigate],
  )

  const reloadPhone = useCallback(() => {
    setSim(null)
    phoneRef.current?.contentWindow?.location.reload()
  }, [])

  const openDesktop = useCallback(
    (src: string) => {
      setDeskSrc(src)
      navigate(deskRef, src)
    },
    [navigate],
  )

  const phoneScript = script ? { kind: script, expect: enterOf(enter, data, frame) ?? '/' } : null

  // Režirana scena (instalacija, dozvola): kad iPhone završi, sama krene na
  // Androidu — prekidač se pomjeri s njom. Izbor sistema se dalje ne dira.
  const onScriptDone = useCallback(() => {
    if (osRef.current === 'ios') pickOs('android')
  }, [])

  // aplikacija u telefonu crta svoje modale i fontove po sistemu (globals.css);
  // sessionStorage nosi izbor i kroz ponovno učitavanje okvira
  const syncOs = useCallback(() => {
    try {
      sessionStorage.setItem('stihdana:os', osRef.current)
      const html = phoneRef.current?.contentDocument?.documentElement
      if (html) html.dataset.os = osRef.current
    } catch {
      /* tuđa adresa */
    }
  }, [])
  useEffect(() => {
    osRef.current = os
    syncOs()
  }, [os, syncOs])

  // Stabilna funkcija, vezana za trenutni korak kroz ref: korak koji se upravo
  // gasi (izlazna animacija) inače bi na promjenu koraka ponovo pokrenuo svoju
  // scenu — i ona bi završila na novom koraku (zaključan ekran, chat).
  // (ref se postavlja u renderu, ne u efektu: efekti novog koraka se izvrše
  // prije efekata Decka i odmah zovu simulate)
  const stopRef = useRef(stop.id)
  // eslint-disable-next-line react-hooks/refs
  stopRef.current = stop.id
  const simulate = useCallback((kind: Simulation) => {
    setSim({ kind, stop: stopRef.current, n: Date.now() })
    navigator.vibrate?.(8)
  }, [])

  // Ulazak na zaustavljanje postavi uređaj tamo gdje ono traži — ali samo ako
  // već nije tamo, da se ono što je prezenter otvorio ne izgubi bez razloga.
  useEffect(() => {
    const src = enterOf(enter, data, frame)
    if (mode === 'phone') {
      const at = where(phoneRef.current)
      // Bez svoje adrese telefon se ne dira — osim ako je ostao na uvodnoj
      // kapiji (npr. skok kroz pregled): tad ide na zadnju zadanu adresu.
      const target = src ?? (at?.includes('uvod=') ? phoneTarget(pos, data, frame) : null)
      if (target && at !== target) navigate(phoneRef, target)
    }
    if (mode === 'desktop' && src && where(deskRef.current) !== src) navigate(deskRef, src)
  }, [enter, mode, pos, data, frame, navigate])

  // Slajd sa stihom van kataloga: telefon je na /pregled i odmah pokazuje taj
  // stih; svaki papirić koji uleti (PaperToPhone) donese sljedeći.
  // /pregled javi kad je spreman, pa redoslijed učitavanja nije bitan.
  const preview = slide.preview
  const landed = useRef<Verse | null>(null)
  const sendPreview = useCallback(() => {
    if (!landed.current) return
    phoneRef.current?.contentWindow?.postMessage(
      { type: 'stihdana:preview', verse: landed.current, date: data.today },
      window.location.origin,
    )
  }, [data.today])

  useEffect(() => {
    if (!preview) return
    // telefon odmah pokazuje stih sa slajda; papirići ga zatim mijenjaju —
    // a jednom promijenjen se više ne vraća na prvi (bez skoka unazad)
    landed.current ??= preview
    if (where(phoneRef.current) === '/pregled') sendPreview()
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== phoneRef.current?.contentWindow) return
      if (e.data?.type === 'stihdana:preview-ready') sendPreview()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [preview, sendPreview])

  const onLand = useCallback(
    (v: Verse) => {
      landed.current = v
      sendPreview()
    },
    [sendPreview],
  )
  // stih sa slajda je već na telefonu — papirići nose ostale, on dolazi zadnji
  const paperVerses = useMemo(
    () => (preview ? [...data.verses.filter((v) => v.id !== preview.id), preview] : []),
    [preview, data.verses],
  )

  // Strelice rade i kad je fokus u aplikaciji: okvir je na istoj adresi, pa
  // mu se tastatura može slušati direktno.
  const keysRef = useRef<(e: KeyboardEvent, inFrame: boolean) => void>(() => {})
  const listen = useCallback((ref: React.RefObject<HTMLIFrameElement | null>) => {
    try {
      const w = ref.current?.contentWindow
      w?.addEventListener('keydown', (e) => keysRef.current(e, true))
    } catch {
      /* tuđa adresa — nema tastature */
    }
  }, [])

  // Prijava u adminu ima autofocus. Okvir računara se učita na početku, pa
  // bi polje za šifru odmah uzelo tastaturu i strelice ne bi radile dok se
  // ne klikne. Fokus se zato vraća prezentaciji, osim kad je uređaj na ekranu.
  const modeRef = useRef(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  const giveBackFocus = useCallback((ref: React.RefObject<HTMLIFrameElement | null>, own: string, force = false) => {
    if (modeRef.current === own && !force) return
    try {
      ;(ref.current?.contentDocument?.activeElement as HTMLElement | null)?.blur?.()
    } catch {
      /* tuđa adresa */
    }
    if (document.activeElement === ref.current) ref.current?.blur()
    window.focus()
  }, [])

  const onPhoneLoad = useCallback(() => {
    const at = where(phoneRef.current)
    if (at) setPhoneSrc(at)
    syncOs()
    listen(phoneRef)
    // Uvijek, i kad je telefon na ekranu: novi dokument u okviru ne smije
    // zadržati tastaturu — strelica bi otišla u stranicu koja se još učitava
    // i izgubila se, pa bi se moralo pritisnuti više puta. Dodir i klik u
    // telefonu rade i bez fokusa.
    giveBackFocus(phoneRef, 'phone', true)
  }, [listen, giveBackFocus, syncOs])

  const onDeskLoad = useCallback(() => {
    const at = where(deskRef.current)
    if (at) setDeskSrc(at)
    listen(deskRef)
    giveBackFocus(deskRef, 'desktop', true)
    // autofocus zna stići tik nakon `load`
    setTimeout(() => giveBackFocus(deskRef, 'desktop', true), 300)
  }, [listen, giveBackFocus])

  // Okvir iz HTML-a sa servera zna se učitati PRIJE hidratacije — tad React
  // nikad ne javi `load`, pa se ono što radi na učitavanju uradi ovdje.
  useEffect(() => {
    const loaded = (f: HTMLIFrameElement | null) => {
      try {
        const doc = f?.contentDocument
        return Boolean(doc && doc.readyState === 'complete' && doc.location.href !== 'about:blank')
      } catch {
        return false
      }
    }
    if (loaded(phoneRef.current)) onPhoneLoad()
    if (loaded(deskRef.current)) onDeskLoad()
    // samo jednom, na montaži
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sa slajda s uređajem dalje: fokus ostavljen u aplikaciji (npr. u polju za
  // šifru) bi pojeo strelice.
  useEffect(() => {
    giveBackFocus(phoneRef, 'phone')
    giveBackFocus(deskRef, 'desktop')
    giveBackFocus(siteRef, 'site')
  }, [mode, giveBackFocus])

  /* ── tastatura ────────────────────────────────────────────── */

  // Portfolio (slajd 2) je tuđa adresa: kad ga se dodirne, uzme tastaturu i
  // strelice mu se ne mogu slušati — prezentacija stane. Klik u njemu i dalje
  // radi, a skrol ne treba fokus, pa se tastatura odmah vraća prezentaciji.
  useEffect(() => {
    const onBlur = () =>
      setTimeout(() => {
        const el = document.activeElement
        if (!(el instanceof HTMLIFrameElement)) return
        try {
          if (el.contentDocument) return // naša adresa — tastatura se sluša direktno
        } catch {
          /* tuđa adresa */
        }
        el.blur()
        window.focus()
      }, 0)
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [])


  useEffect(() => {
    keysRef.current = (e, inFrame) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
      const k = e.key
      // u aplikaciji samo strelice lijevo-desno i daljinski — ostalo pripada njoj
      if (inFrame && !['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp'].includes(k)) return
      const onControl = (e.target as HTMLElement | null)?.closest?.('button, a')
      if (k === 'ArrowRight' || k === 'PageDown' || k === 'ArrowDown' || (k === ' ' && !onControl)) {
        e.preventDefault()
        go(pos + 1)
      } else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp') {
        e.preventDefault()
        go(pos - 1)
      } else if (k === 'Home') go(0)
      else if (k === 'End') go(STOPS.length - 1)
      else if (k === 'o' || k === 'g') setOverview((v) => !v)
      else if (k === 'Escape') setOverview(false)
      else if (k === 'f') toggleFullscreen()
      else if (k === 'r' && mode === 'phone') reloadPhone()
    }
  }, [go, pos, mode, reloadPhone])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keysRef.current(e, false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const api = useMemo<DeckApi>(
    () => ({
      data,
      index,
      step: stop.step,
      setStep,
      phoneSrc,
      frame,
      openPhone,
      reloadPhone,
      openDesktop,
      simulate,
      os,
      setOs: pickOs,
      manual,
      setManual,
      phone,
      desk,
      tapAt,
    }),
    [data, index, stop.step, setStep, phoneSrc, frame, openPhone, reloadPhone, openDesktop, simulate, os, pickOs, manual],
  )

  // isti, današnji stih svuda: zaključan ekran, obavijest, WhatsApp
  const heroVerse = data.todayVerse

  return (
    <DeckContext.Provider value={api}>
      <div className="dk">
        <Backdrop slide={slide} />

        <AnimatePresence mode="wait">
          <motion.section
            key={slide.id}
            className="dk-slide"
            data-mode={mode}
            data-features={slide.features && !slide.center ? '' : undefined}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              y: -6,
              transition: { duration: 0.12, ease: 'easeIn' },
            }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            aria-roledescription="slajd"
            aria-label={`${index + 1} od ${SLIDES.length}: ${slide.title}`}
          >
            {slide.body(data)}
          </motion.section>
        </AnimatePresence>

        {/* uređaji su učitani od početka i nikad se ne skidaju — aplikacija
            pamti šta je urađeno od slajda do slajda */}
        <div className="dk-dock" data-mode={mode} aria-hidden={mode === 'none'}>
          {/* portfolio nema traku "Uživo" ispod — okvir ide do dna */}
          <div className="absolute inset-0">
            <div
              className="absolute inset-0 transition-opacity duration-500"
              style={{
                opacity: mode === 'phone' ? 1 : 0,
                pointerEvents: mode === 'phone' ? 'auto' : 'none',
              }}
              inert={mode !== 'phone'}
            >
              <div className="absolute inset-0" style={{ containerType: 'size' }}>
              <div className="absolute inset-x-0 top-0 bottom-[3.6em]">
              <LivePhone
                kind={frame}
                src={phoneStart}
                frameRef={phoneRef}
                onLoad={onPhoneLoad}
                sim={activeSim}
                simKey={sim?.n}
                verse={heroVerse}
                script={phoneScript}
                onScriptDone={onScriptDone}
                manual={manual}
                tap={tap}
                date={data.today}
                host={data.host}
                onSim={(a) => {
                  setSim(null)
                  // dodir na obavijest otvara aplikaciju, na ponudu — novu verziju
                  if (a === 'open') {
                    if (where(phoneRef.current) === '/') reloadPhone()
                    else openPhone('/')
                  }
                  // dodir na karticu linka u chatu otvara stih s linka
                  if (a === 'link') openPhone(`/stih/${heroVerse.id}`)
                }}
              />
              </div>
              {/* samo slajdovi s demom; ostali drže isto mjesto, da telefon ne skače */}
              <div
                className="absolute inset-x-0 bottom-0 flex justify-center transition-opacity duration-300"
                style={{ opacity: slide.features ? 1 : 0, pointerEvents: slide.features ? 'auto' : 'none' }}
              >
                <div
                  style={{
                    width: `min(100cqw, calc((100cqh - 3.6em) * ${(deviceOuter(frame).w / deviceOuter(frame).h).toFixed(4)}))`,
                  }}
                >
                  <OsToggle />
                </div>
              </div>
              </div>
            </div>
            <div
              className="absolute inset-0 transition-opacity duration-500"
              style={{
                opacity: mode === 'desktop' ? 1 : 0,
                pointerEvents: mode === 'desktop' ? 'auto' : 'none',
              }}
              inert={mode !== 'desktop'}
            >
              <LiveDesktop src="/admin" host={data.host} path={deskSrc} frameRef={deskRef} onLoad={onDeskLoad} />
            </div>
            {/* portfolio sa slajda "O meni" — učitava se od prvog slajda, pa je
                na drugom već prošao svoj uvod */}
            <div
              className="absolute inset-0 transition-opacity duration-500"
              style={{
                opacity: mode === 'site' ? 1 : 0,
                pointerEvents: mode === 'site' ? 'auto' : 'none',
              }}
              inert={mode !== 'site'}
            >
              <LiveDesktop
                src={PORTFOLIO}
                host="harispandzic.dev"
                path=""
                frameRef={siteRef}
                onLoad={() => giveBackFocus(siteRef, 'site')}
              />
            </div>
          </div>
        </div>

        {preview && <PaperToPhone key={slide.id} verses={paperVerses} target={phoneRef} onLand={onLand} />}

        {/* autor — tihi potpis gore lijevo, iznad naslova slajda */}
        <a
          href={PORTFOLIO}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-[clamp(14px,2.4vh,30px)] left-[var(--pad-x)] z-20 flex items-center gap-2.5 transition-opacity duration-500 hover:opacity-100"
          style={{
            opacity: ['uvod', 'o-meni', 'pitanja'].includes(slide.id) ? 0 : 0.6,
            pointerEvents: ['uvod', 'o-meni', 'pitanja'].includes(slide.id) ? 'none' : 'auto',
          }}
          aria-label="harispandzic.dev"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/haris-logo.png" alt="" className="h-[clamp(16px,2.2vh,22px)] w-auto rounded-[22%]" />
          <span className="text-[clamp(10px,0.7vw,12px)] tracking-[0.14em] text-white/80">harispandzic.dev</span>
        </a>

        <Bar
          index={index}
          onGo={goSlide}
          onPrev={() => go(pos - 1)}
          onNext={() => go(pos + 1)}
          atStart={pos === 0}
          atEnd={pos === STOPS.length - 1}
          onOverview={() => setOverview((v) => !v)}
        />

        <AnimatePresence>
          {overview && <Overview index={index} onGo={goSlide} onClose={() => setOverview(false)} />}
        </AnimatePresence>
      </div>
    </DeckContext.Provider>
  )
}

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen()
  else void document.documentElement.requestFullscreen?.().catch(() => {})
}

/* ── pozadina ───────────────────────────────────────────────── */

/**
 * Mirna podloga sporednih ekrana aplikacije (PageShell), a na naslovnom i
 * završnom slajdu prava, živa atmosfera stiha.
 */
function Backdrop({ slide }: { slide: SlideDef }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[#0b0b0c]" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(90% 55% at 50% -10%, rgba(255,255,255,0.07) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(60% 50% at 75% 60%, rgba(191,168,127,0.06) 0%, transparent 70%)',
          }}
        />
        {/* portret stoji TAČNO gdje i u MoodBackground (ista veličina, pozicija
            i maska) — pri prelazu na naslovni i zadnji slajd lice ne skoči */}
        <div
          className="absolute inset-0 bg-no-repeat grayscale"
          style={{
            backgroundImage: `url(${FIGURE_SRC})`,
            backgroundSize: 'auto 118%',
            backgroundPosition: 'calc(70vw - 40dvh) -2dvh',
            mixBlendMode: 'screen',
            opacity: 0.08,
            maskImage: 'radial-gradient(ellipse 80% 62% at 78% 22%, black 30%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 62% at 78% 22%, black 30%, transparent 80%)',
          }}
        />
      </div>
      <AnimatePresence>
        {slide.backdrop && (
          <motion.div
            key={slide.backdrop}
            className="pointer-events-none absolute inset-0 -z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            {/* `still`: portret ne diše i ne prati miš — na projektoru mora stajati */}
            <MoodBackground mood={slide.backdrop} seed="prezentacija" still />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ── donja traka prezentacije ───────────────────────────────── */

function Bar({
  index,
  onGo,
  onPrev,
  onNext,
  atStart,
  atEnd,
  onOverview,
}: {
  index: number
  onGo: (i: number) => void
  onPrev: () => void
  onNext: () => void
  atStart: boolean
  atEnd: boolean
  onOverview: () => void
}) {
  const slide = SLIDES[index]
  // naslovna već nosi oba znaka, krupno — traka ih ne ponavlja
  const bare = index === 0
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-4 px-[var(--pad-x)]"
      style={{ height: 'var(--bar)' }}
    >
      {/* Potpis pa Magaza — na svakom slajdu. Potpis je rukopis pa mu
          treba više visine da bi imao istu težinu kao slova Magaze. */}
      <div
        className="flex min-w-0 items-center gap-3.5 transition-opacity duration-500"
        style={{ opacity: bare ? 0 : 1 }}
        aria-hidden={bare}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/signature.webp" alt="Dino Merlin" className="h-[30px] w-auto opacity-90" />
        <span className="h-5 w-px bg-white/20" />
        <MagazaLogo height={20} color="rgba(255,255,255,0.88)" />
        <span className="hidden h-4 w-px bg-white/15 sm:block" />
        <span className="hidden truncate text-[10px] font-medium uppercase tracking-[0.26em] text-white/40 sm:block">
          {slide.section}
        </span>
      </div>

      {/* napredak: sekcije su grupe tačaka */}
      <div className="mx-auto hidden items-center gap-3 md:flex" role="tablist" aria-label="Slajdovi">
        {SECTIONS.map((sec) => (
          <div key={sec} className="flex items-center gap-[5px]">
            {SLIDES.map((s, i) =>
              s.section !== sec ? null : (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`${i + 1}. ${s.title}`}
                  title={`${i + 1}. ${s.title}`}
                  onClick={() => onGo(i)}
                  className="group flex h-6 items-center"
                >
                  <span
                    className="block h-[3px] rounded-full transition-all duration-500"
                    style={{
                      width: i === index ? 26 : 10,
                      background:
                        i === index ? '#BFA87F' : i < index ? 'rgba(191,168,127,0.45)' : 'rgba(255,255,255,0.16)',
                    }}
                  />
                </button>
              ),
            )}
          </div>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2 md:ml-0">
        {/* demo na telefonu: sam, ili ga prezenter klikće — važi za sve korake */}
        <DemoToggle small />
        <span className="tabular mx-2 text-[12px] text-white/40">
          <span className="text-white/80">{String(index + 1).padStart(2, '0')}</span> / {SLIDES.length}
        </span>
        <BarButton label="Nazad (←)" onClick={onPrev} disabled={atStart}>
          <path d="m14.5 18-6-6 6-6" />
        </BarButton>
        <BarButton label="Naprijed (→)" onClick={onNext} disabled={atEnd}>
          <path d="m9.5 6 6 6-6 6" />
        </BarButton>
        <BarButton label="Svi slajdovi (O)" onClick={onOverview}>
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
        </BarButton>
        <BarButton label="Preko cijelog ekrana (F)" onClick={toggleFullscreen}>
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </BarButton>
      </div>
    </div>
  )
}

function BarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/60 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-30"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </button>
  )
}

/* ── pregled svih slajdova ──────────────────────────────────── */

function Overview({ index, onGo, onClose }: { index: number; onGo: (i: number) => void; onClose: () => void }) {
  return (
    <motion.div
      className="absolute inset-0 z-30 overflow-y-auto bg-black/80 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    >
      <div className="mx-auto max-w-6xl px-[var(--pad-x)] py-[6vh]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="dk-eyebrow">Prezentacija</p>
            <p className="dk-h3 mt-1">Svi slajdovi</p>
          </div>
          <p className="dk-small hidden sm:block">
            <span className="dk-kbd">←</span> <span className="dk-kbd">→</span> naprijed / nazad ·{' '}
            <span className="dk-kbd">O</span> pregled · <span className="dk-kbd">F</span> cijeli ekran ·{' '}
            <span className="dk-kbd">R</span> učitaj aplikaciju
          </p>
        </div>
        {SECTIONS.map((sec) => (
          <div key={sec} className="mb-8">
            <p className="dk-eyebrow mb-3 opacity-80">{sec}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SLIDES.map((s, i) =>
                s.section !== sec ? null : (
                  <motion.button
                    key={s.id}
                    type="button"
                    onClick={() => onGo(i)}
                    whileHover={{ y: -2 }}
                    className="dk-card flex min-h-[92px] flex-col justify-between p-4 text-left transition-colors hover:border-white/20"
                    style={
                      i === index
                        ? {
                            borderColor: 'rgba(191,168,127,0.6)',
                            background: 'rgba(191,168,127,0.08)',
                          }
                        : undefined
                    }
                  >
                    <span className="flex items-center justify-between">
                      <span className="tabular text-[11px] text-white/35">{String(i + 1).padStart(2, '0')}</span>
                      {s.mode && (
                        <span className="text-[9px] uppercase tracking-[0.2em] text-[#8DC9A3]/80">
                          {s.mode === 'phone' ? 'telefon' : s.mode === 'desktop' ? 'računar' : 'sajt'}
                        </span>
                      )}
                    </span>
                    <span
                      className="mt-3 text-[15px] leading-snug text-white/90"
                      style={{ fontFamily: 'var(--font-serif), serif' }}
                    >
                      {s.title}
                    </span>
                    {s.features && (
                      <span className="mt-1.5 text-[11px] leading-snug text-white/40">
                        {s.features.map((f) => f.title).join(' · ')}
                      </span>
                    )}
                  </motion.button>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
