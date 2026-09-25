import type { NextConfig } from 'next'

/**
 * Zaglavlja koja ne koštaju ništa a rješavaju cijelu klasu problema.
 * Aplikacija se nigdje ne ugrađuje u okvir i ne prima tuđi sadržaj.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
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
