'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react'
import { BRAND } from '@/lib/brand'
import { SEND_TIME } from '@/lib/date'
import { useDeck } from './context'
import { deviceOuter, IPhone, IPHONE, IosStatus } from './Devices'
import { Poster, PosterLandscape, SocialPost, SocialStory } from './Poster'
import { VerseMock } from './Screens'
import { Ico, R } from './ui'
import type { DeckData, FeatureDef } from './types'

/* ═══════════════════════════════════════════════════════════════
   PLAN ZA LAUNCH
   ═══════════════════════════════════════════════════════════════ */

/* ── 1. PWA ili prava mobilna aplikacija ─────────────────────── */

/** Red tabele: šta, PWA, prava aplikacija, i ko je tu bolji. */
const COMPARE: { what: string; pwa: string; native: string; win: 'pwa' | 'native' }[] = [
  {
    what: 'Instalacija',
    pwa: 'QR → „Dodaj na početni ekran“ — par koraka, ljudima novo',
    native: 'Poznato svima: preuzmi iz storea',
    win: 'native',
  },
  { what: 'Spremno', pwa: 'Gotova — radi danas', native: 'Mjeseci razvoja, pa pregled u storeu', win: 'pwa' },
  { what: 'Nova verzija', pwa: 'Stiže odmah, bez storea', native: 'Pregled prije svake verzije', win: 'pwa' },
  { what: 'Obavijesti', pwa: 'iPhone: tek s početnog ekrana', native: 'Pouzdane na svakom telefonu', win: 'native' },
  { what: 'Trošak', pwa: '$0–20 mjesečno, jedan kod', native: '$99 godišnje + dvije platforme', win: 'pwa' },
]

const WIN = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

