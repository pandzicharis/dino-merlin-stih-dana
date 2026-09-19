'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  PUSH_EVENT,
  getSubscription,
  needsInstallFirst,
  pushSupported,
  registerSW,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push-client'

type State = 'checking' | 'off' | 'on' | 'denied' | 'install' | 'unsupported' | 'busy'

const SEND_HOUR = 20

/** Čita stvarno stanje dozvole i pretplate. Izvan komponente da render ostane čist. */
async function resolveState(): Promise<State> {
  if (!pushSupported()) return 'unsupported'
  if (needsInstallFirst()) return 'install'
  if (Notification.permission === 'denied') return 'denied'
  return (await getSubscription()) ? 'on' : 'off'
}

const HINTS: Partial<Record<State, string>> = {
  denied: 'Obavijesti su blokirane u postavkama browsera',
  install: 'Dodaj aplikaciju na početni ekran da bi obavijesti radile',
}

/**
 * Uključivanje i isključivanje dnevne obavijesti, jednim dodirom.
 *
 * Na iPhoneu Web Push radi isključivo iz instaliranog PWA-a, pa se tamo
 * umjesto dozvole prikazuje uputa.
 */
export function NotifyToggle({ accent }: { accent: string }) {
  const [state, setState] = useState<State>('checking')
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    registerSW()
    let alive = true
    const sync = () => {
      void resolveState().then((next) => {
        if (alive) setState(next)
      })
    }
    sync()
    window.addEventListener(PUSH_EVENT, sync)
    return () => {
      alive = false
      window.removeEventListener(PUSH_EVENT, sync)
    }
  }, [])

  const showHint = (text: string) => {
    setHint(text)
    setTimeout(() => setHint(null), 3400)
  }

  const onClick = async () => {
    if (state === 'busy' || state === 'checking') return
    if (HINTS[state]) return showHint(HINTS[state]!)

    setState('busy')
    if (state === 'on') {
      await unsubscribeFromPush()
      setState('off')
      showHint('Obavijesti isključene')
      return
    }

    const r = await subscribeToPush(SEND_HOUR)
    if (r === 'ok') {
      setState('on')
      showHint('Stih ti stiže svaki dan u 20:00')
      navigator.vibrate?.([8, 40, 8])
    } else if (r === 'denied') {
      setState('denied')
      showHint(HINTS.denied!)
    } else {
      setState('off')
      showHint('Nije uspjelo — pokušaj ponovo')
    }
  }

  if (state === 'unsupported' || state === 'checking') return null

  const on = state === 'on'

  return (
    <div className="relative flex flex-col items-center">
      <button
        onClick={onClick}
        aria-pressed={on}
        aria-label={on ? 'Isključi dnevnu obavijest' : 'Uključi dnevnu obavijest'}
        disabled={state === 'busy'}
        className="group flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] transition-colors duration-300"
        style={{ color: on ? accent : 'rgba(255,255,255,0.28)' }}
      >
        <motion.span
          className="relative flex h-4 w-4 items-center justify-center"
          animate={on ? { rotate: [0, -12, 10, -6, 0] } : { rotate: 0 }}
          transition={{ duration: 0.75, ease: 'easeInOut' }}
        >
          {/* val koji se širi kad su obavijesti uključene */}
          {on && (
            <motion.span
              className="absolute inset-0 rounded-full border"
              style={{ borderColor: accent }}
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{ scale: 2.1, opacity: 0 }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
              aria-hidden
            />
          )}
          <Bell on={on} muted={state === 'denied'} />
        </motion.span>
        <span className="transition-opacity group-hover:opacity-80">Obavijesti</span>
      </button>

      <AnimatePresence>
        {hint && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute -bottom-7 w-[min(78vw,20rem)] text-center text-[10px] leading-relaxed text-white/45"
          >
            {hint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

function Bell({ on, muted }: { on: boolean; muted: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={on ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="relative"
      aria-hidden
    >
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
      {muted && <path d="M3 3l18 18" strokeWidth="1.5" />}
    </svg>
  )
}
