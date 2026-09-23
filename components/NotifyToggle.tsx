'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ensurePermission,
  getSubscription,
  needsInstallFirst,
  permissionSnapshot,
  pushSupported,
  registerSW,
  subscribePermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push-client'
import { SEND_HOUR, SEND_TIME } from '@/lib/date'
import { useNotifyIntent } from '@/lib/client-store'
import { getNotifyIntent, setNotifyIntent } from '@/lib/storage'

type State = 'off' | 'on' | 'denied' | 'install' | 'unsupported' | 'busy'

/**
 * Stanje se računa SINHRONO iz dozvole i korisnikovog prekidača.
 *
 * Ranije se čekalo `getSubscription()`, koji čeka service worker, koji čeka
 * mrežu — pa je zvono prvo bilo nevidljivo, a paljenje i gašenje su stajali
 * dok se ne vrati odgovor sa servera. Server sad radi u pozadini.
 */
function resolve(permission: string, intent: boolean): State {
  // Na serveru (i pri hidrataciji) store vraća 'unsupported' — zvono se tada
  // ne crta, pa se HTML sa servera i prvi klijentski render poklapaju.
  if (permission === 'unsupported') return 'unsupported'
  if (!pushSupported()) return 'unsupported'
  if (needsInstallFirst()) return 'install'
  if (permission === 'denied') return 'denied'
  if (permission !== 'granted') return 'off'
  return intent ? 'on' : 'off'
}

const HINTS: Partial<Record<State, string>> = {
  denied: 'Obavijesti su blokirane u postavkama telefona',
  install: 'Dodaj aplikaciju na početni ekran da bi obavijesti radile',
}

const ARIA: Record<Exclude<State, 'unsupported'>, string> = {
  on: `Obavijesti uključene, stih stiže u ${SEND_TIME}. Isključi.`,
  off: 'Uključi dnevnu obavijest',
  busy: 'Trenutak…',
  denied: 'Obavijesti su blokirane u postavkama telefona',
  install: 'Obavijesti rade tek kad je aplikacija na početnom ekranu',
}

/** Zeleno = stiže, crveno = ne stiže. Ništa između. */
const OK = '#4ADE80'
const NO = '#F87171'

export function NotifyToggle({ accent }: { accent: string }) {
  const permission = useSyncExternalStore(
    subscribePermission,
    permissionSnapshot,
    () => 'unsupported',
  )
  const intent = useNotifyIntent()
  /** Privremeno stanje dok traje sistemski dijalog. */
  const [pending, setPending] = useState<State | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const state = pending ?? resolve(permission, intent)

  useEffect(() => {
    registerSW()

    // Tiho popravljanje: dozvola je data i prekidač je upaljen, ali pretplate
    // na serveru nema (npr. prva posjeta nakon uvoda, ili je istekla).
    // Prekidač se MORA provjeriti — bez toga bi se isključeni korisnik
    // ponovo pretplatio pri svakom otvaranju.
    if (!pushSupported() || needsInstallFirst()) return
    if (permissionSnapshot() !== 'granted' || !getNotifyIntent()) return
    let alive = true
    void (async () => {
      const sub = await getSubscription()
      if (alive && !sub) void subscribeToPush(SEND_HOUR)
    })()
    return () => {
      alive = false
    }
  }, [])

  const showHint = (text: string) => {
    setHint(text)
    setTimeout(() => setHint(null), 3400)
  }

  const onClick = async () => {
    if (state === 'busy') return
    if (HINTS[state]) return showHint(HINTS[state]!)

    if (state === 'on') {
      // Prekidač se pomjera odmah; odjava ide u pozadini.
      // Nema poruke — crveni ✕ je već rekao sve.
      setNotifyIntent(false)
      void unsubscribeFromPush()
      return
    }

    // Dozvolu treba sačekati — to je sistemski dijalog i korisnik ga vidi.
    if (permissionSnapshot() !== 'granted') {
      setPending('busy')
      const p = await ensurePermission()
      setPending(null)
      if (p !== 'granted') return
    }

    setNotifyIntent(true)
    navigator.vibrate?.([8, 40, 8])

    // Prijava servera ide poslije; ako padne, prekidač se vraća.
    const r = await subscribeToPush(SEND_HOUR)
    if (r !== 'ok') {
      setNotifyIntent(false)
      showHint('Nije uspjelo — pokušaj ponovo')
    }
  }

  if (state === 'unsupported') return null

  const on = state === 'on'
  const mark = on ? OK : NO

  return (
    <div className="relative">
      <button
        onClick={onClick}
        aria-pressed={on}
        aria-label={ARIA[state]}
        disabled={state === 'busy'}
        className="flex items-center gap-1.5 rounded-full border py-[0.3rem] pl-[0.4rem] pr-[0.42rem] transition-colors duration-300"
        style={{
          color: on ? accent : 'rgba(255,255,255,0.4)',
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

        {/* Stanje nosi znak, ne riječ: zeleno kvačica, crveno iks. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={String(on)}
            className="flex h-[15px] w-[15px] items-center justify-center rounded-full"
            style={{ backgroundColor: mark }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 18 }}
          >
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0B0F1A"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {on ? <path d="M5 12.5 10 17.5 19 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
            </svg>
          </motion.span>
        </AnimatePresence>
      </button>

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
