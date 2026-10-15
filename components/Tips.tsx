'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BRAND } from '@/lib/brand'

/**
 * Savjeti pri prvom otvaranju — odmah nakon dozvole za obavijesti. Ostatak
 * ekrana se zatamni, a u fokusu je jedno dugme i rečenica o njemu.
 *
 * Pokreće ih `startTips()` (Onboarding, kad dozvola prođe). Na telefonu se
 * pokažu jednom; u prezentaciji svaki put, a kraj se javi prezentaciji.
 */

const SEEN = 'stihdana:tips'
const EVENT = 'stihdana:tips'

/** ikonica savjeta — iste linije kao dugme na koje savjet pokazuje */
type Tip = { target: string[]; title: string; body: string; icon: ReactNode }

const TIPS: Tip[] = [
  {
    target: ['mine'],
    title: 'Ovaj stih je samo tvoj',
    body: 'Svaki dan izvlačiš svoj, kao papirić u Magazi — i nijedan se ne ponavlja.',
    icon: (
      <>
        <path d="M5 8.5h14v7H5z" />
        <path d="M8 11h8M8 13.2h5" />
      </>
    ),
  },
  {
    target: ['notify'],
    title: 'Obavijest u 12:00',
    body: 'Svaki dan: „Vrijeme je za stih dana! Uzmi svoj!“ Zvono obavijesti pali i gasi, kad god poželiš.',
    icon: (
      <>
        <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5" />
        <path d="M13.7 20a2 2 0 0 1-3.4 0" />
      </>
    ),
  },
  {
    target: ['save', 'saved'],
    title: 'Sviđa ti se stih?',
    body: 'Sačuvaj ga. Svi sačuvani te čekaju gore, pod ikonicom s brojem.',
    icon: <path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z" />,
  },
  {
    target: ['share'],
    title: 'Podijeli kao sliku',
    body: 'Story, objava ili kvadrat — za Instagram, WhatsApp ili Viber. Sliku možeš i preuzeti.',
    icon: (
      <>
        <path d="M12 3v13M12 3 8 7M12 3l4 4" />
        <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
      </>
    ),
  },
  {
    target: ['song'],
    title: 'Poslušaj pjesmu',
    body: 'Dodir na naziv pusti pjesmu iz koje je stih — u pozadini, bez napuštanja stiha.',
    icon: <path d="M9 6.8v10.4l8.4-5.2z" />,
  },
]

/** Dobrodošlica kad savjeti prođu — prva obavijest koju korisnik dobije. */
export const WELCOME = { title: 'Mir svim dobrim ljudima', body: 'Dobro došli na Stih dana. — Dino Merlin' }

function welcome() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const tag = 'stih-dana-dobrodoslica'
  navigator.serviceWorker?.ready
    .then(async (reg) => {
      await reg.showNotification(WELCOME.title, {
        body: WELCOME.body,
        tag,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        data: { url: '/' },
      })
      // Dobrodošlica se pročita i ode — ne ostaje u traci, pa launcher
      // (Samsung, Pixel) ne drži tačku/broj na ikonici aplikacije.
      setTimeout(() => {
        reg.getNotifications({ tag }).then((list) => list.forEach((n) => n.close()))
        navigator.clearAppBadge?.().catch(() => {})
      }, 8000)
    })
    .catch(() => {})
}

const STOP = 'stihdana:tips-stop'

/** Skloni savjete bez traga — prezentacija na istom ekranu pokazuje nešto drugo. */
export function stopTips() {
  window.dispatchEvent(new Event(STOP))
}

/**
 * Savjeti su za sada ISKLJUČENI — za ovako malu aplikaciju nisu potrebni.
 * Kod ostaje: `true` ih vraća svuda (aplikacija, prezentacija, dev traka).
 */
export const TIPS_ON = false

