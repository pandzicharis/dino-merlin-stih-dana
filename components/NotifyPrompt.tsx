'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  getSubscription,
  needsInstallFirst,
  pushSupported,
  registerSW,
  subscribeToPush,
} from '@/lib/push-client'

const DISMISSED = 'stihdana:notifyDismissed'
const DELAY = 8000
const SEND_HOUR = 20

type View = 'hidden' | 'install' | 'ask' | 'ok' | 'denied'

/**
 * Uputa za iPhone, i ništa više.
 *
 * Web Push na iOS-u radi isključivo iz instaliranog PWA-a, pa zvono u
 * podnožju tamo nema šta uključiti dok aplikacija nije na početnom ekranu.
 * Sve ostale slučajeve rješava NotifyToggle.
 */
export function NotifyPrompt({ accent }: { accent: string }) {
  const [view, setView] = useState<View>('hidden')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    registerSW()

    let cancelled = false
    const t = setTimeout(async () => {
      if (cancelled) return
      if (!pushSupported()) return
      if (Notification.permission === 'granted' && (await getSubscription())) return
      if (Notification.permission === 'denied') return
      try {
        if (localStorage.getItem(DISMISSED)) return
      } catch {
        /* private mode */
      }
      // Za obično uključivanje sad postoji zvono u podnožju; ovdje ostaje
      // samo iPhone slučaj, gdje zvono samo po sebi ne može pomoći.
      if (needsInstallFirst()) setView('install')
    }, DELAY)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {
      /* ignore */
    }
    setView('hidden')
  }

  const enable = async () => {
    setBusy(true)
    const r = await subscribeToPush(SEND_HOUR)
    setBusy(false)
    if (r === 'ok') {
      setView('ok')
      setTimeout(() => setView('hidden'), 2600)
    } else if (r === 'denied') {
      setView('denied')
      setTimeout(dismiss, 3000)
    } else {
      dismiss()
    }
  }

  return (
    <AnimatePresence>
      {view !== 'hidden' && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', damping: 26, stiffness: 240 }}
          className="fixed inset-x-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-sm rounded-2xl border border-white/10 bg-black/75 p-5 backdrop-blur-xl"
        >
          {view === 'ask' && (
            <>
              <p className="mb-1 font-serif text-lg text-white" style={{ fontFamily: 'var(--font-serif), serif' }}>
                Stih svaki dan u 20:00?
              </p>
              <p className="mb-4 text-[13px] leading-relaxed text-white/50">
                Jedna notifikacija dnevno. Ništa više.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={enable}
                  disabled={busy}
                  className="flex-1 rounded-full px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.12em] text-black disabled:opacity-60"
                  style={{ backgroundColor: accent }}
                >
                  {busy ? 'Trenutak…' : 'Uključi'}
                </button>
                <button
                  onClick={dismiss}
                  className="rounded-full px-4 py-2.5 text-[12px] uppercase tracking-[0.12em] text-white/40 transition-colors hover:text-white/70"
                >
                  Ne sada
                </button>
              </div>
            </>
          )}

          {view === 'install' && (
            <>
              <p className="mb-1 font-serif text-lg text-white" style={{ fontFamily: 'var(--font-serif), serif' }}>
                Dodaj na početni ekran
              </p>
              <p className="mb-4 text-[13px] leading-relaxed text-white/50">
                Da bi stih stizao svaki dan, aplikacija mora biti na početnom ekranu — na iPhoneu
                notifikacije drugačije ne rade.
              </p>
              <ol className="mb-4 flex flex-col gap-2 text-[13px] text-white/70">
                <li className="flex items-center gap-2.5">
                  <Step n={1} accent={accent} /> Dodirni <ShareGlyph /> dolje u Safariju
                </li>
                <li className="flex items-center gap-2.5">
                  <Step n={2} accent={accent} /> Odaberi „Add to Home Screen“
                </li>
                <li className="flex items-center gap-2.5">
                  <Step n={3} accent={accent} /> Otvori aplikaciju odatle
                </li>
              </ol>
              <button
                onClick={dismiss}
                className="text-[12px] uppercase tracking-[0.12em] text-white/40 transition-colors hover:text-white/70"
              >
                Razumijem
              </button>
            </>
          )}

          {view === 'ok' && (
            <p className="text-center text-[13px] text-white/70">
              Gotovo. Vidimo se sutra u 20:00.
            </p>
          )}

          {view === 'denied' && (
            <p className="text-center text-[13px] text-white/60">
              Notifikacije su blokirane u postavkama browsera.
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Step({ n, accent }: { n: number; accent: string }) {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-black"
      style={{ backgroundColor: accent }}
    >
      {n}
    </span>
  )
}

function ShareGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="inline">
      <path d="M12 3v13M12 3 8 7M12 3l4 4" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}
