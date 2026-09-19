/**
 * Lokalno stanje — favoriti i postavke. Bez logina, bez baze.
 * Svaki pristup je u try/catch: private mode i blokirani storage ne smiju srušiti ekran.
 */

const FAV = 'stihdana:favorites'
const SEEN = 'stihdana:lastSeen'

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

export function getFavorites(): string[] {
  return read<string[]>(FAV, [])
}

export function isFavorite(id: string): boolean {
  return getFavorites().includes(id)
}

/** Vraća novo stanje (true = sad je favorit). */
export function toggleFavorite(id: string): boolean {
  const list = getFavorites()
  const i = list.indexOf(id)
  if (i === -1) list.push(id)
  else list.splice(i, 1)
  write(FAV, list)
  window.dispatchEvent(new Event('favoriteschange'))
  return i === -1
}

export function getLastSeen(): string | null {
  return read<string | null>(SEEN, null)
}

export function setLastSeen(iso: string) {
  write(SEEN, iso)
}
