'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useIsPresent, useMotionValue } from 'motion/react'

/*
 * Donji paneli (sačuvani, dijeljenje) kao na nativnoj aplikaciji:
 *   - panel izlazi odozdo cijelom visinom, bez fade-a — samo se zatamnjenje
 *     iza njega pojavi
 *   - kretnja je `transform` kao string uz bezier krivu — Motion je pusti kroz
 *     WAAPI, pa ide na grafičkom procesoru i ne zastaje dok se sadržaj slaže
 *   - dok je panel otvoren, pozadina iza zatamnjenja miruje (globals.css
 *     `html[data-sheet]`) — blur se inače računa iznova svaki kadar
 *   - teški sadržaj se slaže dva kadra poslije dodira (`AfterOpen`)
 * Na širokom ekranu panel je na sredini, pa tamo ostaje kratko klizanje uz fade.
 */

// otvaranje: kriva iOS panela — brzo krene, mekano sjedne
const OPEN = { duration: 0.5, ease: [0.32, 0.72, 0, 1] as const }
// zatvaranje: krene polako pa ubrza i ode s ekrana — bez usporavanja na dnu
// (stara kriva je zadnje piksele "puzala", pa je panel kao zastao pri dnu)
const CLOSE = { duration: 0.42, ease: [0.4, 0, 0.75, 0.35] as const }

/**
 * Povlačenje nadolje prati prst 1:1, kao na telefonu. Kad se pusti dovoljno
 * nisko, panel ne skače nazad nego nastavi dolje odatle gdje ga je prst ostavio.
 * Pri sljedećem otvaranju povlačenje kreće od nule — inače bi se panel
 * otvorio tamo gdje ga je prst zadnji put pustio (do pola).
 */
