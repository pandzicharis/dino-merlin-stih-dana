'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import { MOODS, FIGURE_SRC, type Mood } from '@/data/moods'
import { FloatingNotes } from './FloatingNotes'

/**
 * Atmosfera ekrana, u slojevima odozdo prema gore:
 *
 *   1. osnovna boja
 *   2. tri zamućene mrlje koje sporo plutaju
 *   3. portret — utopljen kroz mix-blend, jedva prisutan
 *   4. bloom: sjaj u boji naglaska iza stiha
 *   5. sweep: spori dijagonalni prelaz svjetla (samo neki moodovi)
 *   5b. note koje plutaju uvis
 *   6. zrnatost, kod tamnijih moodova s filmskim podrhtavanjem
 *   7. vinjeta
 *
 * Animira se ISKLJUČIVO transform i opacity — sve ostalo obara framerate
 * na starijim telefonima.
 */
export function MoodBackground({ mood, seed }: { mood: Mood; seed: string }) {
  const m = MOODS[mood]
  const reduced = useReducedMotion()
  const dur = (base: number) => base / m.speed

  // Portret se jedva primjetno pomjera za pokazivačem — daje dubinu na
  // velikom ekranu. Na dodir uređajima se ne uključuje.
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const px = useSpring(mx, { stiffness: 38, damping: 22, mass: 0.6 })
  const py = useSpring(my, { stiffness: 38, damping: 22, mass: 0.6 })

  useEffect(() => {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return
    const onMove = (e: PointerEvent) => {
      mx.set((e.clientX / window.innerWidth - 0.5) * 22)
      my.set((e.clientY / window.innerHeight - 0.5) * 14)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [reduced, mx, my])

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <AnimatePresence mode="sync">
        <motion.div
          key={mood}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          className="absolute inset-0"
          style={{ backgroundColor: m.gradient[0] }}
        >
          {/* 2 — mrlje */}
          {m.gradient.map((color, i) => (
            <motion.div
              key={color + i}
              className="absolute rounded-full"
              style={{
                width: '85vmax',
                height: '85vmax',
                background: `radial-gradient(circle at center, ${color} 0%, transparent 68%)`,
                filter: 'blur(60px)',
                left: `${[-15, 35, 5][i]}%`,
                top: `${[-10, 20, 55][i]}%`,
                willChange: 'transform',
              }}
              animate={
                reduced
                  ? undefined
                  : {
                      x: [0, m.drift, -m.drift * 0.6, 0],
                      y: [0, -m.drift * 0.75, m.drift * 0.6, 0],
                      scale: [1, 1.12, 0.94, 1],
                    }
              }
              transition={{
                duration: dur(20 + i * 4),
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 1.5,
              }}
            />
          ))}

          {/* 3 — portret */}
          <motion.div
            className="absolute inset-0 bg-no-repeat"
            style={{
              backgroundImage: `url(${FIGURE_SRC})`,
              // visinom, ne "cover" — na širokom ekranu inače proguta sve
              backgroundSize: 'auto 95%',
              backgroundPosition: m.focus,
              mixBlendMode: m.blend,
              opacity: m.figure,
              x: px,
              y: py,
              // utapa se prije nego dođe do stiha
              maskImage: 'radial-gradient(ellipse 72% 60% at 50% 26%, black 30%, transparent 82%)',
              WebkitMaskImage: 'radial-gradient(ellipse 72% 60% at 50% 26%, black 30%, transparent 82%)',
              willChange: 'transform',
            }}
            animate={reduced ? undefined : { scale: [1, 1.045, 1] }}
            transition={{ duration: dur(34), repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* 4 — sjaj iza stiha */}
          {m.bloom > 0 && (
            <motion.div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse 70% 40% at 50% 50%, ${m.accent} 0%, transparent 70%)`,
                opacity: m.bloom * 0.14,
                willChange: 'opacity',
              }}
              animate={reduced ? undefined : { opacity: [m.bloom * 0.09, m.bloom * 0.17, m.bloom * 0.09] }}
              transition={{ duration: dur(11), repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          {/* 5 — prelaz svjetla
                 Širok, jako zamućen i linearan: ulazi i izlazi kroz opacity,
                 pa nema trzaja na rubovima ekrana. Prije je bio uzak i brz
                 i čitao se kao efekat, a ne kao svjetlo. */}
          {m.sweep && !reduced && (
            <motion.div
              className="absolute -inset-y-1/3 w-[90%]"
              style={{
                background: `linear-gradient(105deg, transparent 0%, ${m.accent}0d 36%, ${m.accent}1a 50%, ${m.accent}0d 64%, transparent 100%)`,
                filter: 'blur(90px)',
                willChange: 'transform, opacity',
              }}
              initial={{ opacity: 0 }}
              animate={{ x: ['-100vw', '160vw'], opacity: [0, 1, 1, 0] }}
              transition={{
                x: { duration: dur(38), repeat: Infinity, repeatDelay: 12, ease: 'linear' },
                opacity: {
                  duration: dur(38),
                  repeat: Infinity,
                  repeatDelay: 12,
                  ease: 'linear',
                  times: [0, 0.28, 0.72, 1],
                },
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* 5b — note */}
      <FloatingNotes count={m.notes} accent={m.accent} speed={m.speed} seed={seed} />

      {/* 6 — zrnatost */}
      <motion.div
        className="absolute -inset-4"
        style={{
          opacity: m.grain * 0.4,
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          willChange: m.grain > 0.5 ? 'transform' : undefined,
        }}
        // filmsko podrhtavanje samo tamo gdje je zrno ionako izraženo
        animate={m.grain > 0.5 && !reduced ? { x: [0, -7, 5, -3, 7, 0], y: [0, 5, -7, 3, -5, 0] } : undefined}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
      />

      {/* 7 — vinjeta */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,${m.vignette}) 100%)`,
        }}
      />
    </div>
  )
}
