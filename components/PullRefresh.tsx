'use client'

import { useEffect, useRef } from 'react'

/** koliko kružić siđe (px) da se osvježi — prst ide duplo toliko */
const PULL = 72

/**
 * Povuci za osvježavanje — u instaliranoj aplikaciji (iPhone je tamo nema sam;
 * u Safariju radi sistemski). Stranica stoji (bez odskakanja — sadržaj se ne
 * pomjera), a odozgo za prstom siđe kružić: dovoljno nisko i pusti → nova
 * verzija ako čeka, pa učitavanje iznova. Samo pasivni slušači i jedan sloj —
 * ne smeta skrolu.
 */
export function PullRefresh() {
  const icon = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
    if (!standalone) return
    // stranica ne odskače pod prstom — povlačenje vodi samo kružić
    const roots = [document.documentElement, document.body]
    for (const r of roots) r.style.overscrollBehaviorY = 'none'
    let from: { x: number; y: number } | null = null
    let armed = false
    let busy = false
    const blocked = () => 'sheet' in document.documentElement.dataset || Boolean(document.querySelector('[role="dialog"][aria-modal="true"], [data-cover]'))
    const paint = (pull: number, settle = false) => {
      const el = icon.current
      if (!el || busy) return
      const p = Math.min(1, pull / PULL)
      el.style.transition = settle ? 'transform 0.25s ease, opacity 0.25s ease' : 'none'
      el.style.opacity = String(p)
      el.style.transform = `translate(-50%, ${(pull - PULL).toFixed(1)}px) rotate(${Math.round(p * 270)}deg)`
      armed = p >= 1
    }
    const refresh = async () => {
      busy = true
      icon.current?.firstElementChild?.classList.add('animate-spin')
      try {
        const reg = await navigator.serviceWorker?.getRegistration()
        await reg?.update()
        const sw = reg?.installing
        if (sw)
          await new Promise((r) => {
            sw.addEventListener('statechange', () => sw.state !== 'installing' && r(null))
            window.setTimeout(r, 4000)
          })
        // nova verzija čeka — preuzme odmah, pa se stranica učita s njom
        const waiting = reg?.waiting
        if (waiting) {
          const took = new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }))
          waiting.postMessage({ type: 'SKIP_WAITING' })
          await Promise.race([took, new Promise((r) => window.setTimeout(r, 1500))])
        }
      } catch {
        /* bez mreže — samo učitaj iznova */
      }
      window.location.reload()
    }
    const start = (e: TouchEvent) => {
      // samo s vrha stranice, jednim prstom, ne iz prozora ni s dugmadi koja se vuku
      const t = e.touches[0]
      from = !busy && e.touches.length === 1 && window.scrollY <= 0 && !blocked() && !(e.target as Element).closest?.('[data-nodrag], input, textarea') ? { x: t.clientX, y: t.clientY } : null
    }
    const move = (e: TouchEvent) => {
      if (!from) return
      const t = e.touches[0]
      const dy = t.clientY - from.y
      // u stranu (karte, plejer) — to nije povlačenje
      if (Math.abs(t.clientX - from.x) > Math.max(12, dy)) {
        from = null
        return paint(0, true)
      }
      // otpor: kružić ide upola sporije od prsta, a preko granice još sporije
      const pull = Math.max(0, dy) / 2
      paint(pull > PULL ? PULL + (pull - PULL) / 3 : pull)
    }
    const end = () => {
      if (!from) return
      from = null
      if (armed && !busy) {
        paint(PULL, true)
        void refresh()
      } else paint(0, true)
    }
    window.addEventListener('touchstart', start, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', end, { passive: true })
    window.addEventListener('touchcancel', end, { passive: true })
    return () => {
      for (const r of roots) r.style.overscrollBehaviorY = ''
      window.removeEventListener('touchstart', start)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
      window.removeEventListener('touchcancel', end)
    }
  }, [])
  return (
    <div
      ref={icon}
      aria-hidden
      className="pointer-events-none fixed left-1/2 z-[5] flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/80 shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
      style={{ top: 'calc(var(--sat) + 28px)', opacity: 0, transform: `translate(-50%, ${-PULL}px)` }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 4v5h-5" />
      </svg>
    </div>
  )
}