export function useSheetDrag(onClose: () => void, open: boolean) {
  const y = useMotionValue(0)
  // spuštanje poslije povlačenja (WAAPI, ostaje dolje) — otkaže se pri otvaranju
  const fly = useRef<Animation | null>(null)
  useLayoutEffect(() => {
    if (!open) return
    fly.current?.cancel()
    fly.current = null
    y.set(0)
  }, [open, y])
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  /*
   * Povuci nadolje BILO GDJE po panelu (ne samo za zaglavlje), kao na
   * telefonu: ako je sadržaj ispod prsta skrolan, prvo se skrola do vrha;
   * tek s vrha prst vuče panel. Vodoravno (špil, albumi) ostaje njihovo.
   * Slušači su "passive: false" — samo tako se skrolanje može zaustaviti.
   */
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!el) return
    // pušten dovoljno nisko (ili brzo): panel NASTAVI dolje odatle gdje ga je
    // prst ostavio, brzinom prsta (bez vraćanja gore), dok se zatvaranje odvija;
    // pri sljedećem otvaranju pomak se vrati na nulu (gore, useLayoutEffect).
    // Kroz WAAPI na grafičkom procesoru, ne motion value iz JavaScripta — glavna
    // nit je baš tad zauzeta zatvaranjem; `fill` ga drži dolje do otvaranja
    const fling = () => {
      const from = y.get()
      fly.current?.cancel()
      fly.current = el.animate(
        [{ transform: `translateY(${from}px)` }, { transform: `translateY(${from + window.innerHeight * 0.6}px)` }],
        { duration: 420, easing: 'cubic-bezier(0.22, 0.75, 0.2, 1)', fill: 'forwards' },
      )
      closeRef.current()
    }
    let g: { x0: number; y0: number; scroller: HTMLElement | null; pull: boolean; off: boolean; last: [number, number][] } | null = null
    const scrollerOf = (t: Element | null) => {
      for (let n = t as HTMLElement | null; n && n !== el; n = n.parentElement) {
        const o = getComputedStyle(n).overflowY
        if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n
      }
      return null
    }
    const start = (e: TouchEvent) => {
      const t = e.target as Element
      if (e.touches.length > 1 || t.closest('input, textarea, select, [role="slider"], [data-nodrag]')) return (g = null)
      const p = e.touches[0]
      g = { x0: p.clientX, y0: p.clientY, scroller: scrollerOf(t), pull: false, off: false, last: [[p.clientY, e.timeStamp]] }
    }
    const move = (e: TouchEvent) => {
      if (!g || g.off) return
      const p = e.touches[0]
      const dx = p.clientX - g.x0
      const dy = p.clientY - g.y0
      if (!g.pull) {
        // vodoravno — to je špil ili albumi, panel se ne dira
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) return void (g.off = true)
        const top = !g.scroller || g.scroller.scrollTop <= 0
        // gore, ili sadržaj nije na vrhu — normalno skrolanje
        if (dy < 0 || !top) return void (dy < -4 || !top ? (g.off = true) : null)
        // nadolje s vrha: skrolanje se zaustavi odmah, panel krene poslije praga
        if (e.cancelable) e.preventDefault()
        if (dy < 8) return
        g.pull = true
        g.y0 = p.clientY
      }
      if (e.cancelable) e.preventDefault()
      y.set(Math.max(0, p.clientY - g.y0))
      g.last = [...g.last.slice(-3), [p.clientY, e.timeStamp]]
    }
    const end = () => {
      const s = g
      g = null
      if (!s?.pull) return
      const [a0, b0] = s.last[0]
      const [a1, b1] = s.last[s.last.length - 1]
      const v = b1 > b0 ? ((a1 - a0) / (b1 - b0)) * 1000 : 0
      // dovoljno nisko ili brzo — zatvori odatle gdje ga je prst ostavio
      if (y.get() > 90 || v > 600) return fling()
      void animate(y, 0, { duration: 0.3, ease: [0.32, 0.72, 0, 1] })
    }
    // hvatanje (capture): i kad dijete zaustavi događaj (prekidači, dugmad)
    el.addEventListener('touchstart', start, { passive: true, capture: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)

    // i mišem (računar): pritisni bilo gdje i povuci nadolje — isto pravilo
    let m: { y0: number; x0: number; scroller: HTMLElement | null; pull: boolean; last: [number, number][] } | null = null
    let pulled = false
    const mDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      const t = e.target as Element
      // i s dugmeta/pjesme (kao prstom) — povlačenje onda nije klik (noClick)
      if (t.closest('input, textarea, select, [role="slider"], [data-nodrag]')) return
      m = { y0: e.clientY, x0: e.clientX, scroller: scrollerOf(t), pull: false, last: [[e.clientY, e.timeStamp]] }
    }
    const mMove = (e: PointerEvent) => {
      if (!m) return
      const dy = e.clientY - m.y0
      const dx = e.clientX - m.x0
      if (!m.pull) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) return void (m = null)
        if (dy < 8) return
        if (m.scroller && m.scroller.scrollTop > 0) return void (m = null)
        m.pull = true
        m.y0 = e.clientY
      }
      e.preventDefault()
      y.set(Math.max(0, e.clientY - m.y0))
      m.last = [...m.last.slice(-3), [e.clientY, e.timeStamp]]
    }
    const mUp = () => {
      const s = m
      m = null
      if (!s?.pull) return
      pulled = true
      window.setTimeout(() => (pulled = false), 0)
      const [a0, b0] = s.last[0]
      const [a1, b1] = s.last[s.last.length - 1]
      const v = b1 > b0 ? ((a1 - a0) / (b1 - b0)) * 1000 : 0
      if (y.get() > 90 || v > 600) return fling()
      void animate(y, 0, { duration: 0.3, ease: [0.32, 0.72, 0, 1] })
    }
    // povlačenje mišem nije klik (na kartu, pjesmu)
    const noClick = (e: MouseEvent) => {
      if (!pulled) return
      e.stopPropagation()
      e.preventDefault()
    }
    el.addEventListener('pointerdown', mDown, true)
    // link ili slika se ne "vuku" (prevlačenje preglednika bi progutalo povlačenje panela)
    const noNativeDrag = (e: DragEvent) => e.preventDefault()
    el.addEventListener('dragstart', noNativeDrag, true)
    window.addEventListener('pointermove', mMove)
    window.addEventListener('pointerup', mUp)
    el.addEventListener('click', noClick, true)
    return () => {
      el.removeEventListener('touchstart', start, true)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
      el.removeEventListener('pointerdown', mDown, true)
      el.removeEventListener('dragstart', noNativeDrag, true)
      window.removeEventListener('pointermove', mMove)
      window.removeEventListener('pointerup', mUp)
      el.removeEventListener('click', noClick, true)
    }
  }, [el, y])

  // jedan način povlačenja za sve panele (prst i miš, bilo gdje) — bez
  // Motion "drag", da se dva povlačenja ne bore oko iste pozicije
  return { ref: setEl, style: { y } } as const
}

