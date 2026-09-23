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
import { SEND_HOUR, SEND_TIME } from '@/lib/date'

type State = 'checking' | 'off' | 'on' | 'denied' | 'install' | 'unsupported' | 'busy'

/** Čita stvarno stanje dozvole i pretplate. Izvan komponente da render ostane čist. */
async function resolveState(): Promise<State> {
  if (!pushSupported()) return 'unsupported'
  if (needsInstallFirst()) return 'install'
  if (Notification.permission === 'denied') return 'denied'
  return (await getSubscription()) ? 'on' : 'off'
}

const HINTS: Partial<Record<State, string>> = {
  denied: 'Obavijesti su blokirane u postavkama telefona',
  install: 'Dodaj aplikaciju na početni ekran da bi obavijesti radile',
}

const ARIA: Record<Exclude<State, 'unsupported' | 'checking'>, string> = {
  on: `Obavijesti uključene, stih stiže u ${SEND_TIME}. Isključi.`,
  off: 'Uključi dnevnu obavijest',
  busy: 'Trenutak…',
  denied: 'Obavijesti su blokirane u postavkama telefona',
  install: 'Obavijesti rade tek kad je aplikacija na početnom ekranu',
}

/**
 * Natpis mora sam reći u kojem je stanju — ikona to ne stigne.
 * Uključeno nosi vrijeme (to je cijela poruka), ostalo kaže zašto ne radi.
 */
const LABEL: Record<Exclude<State, 'unsupported' | 'checking'>, string> = {
  on: SEND_TIME,
  off: 'Isključeno',
  busy: 'Trenutak…',
  denied: 'Blokirano',
  install: 'Nakon instalacije',
}

/**
 * Dnevna obavijest — stoji u zaglavlju, uz dijeljenje.
 *
 * Uključeno stanje se ne nagađa iz ikone: zvono se ispuni bojom naglaska,
 * dobije okvir, tihi val i ispisano vrijeme dolaska stiha. Isključeno je
 * gola kontura u istoj težini kao ikona dijeljenja.
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
      showHint(`Gotovo — stih ti stiže svaki dan u ${SEND_TIME}`)
      navigator.vibrate?.([8, 40, 8])
    } else if (r === 'denied') {
      setState('denied')
      showHint(HINTS.denied!)
    } else {
      // Ne pretpostavljaj 'off' — pretplata je možda prošla a prijava pala.
      setState(await resolveState())
      showHint('Nije uspjelo — pokušaj ponovo')
    }
  }

  if (state === 'unsupported' || state === 'checking') return null

  const on = state === 'on'
  const muted = state === 'denied' || state === 'install'

  return (
    <div className="relative">
      <motion.button
        onClick={onClick}
        aria-pressed={on}
        aria-label={ARIA[state as keyof typeof ARIA]}
        disabled={state === 'busy'}
        layout
        className="flex items-center gap-1.5 rounded-full border py-[0.3rem] pl-[0.4rem] pr-[0.6rem] text-[10px] uppercase tracking-[0.16em] transition-colors duration-500"
        style={{
          color: on ? accent : muted ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.45)',
          borderColor: on ? `${accent}4D` : 'rgba(255,255,255,0.12)',
          backgroundColor: on ? `${accent}12` : 'rgba(255,255,255,0.03)',
        }}
      >
        <span className="relative flex h-[18px] w-[18px] items-center justify-center">
          {/* val — jedini znak na ekranu koji stalno kuca */}
          {on && (
            <motion.span
              className="absolute inset-0 rounded-full border"
              style={{ borderColor: accent }}
              initial={{ scale: 0.75, opacity: 0.45 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
              aria-hidden
            />
          )}
          <Bell on={on} muted={state === 'denied'} />
        </span>

        {/* Stanje je ispisano uvijek — ne nagađa se iz boje zvona. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={state}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={`whitespace-nowrap ${on ? 'tabular font-semibold' : 'font-medium'}`}
          >
            {LABEL[state as keyof typeof LABEL]}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {hint && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-full mt-2 w-[min(70vw,16rem)] text-right text-[10px] leading-relaxed text-white/45"
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
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={on ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
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
