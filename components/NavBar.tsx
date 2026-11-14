'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { BRAND } from '@/lib/brand'

/**
 * Donja traka na telefonu (components/VerseScreen.tsx): Moji stihovi (s
 * brojem), Moj kalendar i Postavke — na širem ekranu su to dugmad gore u
 * zaglavlju. Staklena traka preko cijele širine, uz dno ekrana: pozadina iza
 * nje zamućena, s blagim sjajem — bez linije, gornja ivica se pretapa.
 */
export function NavBar({ children }: { children: ReactNode }) {
  return (
    <nav aria-label="Meni" className="relative z-10 -mx-6 mt-5 flex items-stretch px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3">
      {/* staklo (zamućeno, blag sjaj) iza stavki — gore se mekano pretopi, bez ivice */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-2xl backdrop-saturate-150"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 50%, rgba(0,0,0,0.2) 100%)',
          maskImage: 'linear-gradient(180deg, transparent 0, #000 24px)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0, #000 24px)',
        }}
      />
      {children}
    </nav>
  )
}

/** Stavka trake — znak gore, natpis ispod; `badge`: broj (zlatna značka uz znak). */
export function NavItem({ icon, label, badge, ...button }: { icon: ReactNode; label: string; badge?: number } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...button}
      className="relative flex flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl py-1.5 text-white/75 transition-colors hover:text-white active:bg-white/[0.06]"
    >
      <span className="relative flex h-[22px] items-center justify-center">
        {icon}
        {badge ? (
          <span
            className="tabular absolute -top-1.5 left-[calc(100%-4px)] min-w-[18px] rounded-full px-1 text-center text-[10px] font-semibold leading-[16px] text-[#14100A]"
            style={{ background: BRAND.gold }}
          >
            {badge}
          </span>
        ) : null}
      </span>
      <span className="whitespace-nowrap text-[9.5px] font-medium uppercase tracking-[0.16em]">{label}</span>
    </button>
  )
}

/** Znak "Moji stihovi" — srce, kao u zaglavlju sačuvanih. */
export function HeartIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z" />
    </svg>
  )
}