/** Pokreni savjete. `force` ih pokaže i ako su već viđeni (prezentacija). */
export function startTips(force = false) {
  try {
    if (!force && localStorage.getItem(SEEN)) return
    localStorage.setItem(SEEN, '1')
  } catch {
    /* privatni prozor — savjeti se pokažu, samo se ne zapamte */
  }
  // bez savjeta dobrodošlica stiže odmah — jednom, poslije prvog otvaranja
  if (!TIPS_ON) {
    if (window.parent === window) welcome()
    return
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Prozor oko dugmeta: `r` je zaobljenje — krug za okrugla dugmad, kapsula za šira. */
type Box = { x: number; y: number; w: number; h: number; r: number }
const PAD = 10

function boxes(tip: Tip): Box[] {
  return tip.target.flatMap((t) => {
    const el = document.querySelector<HTMLElement>(`[data-tip="${t}"]`)
    const b = el?.getBoundingClientRect()
    if (!b || !b.width) return []
    const w = b.width + PAD * 2
    const h = b.height + PAD * 2
    // skoro kvadratno (ikonica, ploča) → pravilan krug oko središta
    if (w / h < 1.6) {
      const d = Math.max(w, h)
      return [{ x: b.left + b.width / 2 - d / 2, y: b.top + b.height / 2 - d / 2, w: d, h: d, r: d / 2 }]
    }
    // šire (datum, dugme sa tekstom) → kapsula
    return [{ x: b.left - PAD, y: b.top - PAD, w, h, r: h / 2 }]
  })
}

export function Tips() {
  const [step, setStep] = useState<number | null>(null)
  const [holes, setHoles] = useState<Box[]>([])
  const [vp, setVp] = useState({ w: 0, h: 0 })

  useEffect(() => {
    let t = 0
    // gate se prvo skloni, a zaglavlje i potpis pjesme dođu na ekran; ako se
    // stih upravo izvlači, savjeti čekaju da sleti
    const start = () => {
      clearTimeout(t)
      const go = () => {
        if (document.querySelector('[data-izvlacenje]')) t = window.setTimeout(go, 300)
        else t = window.setTimeout(() => setStep(0), 1100)
      }
      go()
    }
    const stop = () => {
      clearTimeout(t)
      setStep(null)
      setHoles([])
    }
    window.addEventListener(EVENT, start)
    window.addEventListener(STOP, stop)
    return () => {
      window.removeEventListener(EVENT, start)
      window.removeEventListener(STOP, stop)
      clearTimeout(t)
    }
  }, [])

  // rupe prate dugmad i dok se ekran još slaže (animacije, promjena veličine)
  useEffect(() => {
    if (step === null) return
    let raf = 0
    const tick = () => {
      setHoles((prev) => {
        const next = boxes(TIPS[step])
        return JSON.stringify(next) === JSON.stringify(prev) ? prev : next
      })
      setVp((v) => (v.w === innerWidth && v.h === innerHeight ? v : { w: innerWidth, h: innerHeight }))
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [step])

  const finish = () => {
    setStep(null)
    setHoles([])
    // u prezentaciji obavijest pokaže telefon na slajdu, a ne pravi sistem
    if (window.parent !== window) window.parent.postMessage({ type: 'stihdana:tips-done' }, window.location.origin)
    else welcome()
  }
  const next = () => (step !== null && step < TIPS.length - 1 ? setStep(step + 1) : finish())

  const tip = step !== null ? TIPS[step] : null
  const main = holes[0]
  // kartica ide tamo gdje ima više mjesta: ispod dugmeta gore, iznad dugmeta dole
  const below = main ? main.y + main.h / 2 < vp.h / 2 : true
  const last = step === TIPS.length - 1

  // tekst stoji ispod/iznad dugmeta, ali uvijek na istom mjestu po širini i
  // poravnat lijevo — svaki savjet počinje u istoj liniji, gdje god dugme bilo
  const W = Math.min(340, vp.w - 32)
  const left = (vp.w - W) / 2
  const GAP = 12

  const ease = [0.22, 1, 0.36, 1] as const
  const glide = { type: 'spring', stiffness: 140, damping: 26 } as const

  return (
    <AnimatePresence>
      {tip && (
        <motion.div
          key="tips"
          className="fixed inset-0 z-[95]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease }}
          onClick={next}
        >
          {/* tama s jasnim prozorom oko dugmeta — krug ili kapsula, zlatni obrub */}
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <mask id="tips-mask">
                <rect width="100%" height="100%" fill="white" />
                {holes.map((b, i) => (
                  <motion.rect
                    key={i}
                    initial={false}
                    animate={{ x: b.x, y: b.y, width: b.w, height: b.h, rx: b.r, ry: b.r }}
                    transition={glide}
                    fill="black"
                  />
                ))}
              </mask>
              <radialGradient id="tips-glow">
                <stop offset="0" stopColor={BRAND.gold} stopOpacity="0.16" />
                <stop offset="1" stopColor={BRAND.gold} stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="rgba(3,2,2,0.92)" mask="url(#tips-mask)" />
            {/* obrub prozora — tanka zlatna linija; kad savjet stigne, jednom se raširi i nestane */}
            {holes.map((b, i) => (
              <g key={`o-${i}`}>
                <motion.rect
                  initial={false}
                  animate={{ x: b.x, y: b.y, width: b.w, height: b.h, rx: b.r, ry: b.r }}
                  transition={glide}
                  fill="none"
                  stroke={BRAND.gold}
                  strokeOpacity="0.75"
                  strokeWidth="1.5"
                />
                <motion.rect
                  key={`p-${step}`}
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  rx={b.r}
                  ry={b.r}
                  fill="none"
                  stroke={BRAND.gold}
                  strokeWidth="1.5"
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                  initial={{ opacity: 0.6, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.25 }}
                  transition={{ duration: 1.1, delay: 0.35, ease: 'easeOut' }}
                />
              </g>
            ))}
            {/* tih zlatni sjaj iza dugmeta, kao na ostatku aplikacije */}
            {holes.map((b, i) => (
              <motion.ellipse
                key={i}
                initial={false}
                animate={{ cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w * 0.9 + 20, ry: b.h * 0.9 + 20 }}
                transition={glide}
                fill="url(#tips-glow)"
              />
            ))}
          </svg>

          {/* kartica — isti jezik kao paneli: tamno staklo, zlatna nit gore */}
          <motion.div
            role="dialog"
            aria-label={tip.title}
            className="absolute overflow-hidden rounded-[22px] border border-white/10 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
            style={{
              left,
              width: W,
              background: `radial-gradient(120% 70% at 0% 0%, ${BRAND.gold}17 0%, transparent 60%), linear-gradient(180deg, #161312 0%, #0d0b0b 100%)`,
              ...(!main ? { top: vp.h / 2 - 70 } : below ? { top: main.y + main.h + GAP } : { bottom: vp.h - main.y + GAP }),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className="pointer-events-none absolute inset-x-8 top-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${BRAND.gold}80, transparent)` }}
              aria-hidden
            />
            {/* prvi savjet ulazi s karticom, bez svoje animacije — inače kartica
                stoji prazna dok tekst ne stigne */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                className="flex items-start gap-3.5"
                initial={{ opacity: 0, y: below ? -4 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ duration: 0.28, ease }}
              >
                <span
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                  style={{ borderColor: `${BRAND.gold}40`, background: `radial-gradient(circle, ${BRAND.gold}1f, transparent 70%)`, color: BRAND.gold }}
                  aria-hidden
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {tip.icon}
                  </svg>
                </span>
                <div className="min-w-0">
                  <p
                    className="text-[1.3rem] leading-snug text-white/95"
                    style={{ fontFamily: 'var(--font-serif), serif', fontVariationSettings: "'opsz' 72, 'SOFT' 30" }}
                  >
                    {tip.title}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{tip.body}</p>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3">
              <button
                type="button"
                onClick={finish}
                className="text-[10px] uppercase tracking-[0.24em] text-white/35 transition-colors hover:text-white/60"
              >
                Preskoči
              </button>
              {/* napredak — iste tanke crtice kao u ostatku */}
              <span className="flex items-center gap-[5px]" aria-hidden>
                {TIPS.map((_, i) => (
                  <span
                    key={i}
                    className="h-[2px] rounded-full transition-all duration-500"
                    style={{
                      width: i === step ? 18 : 6,
                      background: i === step ? BRAND.gold : i < step! ? `${BRAND.gold}73` : 'rgba(255,255,255,0.18)',
                    }}
                  />
                ))}
              </span>
              <button
                type="button"
                onClick={next}
                data-deck="tip-next"
                className="text-[10px] font-medium uppercase tracking-[0.24em] transition-opacity hover:opacity-80"
                style={{ color: BRAND.gold }}
              >
                {last ? 'Kreni' : 'Dalje'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
