import type { ReactNode } from 'react'
import { BRAND } from '@/lib/brand'

/** Okrugla ikonica u zaglavlju — kao na ostalim panelima. */
export const ROUND = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/90 transition-colors hover:text-white active:scale-95'

/** zlatni krug oko ikone; `strong` (zaglavlje drawera): jači rub i sjaj, deblja ikona */
function Ring({ size, strong = false, children }: { size: number; strong?: boolean; children: ReactNode }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full border ${strong ? '[&_svg]:[stroke-width:2]' : ''}`}
      style={{
        width: size,
        height: size,
        borderColor: `${BRAND.gold}${strong ? '99' : '55'}`,
        background: `radial-gradient(circle, ${BRAND.gold}${strong ? '3d' : '24'}, transparent 70%)`,
        color: BRAND.gold,
      }}
      aria-hidden
    >
      {children}
    </span>
  )
}

/**
 * Znak u zaglavlju drawera — zlatni krug s istom ikonom kao dugme koje ga
 * otvara (sačuvano, podijeli), pa se odmah zna gdje si.
 */
export function DrawerIcon({ children }: { children: ReactNode }) {
  return (
    <Ring size={40}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </Ring>
  )
}

/**
 * Zaglavlje drawera (tekst pjesme, dijeljenje, postavke) — isto na svima:
 * traka po vrhu panela, svjetlija i zamućena (omot albuma iza nje se razlije),
 * s hvataljkom, zlatnom niti i crtom ispod — vidi se da je zaglavlje. Znak i
 * zatvori iste veličine, natpis i naslov zbijeni između njih.
 */
export function DrawerHeader({
  icon,
  eyebrow,
  title,
  onClose,
  className = '',
}: {
  icon: ReactNode
  eyebrow: string
  title: string
  onClose: () => void
  className?: string
}) {
  return (
    <div className={`relative z-10 shrink-0 border-b border-white/[0.09] bg-white/[0.075] px-5 pb-3 pt-3 backdrop-blur-xl ${className}`}>
      <span className="pointer-events-none absolute inset-x-10 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${BRAND.gold}80, transparent)` }} aria-hidden />
      <span className="os-grabber mx-auto mb-3 block h-1 w-10 rounded-full bg-white/15 sm:hidden" aria-hidden />
      <div className="flex items-center gap-3">
        <Ring size={36} strong>
          {icon}
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold uppercase leading-none tracking-[0.2em]" style={{ color: BRAND.gold }}>
            {eyebrow}
          </p>
          <p className="mt-1 truncate text-[1.25rem] font-medium leading-[1.2] text-white" style={{ fontFamily: 'var(--font-serif), serif' }}>
            {title}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Zatvori" data-drawer-close className={ROUND}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
