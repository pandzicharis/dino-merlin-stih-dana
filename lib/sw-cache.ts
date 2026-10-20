/**
 * Pjesme u kešu service workera (public/sw.js, AUDIO): puštanje, nastavak i
 * povratak u aplikaciju ne skidaju pjesmu iznova. Worker pamti samo pjesme
 * koje mu se ovdje jave — one koje se upravo puštaju; nikad uz uštedu podataka.
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
