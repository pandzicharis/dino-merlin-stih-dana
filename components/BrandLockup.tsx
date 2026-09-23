'use client'

import { Signature } from './Signature'

/**
 * Samo potpis.
 *
 * Ispod njega su nekad stajali linija i natpis "Stih dana"; oboje je otišlo —
 * potpis je dovoljan znak i ne treba mu ništa da ga podupire.
 */
export function BrandLockup({ height = 42, delay = 0.1 }: { height?: number; delay?: number }) {
  return (
    <div className="inline-flex flex-col items-center">
      <Signature height={height} delay={delay} duration={1.25} className="opacity-90" />
    </div>
  )
}