export function PwaNative() {
  // kolone: šta | PWA (istaknuta) | prava aplikacija
  const cols = 'grid grid-cols-[minmax(6.5em,0.7fr)_minmax(0,1.3fr)_minmax(0,1.3fr)]'
  const cell = (text: string, won: boolean, gold: boolean) => (
    <span className={`flex items-start gap-2 ${won ? 'text-white/90' : 'text-white/45'}`}>
      <span
        className="mt-[0.15em] flex h-[1.15em] w-[1.15em] shrink-0 items-center justify-center rounded-full"
        style={
          won
            ? { background: gold ? BRAND.gold : '#8DC9A3', color: '#14100A' }
            : { boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)' }
        }
      >
        {won && WIN}
      </span>
      <span className="dk-body">{text}</span>
    </span>
  )
  return (
    <div className="grid h-full items-center gap-[4vw] lg:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <R i={0}>
          <p className="dk-eyebrow">Plan za launch</p>
        </R>
        <R i={1}>
          <h2 className="dk-h2 mt-[2.2vh]">
            PWA danas — <em>native kad brojke kažu</em>
          </h2>
        </R>
        <R i={2}>
          <div className="dk-card relative mt-[3.4vh] max-w-[50em] overflow-hidden p-0">
            {/* zlatna kolona PWA-a, cijelom visinom tabele */}
            <div
              className={`${cols} pointer-events-none absolute inset-0`}
              aria-hidden
            >
              <span />
              <span
                className="relative"
                style={{ background: `linear-gradient(180deg, ${BRAND.gold}24, ${BRAND.gold}0a)`, boxShadow: `inset 1px 0 0 ${BRAND.gold}40, inset -1px 0 0 ${BRAND.gold}40` }}
              >
                {/* traka po vrhu kolone — kao istaknuta kolona u cjenovniku */}
                <span
                  className="absolute inset-x-0 top-0 flex h-[clamp(22px,2.9vh,30px)] items-center justify-center text-[clamp(9px,0.62vw,11px)] font-semibold uppercase tracking-[0.22em]"
                  style={{ background: `linear-gradient(90deg, #C9B184, #E2CFA6, #C9B184)`, color: '#14100A' }}
                >
                  Preporuka za početak
                </span>
              </span>
              <span />
            </div>
            <div className={`${cols} relative items-end gap-x-[clamp(12px,1.4vw,24px)] px-[clamp(14px,1.4vw,24px)] pt-[clamp(36px,4.6vh,48px)] pb-3`}>
              <span />
              <span>
                <span className="dk-h3 block" style={{ color: '#F4E5C2' }}>
                  PWA
                </span>
                <span className="dk-small">ova aplikacija, iz preglednika</span>
              </span>
              <span>
                <span className="dk-h3 block text-white/75">Prava aplikacija</span>
                <span className="dk-small">iOS i Android, iz storea</span>
              </span>
            </div>
            {COMPARE.map((r, k) => (
              <motion.div
                key={r.what}
                className={`${cols} relative items-start gap-x-[clamp(12px,1.4vw,24px)] border-t border-white/[0.07] px-[clamp(14px,1.4vw,24px)] py-[clamp(9px,1.35vh,15px)]`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 + k * 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="dk-eyebrow pt-[0.2em] opacity-75">{r.what}</span>
                {cell(r.pwa, r.win === 'pwa', true)}
                {cell(r.native, r.win === 'native', false)}
              </motion.div>
            ))}
          </div>
        </R>
        <R i={4}>
          <div
            className="mt-3 flex max-w-[50em] flex-wrap items-center gap-x-5 gap-y-2 rounded-[clamp(16px,1.4vw,28px)] border px-[clamp(16px,1.6vw,28px)] py-[clamp(12px,1.6vh,20px)]"
            style={{ borderColor: `${BRAND.gold}55`, background: `linear-gradient(90deg, ${BRAND.gold}1f, transparent 70%)` }}
          >
            <span className="dk-eyebrow">Preporuka</span>
            <p className="dk-body min-w-0 flex-1 text-white/80">
              Prava aplikacija se možda lakše instalira — ljudi znaju za store. Ali <b>za početak PWA</b>: gotova je
              danas, besplatna i mijenja se odmah. Kad brojke pokažu da ljudi ostaju, isti stihovi i isti backend dobiju
              native omotač — <b>bez bacanja posla.</b>
            </p>
          </div>
        </R>
      </div>
      <R i={3} className="hidden lg:block">
        <Race />
      </R>
    </div>
  )
}

/**
 * Trka do korisnika: PWA je na početnom ekranu za par sekundi, aplikacija iz
 * storea tek čeka pregled pa preuzimanje. Vrti se u krug.
 */
function Race() {
  const [round, setRound] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setRound((r) => r + 1), 7000)
    return () => clearInterval(t)
  }, [])
  const lane = (label: string, sub: string, steps: [string, number][], gold: boolean) => (
    <div className="dk-card p-[clamp(16px,1.5vw,26px)]" style={gold ? { borderColor: `${BRAND.gold}55` } : undefined}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="dk-h3" style={gold ? { color: '#E9D9B6' } : undefined}>
          {label}
        </p>
        <p className="dk-small">{sub}</p>
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {steps.map(([s, at], k) => (
          <motion.div
            key={`${round}-${s}`}
            className="flex items-center gap-3"
            initial={{ opacity: 0.25 }}
            animate={{ opacity: 1 }}
            transition={{ delay: at, duration: 0.4 }}
          >
            <motion.span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]"
              initial={{ background: 'rgba(255,255,255,0)', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)' }}
              animate={{
                background: gold ? `${BRAND.gold}` : 'rgba(255,255,255,0.12)',
                borderColor: gold ? BRAND.gold : 'rgba(255,255,255,0.3)',
                color: gold ? '#14100A' : '#fff',
              }}
              transition={{ delay: at, duration: 0.3 }}
            >
              {k + 1}
            </motion.span>
            <span className="dk-body text-white/80">{s}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-white/10">
        <motion.div
          key={round}
          className="h-full rounded-full"
          style={{ background: gold ? `linear-gradient(90deg, #8A7148, ${BRAND.gold})` : 'rgba(255,255,255,0.35)' }}
          initial={{ width: '0%' }}
          animate={{ width: gold ? '100%' : '38%' }}
          transition={{ duration: gold ? 2.2 : 6, ease: gold ? [0.22, 1, 0.36, 1] : 'linear' }}
        />
      </div>
    </div>
  )
  return (
    <div className="flex w-[min(30vw,60vh)] flex-col gap-3">
      {lane(
        'PWA',
        'par sekundi',
        [
          ['Skenira QR kod', 0.2],
          ['Dodaj na početni ekran', 0.9],
          ['Stih dana je na telefonu', 1.7],
        ],
        true,
      )}
      {lane(
        'Prava aplikacija',
        'dani',
        [
          ['Pregled u storeu: 1–3 dana', 1.2],
          ['Traži aplikaciju u storeu', 3.2],
          ['Preuzima i instalira', 5.2],
        ],
        false,
      )}
    </div>
  )
}

/* ── 2. Plan: izlog → objava → kapacitet ───────────────────── */

export const LANSIRANJE: FeatureDef[] = [
  { id: 'izlog', title: 'Prvo u izlogu Magaze', body: () => null },
  { id: 'objava', title: 'Pa jedna objava', body: () => null },
  { id: 'kapacitet', title: 'Koliko može podnijeti', body: () => null },
]

const PLAN_TEXT: ReactNode[] = [
  <>
    Nemamo kako testirati na hiljadama ljudi prije launcha — zato prvo <b>plakat ispred Magaze</b>. Ko prođe,
    skenira kod i za par sekundi ima stih na telefonu. Mali, stvaran test: koliko skenira, koliko ostane.
  </>,
  <>
    Kad se pokaže da radi: <b>objava i story</b> na Merlinovom profilu i profilu Magaze — isti plakat, isti stih. Na
    mreži niko ne skenira, zato link u opisu i link naljepnica u storyju.
  </>,
  <>
    Za probu u izlogu dovoljan je <b>besplatni plan — $0</b>. Stranica je gotova na CDN-u, a obavijesti idu u
    porcijama. Kad krene objava i brojke porastu, prelazi se na plaćeni plan — <b>bez promjene koda.</b>
  </>,
]

export function LaunchPlan({ d }: { d: DeckData }) {
  const { step, setStep } = useDeck()
  return (
    <div className="grid h-full items-center gap-[4vw] lg:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <R i={0}>
          <p className="dk-eyebrow">Plan za launch</p>
        </R>
        <R i={1}>
          <h2 className="dk-h2 mt-[2.2vh] max-w-[14em]">
            Od izloga <em>do hiljada ekrana</em>
          </h2>
        </R>
        <ol className="mt-[4vh] flex max-w-[34em] flex-col">
          {LANSIRANJE.map((f, k) => {
            const on = k === step
            return (
              <R key={f.id} i={2 + k}>
                <li className="border-t border-white/[0.08] py-[1.6vh]">
                  <button type="button" onClick={() => setStep(k)} className="flex w-full items-center gap-3.5 text-left">
                    <span
                      className="dk-num shrink-0 transition-colors"
                      style={on ? { background: BRAND.gold, color: '#14100A', borderColor: BRAND.gold } : undefined}
                    >
                      {k + 1}
                    </span>
                    <span className="dk-h3 transition-colors" style={{ color: on ? '#F4EBDB' : 'rgba(255,255,255,0.45)' }}>
                      {f.title}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.div
                        key="t"
                        className="overflow-hidden"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <p className="dk-body pt-2.5 pl-[calc(1.9em+0.875rem)] text-white/70">{PLAN_TEXT[k]}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              </R>
            )
          })}
        </ol>
      </div>
      <div className="hidden lg:block">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {step <= 0 ? <Izlog d={d} /> : step === 1 ? <Objava d={d} /> : <Kapacitet />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * Od izloga do ekrana: A4 plakat u izlogu → telefon skenira kod → stih je na
 * ekranu. Vrti se u krug.
 */
function Izlog({ d }: { d: DeckData }) {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setPhase((p) => (p + 1) % 3), [2400, 2600, 4200][phase])
    return () => clearTimeout(t)
  }, [phase])
  const W = 'min(44vw, 84vh)'
  return (
    <div className="relative" style={{ width: W, height: `calc(${W} * 0.82)` }}>
      {/* izlog: staklo s odsjajem, plakat iza njega */}
      <motion.div
        className="absolute left-0 right-0 top-0 overflow-hidden rounded-[10px] p-[1.2%]"
        style={{
          background: 'linear-gradient(145deg, #2f2d2a, #141312 50%, #262422)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 40px 90px rgba(0,0,0,0.65)',
        }}
        animate={{ opacity: phase === 2 ? 0.35 : 1, filter: phase === 2 ? 'blur(2px)' : 'blur(0px)' }}
        transition={{ duration: 0.8 }}
      >
        <PosterLandscape data={d.poster} width={`calc(${W} * 0.976)`} />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.07) 42%, transparent 55%)' }}
        />
      </motion.div>

      {/* telefon: dolazi, skenira, pa ide naprijed sa stihom */}
      <motion.div
        className="absolute"
        style={{ width: `calc(${W} * 0.24)` }}
        initial={false}
        animate={
          phase === 0
            ? { left: '70%', top: '70%', opacity: 0, rotate: 8, scale: 0.9 }
            : phase === 1
              ? { left: '8%', top: '30%', opacity: 1, rotate: -4, scale: 1 }
              : { left: '38%', top: '6%', opacity: 1, rotate: 0, scale: 1.35 }
        }
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      >
        <IPhone width={`calc(${W} * 0.24)`} time="12:00">
          <AnimatePresence mode="wait">
            {phase < 2 ? (
              <motion.div key="cam" className="absolute inset-0 bg-black" exit={{ opacity: 0 }}>
                {/* kamera: okvir koda i linija skeniranja */}
                <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 45%, #2a2622, #0b0a09 70%)' }} />
                <div className="absolute left-1/2 top-[44%] h-[150em] w-[150em] -translate-x-1/2 -translate-y-1/2">
                  {['left-0 top-0 border-l-[6em] border-t-[6em]', 'right-0 top-0 border-r-[6em] border-t-[6em]', 'left-0 bottom-0 border-l-[6em] border-b-[6em]', 'right-0 bottom-0 border-r-[6em] border-b-[6em]'].map((c) => (
                    <span key={c} className={`absolute h-[34em] w-[34em] rounded-[6em] ${c}`} style={{ borderColor: '#F4E5C2' }} />
                  ))}
                  {phase === 1 && (
                    <motion.span
                      className="absolute left-[8%] right-[8%] h-[3em] rounded-full"
                      style={{ background: BRAND.gold, boxShadow: `0 0 20em ${BRAND.gold}` }}
                      initial={{ top: '10%' }}
                      animate={{ top: ['10%', '88%', '10%'] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                </div>
                <p className="absolute bottom-[90em] left-0 right-0 text-center text-[15em] text-white/70">Stih dana</p>
              </motion.div>
            ) : (
              <motion.div key="app" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                <VerseMock verse={d.poster.hero} date={d.poster.date} w={IPHONE.w} h={IPHONE.h} top={70} />
              </motion.div>
            )}
          </AnimatePresence>
        </IPhone>
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4">
        {['Izlog', 'Skeniranje', 'Ekran'].map((l, k) => (
          <span key={l} className="flex items-center gap-4">
            {k > 0 && (
              <span className="dk-small transition-colors" style={{ color: k <= phase ? `${BRAND.gold}cc` : 'rgba(255,255,255,0.2)' }} aria-hidden>
                →
              </span>
            )}
            <span className="dk-small uppercase tracking-[0.22em] transition-colors" style={{ color: k === phase ? BRAND.gold : 'rgba(255,255,255,0.3)' }}>
              {l}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

const HEART_D = 'M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z'

/** Plava značka verifikovanog profila. */
function Verified({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: `${size}em`, height: `${size}em`, flexShrink: 0 }} aria-hidden>
      <path
        d="M12 1.5l2.4 1.9 3-.3 1 2.9 2.6 1.6-.6 3 1.3 2.7-2.2 2.1-.2 3-3 .6-1.7 2.5-2.9-.9-2.9.9-1.7-2.5-3-.6-.2-3L1.6 13l1.3-2.7-.6-3 2.6-1.6 1-2.9 3 .3z"
        fill="#3897F0"
      />
      <path d="M7.8 12.3l2.8 2.8 5.6-5.8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const IG_FONT = '-apple-system, "SF Pro Text", "Helvetica Neue", var(--font-sans), sans-serif'
const IG_RING = 'conic-gradient(from 200deg, #FEDA75, #FA7E1E, #D62976, #962FBF, #4F5BD5, #FEDA75)'
const IG_BG = '#0C1014'
const IG_TEXT = '#F5F5F5'
const IG_GREY = '#A8A8A8'
const IG_LINK = '#E0F1FF'
/** profilna slika Dine — isječak s njegovog profila */
const DINO_AVATAR = '/ig/dinomerlin.webp'

function IgIcon({ children, size = 24, fill = 'none' }: { children: ReactNode; size?: number; fill?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill={fill} stroke={IG_TEXT} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: `${size}em`, height: `${size}em`, flexShrink: 0 }}>
      {children}
    </svg>
  )
}

/** Magazin avatar: crni krug s logom, kao na njihovom profilu. */
function MagazaAvatar({ size }: { size: number }) {
  return (
    <span className="flex items-center justify-center rounded-full bg-black" style={{ width: `${size}em`, height: `${size}em` }}>
      <span
        role="img"
        aria-label="Magaza"
        className="block"
        style={{
          width: '72%',
          aspectRatio: '316 / 87',
          background: '#EDEDED',
          mask: 'url(/brand/magaza.svg) center / contain no-repeat',
          WebkitMask: 'url(/brand/magaza.svg) center / contain no-repeat',
        }}
      />
    </span>
  )
}

/** Avatar s prstenom priče (ili bez). */
function IgAvatar({ src, size, ring = true, magaza = false }: { src?: string; size: number; ring?: boolean; magaza?: boolean }) {
  const inner = size * 0.86
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: `${size}em`, height: `${size}em`, background: ring ? IG_RING : 'transparent' }}
    >
      <span className="flex items-center justify-center rounded-full" style={{ width: `${size * 0.93}em`, height: `${size * 0.93}em`, background: IG_BG }}>
        {magaza ? (
          <MagazaAvatar size={inner} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="rounded-full object-cover" style={{ width: `${inner}em`, height: `${inner}em` }} />
        )}
      </span>
    </span>
  )
}

/**
 * Instagram na telefonu, tamna tema — po pravim profilima @dinomerlin i
 * @magaza: zajednička objava na naslovnoj (srce, oznake rastu), pa story s
 * naljepnicom za link, pa Merlinov profil s novom objavom prvom u mreži.
 * Ide u krug, polako.
 */
const IG_VIEWS = [
  { id: 'feed', label: 'Objava', ms: 11000 },
  { id: 'story', label: 'Story', ms: 9500 },
  { id: 'profil', label: 'Profil', ms: 8500 },
] as const

function Objava({ d }: { d: DeckData }) {
  const [at, setAt] = useState(0)
  const [cycle, setCycle] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => {
      if (at === IG_VIEWS.length - 1) setCycle((c) => c + 1)
      setAt((a) => (a + 1) % IG_VIEWS.length)
    }, IG_VIEWS[at].ms)
    return () => clearTimeout(t)
  }, [at])
  const view = IG_VIEWS[at].id
  // isti telefon kao u doku na ostalim slajdovima: visina doka bez potpisa ispod
  const outer = deviceOuter('iphone')
  const W = `min(var(--dock-phone), calc((101vh - var(--pad-t) - var(--bar) - 4px - 3.6rem) * ${outer.w / outer.h}))`
  return (
    <div className="flex flex-col items-center gap-4">
      <IPhone width={W} time={null}>
        <div className="absolute inset-0 overflow-hidden" style={{ fontFamily: IG_FONT, background: IG_BG, color: IG_TEXT }}>
          <AnimatePresence initial={false}>
            <motion.div
              key={`${view}${cycle}`}
              className="absolute inset-0"
              style={{ background: view === 'story' ? '#000' : IG_BG }}
              initial={view === 'story' ? { opacity: 0, scale: 0.92 } : { opacity: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {view === 'feed' ? <IgFeed d={d} /> : view === 'story' ? <IgStory d={d} /> : <IgProfile d={d} />}
            </motion.div>
          </AnimatePresence>
          <div className="absolute inset-x-0 top-0 z-[6]">
            <IosStatus time="12:00" />
          </div>
        </div>
      </IPhone>
      <div className="flex items-center gap-3">
        {IG_VIEWS.map((v, k) => (
          <span key={v.id} className="flex items-center gap-3">
            {k > 0 && (
              <span className="dk-small" style={{ color: k <= at ? `${BRAND.gold}cc` : 'rgba(255,255,255,0.2)' }} aria-hidden>
                →
              </span>
            )}
            <span className="dk-small uppercase tracking-[0.22em] transition-colors" style={{ color: k === at ? BRAND.gold : 'rgba(255,255,255,0.3)' }}>
              {v.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Donja traka Instagrama (tamna). */
function IgTabBar({ profile = false }: { profile?: boolean }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-[3] flex items-start justify-around border-t border-white/10" style={{ height: '82em', paddingTop: '12em', background: IG_BG }}>
      <IgIcon size={26} fill={profile ? 'none' : IG_TEXT}>
        <path d="M3.5 10.5 12 3.5l8.5 7V20.5h-5.5v-6h-6v6H3.5z" />
      </IgIcon>
      <IgIcon size={26}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20.5 20.5-4.5-4.5" />
      </IgIcon>
      <IgIcon size={26}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <path d="M12 8v8M8 12h8" />
      </IgIcon>
      <IgIcon size={26}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <path d="M3.5 8.5h17M8 3.5l2.5 5M13.5 3.5l2.5 5M10.5 12v5l4-2.5z" />
      </IgIcon>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={DINO_AVATAR} alt="" className="rounded-full object-cover" style={{ width: '27em', height: '27em', border: profile ? `1.8em solid ${IG_TEXT}` : 'none' }} />
      <span className="absolute bottom-[8em] left-1/2 h-[5em] w-[136em] -translate-x-1/2 rounded-full bg-white" />
    </div>
  )
}

/** Naslovna: priče, zajednička objava dinomerlin × magaza, oznake rastu, feed se polako skrola. */
function IgFeed({ d }: { d: DeckData }) {
  const likes = useMotionValue(3120)
  const shown = useTransform(likes, (v) => Math.round(v).toLocaleString('de-DE'))
  const [liked, setLiked] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLiked(true), 1800)
    const c = animate(likes, 48213, { duration: 9, ease: [0.16, 1, 0.3, 1], delay: 1.6 })
    return () => {
      clearTimeout(t)
      c.stop()
    }
  }, [likes])
  const head = 54
  const postTop = head + 44 + 104 + 54
  const imgH = IPHONE.w * 1.25
  return (
    <>
      {/* naslov — feed klizi ispod njega */}
      <div className="absolute inset-x-0 top-0 z-[2]" style={{ height: `${head + 44}em`, background: IG_BG }} />
      <div className="absolute inset-x-0 z-[3] flex items-center justify-between px-[14em]" style={{ top: `${head}em`, height: '44em' }}>
        <span className="flex items-center gap-[4em]">
          <span style={{ fontSize: '29em', fontFamily: '"Snell Roundhand", "Brush Script MT", cursive', fontWeight: 700 }}>Instagram</span>
          <IgIcon size={14}>
            <path d="m6 9 6 6 6-6" />
          </IgIcon>
        </span>
        <span className="flex items-center gap-[20em]">
          <IgIcon>
            <path d={HEART_D} />
          </IgIcon>
          <span className="relative">
            <IgIcon size={25}>
              <path d="M12 3.5a8.5 8.5 0 0 0-7.4 12.7L3.5 20.5l4.4-1.1A8.5 8.5 0 1 0 12 3.5zM8 13.5l2.6-2.8 2 1.6 3.4-3" />
            </IgIcon>
            <span className="absolute -right-[7em] -top-[6em] flex h-[17em] min-w-[17em] items-center justify-center rounded-full bg-[#FF3040] px-[4em]" style={{ border: `2em solid ${IG_BG}` }}>
              <span style={{ fontSize: '10.5em', fontWeight: 700 }}>3</span>
            </span>
          </span>
        </span>
      </div>

      <motion.div
        className="absolute inset-x-0 bottom-0"
        style={{ top: 0 }}
        initial={{ y: 0 }}
        animate={{ y: '-150em' }}
        transition={{ delay: 4.2, duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* priče */}
        <div className="absolute inset-x-0 flex gap-[16em] px-[12em]" style={{ top: `${head + 44}em`, height: '104em' }}>
          {(
            [
              ['Tvoja priča', DINO_AVATAR, false, false],
              ['dinomerlin', DINO_AVATAR, true, false],
              ['magaza', undefined, true, true],
            ] as const
          ).map(([name, img, ring, mag]) => (
            <span key={name} className="flex shrink-0 flex-col items-center" style={{ width: '72em' }}>
              <IgAvatar src={img} size={70} ring={ring} magaza={mag} />
              <span className="mt-[0.435em] w-full truncate text-center" style={{ fontSize: '11.5em', color: name === 'Tvoja priča' ? IG_GREY : IG_TEXT }}>
                {name}
              </span>
            </span>
          ))}
        </div>
        {/* autori: zajednička objava */}
        <div className="absolute inset-x-0 flex items-center gap-[9em] px-[12em]" style={{ top: `${head + 44 + 104}em`, height: '54em' }}>
          <span className="relative shrink-0" style={{ width: '46em', height: '36em' }}>
            <span className="absolute left-0 top-0">
              <IgAvatar src={DINO_AVATAR} size={34} />
            </span>
            <span className="absolute left-[14em] top-[4em] rounded-full" style={{ border: `2em solid ${IG_BG}` }}>
              <MagazaAvatar size={30} />
            </span>
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="flex items-center gap-[4em]">
              <span style={{ fontSize: '13.5em', fontWeight: 600 }}>dinomerlin</span>
              <Verified size={13} />
              <span style={{ fontSize: '13.5em' }}>i</span>
              <span style={{ fontSize: '13.5em', fontWeight: 600 }}>magaza</span>
            </span>
            <span style={{ fontSize: '11.5em', color: IG_TEXT }}>Sarajevo</span>
          </span>
          <span className="ml-auto" style={{ fontSize: '18em', letterSpacing: '0.05em' }}>
            ···
          </span>
        </div>
        {/* objava 4:5 */}
        <div className="absolute inset-x-0 overflow-hidden" style={{ top: `${postTop}em`, height: `${imgH}em` }}>
          <SocialPost data={d.poster} width={`${IPHONE.w}em`} />
          <motion.svg
            viewBox="0 0 24 24"
            className="absolute left-1/2 top-1/2"
            style={{ width: '110em', height: '110em', marginLeft: '-55em', marginTop: '-55em', filter: 'drop-shadow(0 4em 12em rgba(0,0,0,0.35))' }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.25, 0.95, 1, 1.1], opacity: [0, 1, 1, 1, 0] }}
            transition={{ duration: 1.2, times: [0, 0.25, 0.45, 0.75, 1], delay: 1.5 }}
          >
            <path d={HEART_D} fill="#fff" />
          </motion.svg>
        </div>
        {/* akcije, oznake, opis */}
        <div className="absolute inset-x-0 px-[12em]" style={{ top: `${postTop + imgH}em` }}>
          <div className="flex items-center gap-[15em]" style={{ height: '46em' }}>
            <motion.svg
              key={String(liked)}
              viewBox="0 0 24 24"
              style={{ width: '26em', height: '26em' }}
              initial={liked ? { scale: 0.5 } : false}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 12 }}
            >
              <path d={HEART_D} fill={liked ? '#FF3040' : 'none'} stroke={liked ? '#FF3040' : IG_TEXT} strokeWidth="1.9" />
            </motion.svg>
            <IgIcon>
              <path d="M20.5 12a8.5 8.5 0 1 1-3.6-6.9L21 3.5l-1.2 4.4A8.4 8.4 0 0 1 20.5 12z" />
            </IgIcon>
            <IgIcon>
              <path d="M21.5 3 3 10.4l7 2.6 2.6 7.5zM10 13l5.5-5.5" />
            </IgIcon>
            <span className="ml-auto">
              <IgIcon>
                <path d="M6 3.5h12v17.5l-6-4.6-6 4.6z" />
              </IgIcon>
            </span>
          </div>
          <p style={{ fontSize: '13.5em' }}>
            Sviđa se korisniku <b>magaza</b> i <b><motion.span className="tabular">{shown}</motion.span> drugih</b>
          </p>
          {/* razmaci u em teksta — ne u pikselima ekrana */}
          <p className="mt-[0.35em]" style={{ fontSize: '13.5em', lineHeight: 1.38 }}>
            <b>dinomerlin</b> Stih dana — svaki dan u {SEND_TIME}, na vašem telefonu. 🎶 Link je u biografiji.{' '}
            <span style={{ color: IG_LINK }}>@magaza</span>
          </p>
          <p className="mt-[0.35em]" style={{ fontSize: '13.5em', color: IG_GREY }}>
            Prikaži svih 1.284 komentara
          </p>
          <p className="mt-[0.4em]" style={{ fontSize: '11em', color: IG_GREY }}>
            prije 2 sata
          </p>
        </div>
      </motion.div>
      <IgTabBar />
    </>
  )
}

/** Story: preko cijelog ekrana, traka napretka, naljepnica za link koja se dodirne. */
function IgStory({ d }: { d: DeckData }) {
  const [tap, setTap] = useState(false)
  useEffect(() => {
    const a = setTimeout(() => setTap(true), 5200)
    const b = setTimeout(() => setTap(false), 6000)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])
  const top = 52
  const artH = IPHONE.w * (16 / 9)
  return (
    <>
      <div className="absolute inset-x-0 overflow-hidden" style={{ top: `${top}em`, height: `${artH}em`, borderRadius: '12em' }}>
        <SocialStory data={d.poster} width={`${IPHONE.w}em`} />
        <div className="absolute inset-x-0 top-0 h-[90em]" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.45), transparent)' }} />
        {/* naljepnica za link — Instagramova */}
        <motion.span
          className="absolute left-1/2 flex items-center gap-[6em] rounded-[10em] bg-white px-[14em] py-[9em]"
          style={{ top: '62%', x: '-50%', boxShadow: '0 6em 18em rgba(0,0,0,0.35)' }}
          initial={{ scale: 0, rotate: -6 }}
          animate={{ scale: tap ? 0.92 : 1, rotate: -3 }}
          transition={{ type: 'spring', stiffness: 380, damping: 16, delay: tap ? 0 : 1.2 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#3897F0" strokeWidth="2.4" strokeLinecap="round" style={{ width: '17em', height: '17em' }}>
            <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
          </svg>
          <span style={{ fontSize: '14em', fontWeight: 700, color: '#3897F0', letterSpacing: '0.02em' }}>STIH DANA</span>
          {tap && <motion.span className="absolute inset-0 rounded-[10em]" style={{ background: 'rgba(56,151,240,0.25)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />}
        </motion.span>
      </div>
      {/* trake napretka */}
      <div className="absolute inset-x-[8em] flex gap-[3em]" style={{ top: `${top + 8}em` }}>
        {[1, 1, 0, 0].map((done, k) => (
          <span key={k} className="h-[2.5em] flex-1 overflow-hidden rounded-full bg-white/35">
            {done ? (
              <span className="block h-full w-full bg-white" />
            ) : k === 2 ? (
              <motion.span className="block h-full bg-white" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 9, ease: 'linear' }} />
            ) : null}
          </span>
        ))}
      </div>
      {/* autor */}
      <div className="absolute inset-x-[10em] flex items-center gap-[8em]" style={{ top: `${top + 20}em` }}>
        <IgAvatar src={DINO_AVATAR} size={32} ring={false} />
        <span style={{ fontSize: '13.5em', fontWeight: 600 }}>dinomerlin</span>
        <Verified size={13} />
        <span className="text-white/70" style={{ fontSize: '13em' }}>
          2 h
        </span>
        <span className="ml-auto flex items-center gap-[16em]">
          <span style={{ fontSize: '18em' }}>···</span>
          <IgIcon size={22}>
            <path d="M6 6l12 12M18 6 6 18" />
          </IgIcon>
        </span>
      </div>
      {/* odgovor */}
      <div className="absolute inset-x-[10em] flex items-center gap-[14em]" style={{ top: `${top + artH + 12}em` }}>
        <span className="flex h-[44em] flex-1 items-center rounded-full px-[16em] text-white/80" style={{ border: '1.5em solid rgba(255,255,255,0.55)' }}>
          <span style={{ fontSize: '14em' }}>Pošalji poruku</span>
        </span>
        <IgIcon size={26}>
          <path d={HEART_D} />
        </IgIcon>
        <IgIcon size={25}>
          <path d="M21.5 3 3 10.4l7 2.6 2.6 7.5zM10 13l5.5-5.5" />
        </IgIcon>
      </div>
    </>
  )
}

/** Merlinov profil — tačne brojke, a nova objava je prva u mreži. */
function IgProfile({ d }: { d: DeckData }) {
  const head = 54
  const stat = (n: string, l: string) => (
    <span className="flex flex-col leading-tight">
      <span style={{ fontSize: '16em', fontWeight: 700 }}>{n}</span>
      <span style={{ fontSize: '13em' }}>{l}</span>
    </span>
  )
  const highlights: [string, string][] = [
    ['Album „Mi”', '/ig/hl-album-mi.webp'],
    ['Briga', '/ig/hl-briga.webp'],
    ['Skoro će zi…', '/ig/hl-skoro.webp'],
    ['Krive Karte', '/ig/hl-krive-karte.webp'],
    ['Jedan…', '/ig/hl-jedan.webp'],
  ]
  const cell = IPHONE.w / 3
  const grid = ['/albumi/hq/mi.webp', '/albumi/hq/hotel-nacional.webp', '/albumi/hq/sredinom.webp', '/albumi/hq/burek.webp', '/albumi/hq/fotografija.webp']
  const btn = (label: string, wide = true) => (
    <span className={`flex h-[34em] items-center justify-center rounded-[9em] ${wide ? 'flex-1' : ''}`} style={{ background: '#25292E', padding: wide ? 0 : '0 10em' }}>
      <span style={{ fontSize: '13.5em', fontWeight: 600 }}>{label}</span>
    </span>
  )
  return (
    <>
      {/* zaglavlje */}
      <div className="absolute inset-x-0 flex items-center gap-[12em] px-[14em]" style={{ top: `${head}em`, height: '44em' }}>
        <IgIcon size={24}>
          <path d="m15 5-7 7 7 7" />
        </IgIcon>
        <span className="flex items-center gap-[5em]">
          <span style={{ fontSize: '19em', fontWeight: 700 }}>dinomerlin</span>
          <Verified size={16} />
        </span>
        <span className="ml-auto flex items-center gap-[18em]">
          <IgIcon size={23}>
            <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5M13.7 20a2 2 0 0 1-3.4 0" />
          </IgIcon>
          <span style={{ fontSize: '18em', letterSpacing: '0.05em' }}>···</span>
        </span>
      </div>
      {/* avatar i brojke */}
      <div className="absolute inset-x-0 flex items-center gap-[22em] px-[14em]" style={{ top: `${head + 56}em` }}>
        <IgAvatar src={DINO_AVATAR} size={86} ring={false} />
        <span className="flex flex-col gap-[6em]">
          <span style={{ fontSize: '14.5em', fontWeight: 600 }}>Dino Merlin</span>
          <span className="flex gap-[24em]">
            {stat('1.301', 'objava')}
            {stat('334K', 'pratilaca')}
            {stat('83', 'praćenja')}
          </span>
        </span>
      </div>
      {/* opis i dugmad */}
      <div className="absolute inset-x-0 px-[14em]" style={{ top: `${head + 158}em` }}>
        <p style={{ fontSize: '13.5em', fontWeight: 600 }}>🎟️ Informacije &amp; ulaznice ↓</p>
        <p className="mt-[0.3em] flex items-center gap-[0.3em]" style={{ fontSize: '13.5em', fontWeight: 600 }}>
          <span style={{ color: IG_LINK }}>🔗 dinomerlin.com/live i još 2</span>
        </p>
        <div className="mt-[12em] flex gap-[6em]">
          {btn('Pratite')}
          {btn('Poruka')}
          {btn('E-pošta')}
          {btn('+', false)}
        </div>
      </div>
      {/* istaknute priče */}
      <div className="absolute inset-x-0 flex gap-[12em] px-[12em]" style={{ top: `${head + 262}em` }}>
        {highlights.map(([name, src]) => (
          <span key={name} className="flex shrink-0 flex-col items-center" style={{ width: '66em' }}>
            <span className="flex items-center justify-center rounded-full" style={{ width: '64em', height: '64em', border: '1.5em solid #3a3f45' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="rounded-full object-cover" style={{ width: '56em', height: '56em' }} />
            </span>
            <span className="mt-[0.435em] w-full truncate text-center" style={{ fontSize: '11.5em' }}>
              {name}
            </span>
          </span>
        ))}
      </div>
      {/* kartice mreže */}
      <div className="absolute inset-x-0 flex justify-around border-b border-white/10" style={{ top: `${head + 376}em`, height: '42em' }}>
        <span className="flex h-full flex-1 items-center justify-center" style={{ borderBottom: `1.5em solid ${IG_TEXT}` }}>
          <IgIcon size={22}>
            <path d="M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z" />
          </IgIcon>
        </span>
        <span className="flex h-full flex-1 items-center justify-center opacity-60">
          <IgIcon size={22}>
            <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
            <path d="M10.5 9v6l5-3z" />
          </IgIcon>
        </span>
        <span className="flex h-full flex-1 items-center justify-center opacity-60">
          <IgIcon size={22}>
            <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
            <circle cx="12" cy="10" r="3" />
            <path d="M6.5 18.5a6 6 0 0 1 11 0" />
          </IgIcon>
        </span>
      </div>
      {/* mreža: nova objava prva, s tihim sjajem */}
      <div className="absolute inset-x-0 grid grid-cols-3 gap-[1.5em]" style={{ top: `${head + 420}em` }}>
        <motion.div
          className="relative overflow-hidden"
          style={{ height: `${cell * 1.333}em` }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <SocialPost data={d.poster} width={`${cell}em`} />
          <motion.span
            className="absolute inset-0"
            style={{ boxShadow: `inset 0 0 0 2em ${BRAND.gold}` }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ delay: 1.2, duration: 1.6, repeat: 2 }}
          />
        </motion.div>
        {grid.map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt="" className="w-full object-cover" style={{ height: `${cell * 1.333}em` }} />
        ))}
      </div>
      <IgTabBar profile />
    </>
  )
}

/** Brojka koja izraste do svoje vrijednosti. */
function Count({ to, prefix = '', suffix = '', duration = 1.8 }: { to: number; prefix?: string; suffix?: string; duration?: number }) {
  const v = useMotionValue(0)
  const text = useTransform(v, (x) => `${prefix}${Math.round(x).toLocaleString('de-DE')}${suffix}`)
  useEffect(() => {
    const c = animate(v, to, { duration, ease: [0.16, 1, 0.3, 1] })
    return () => c.stop()
  }, [v, to, duration])
  return <motion.span className="tabular">{text}</motion.span>
}

/**
 * Koliko podnese — realno, po planovima hostinga. Besplatno je dovoljno za
 * probu u izlogu; plaćeno tek kad objava dovede hiljade ljudi.
 */
function Kapacitet() {
  const tiers: {
    name: string
    tag: string
    price: string
    rows: [ReactNode, string][]
    note: string
    pick?: boolean
  }[] = [
    {
      name: 'Za početak',
      tag: 'Vercel Hobby · Supabase Free',
      price: '$0',
      rows: [
        [<Count key="a" to={2000} prefix="do " />, 'korisnika dnevno'],
        [<Count key="b" to={3000} prefix="do " />, `obavijesti u ${SEND_TIME}, za par minuta`],
        [<>100 GB</>, 'prenosa mjesečno'],
      ],
      note: 'Dovoljno za izlog i prve sedmice. Vercel ga vodi kao plan za lične projekte — za zvaničan launch Magaze traži Pro.',
      pick: true,
    },
    {
      name: 'Kad brojke porastu',
      tag: 'Vercel Pro · Supabase Pro',
      price: '$20–45 / mj.',
      rows: [
        [<Count key="c" to={50000} prefix="~" />, 'korisnika dnevno'],
        [<Count key="d" to={50000} prefix="~" />, `obavijesti u ${SEND_TIME}, za oko minutu`],
        [<>1 TB</>, 'prenosa mjesečno'],
      ],
      note: 'Isti kod — samo jači plan. Za objavu na Merlinovom profilu.',
    },
  ]
  return (
    <div className="grid w-[min(42vw,82vh)] grid-cols-2 gap-3">
      {tiers.map((t, k) => (
        <motion.div
          key={t.name}
          className="dk-card relative flex flex-col overflow-hidden p-[clamp(14px,1.4vw,24px)]"
          style={t.pick ? { borderColor: `${BRAND.gold}66`, background: `linear-gradient(180deg, ${BRAND.gold}1a, transparent 60%)` } : undefined}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + k * 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {t.pick && (
            <span
              className="absolute right-0 top-0 rounded-bl-[10px] px-2.5 py-1 text-[clamp(9px,0.6vw,11px)] font-semibold uppercase tracking-[0.18em]"
              style={{ background: BRAND.gold, color: '#14100A' }}
            >
              Sad
            </span>
          )}
          <p className="dk-eyebrow">{t.name}</p>
          <p className="dk-serif mt-2 text-[clamp(30px,min(3vw,5.6vh),60px)] leading-none" style={{ color: t.pick ? '#F4E5C2' : '#E9D9B6' }}>
            {t.price}
          </p>
          <p className="dk-small mt-1.5">{t.tag}</p>
          <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.08] pt-4">
            {t.rows.map(([big, small]) => (
              <div key={small}>
                <p className="dk-serif text-[clamp(18px,min(1.6vw,3vh),30px)] leading-none text-white/90">{big}</p>
                <p className="dk-small mt-1">{small}</p>
              </div>
            ))}
          </div>
          <p className="dk-small mt-auto pt-4 text-white/55">{t.note}</p>
        </motion.div>
      ))}
    </div>
  )
}

/* ── 3. Šta je ostalo ─────────────────────────────────────────── */

export function Ostalo({ d }: { d: DeckData }) {
  const done = [
    'Instalacija bez storea — iPhone i Android',
    `Dozvola i obavijest u ${SEND_TIME}, zaključan ekran`,
    'Savjeti pri prvom otvaranju',
    'Atmosfera po raspoloženju, album u pozadini',
    'Pjesma uz stih, u pozadini',
    'Sačuvani stihovi i dijeljenje kao slika',
    'Link koji izgleda kao poster',
    'Nova verzija stiže sama',
    'Urednički panel: kalendar, biblioteka, novi stih',
    'Plakat A3, A4 i objave za mreže',
  ]
  const todo: [string, ReactNode][] = [
    [
      'Lista stihova',
      <>
        Sada ih je {d.count}; za launch <b>90–120</b> — tri do četiri mjeseca bez ponavljanja. Magaza bira i odobrava.
      </>,
    ],
    ['Grafika i eventualna nadogradnja UI', <>Originali u visokoj rezoluciji — potpis, portret, logotipi — i dorada izgleda po želji Magaze.</>],
    [
      'Domena',
      <>
        Aplikacija na <b>stihdana.dinomerlin.ba</b> — jedan DNS zapis, linkovi i plakati vode tamo.
      </>,
    ],
    ['Testiranje', <>Prvo u izlogu Magaze, na stvarnim ljudima i telefonima — pa objava na mrežama.</>],
  ]
  return (
    <div>
      <R i={0}>
        <p className="dk-eyebrow">Do launcha</p>
      </R>
      <R i={1}>
        <h2 className="dk-h2 mt-[2.2vh]">
          Šta je <em>ostalo</em>
        </h2>
      </R>
      <div className="mt-[4vh] grid gap-3 lg:grid-cols-[1fr_1.25fr]">
        <R i={2}>
          <div className="dk-card h-full p-[clamp(16px,1.6vw,28px)]">
            <p className="dk-eyebrow" style={{ color: '#8DC9A3' }}>
              Gotovo — sve što smo danas vidjeli
            </p>
            <ul className="mt-3 grid gap-x-6 gap-y-2 xl:grid-cols-2">
              {done.map((t) => (
                <li key={t} className="dk-body flex gap-2.5 text-white/70">
                  <span className="mt-[0.2em] text-[#8DC9A3]">{Ico.check}</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </R>
        <R i={3}>
          <div className="dk-card h-full p-[clamp(16px,1.6vw,28px)]" style={{ borderColor: `${BRAND.gold}55`, background: `${BRAND.gold}0d` }}>
            <p className="dk-eyebrow">Šta treba</p>
            <ol className="mt-3 flex flex-col gap-[2.2vh]">
              {todo.map(([title, text], k) => (
                <li key={title} className="flex gap-3">
                  <span className="dk-num mt-0.5">{k + 1}</span>
                  <span>
                    <span className="dk-h3 block">{title}</span>
                    <span className="dk-body mt-1 block">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </R>
      </div>
    </div>
  )
}

/* ── 4. Grafike — za preuzimanje, u punoj rezoluciji ──────────── */

const DOWNLOAD = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
)

type Graphic = {
  title: string
  sub: string
  /** visina / širina */
  ratio: number
  draw: (width: string) => ReactNode
  /** širina pri izvozu, u CSS pikselima — PNG je dvostruko veći */
  exportW: number
  /** ime PNG-a, bez datuma */
  file: string
  pdf?: string
}

/** "3508 × 4961" — stvarna veličina PNG-a */
const pngSize = (it: Graphic) => `${it.exportW * 2} × ${Math.floor(it.exportW * it.ratio * 2)}`

/**
 * PNG se pravi u pregledniku, iz iste grafike koja je na slajdu — pa nosi
 * današnji stih. Gotove slike iz `public/promo` ostajale su na danu kad je
 * skripta zadnji put pokrenuta.
 *
 * Grafika se za to nacrta van ekrana u punoj širini (kao prozor iz kojeg je
 * skripta slikala), pa se preslika ×2.
 */
function PngButton({ it, date, className, children }: { it: Graphic; date: string; className: string; children: ReactNode }) {
  // posao se uzme u trenutku klika — novo iscrtavanje slajda ga ne pokreće ispočetka
  const [job, setJob] = useState<{ it: Graphic; date: string } | null>(null)
  const art = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!job) return
    let alive = true
    ;(async () => {
      try {
        await document.fonts?.ready
        const { toPng } = await import('html-to-image')
        const node = art.current
        if (!node || !alive) return
        // grafika je tek nacrtana: slika koja se još učitava (npr. potpis, širina
        // `auto`) ima širinu 0 i ispadne iz PNG-a
        await Promise.all([...node.querySelectorAll('img')].map((img) => img.decode().catch(() => {})))
        if (!alive) return
        const url = await toPng(node, { pixelRatio: 2 })
        if (!alive) return
        const a = document.createElement('a')
        a.href = url
        a.download = `${job.it.file}-${job.date}.png`
        a.click()
      } catch (e) {
        console.error('[png]', e)
      } finally {
        if (alive) setJob(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [job])

  return (
    <>
      <button type="button" onClick={() => setJob({ it, date })} disabled={!!job} className={className} aria-busy={!!job}>
        {children}
        {job && <span className="opacity-70">…</span>}
      </button>
      {job && (
        <div aria-hidden className="pointer-events-none fixed left-[-100000px] top-0">
          <div ref={art} style={{ width: job.it.exportW }}>
            {job.it.draw(`${job.it.exportW}px`)}
          </div>
        </div>
      )}
    </>
  )
}

const EXPAND = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
)

export function Grafike({ d }: { d: DeckData }) {
  const items: Graphic[] = [
    {
      title: 'Plakat A3',
      sub: 'uspravno, za radnju',
      ratio: Math.SQRT2,
      draw: (w) => <Poster data={d.poster} width={w} />,
      exportW: 1754,
      file: 'stih-dana-plakat-A3',
      pdf: '/promo/stih-dana-plakat-A3.pdf',
    },
    {
      title: 'Plakat A4',
      sub: 'položeno, za izlog',
      ratio: 1 / Math.SQRT2,
      draw: (w) => <PosterLandscape data={d.poster} width={w} />,
      exportW: 1754,
      file: 'stih-dana-plakat-A4-polozeno',
      pdf: '/promo/stih-dana-plakat-A4-polozeno.pdf',
    },
    {
      title: 'Objava 4:5',
      sub: 'Instagram i Facebook',
      ratio: 1.25,
      draw: (w) => <SocialPost data={d.poster} width={w} />,
      exportW: 1080,
      file: 'stih-dana-objava-4x5',
    },
    {
      title: 'Story 9:16',
      sub: 'Instagram story',
      ratio: 16 / 9,
      draw: (w) => <SocialStory data={d.poster} width={w} />,
      exportW: 1080,
      file: 'stih-dana-story-9x16',
    },
  ]
  const [open, setOpen] = useState<number | null>(null)
  // svi pregledi iste visine; zbir širina je ~3.5 visine (+ razmaci)
  const h = 'min(32vh, calc((100vw - 220px) / 3.8), 360px)'
  return (
    <div>
      <R i={0}>
        <p className="dk-eyebrow">Grafike</p>
      </R>
      <R i={1}>
        <h2 className="dk-h2 mt-[2.2vh]">
          Spremno za štampu <em>i za mreže</em>
        </h2>
      </R>
      <R i={2}>
        <p className="dk-lead mt-[1.8vh] max-w-[40em]">
          Plakat A3 za radnju, A4 za izlog, objava i story za mreže — isti stih, isti telefoni, isti jezik. Svaka se
          preuzima u punoj rezoluciji, a plakati i kao PDF za štampu.
        </p>
      </R>
      <div className="mt-[4.5vh] flex w-full items-start justify-between gap-[clamp(14px,2vw,40px)]">
        {items.map((it, k) => (
          <R key={it.title} i={3 + k}>
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setOpen(k)}
                aria-label={`${it.title} preko cijelog ekrana`}
                className="group relative overflow-hidden rounded-[4px] text-left"
                style={{ height: h, width: `calc(${h} / ${it.ratio})`, boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)' }}
              >
                {it.draw(`calc(${h} / ${it.ratio})`)}
                <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/85 opacity-70 backdrop-blur transition-opacity group-hover:opacity-100">
                  {EXPAND}
                </span>
              </button>
              <p className="dk-h3 mt-3">{it.title}</p>
              <p className="dk-small">{it.sub}</p>
              <p className="dk-small tabular text-white/35">{pngSize(it)} px</p>
              <div className="mt-2.5 flex gap-2">
                <PngButton it={it} date={d.today} className="dk-btn-gold !h-[2.3em] !px-[1em] text-[clamp(11px,0.8vw,14px)]">
                  {DOWNLOAD} PNG
                </PngButton>
                {it.pdf && (
                  <a href={it.pdf} download className="dk-chip !h-[2.3em]">
                    {DOWNLOAD} PDF
                  </a>
                )}
              </div>
            </div>
          </R>
        ))}
      </div>
      <AnimatePresence>
        {open !== null && <Lightbox items={items} at={open} date={d.today} onAt={setOpen} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </div>
  )
}

/** Grafika preko cijelog ekrana — strelice listaju, Esc zatvara. */
function Lightbox({
  items,
  at,
  date,
  onAt,
  onClose,
}: {
  items: Graphic[]
  at: number
  date: string
  onAt: (k: number) => void
  onClose: () => void
}) {
  const it = items[at]
  useEffect(() => {
    // u hvatanju, prije prezentacije: strelice ovdje listaju grafike, ne slajdove
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') onAt((at + 1) % items.length)
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') onAt((at - 1 + items.length) % items.length)
      else return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [at, items.length, onAt, onClose])
  const w = `min(90vw, calc(82vh / ${it.ratio}))`
  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-black/92 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={at}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}
          style={{ boxShadow: '0 40px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)' }}
        >
          {it.draw(w)}
        </motion.div>
      </AnimatePresence>
      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="dk-chip" onClick={() => onAt((at - 1 + items.length) % items.length)} aria-label="Prethodna">
          ←
        </button>
        <p className="dk-h3 min-w-[9em] text-center">{it.title}</p>
        <button type="button" className="dk-chip" onClick={() => onAt((at + 1) % items.length)} aria-label="Sljedeća">
          →
        </button>
        <PngButton it={it} date={date} className="dk-btn-gold !h-[2.3em] !px-[1em]">
          {DOWNLOAD} PNG · {pngSize(it)}
        </PngButton>
        {it.pdf && (
          <a href={it.pdf} download className="dk-chip">
            {DOWNLOAD} PDF
          </a>
        )}
        <button type="button" className="dk-chip" onClick={onClose} aria-label="Zatvori">
          ✕
        </button>
      </div>
    </motion.div>
  )
}
