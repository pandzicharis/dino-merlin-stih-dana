'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { motion, AnimatePresence, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import { MOODS, FIGURE_SRC, type Mood } from '@/data/moods'
import { ALBUMS, blurOf } from '@/data/albums'
import { msUntilNextDay } from '@/lib/date'
import { FloatingNotes } from './FloatingNotes'

/**
 * Atmosfera ekrana, u slojevima odozdo prema gore:
 *
 *   1. osnovna boja
 *   2. tri meke mrlje koje sporo plutaju
 *   3. portret — utopljen kroz mix-blend, jedva prisutan
 *   4. bloom: sjaj u boji naglaska iza stiha
 *   5. note koje plutaju uvis
 *   6. zrnatost, kod tamnijih moodova s filmskim podrhtavanjem
 *   7. vinjeta
 *
 * Animira se ISKLJUČIVO transform i opacity — sve ostalo obara framerate
 * na starijim telefonima.
 */
export function MoodBackground({
  mood,
  seed,
  /** Zaustavi portret — na uvodnom ekranu tekst stoji, pa i lice treba mirovati. */
  still = false,
  /** omot albuma stiha — umjesto portreta, utopljen da se ne vidi da je kvadrat */
  cover,
  /** koliko je omot podignut (dio njegove visine) */
  coverLift = 0,
  /** fotografija umjesto portreta (uvodni ekran) — u bojama raspoloženja, utopljena */
  art,
}: {
  mood: Mood
  seed: string
  still?: boolean
  cover?: string
  coverLift?: number
  art?: string
}) {
  const m = MOODS[mood]
  const coverFill = cover ? ALBUMS.find((a) => a.cover === cover)?.fill : undefined
  // atmosfera na telefonu: omot unaprijed zamućen (blur(56px) na omotu visokom
  // 1.3 × 844 px) — bez filtera i bez dekodiranja velikog omota za nju
  const soft = blurOf(cover, 56 / (844 * 1.3))
  const sharp = cover
  const reduced = useReducedMotion()
  const dur = (base: number) => base / m.speed

  // Portret se jedva primjetno pomjera za pokazivačem — daje dubinu na
  // velikom ekranu. Na dodir uređajima se ne uključuje.
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const px = useSpring(mx, { stiffness: 38, damping: 22, mass: 0.6 })
  const py = useSpring(my, { stiffness: 38, damping: 22, mass: 0.6 })

  useEffect(() => {
    if (still || reduced || !window.matchMedia('(pointer: fine)').matches) return
    const onMove = (e: PointerEvent) => {
      mx.set((e.clientX / window.innerWidth - 0.5) * 22)
      my.set((e.clientY / window.innerHeight - 0.5) * 14)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [still, reduced, mx, my])

  // omot za skriptu u <head> — pri sljedećem otvaranju ga predučita, ali samo
  // do kraja ovog dana stiha (u podne dolazi drugi). Samo s početne — ne iz
  // prezentacije, admina ni dijeljenog stiha
  useEffect(() => {
    if (!cover || location.pathname !== '/' || 'deck' in document.documentElement.dataset) return
    try {
      localStorage.setItem('stihdana:cover', JSON.stringify({ c: sharp, x: [soft].filter(Boolean), until: Date.now() + msUntilNextDay() }))
    } catch {}
  }, [cover, sharp, soft])

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
            // Bez `filter: blur` — gradijent koji se gasi do 70% je već mekan, a
            // blur preko pola ekrana iPhone preračunava i guši. Kretanje je CSS
            // animacija (globals.css): vrti je grafički procesor, ne JavaScript.
            <div
              key={color + i}
              className="bg-blob absolute rounded-full"
              style={
                {
                  width: '85vmax',
                  height: '85vmax',
                  background: `radial-gradient(circle at center, ${color} 0%, ${color}b0 22%, ${color}38 46%, transparent 70%)`,
                  left: `${[-15, 35, 5][i]}%`,
                  top: `${[-10, 20, 55][i]}%`,
                  '--drift': `${m.drift}px`,
                  animationDuration: `${dur(20 + i * 4)}s`,
                  animationDelay: `${i * 1.5}s`,
                  animationPlayState: reduced ? 'paused' : undefined,
                } as CSSProperties
              }
            />
          ))}

          {/* 3a — album stiha, u dva sloja:
                  atmosfera — omot preko cijelog ekrana, jako zamućen: boja albuma
                  omot — jasan i krupan gore, ivice utopljene (nema kvadrata)
                  pa tama odozdo, da stih ostane čitak */}
          {cover && (
            <>
              {/* album miruje — ne prati pokazivač i ne diše, da ne odvlači od stiha */}
              {soft && (
                // telefon: ista slika, zamućenje (i saturate) već u njoj
                <div
                  className="absolute -inset-[15%] scale-110 bg-cover bg-center md:hidden"
                  style={{ backgroundImage: `url(${soft})`, opacity: 0.32 }}
                />
              )}
              {/* šire od telefona omot je veći, pa blur(56px) manje muti — tu ostaje CSS */}
              <div
                className={`absolute -inset-[15%] scale-110 bg-cover bg-center ${soft ? 'max-md:hidden' : ''}`}
                style={{
                  backgroundImage: `url(${cover})`,
                  filter: 'blur(56px) saturate(1.2)',
                  opacity: 0.32,
                }}
              />
              {/* boja iznad omota (npr. bijeli papir) — nastavi omot do vrha ekrana,
                  ispod njegovog mekog gornjeg ruba; samo na telefonu */}
              {coverFill && (
                <div
                  className="album-fill absolute inset-x-0 top-0 mx-auto w-[min(100vw,74dvh,760px)] md:hidden"
                  style={{
                    background: coverFill,
                    opacity: 0.42,
                    height: `calc(6dvh + min(100vw, 74dvh, 760px) * ${(0.3 + 0.02 - (coverLift ?? 0)).toFixed(3)})`,
                  }}
                />
              )}
              {/* podloga omota — isti omot zamućen, a iznad njega odraz (preokrenut), pa
                  se boje s gornjeg ruba nastave do vrha ekrana; ispod oštrog omota
                  popuni njegov meki rub. Kutija: 0.35 širine iznad omota + omot. */}
              <div
                className={`album-glow absolute inset-x-0 top-[calc(6dvh-min(100vw,74dvh,760px)*0.33)] mx-auto aspect-[1/1.35] w-[min(100vw,74dvh,760px)] md:top-[calc(2dvh-min(118dvh,1100px)*0.33)] md:w-[min(118dvh,1100px)]`}
                style={{ opacity: 0.3, transform: coverLift ? `translateY(-${((coverLift * 100) / 1.35).toFixed(2)}%)` : undefined }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-[25.93%]"
                  style={{ backgroundImage: `url(${sharp})`, backgroundSize: '100% auto', backgroundPosition: 'top', transform: 'scaleY(-1)' }}
                />
                <div className="absolute inset-x-0 bottom-0 h-[74.07%] bg-cover bg-center" style={{ backgroundImage: `url(${sharp})` }} />
              </div>
              {/* omot gore — na telefonu preko cijele širine, nestaje u strane i prema
                  stihu; na računaru veći i rastopljen ovalno na sve strane (globals.css).
                  Spušten za malo (0.02 — i u visini boje iznad). */}
              <div
                className="album-art absolute inset-x-0 top-[calc(6dvh+min(100vw,74dvh,760px)*0.02)] mx-auto aspect-square w-[min(100vw,74dvh,760px)] bg-cover bg-center md:top-[calc(2dvh+min(118dvh,1100px)*0.02)] md:w-[min(118dvh,1100px)]"
                style={{ backgroundImage: `url(${sharp})`, opacity: 0.42, transform: coverLift ? `translateY(-${coverLift * 100}%)` : undefined }}
              />
              {/* nijansa raspoloženja preko albuma — ekran ostaje "njegov" */}
              <div className="absolute inset-0" style={{ backgroundColor: m.gradient[1], mixBlendMode: 'color', opacity: 0.4 }} />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.12) 22%, rgba(0,0,0,0.38) 50%, rgba(0,0,0,0.7) 78%, rgba(0,0,0,0.85) 100%)',
                }}
              />
            </>
          )}

          {/* 3b — fotografija uvodnog ekrana: luminacija slike na boji
                  raspoloženja (pa je slika u njegovim bojama), utopljena na
                  rubovima i stišana prema sredini, gdje je tekst */}
          {art && !cover && <Art src={art} />}

          {/* 3 — portret: krupan, u gornjem desnom uglu, da stih u sredini
                 ostane na čistoj podlozi a lice ne bude iza teksta */}
          {!cover && !art && (
          // paralaksa za mišem (motion) je spolja, disanje (CSS) unutra —
          // dvije animacije ne smiju dijeliti isti transform
          <motion.div
            className="absolute inset-0"
            style={{ mixBlendMode: m.blend, opacity: m.figure, x: px, y: py }}
          >
            <div
              className={`absolute inset-0 bg-no-repeat ${reduced || still ? '' : 'bg-breathe'}`}
              style={{
                backgroundImage: `url(${FIGURE_SRC})`,
                animationDuration: `${dur(34)}s`,
                // visinom, ne "cover" — na širokom ekranu inače proguta sve
                backgroundSize: 'auto 118%',
                // Lice je na ~45% širine slike, a slika je široka 0.885 visine
                // ekrana (118% × 3/4). Zato se lijevi rub računa tako da lice
                // uvijek padne na 70% širine — isto na telefonu i na monitoru.
                backgroundPosition: 'calc(70vw - 40dvh) -2dvh',
                // utapa se prije nego dođe do stiha
                maskImage: 'radial-gradient(ellipse 80% 62% at 78% 22%, black 30%, transparent 80%)',
                WebkitMaskImage: 'radial-gradient(ellipse 80% 62% at 78% 22%, black 30%, transparent 80%)',
              }}
            />
          </motion.div>
          )}

          {/* 4 — sjaj iza stiha */}
          {m.bloom > 0 && (
            <div
              className={`absolute inset-0 ${reduced ? '' : 'bg-bloom'}`}
              style={
                {
                  background: `radial-gradient(ellipse 70% 40% at 50% 50%, ${m.accent} 0%, transparent 70%)`,
                  opacity: m.bloom * 0.14,
                  '--lo': m.bloom * 0.09,
                  '--hi': m.bloom * 0.17,
                  animationDuration: `${dur(11)}s`,
                } as CSSProperties
              }
            />
          )}

        </motion.div>
      </AnimatePresence>

      {/* 5b — note */}
      <FloatingNotes count={m.notes} accent={m.accent} speed={m.speed} seed={seed} />

      {/* 6 — zrnatost */}
      <div
        className={`absolute -inset-4 ${m.grain > 0.5 && !reduced ? 'bg-grain' : ''}`}
        style={{
          opacity: m.grain * 0.4,
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
        // filmsko podrhtavanje samo tamo gdje je zrno ionako izraženo
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

/** Slika se pojavi tek kad stigne — blago, bez bljeska. */
function Art({ src }: { src: string }) {
  const [on, setOn] = useState(false)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      decoding="async"
      onLoad={() => setOn(true)}
      ref={(el) => {
        // već u kešu: `load` je prošao prije Reacta
        if (el?.complete && el.naturalWidth) setOn(true)
      }}
      // raspored i utapanje: globals.css `.mood-art` (telefon / široki ekran)
      className="mood-art transition-opacity duration-[1600ms] ease-out"
      style={{ mixBlendMode: 'luminosity', opacity: on ? 0.8 : 0 }}
    />
  )
}
