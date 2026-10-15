import type { Metadata, Viewport } from 'next'
import { Fraunces, Roboto, Rubik } from 'next/font/google'
import { SITE_URL } from '@/lib/site'
import './globals.css'
import { HOME_IMAGE, OG_BASE } from '@/lib/og'

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

// Roboto samo za modale na Androidu (data-os) — bez preloada, preuzme se
// tek kad ga neko zaista prikaže
const roboto = Roboto({
  subsets: ['latin-ext'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
  preload: false,
})

/**
 * Sistem telefona na <html data-os>, prije prvog crtanja — modali se po
 * njemu oblikuju kao na iPhoneu ili Androidu. U prezentaciji izbor stiže
 * iz prekidača ispod telefona (sessionStorage), inače iz preglednika —
 * a kad se ne prepozna (računar), podrazumijeva se iPhone.
 * `data-deck`: aplikacija je u telefonu prezentacije — bez dev trake.
 */
const OS_SCRIPT = `try{if(!/^\\/(prezentacija|admin)/.test(location.pathname)){var u=navigator.userAgent,o=sessionStorage.getItem('stihdana:os')||(/iPhone|iPad|iPod/.test(u)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'ios':/Android/.test(u)?'android':'ios');document.documentElement.dataset.os=o}}catch(e){}try{if(self!==top&&top.location.pathname.indexOf('/prezentacija')===0)document.documentElement.dataset.deck=''}catch(e){}`

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Stih dana — Dino Merlin', template: '%s — Stih dana' },
  description: 'Jedan stih Dine Merlina, svaki dan u isto vrijeme.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Stih dana' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  // pregled početnog linka — slika stiha umjesto golog teksta
  openGraph: {
    ...OG_BASE,
    url: '/',
    title: 'Stih dana — Dino Merlin',
    description: 'Jedan stih Dine Merlina, svaki dan u isto vrijeme.',
    images: [HOME_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stih dana — Dino Merlin',
    description: 'Jedan stih Dine Merlina, svaki dan u isto vrijeme.',
    images: [HOME_IMAGE.url],
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
    <html lang="bs" className={`${serif.variable} ${sans.variable} ${roboto.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: OS_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
