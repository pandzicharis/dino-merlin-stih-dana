'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
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
import { haptic } from '@/lib/haptic'
import { Icon, TOAST_BAD, TOAST_OK, toast } from './Toast'

export type NotifyState = 'off' | 'on' | 'denied' | 'install' | 'unsupported' | 'busy'

/**
 * Stanje se računa SINHRONO iz dozvole i korisnikovog prekidača.
 *
 * Ranije se čekalo `getSubscription()`, koji čeka service worker, koji čeka
 * mrežu — pa je prekidač prvo bio nevidljiv, a paljenje i gašenje su stajali
 * dok se ne vrati odgovor sa servera. Server sad radi u pozadini.
 */
function resolve(permission: string, intent: boolean): NotifyState {
  // Na serveru (i pri hidrataciji) store vraća 'unsupported' — prekidač se
  // tada ne crta, pa se HTML sa servera i prvi klijentski render poklapaju.
  if (permission === 'unsupported') return 'unsupported'
  if (!pushSupported()) return 'unsupported'
  if (needsInstallFirst()) return 'install'
  if (permission === 'denied') return 'denied'
  if (permission !== 'granted') return 'off'
  return intent ? 'on' : 'off'
}

const HINTS: Partial<Record<NotifyState, { title: string; sub: string }>> = {
  denied: { title: 'Obavijesti su blokirane', sub: 'Uključi ih u postavkama telefona' },
  install: { title: 'Dodaj na početni ekran', sub: 'Tek tada obavijesti rade' },
  unsupported: { title: 'Obavijesti ovdje ne rade', sub: 'Otvori aplikaciju na telefonu' },
}

/**
 * Obavijesti u pozadini, na svakom otvaranju: service worker se registruje
 * (nova verzija, obavijesti), a pretplata se tiho popravi. Ne crta ništa —
 * prekidač je u postavkama (components/SettingsPanel.tsx).
 */
export function NotifySync() {
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
  return null
}

/** Stanje obavijesti i jedan dodir za paljenje/gašenje — za prekidač u postavkama. */
export function useNotify(): { state: NotifyState; toggle: () => Promise<void> } {
  const permission = useSyncExternalStore(subscribePermission, permissionSnapshot, () => 'unsupported')
  const intent = useNotifyIntent()
  /** Privremeno stanje dok traje sistemski dijalog. */
  const [pending, setPending] = useState<NotifyState | null>(null)
  const state = pending ?? resolve(permission, intent)

  const show = (t: Omit<Parameters<typeof toast>[0], 'id'>) => toast({ id: 'notify', ...t })

  const toggle = async () => {
    if (state === 'busy') return
    if (HINTS[state]) return show({ ...HINTS[state]!, icon: <Icon.info /> })

    if (state === 'on') {
      // Prekidač se pomjera odmah; odjava ide u pozadini.
      setNotifyIntent(false)
      show({ title: 'Obavijesti isključene', color: TOAST_BAD, icon: <Icon.bellOff /> })
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
    haptic([8, 40, 8])
    show({ title: 'Obavijesti uključene', sub: `Stih stiže u ${SEND_TIME}`, color: TOAST_OK, icon: <Icon.bell /> })

    // Prijava servera ide poslije; ako padne, prekidač se vraća.
    const r = await subscribeToPush(SEND_HOUR)
    if (r !== 'ok') {
      setNotifyIntent(false)
      show({ title: 'Nije uspjelo', sub: 'Pokušaj ponovo', color: TOAST_BAD, icon: <Icon.bad /> })
    }
  }

  return { state, toggle }
}