/**
 * Sloj preko ekrana. Čim se panel zatvara, dodiri prolaze do ekrana ispod —
 * ne čekaju da se kretnja smiri do kraja.
 */
export function SheetLayer({ children, className }: { children: ReactNode; className: string }) {
  const present = useIsPresent()
  return (
    <div className={className} style={{ pointerEvents: present ? undefined : 'none' }}>
      {children}
    </div>
  )
}

/** Zatamnjenje iza panela — blago, ekran ispod se vidi zamućen; pojavljuje se postepeno. */
export function SheetBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <motion.button
      aria-label="Zatvori"
      className="absolute inset-0 bg-black/25 backdrop-blur-md backdrop-saturate-150"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, transition: CLOSE }}
    />
  )
}

/**
 * Panel: na telefonu odozdo cijelom visinom, na širokom ekranu 48px uz fade.
 * `away`: panel ostaje montiran, sklonjen ispod ekrana (plejer pjesama) —
 * otvaranje je samo kretnja, bez ponovnog slaganja sadržaja.
 */
/** podizanje iz mini plejera — sporije i mekše, panel "izraste" iz njega */
const RISE = { duration: 0.72, ease: [0.22, 1, 0.36, 1] as const }

export function SheetSlide({ children, away = false, rise = false }: { children: ReactNode; away?: boolean; rise?: boolean }) {
  const [wide] = useState(() => window.matchMedia('(min-width: 640px)').matches)
  const hidden = wide ? { transform: 'translateY(48px)', opacity: 0 } : { transform: 'translateY(100%)' }
  const shown = wide ? { transform: 'translateY(0px)', opacity: 1 } : { transform: 'translateY(0%)' }
  return (
    <motion.div
      className="relative flex w-full max-w-[440px] justify-center"
      style={{ willChange: 'transform' }}
      // `away`: panel stalno montiran, sklonjen ispod ekrana — kad sjedne
      // dolje, ne crta se (visibility), a otvara se bez ikakvog slaganja
      variants={{
        hidden: { ...hidden, transition: CLOSE, ...(away ? { transitionEnd: { visibility: 'hidden' } } : {}) },
        shown: { ...shown, visibility: 'visible', transition: rise ? RISE : OPEN },
      }}
      initial={away ? { ...hidden, visibility: 'hidden' } : 'hidden'}
      animate={away ? 'hidden' : 'shown'}
      exit="hidden"
    >
      {children}
      {/* ispod panela je crno — i kad ga opruga ili prst malo podignu, ne vidi se
          stranica (panel nema donji rub, ide do dna ekrana) */}
      {!wide && <span aria-hidden className="pointer-events-none absolute inset-x-0 top-full h-[40vh] bg-[#0a0909]" />}
    </motion.div>
  )
}

/** Sadržaj tek dva kadra poslije otvaranja — klizanje krene odmah. */
export function AfterOpen({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let b = 0
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setOn(true))
    })
    return () => {
      cancelAnimationFrame(a)
      cancelAnimationFrame(b)
    }
  }, [])
  return <>{on ? children : fallback}</>
}

/** Dok je panel otvoren, pozadina iza zatamnjenja miruje (vidi globals.css). */
export function useSheetOpen(open: boolean) {
  useEffect(() => {
    if (!open) return
    const d = document.documentElement
    d.dataset.sheet = ''
    return () => {
      // tek kad se panel spusti do kraja (CLOSE) — inače bi se pozadina
      // pokrenula dok je zamućenje još preko nje i blur bi se računao svaki kadar
      window.setTimeout(() => {
        if (!d.querySelector('[role="dialog"][aria-modal="true"]')) delete d.dataset.sheet
      }, CLOSE.duration * 1000 + 50)
    }
  }, [open])
}
