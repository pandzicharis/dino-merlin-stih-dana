import type { CSSProperties } from 'react'
import { MAGAZA_RATIO } from '@/lib/brand'
import { MAGAZA_PATH } from '@/lib/magaza-path'

/**
 * Znak izdavača (Magaza), nacrtan iz putanje u kodu — stoji od prvog
 * kadra, bez zahtjeva prema mreži. Boja je `color` (i `currentColor`).
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
  return (
    <svg
      role="img"
      aria-label="Magaza"
      viewBox="0 0 316 67"
      className={`inline-block shrink-0 ${className ?? ''}`}
      style={{ height, width: Math.round(height * MAGAZA_RATIO), ...style }}
    >
      <path d={MAGAZA_PATH} fill={color} fillRule="evenodd" clipRule="evenodd" />
    </svg>
  )
}
