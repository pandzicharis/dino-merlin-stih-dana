/**
 * Adrese na koje se uopšte može slati push. Sve ostalo je ili greška ili
 * pokušaj da nam se u tabelu ubaci tuđi URL — ruta ima servisni ključ, pa
 * bi bez ove provjere bila mali generator zahtjeva na adresu po izboru.
 */
const PUSH_HOSTS = [
  'googleapis.com', // fcm / android — Chrome, Edge, Android
  'push.apple.com', // Safari, iOS PWA
  'mozilla.com', // Firefox (push.services.mozilla.com)
  'notify.windows.com', // WNS
  'pushservice.mozilla.com',
]

const MAX_ENDPOINT = 800

export function isPushEndpoint(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false
  if (raw.length > MAX_ENDPOINT) return false
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  return PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
}
