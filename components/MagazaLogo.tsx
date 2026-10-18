import type { CSSProperties } from 'react'
import { MAGAZA_RATIO } from '@/lib/brand'

/**
 * Znak izdavača (Magaza). SVG je crn, pa se boji kroz CSS masku — ista
 * datoteka radi na tamnoj i svijetloj podlozi, u bilo kojoj boji.
 */
export function MagazaLogo({
  height = 14,
  color = 'currentColor',
  className,
  style,
}: {
  height?: number
  color?: string
  className?: string
  style?: CSSProperties
}) {
  const mask = 'url(/brand/magaza.svg?v=2) center / contain no-repeat'
  return (
    <span
      role="img"
      aria-label="Magaza"
      className={`inline-block ${className ?? ''}`}
      style={{
        height,
        width: Math.round(height * MAGAZA_RATIO),
        background: color,
        mask,
        WebkitMask: mask,
        ...style,
      }}
    />
  )
}
