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

/**
 * Nova pretplata na istoj registraciji.
 *
 * Safari (a povremeno i Chrome) odbije `subscribe()` ako je `unsubscribe()`
 * bio maloprije — zato drugo gasenje/paljenje zaredom nije radilo. Na neuspjeh
 * se zaostala pretplata ukloni do kraja pa se pokusa jos jednom.
 */
async function freshSubscription(
  reg: ServiceWorkerRegistration,
  key: string,
): Promise<PushSubscription> {
  const opts = {
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  }

  // Postojeća pretplata važi samo ako je napravljena ISTIM ključem. Stara
  // (npr. iz testiranja, s drugim VAPID ključem) izgleda ispravno, ali push
  // servis odbije svako slanje na nju — Android tako tiho ostane bez stiha.
  const existing = await reg.pushManager.getSubscription()
  if (existing) {
    if (sameKey(existing.options.applicationServerKey, opts.applicationServerKey as Uint8Array)) return existing
    await existing.unsubscribe().catch(() => {})
  }

  try {
    return await reg.pushManager.subscribe(opts)
  } catch {
    const stale = await reg.pushManager.getSubscription()
    if (stale) await stale.unsubscribe().catch(() => {})
    await new Promise((r) => setTimeout(r, 300))
    return reg.pushManager.subscribe(opts)
  }
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a) return false
  const x = new Uint8Array(a)
  return x.length === b.length && x.every((v, i) => v === b[i])
}

export async function subscribeToPush(
  sendHour = SEND_HOUR,
): Promise<'ok' | 'denied' | 'unsupported' | 'error'> {
  if (!pushSupported()) return 'unsupported'

  // Već data dozvola se ne traži ponovo: drugi `requestPermission()` zna
  // pasti jer više nije vezan za korisnikov dodir.
  const permission =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key) return 'error'

  try {
    const reg = (await navigator.serviceWorker.ready) ?? (await registerSW())
    if (!reg) return 'error'

    const sub = await freshSubscription(reg, key)

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

export function announcePushChange() {
  window.dispatchEvent(new Event(PUSH_EVENT))
}

const notifyChange = announcePushChange

/**
 * Sistemska dozvola kao vanjski store — čita se sinhrono, bez `await`.
 * Korisnik je može promijeniti i izvan aplikacije, pa se osvježava i na
 * povratak u prozor.
 */
export function subscribePermission(cb: () => void) {
  window.addEventListener(PUSH_EVENT, cb)
  window.addEventListener('focus', cb)
  document.addEventListener('visibilitychange', cb)
  return () => {
    window.removeEventListener(PUSH_EVENT, cb)
    window.removeEventListener('focus', cb)
    document.removeEventListener('visibilitychange', cb)
  }
}

export function permissionSnapshot(): string {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/** Traži dozvolu samo ako je nema — drugi poziv nije vezan za dodir i zna pasti. */
export async function ensurePermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  const p = await Notification.requestPermission()
  announcePushChange()
  return p
}

/* Mora se slagati s public/sw.js (MARK, MARK_KEY). */
const MARK = 'stihdana-izvuci'
const MARK_KEY = '/__izvuci'

/**
 * Ima li nepročitana obavijest? Oznaku ostavlja service worker kad stigne;
 * stoji dok se stih ne izvuče (`clearPushMark`) — zatvoriš aplikaciju usred
 * tombole, sljedeće otvaranje je opet tombola.
 */
export async function hasPushMark(): Promise<boolean> {
  if (typeof caches === 'undefined') return false
  try {
    return Boolean(await (await caches.open(MARK)).match(MARK_KEY))
  } catch {
    return false
  }
}

/** dan za koji je server već obaviješten da je stih viđen */
const SEEN = 'stihdana:pushSeen'

/**
 * Današnji stih izvučen BEZ obavijesti (npr. ujutro, prije podneva) — javi
 * serveru, pa obavijest danas ne stigne (app/api/push/seen). Jednom dnevno po
 * uređaju, u pozadini, samo kad su obavijesti uključene; ništa ne čeka na to.
 */
export async function reportSeen(date: string) {
  try {
    if (localStorage.getItem(SEEN) === date) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (localStorage.getItem('stihdana:notify') === 'false') return
    const sub = await (await navigator.serviceWorker?.getRegistration())?.pushManager.getSubscription()
    if (!sub) return
    localStorage.setItem(SEEN, date)
    const r = await fetch('/api/push/seen', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint, date }),
      keepalive: true,
    })
    // nije prošlo — pokuša se pri sljedećem izvlačenju (i obavijest dođe, kao i prije)
    if (!r.ok) localStorage.removeItem(SEEN)
  } catch {
    try {
      localStorage.removeItem(SEEN)
    } catch {
      /* privatni prozor */
    }
  }
}

/** Stih izvučen — obavijest je pročitana: oznaka, tačka na ikonici, centar obavijesti. */
export function clearPushMark() {
  if (typeof caches !== 'undefined') caches.open(MARK).then((c) => c.delete(MARK_KEY)).catch(() => {})
  clearBadge()
}

/** Tačka na ikonici i obavijesti iz centra obavijesti. */
export function clearBadge() {
  navigator.clearAppBadge?.().catch(() => {})
  navigator.serviceWorker?.getRegistration().then((reg) =>
    reg?.getNotifications().then((list) => list.forEach((n) => n.close())),
  )
}
