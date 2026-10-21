/**
 * Javna adresa aplikacije — za OG slike, share linkove i QR kod.
 *
 * Prazna varijabla okoline je realnost (dodaš je u Vercelu pa zaboraviš
 * vrijednost), a `new URL('')` ruši cijelu stranicu — zato provjera na
 * istinitost, ne na null.
 *
 * `VERCEL_URL` je adresa jednog deploya i iza Vercelove zaštite vraća 302 na
 * prijavu — WhatsApp tad ne dobije sliku. Zato prvo produkcijska domena.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3111')

/**
 * Odakle se puštaju pjesme: Cloudflare (workers.dev, besplatno — npm run
 * audio:deploy, cloudflare/audio). `NEXT_PUBLIC_AUDIO_BASE=/` vrati ih na
 * ovaj server (/audio). Bez kose crte na kraju.
 */
export const AUDIO_BASE = (process.env.NEXT_PUBLIC_AUDIO_BASE || 'https://stihdana-audio.pandzicharis.workers.dev').replace(/\/$/, '')

/** Adresa koju nosi odštampani QR kod — mora raditi i kad se gleda s localhosta. */
export const PUBLIC_URL = SITE_URL.startsWith('http://localhost')
  ? 'https://dino-merlin-stih-dana.vercel.app'
  : SITE_URL
