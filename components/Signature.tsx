'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { Wordmark } from './Wordmark'

/**
 * Rukom pisani potpis.
 *
 * Kad se učita, otkriva se slijeva nadesno — kao da se potpisuje.
 * (Pravo crtanje poteza tražilo bi vektorizaciju rukopisa; brisanje
 * `clip-path`-om daje isti utisak, a radi svuda i ne košta ništa.)
 *
 * Visina je fiksna, širina se prilagođava — tako zaglavlje ima istu visinu
 * i prije nego se slika učita, pa nema pomjeranja sadržaja. Na `onLoad` se
 * ne može osloniti za sam prikaz: slika iz keša bude gotova prije nego
 * React zakači handler.
 *
 * Fajl se pravi sa: npm run brand:signature
 */
export function Signature({
  height = 44,
  className,
  delay = 0,
  duration = 1.3,
}: {
  height?: number
  className?: string
  delay?: number
  duration?: number
}) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="flex items-center" style={{ height }}>
      {failed ? (
        <Wordmark width={Math.round(height * 1.7)} className={className} />
      ) : (
        <motion.div
          initial={{ clipPath: 'inset(0 100% 0 0)' }}
          animate={{ clipPath: 'inset(0 0% 0 0)' }}
          transition={{ duration, delay, ease: [0.33, 0, 0.2, 1] }}
          style={{ height }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/signature.webp"
            alt="Dino Merlin"
            className={className}
            onError={() => setFailed(true)}
            style={{ height, width: 'auto' }}
          />
        </motion.div>
      )}
    </div>
  )
}
