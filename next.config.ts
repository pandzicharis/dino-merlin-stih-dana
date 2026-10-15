import type { NextConfig } from 'next'

/**
 * Zaglavlja koja ne koštaju ništa a rješavaju cijelu klasu problema.
 *
 * Okvir je dozvoljen samo istom sajtu: admin u njemu pokazuje pregled
 * stiha, a prezentacija (`/prezentacija`) cijelu aplikaciju. Tuđi sajt je
 * i dalje ne može ugraditi.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
  // bez ovoga Turbopack traži root u home direktoriju
  turbopack: { root: __dirname },
  // dev overlay se preklapa s dev trakom za datum
  devIndicators: false,
  // verzija Next-a u zaglavlju ne služi nama nego onome ko traži metu
  poweredByHeader: false,

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Ikone i logotip se mijenjaju samo uz novi deploy.
        source: '/:path(icons|brand)/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // Omoti i pjesme: bez ovoga Vercel kaže `max-age=0`, pa telefon svaki
        // put pita server — omot na slici za dijeljenje i pjesma kasne. Sedmica,
        // a ne zauvijek: omot se zna zamijeniti istim imenom.
        source: '/:path(albumi|audio|ig)/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' }],
      },
      {
        // Manifest se mijenja samo uz deploy — dan keša je jedan zahtjev manje po otvaranju.
        source: '/manifest.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
      {
        /**
         * Service worker se NE smije keširati: on je taj koji donosi novu
         * verziju aplikacije. Keširan `sw.js` znači da korisnik zaglavi na
         * staroj verziji i da mu ažuriranje nikad ne stigne.
         */
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
