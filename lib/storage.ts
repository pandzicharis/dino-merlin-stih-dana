/**
 * Lokalno stanje — samo zadnji viđeni dan. Bez logina, bez baze.
 * Svaki pristup je u try/catch: private mode i blokirani storage ne smiju srušiti ekran.
 */

const SEEN = 'stihdana:lastSeen'
const NOTIFY = 'stihdana:notify'

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

/**
 * Želi li korisnik obavijesti — prekidač u aplikaciji, odvojen od sistemske
 * dozvole. Dozvola se traži na uvodu i više se ne dira; ovo je ono što
 * korisnik pali i gasi, i po čemu se ekran crta ODMAH, bez čekanja mreže.
 *
 * Podrazumijeva se `true`: ko je dozvolu dao, taj je obavijesti i htio.
 */
export function getNotifyIntent(): boolean {
  return read<boolean>(NOTIFY, true)
}

export function setNotifyIntent(on: boolean) {
  write(NOTIFY, on)
  window.dispatchEvent(new Event('notifychange'))
}

export function getLastSeen(): string | null {
  return read<string | null>(SEEN, null)
}

export function setLastSeen(iso: string) {
  write(SEEN, iso)
}
