'use client'

import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useDeck } from './context'
import type { DeviceKind } from './Devices'
import type { DeckData, FeatureDef } from './types'

/**
 * Sitni dijelovi slajdova. Sve što se pojavljuje ulazi istim ritmom kao
 * stih u aplikaciji — blago odozdo, jedno za drugim.
 */
export function R({ i = 0, children, className }: { i?: number; children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ delay: 0.08 + i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Slajd s više funkcionalnosti: lista, u kojoj je otvorena jedna.
 * Strelica naprijed (ili klik na red) otvara sljedeću i vodi uređaj desno
 * tamo gdje se ona vidi — svaka funkcija ima svoj opis, a slajdova je malo.
 */
export function FeatureSlide({
  eyebrow,
  title,
  features,
  d,
}: {
  eyebrow: ReactNode
  title: ReactNode
  features: FeatureDef[]
  d: DeckData
}) {
  const { step, setStep, phoneSrc } = useDeck()
  return (
    <div>
      <R i={0}>
        <p className="dk-eyebrow flex items-center gap-2.5">{eyebrow}</p>
      </R>
      <R i={1}>
        <h2 className="dk-h2 dk-h2-sm mt-[1.4vh]">{title}</h2>
      </R>
      <a href={phoneSrc} target="_blank" rel="noopener noreferrer" className="dk-chip dk-only-narrow mt-4 w-fit">
        Otvori aplikaciju ↗
      </a>
      <R i={2}>
        <ol className="mt-[3vh] max-w-[min(100%,52rem)]">
          {features.map((f, k) => {
            const on = k === step
            const done = k < step
            return (
              <li key={f.id} className="relative">
                <button
                  type="button"
                  onClick={() => setStep(k)}
                  aria-expanded={on}
                  className="group flex w-full items-center gap-[1.1em] py-[1.15vh] text-left"
                  style={{ fontSize: 'var(--fs-body)' }}
                >
                  {/* odrađeni koraci: zlatna kvačica, naslov u zlatnom tonu */}
                  <span
                    className="dk-num transition-colors duration-300"
                    style={
                      on
                        ? { background: 'linear-gradient(180deg, #E2CFA6, #BFA87F)', color: '#14100A', borderColor: 'transparent' }
                        : done
                          ? { background: 'rgba(191,168,127,0.14)', color: '#E2CFA6', borderColor: 'rgba(191,168,127,0.55)' }
                          : undefined
                    }
                  >
                    {done ? Ico.check : k + 1}
                  </span>
                  <span
                    className="dk-h3 transition-colors duration-300 group-hover:text-white/85"
                    style={{ color: on ? '#FBF6EC' : done ? 'rgba(226,207,166,0.72)' : 'rgba(255,255,255,0.42)' }}
                  >
                    {f.title}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="pb-[2.2vh] pl-[calc(var(--fs-body)*3.1)]">{f.body(d)}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ol>
      </R>
    </div>
  )
}

/* ── sitni dijelovi opisa funkcionalnosti ───────────────────── */

/** Zlatna tačka ispred stavke — poravnata s prvim redom teksta. */
export function Dot() {
  return (
    <span
      aria-hidden
      className="mt-[0.62em] block h-[0.34em] w-[0.34em] shrink-0 rotate-45 bg-[#BFA87F] shadow-[0_0_10px_rgba(191,168,127,0.6)]"
    />
  )
}

export function Text({ children }: { children: ReactNode }) {
  return <p className="dk-body max-w-[38em] text-white/70">{children}</p>
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-[1.4vh] flex max-w-[34em] flex-col gap-[0.9vh]">
      {items.map((t, k) => (
        <li key={k} className="dk-small flex gap-2.5 text-white/55">
          <Dot />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

/** Dugmad koja vode aplikaciju — zelena oznaka znači: ovo radi uživo. */
export function Acts({ children }: { children: ReactNode }) {
  return <div className="mt-[1.8vh] flex flex-wrap gap-2">{children}</div>
}

/** Šta dodirnuti u aplikaciji — tiho, u jednom redu. */
export function Try({ steps }: { steps: string[] }) {
  return (
    <p className="dk-small mt-[1.6vh] flex flex-wrap items-center gap-x-2 gap-y-1 text-white/55">
      <span className="text-[0.85em] font-medium uppercase tracking-[0.22em] text-[#BFA87F]">Probaj</span>
      {steps.map((s, k) => (
        <span key={s} className="flex items-center gap-2">
          {k > 0 && <span className="text-[#BFA87F]/60">→</span>}
          {s}
        </span>
      ))}
    </p>
  )
}

/** Zaglavlje slajda s funkcionalnošću: broj, naslov, i link za uski ekran. */
export function FeatureHead({ n, kicker, title }: { n: string; kicker: string; title: ReactNode }) {
  const { phoneSrc } = useDeck()
  return (
    <>
      <R i={0}>
        <p className="dk-eyebrow flex items-center gap-3">
          <span className="tabular">{n}</span>
          <span className="h-px w-6 bg-[#BFA87F]/50" />
          {kicker}
        </p>
      </R>
      <R i={1}>
        <h2 className="dk-h2 mt-[2.2vh]">{title}</h2>
      </R>
      <a
        href={phoneSrc}
        target="_blank"
        rel="noopener noreferrer"
        className="dk-chip dk-only-narrow mt-4 w-fit"
      >
        Otvori aplikaciju ↗
      </a>
    </>
  )
}

export function Lead({ i = 2, children }: { i?: number; children: ReactNode }) {
  return (
    <R i={i}>
      <p className="dk-lead mt-[2.6vh] max-w-[34em]">{children}</p>
    </R>
  )
}

/** Tačke sa zlatnom crticom — kratko, jedna misao po redu. */
export function Points({ i = 3, items }: { i?: number; items: ReactNode[] }) {
  return (
    <ul className="mt-[3vh] flex max-w-[36em] flex-col gap-[1.4vh]">
      {items.map((item, k) => (
        <R key={k} i={i + k}>
          <li className="dk-body flex gap-3">
            <Dot />
            <span>{item}</span>
          </li>
        </R>
      ))}
    </ul>
  )
}

/** "Zašto" — obrazloženje odluke, odvojeno od opisa. */
export function Why({ i = 5, title = 'Zašto', children }: { i?: number; title?: string; children: ReactNode }) {
  return (
    <R i={i}>
      <div className="dk-card mt-[3vh] max-w-[36em] px-5 py-4">
        <p className="dk-eyebrow mb-1.5 opacity-90">{title}</p>
        <p className="dk-body">{children}</p>
      </div>
    </R>
  )
}

/** Šta kliknuti uživo — vodič za prezentera, a publici najava. */
export function LiveSteps({ i = 6, steps }: { i?: number; steps: ReactNode[] }) {
  return (
    <R i={i}>
      <div className="mt-[3.2vh] max-w-[36em]">
        <p className="dk-eyebrow mb-3 flex items-center gap-2 text-[#8DC9A3]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#8DC9A3]" />
          Uživo u aplikaciji
        </p>
        <ol className="flex flex-wrap gap-x-6 gap-y-2.5">
          {steps.map((s, k) => (
            <li key={k} className="dk-small flex items-center gap-2.5 text-white/65">
              <span className="dk-num">{k + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </R>
  )
}

/** Red dugmadi koja vode pravu aplikaciju na određeno stanje. */
export function Controls({ i = 6, label = 'Pokaži', children }: { i?: number; label?: string; children: ReactNode }) {
  return (
    <R i={i}>
      <div className="mt-[3.2vh]">
        <p className="dk-eyebrow mb-3 flex items-center gap-2 text-[#8DC9A3]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#8DC9A3]" />
          {label}
        </p>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </R>
  )
}

/** Dugme koje telefon vodi na adresu; upaljeno je dok je telefon tamo. */
export function PhoneChip({ src, frame, children }: { src: string; frame?: DeviceKind; children: ReactNode }) {
  const { phoneSrc, openPhone, frame: current } = useDeck()
  const on = phoneSrc === src && (!frame || frame === current)
  return (
    <button type="button" className="dk-chip" aria-pressed={on} onClick={() => openPhone(src, frame)}>
      {children}
    </button>
  )
}

/**
 * iPhone / Android — jedan prekidač ispod telefona za cijelu prezentaciju.
 * Zlatna podloga klizi na izabrani sistem.
 */
export function OsToggle() {
  const { os, setOs } = useDeck()
  return (
    <div className="dk-os dk-os--wide" role="radiogroup" aria-label="Sistem telefona">
      {(
        [
          ['ios', Ico.apple, 'iPhone'],
          ['android', Ico.android, 'Android'],
        ] as const
      ).map(([o, icon, label]) => (
        <button key={o} type="button" role="radio" aria-checked={os === o} onClick={() => setOs(o)}>
          {os === o && (
            <motion.span
              layoutId="dk-os-pill"
              className="dk-os-pill"
              transition={{ type: 'spring', stiffness: 520, damping: 38 }}
            />
          )}
          <span className="relative flex items-center gap-[0.5em]">
            {icon}
            {label}
          </span>
        </button>
      ))}
    </div>
  )
}

/** Auto / Ručno — režirana scena ide sama, ili je prezenter klikće na telefonu. */
export function DemoToggle({ small }: { small?: boolean }) {
  const { manual, setManual } = useDeck()
  return (
    <div className={small ? 'dk-os dk-os--sm' : 'dk-os'} role="radiogroup" aria-label="Demo" title="Demo na telefonu">
      {(
        [
          [false, 'Auto'],
          [true, 'Ručno'],
        ] as const
      ).map(([m, label]) => (
        <button key={label} type="button" role="radio" aria-checked={manual === m} onClick={() => setManual(m)}>
          {manual === m && (
            <motion.span
              layoutId="dk-demo-pill"
              className="dk-os-pill"
              transition={{ type: 'spring', stiffness: 520, damping: 38 }}
            />
          )}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  )
}

export function ActionChip({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="dk-chip" onClick={onClick}>
      {children}
    </button>
  )
}

export function Small({ i = 8, children, className = '' }: { i?: number; children: ReactNode; className?: string }) {
  return (
    <R i={i}>
      <p className={`dk-small mt-[2.4vh] max-w-[38em] ${className}`}>{children}</p>
    </R>
  )
}

export const Ico = {
  reload: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  ),
  bell: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  apple: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.4-.9-2.3-4.3zM14 5.3c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3z" />
    </svg>
  ),
  android: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.6 9.5l1.7-3a.4.4 0 0 0-.7-.4l-1.8 3A10.6 10.6 0 0 0 12 8.1c-1.7 0-3.3.4-4.8 1l-1.8-3a.4.4 0 0 0-.7.4l1.7 3C3.6 11 1.8 13.8 1.5 17h21c-.3-3.2-2.1-6-4.9-7.5zM7 14.4a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm10 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
    </svg>
  ),
  check: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  ),
  arrow: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  external: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  ),
}
