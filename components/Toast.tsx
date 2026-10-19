'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

/*
 * Jedan oblik za sve poruke u aplikaciji (nova verzija, obavijesti,
 * dijeljenje, admin): staklena kartica koja se spusti odozgo, kao obavijest
 * na telefonu. `toast()` se zove odakle god; `<Toaster />` je u layoutu.
 *
 * Vidi se jedna poruka — zadnja. Kratka poruka preko nove verzije ode pa se
 * nova verzija vrati. Kretnja je `transform` kao string (WAAPI, GPU), ista
 * kriva kao donji paneli (components/Sheet.tsx).
 */

export const TOAST_OK = '#8DC9A3'
export const TOAST_BAD = '#D08C8C'
const NEUTRAL = '#D9D9D9'

export type Toast = {
  /** isti id = ista poruka se zamijeni (npr. 'update', 'notify') */
  id: string
  title: string
  sub?: string
  /** boja ikone i dugmeta */
  color?: string
  icon?: ReactNode
  action?: { label: string; onClick: () => void; busy?: boolean }
  /** ostaje dok se ne makne (`dismissToast`) — inače nestane sama */
  sticky?: boolean
}

let items: Toast[] = []
const subs = new Set<() => void>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const emit = () => subs.forEach((f) => f())
const NONE: Toast[] = []

export function toast(t: Toast, ttl = 2600) {
  const i = items.findIndex((x) => x.id === t.id)
  items = i < 0 ? [...items, t] : items.map((x, j) => (j === i ? t : x))
  clearTimeout(timers.get(t.id))
  if (!t.sticky) timers.set(t.id, setTimeout(() => dismissToast(t.id), ttl))
  emit()
}

export function dismissToast(id: string) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  if (!items.some((x) => x.id === id)) return
  items = items.filter((x) => x.id !== id)
  emit()
}

const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}

const OPEN = { duration: 0.5, ease: [0.32, 0.72, 0, 1] as const }
const CLOSE = { duration: 0.3, ease: [0.4, 0, 1, 1] as const }

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => NONE)
  const t = list[list.length - 1]
  return (
    <div role="status" aria-live="polite">
      <AnimatePresence mode="wait">
        {t && (
          <motion.div
            key={`${t.id}:${t.title}`}
            className="pointer-events-none fixed inset-x-0 top-0 z-[150] flex justify-center px-4 pt-[max(0.75rem,calc(var(--sat,0px)+0.375rem))]"
            style={{ willChange: 'transform' }}
            initial={{ transform: 'translateY(-100%)' }}
            animate={{ transform: 'translateY(0%)', transition: OPEN }}
            exit={{ transform: 'translateY(-100%)', transition: CLOSE }}
          >
            <Card t={t} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Card({ t }: { t: Toast }) {
  const color = t.color ?? NEUTRAL
  return (
    <div
      className="pointer-events-auto flex min-h-[52px] w-fit max-w-[400px] items-center gap-3 rounded-[26px] border border-white/10 py-2 pl-2 shadow-[0_14px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      style={{ backgroundColor: 'rgba(20,18,18,0.82)', paddingRight: t.action ? 8 : 18 }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ color, backgroundColor: `${color}1F` }}
        aria-hidden
      >
        {t.icon ?? <Icon.info />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium leading-tight text-white/90">{t.title}</p>
        {t.sub && <p className="mt-0.5 text-[12px] leading-tight text-white/50">{t.sub}</p>}
      </div>
      {t.action && (
        <button
          onClick={t.action.onClick}
          disabled={t.action.busy}
          className="ml-1 flex h-9 shrink-0 items-center justify-center rounded-full px-4 text-[13px] font-semibold text-black transition-opacity active:opacity-80 disabled:opacity-60"
          style={{ backgroundColor: color }}
        >
          {t.action.busy ? <Icon.spin /> : t.action.label}
        </button>
      )}
    </div>
  )
}

const svg = (d: ReactNode, extra?: { className?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...extra}>
    {d}
  </svg>
)

/** Ikone za poruke — iste linije kao ostatak aplikacije. */
export const Icon = {
  ok: () => svg(<path d="M5 12.5l4.5 4.5L19 7.5" />),
  bad: () => svg(<path d="M7 7l10 10M17 7 7 17" />),
  info: () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.6v.01" /></>),
  refresh: () => svg(<><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>),
  bell: () => svg(<><path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5" /><path d="M13.7 20a2 2 0 0 1-3.4 0" /></>),
  bellOff: () => svg(<><path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5" /><path d="M13.7 20a2 2 0 0 1-3.4 0" /><path d="M3 3l18 18" /></>),
  download: () => svg(<><path d="M12 4v11M12 15l-4-4M12 15l4-4" /><path d="M5 19h14" /></>),
  spin: () => svg(<><circle cx="12" cy="12" r="9" opacity="0.25" /><path d="M21 12a9 9 0 0 0-9-9" /></>, { className: 'animate-spin' }),
}
