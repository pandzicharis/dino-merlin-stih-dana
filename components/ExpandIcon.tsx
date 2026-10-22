import type { CSSProperties } from 'react'

/**
 * Raširi ⇄ skupi u jednoj ikonici: svaka strelica se okrene oko svoje sredine
 * (SavedFull `data-flip`) i iz "raširi" postane "skupi". Bez pretapanja dvije
 * ikonice — ništa ne nestane na trenutak, pa ništa ne trepne.
 */
export function ExpandMorph({ size = 15, layer }: { size?: number; layer?: CSSProperties }) {
  const arrow = (d: string, origin: string) => (
    <span data-flip className="absolute inset-0" style={{ ...layer, transformOrigin: origin }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </span>
  )
  return (
    <span className="relative block" style={{ width: size, height: size }}>
      {/* sredina strelice: x 13–20 / 4–11, y 4–11 / 13–20 (od 24) */}
      {arrow('M14 4h6v6M20 4l-7 7', '68.75% 31.25%')}
      {arrow('M10 20H4v-6M4 20l7-7', '31.25% 68.75%')}
    </span>
  )
}
