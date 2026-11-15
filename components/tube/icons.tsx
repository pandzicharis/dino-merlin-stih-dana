import type { CSSProperties } from 'react'

/*
 * Ikone YouTube dijela — jedan crtež za sve (kao Lucide: linija 2, zaobljeni
 * krajevi), pa izgledaju kao jedan komplet. YouTube znak je zvaničan.
 */

type P = { size?: number; className?: string; style?: CSSProperties }

function Line({ size = 20, className, style, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden>
      {children}
    </svg>
  )
}

export const ChevronDown = (p: P) => (
  <Line {...p}>
    <path d="m6 9 6 6 6-6" />
  </Line>
)
export const ChevronLeft = (p: P) => (
  <Line {...p}>
    <path d="m15 18-6-6 6-6" />
  </Line>
)
export const Close = (p: P) => (
  <Line {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Line>
)
export const Search = (p: P) => (
  <Line {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Line>
)
export const ArrowUpRight = (p: P) => (
  <Line {...p}>
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </Line>
)
/** QR kod (Lucide „qr-code“) — QR kod stiha (components/VerseQr.tsx) */
export const QrIcon = (p: P) => (
  <Line {...p}>
    <rect width="5" height="5" x="3" y="3" rx="1" />
    <rect width="5" height="5" x="16" y="3" rx="1" />
    <rect width="5" height="5" x="3" y="16" rx="1" />
    <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
    <path d="M21 21v.01" />
    <path d="M12 7v3a2 2 0 0 1-2 2H7" />
    <path d="M3 12h.01" />
    <path d="M12 3h.01" />
    <path d="M12 16v.01" />
    <path d="M16 12h1" />
    <path d="M21 12v.01" />
    <path d="M12 21v-1" />
  </Line>
)

/** YouTube znak — crveno dugme, bijeli trougao (zvanični oblik) */
export function YouTubeLogo({ width = 28, className, style }: { width?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg width={width} height={Math.round(width * 0.7)} viewBox="0 3.4 24 17.2" className={className} style={style} aria-hidden>
      <path
        fill="#FF0033"
        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
      />
      <path fill="#fff" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}
