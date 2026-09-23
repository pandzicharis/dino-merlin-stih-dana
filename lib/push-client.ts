'use client'

import { SEND_HOUR } from './date'

/** Sve što se tiče Web Push-a na strani browsera. */

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** Je li aplikacija pokrenuta kao instalirani PWA. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    // bez VAPID ključa nema šta uključiti — zvono se tada uopšte ne prikazuje
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  )
}

/**
 * KLJUČNO OGRANIČENJE: na iPhoneu Web Push radi isključivo iz
 * instaliranog PWA-a (iOS 16.4+), nikad iz Safari taba.
 */
export function needsInstallFirst(): boolean {
  return isIOS() && !isStandalone()
}

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  // U dev-u service worker se sudara s HMR-om — registruje se samo u buildu.
  if (process.env.NODE_ENV !== 'production') return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    return null
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export async function getSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function subscribeToPush(
  sendHour = SEND_HOUR,
): Promise<'ok' | 'denied' | 'unsupported' | 'error'> {
  if (!pushSupported()) return 'unsupported'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key) return 'error'

  try {
    const reg = (await navigator.serviceWorker.ready) ?? (await registerSW())
    if (!reg) return 'error'

    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      }))

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        sendHour,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    })
    if (res.ok) notifyChange()
    return res.ok ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const sub = await getSubscription()
  if (!sub) return true
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {})
  const ok = await sub.unsubscribe()
  notifyChange()
  return ok
}

/** Zvono i onboarding slušaju isti signal, da nikad ne pokazuju različito stanje. */
export const PUSH_EVENT = 'pushchange'

function notifyChange() {
  window.dispatchEvent(new Event(PUSH_EVENT))
}
