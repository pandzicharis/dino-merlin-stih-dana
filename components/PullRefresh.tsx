'use client'

import { useEffect, useRef } from 'react'

/** koliko stranica mora odskočiti (px) da se osvježi */
const PULL = 80

/**
 * Povuci za osvježavanje — u instaliranoj aplikaciji (iPhone je tamo nema sam;
 * u Safariju radi sistemski). Stranica odskoči pod prstom (scrollY ide u
 * minus): dovoljno nisko i pusti → nova verzija ako čeka, pa učitavanje iznova.
 * Samo pasivni slušači i jedan sloj — ne smeta skrolu.
 */
export function PullRefresh() {
  const icon = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
    if (!standalone) return
    let down = false
    let armed = false
    let busy = false
    const blocked = () => 'sheet' in document.documentElement.dataset || Boolean(document.querySelector('[role="dialog"][aria-modal="true"], [data-cover]'))
    const paint = () => {
      const el = icon.current
      if (!el || busy) return
      const p = Math.min(1, Math.max(0, -window.scrollY / PULL))
      el.style.opacity = String(p)
      el.style.transform = `translateX(-50%) rotate(${Math.round(p * 270)}deg) scale(${(0.6 + p * 0.4).toFixed(3)})`
      armed = down && p >= 1 && !blocked()
    }
    const refresh = async () => {
      busy = true
      const el = icon.current
      if (el) {
        el.style.opacity = '1'
        el.style.transform = 'translateX(-50%)'
        el.firstElementChild?.classList.add('animate-spin')
      }
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
    const start = () => {
      down = true
    }
    const end = () => {
      down = false
      if (armed && !busy) void refresh()
    }
    window.addEventListener('scroll', paint, { passive: true })
    window.addEventListener('touchstart', start, { passive: true })
    window.addEventListener('touchend', end, { passive: true })
    window.addEventListener('touchcancel', end, { passive: true })
    return () => {
      window.removeEventListener('scroll', paint)
      window.removeEventListener('touchstart', start)
      window.removeEventListener('touchend', end)
      window.removeEventListener('touchcancel', end)
    }
  }, [])
  return (
    <div
      ref={icon}
      aria-hidden
      className="pointer-events-none fixed left-1/2 z-[5] flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80"
      style={{ top: 'calc(var(--sat) + 10px)', opacity: 0, transform: 'translateX(-50%) scale(0.6)' }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 4v5h-5" />
      </svg>
    </div>
  )
}
