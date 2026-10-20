import { getPlays } from './storage'

/**
 * Pjesme u kešu service workera (public/sw.js, AUDIO): puštanje, nastavak i
 * povratak u aplikaciju ne skidaju pjesmu iznova. Worker pamti samo pjesme
 * koje mu se ovdje jave — one koje se slušaju i sljedeću u redu; nikad uz
 * uštedu podataka.
 */
export function warmAudio(urls: string[]) {
  try {
    const sw = navigator.serviceWorker?.controller
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (!sw || conn?.saveData || !urls.length) return
    sw.postMessage({ type: 'stihdana:warm-audio', urls: urls.slice(0, 3) })
  } catch {
    /* bez keša — pjesma ide s mreže kao i prije */
  }
}

/** Je li ikad pustio pjesmu — samo takvom se pjesma ispod stiha preuzme unaprijed (Vercel: ograničen prenos). */
export function listener(): boolean {
  return Object.keys(getPlays()).length > 0
}
