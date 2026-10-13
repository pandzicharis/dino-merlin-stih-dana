'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useFavorites, useMounted } from '@/lib/client-store'
import { toggleFavorite } from '@/lib/storage'

/**
 * Sačuvaj stih — dugme s tekstom ispod pjesme. Bez logina: lista živi u
 * localStorage-u. Na dodir mali "otkucaj" srca i haptika.
 *
 * Do hidratacije se ne zna je li stih sačuvan, pa dugme stoji tiho u
 * "Sačuvaj" obliku iste širine — ekran ne poskakuje.
 */
export function FavoriteButton({ id, accent }: { id: string; accent: string }) {
  const mounted = useMounted()
  const saved = useFavorites().includes(id)
  const on = mounted && saved

  return (
    <motion.button
      onClick={() => {
        const now = toggleFavorite(id)
        navigator.vibrate?.(now ? [10, 40, 10] : 6)
      }}
      aria-pressed={on}
      className="relative flex h-9 min-w-[9.5rem] items-center justify-center gap-2 rounded-full border px-4 text-[10px] font-medium uppercase tracking-[0.22em] backdrop-blur-sm transition-colors duration-300"
      style={{
        color: on ? accent : 'rgba(255,255,255,0.6)',
        borderColor: on ? `${accent}66` : 'rgba(255,255,255,0.14)',
        background: on ? `${accent}14` : 'rgba(255,255,255,0.03)',
      }}
      // isti "zoom" kao naziv pjesme i YouTube znak
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 460, damping: 20 }}
    >
      <span className="relative flex">
        <motion.svg
          key={String(on)}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={on ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          initial={on ? { scale: 0.5 } : false}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 14 }}
          aria-hidden
        >
          <path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z" />
        </motion.svg>
        {/* prsten koji se raširi kad se stih sačuva */}
        <AnimatePresence>
          {on && (
            <motion.span
              key="ring"
              className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 rounded-full border"
              style={{ borderColor: accent }}
              initial={{ scale: 0.6, opacity: 0.7 }}
              animate={{ scale: 2.4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              aria-hidden
            />
          )}
        </AnimatePresence>
      </span>
      {on ? 'Sačuvano' : 'Sačuvaj stih'}
    </motion.button>
  )
}
