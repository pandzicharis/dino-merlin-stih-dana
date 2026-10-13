'use client'

import { useStreak } from '@/lib/client-store'

/**
 * Jedan tihi red ispod potpisa: niz dana. (Broj sačuvanih je na srcu gore.)
 *
 * Red je uvijek u DOM-u i drži visinu — na serveru i u prvom frejmu ne zna
 * se ni niz ni favoriti (localStorage), pa bi se inače ekran pomjerio kad
 * se pojave.
 */
export function RitualLine({ accent }: { accent: string }) {
  const streak = useStreak()

  const showStreak = streak >= 2

  return (
    <p
      className="tabular relative z-10 flex h-4 items-center justify-center gap-3 text-[10px] uppercase tracking-[0.22em] text-white/35 transition-opacity duration-700"
      style={{ opacity: showStreak ? 1 : 0 }}
    >
      {showStreak && (
        <span>
          <span style={{ color: accent }}>{streak}</span> {daysWord(streak)} zaredom
        </span>
      )}
    </p>
  )
}

/** 2 dana, 5 dana, 21 dan, 22 dana */
function daysWord(n: number) {
  return n % 10 === 1 && n % 100 !== 11 ? 'dan' : 'dana'
}
