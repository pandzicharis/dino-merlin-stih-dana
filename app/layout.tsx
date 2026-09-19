import type { Metadata, Viewport } from 'next'
import { Fraunces, Rubik } from 'next/font/google'
import './globals.css'

const serif = Fraunces({
  subsets: ['latin-ext'],
  variable: '--font-serif',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
})

// Rubik je font sa dinomerlin.com — hrom aplikacije prati njegov identitet
const sans = Rubik({
  subsets: ['latin-ext'],
  weight: ['300', '400', '500', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

// Prazna varijabla okoline je realnost (dodaš je u Vercelu pa zaboraviš
// vrijednost), a `new URL('')` ruši cijelu stranicu — zato provjera na istinitost,
// ne na null.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3111')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Stih dana — Dino Merlin', template: '%s — Stih dana' },
  description: 'Jedan stih Dine Merlina, svaki dan u isto vrijeme.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Stih dana' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  // Ostaje neindeksirano dok ne stigne dozvola za objavljivanje stihova.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  viewportFit: 'cover',
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bs" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
