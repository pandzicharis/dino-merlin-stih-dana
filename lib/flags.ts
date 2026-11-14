/**
 * PREKIDAČI (feature flags).
 *
 * OWN_AUDIO — stari plejer, sve kako je bilo: vlastiti fajlovi pjesama
 * (public/audio, Cloudflare), preuzimanje s YouTubea (yt-dlp: /api/audio,
 * admin, workflow), gramofon ispod stiha, špil sačuvanih s mini plejerom,
 * tekst uz pjesmu, zaključan ekran. Samo uz licencu za pjesme.
 *   pali se:  NEXT_PUBLIC_FF_OWN_AUDIO=1  (.env.local, Vercel)
 *             u workflowu repo varijabla FF_OWN_AUDIO=1
 *
 * Ugašen (zadano): pjesme idu preko YouTube plejera (lib/youtube.ts), s novim
 * dizajnom početne i plejera (components/tube).
 */
export const OWN_AUDIO = process.env.NEXT_PUBLIC_FF_OWN_AUDIO === '1'
