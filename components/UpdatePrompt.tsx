'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { registerSW } from '@/lib/push-client'

/** Koliko često se traži nova verzija dok aplikacija stoji otvorena. */
const CHECK_EVERY = 30 * 60 * 1000

/**
 * Ponuda za prelazak na novu verziju.
 *
 * Instalirana aplikacija se ne "reloada" kao stranica — korisnik je otvori s
 * početnog ekrana i ona tu stoji danima, na staroj verziji. Service worker
 * novu verziju drži u čekanju (vidi `public/sw.js`), a ovdje se to pretvara
 * u jedno dugme: preuzmi kad tebi odgovara.
 */
export function UpdatePrompt({ accent }: { accent: string }) {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    let alive = true
    let reloading = false
    let timer: ReturnType<typeof setInterval> | undefined

    // Nova verzija preuzima tek kad je korisnik potvrdi, pa je ovo jedino
    // mjesto gdje se stranica sama osvježava.
    const onController = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onController)

    const watch = (reg: ServiceWorkerRegistration) => {
      if (!alive) return

      // `controller` postoji samo ako već radi neka verzija — bez toga je ovo
      // prva instalacija, a ne nadogradnja, i ne treba ništa nuditi.
      const offer = (sw: ServiceWorker | null) => {
        if (alive && sw && navigator.serviceWorker.controller) setWaiting(sw)
      }

      offer(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing
        if (!sw) return
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed') offer(sw)
        })
      })

      const check = () => void reg.update().catch(() => {})
      const onVisible = () => {
        if (!document.hidden) check()
      }
      document.addEventListener('visibilitychange', onVisible)
      timer = setInterval(check, CHECK_EVERY)
      check()
    }

    void registerSW().then((reg) => {
      if (reg) watch(reg)
    })

    return () => {
      alive = false
      if (timer) clearInterval(timer)
      navigator.serviceWorker.removeEventListener('controllerchange', onController)
    }
  }, [])

  const apply = useCallback(() => {
    if (!waiting) return
    setBusy(true)
    waiting.postMessage({ type: 'SKIP_WAITING' })
    // Ako `controllerchange` iz nekog razloga ne stigne, ne ostavljaj
    // korisnika da gleda "Trenutak…" dovijeka.
    setTimeout(() => window.location.reload(), 3000)
  }, [waiting])

  return (
    <AnimatePresence>
      {waiting && (
        <motion.div
          className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', damping: 26, stiffness: 240 }}
        >
          <button
            onClick={apply}
            disabled={busy}
            className="flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-[10px] uppercase tracking-[0.2em] backdrop-blur-xl transition-opacity active:opacity-80 disabled:opacity-60"
            style={{
              color: accent,
              borderColor: `${accent}4D`,
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}
          >
            <Arrow />
            {busy ? 'Trenutak…' : 'Nova verzija — osvježi'}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Arrow() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}
