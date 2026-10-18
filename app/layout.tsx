import type { Metadata, Viewport } from 'next'
import { CEKAJ_SCRIPT } from '@/lib/cekaj'
import {
  Alex_Brush,
  Allura,
  Bodoni_Moda,
  Caveat,
  Cinzel,
  Cormorant_Garamond,
  DM_Serif_Display,
  Dancing_Script,
  EB_Garamond,
  Fraunces,
  Great_Vibes,
  Instrument_Serif,
  Josefin_Sans,
  Montserrat,
  Parisienne,
  Pinyon_Script,
  Playfair_Display,
  Roboto,
  Rubik,
} from 'next/font/google'
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

// Fontovi stiha koje urednik može izabrati (lib/fonts.ts) — bez preloada:
// preuzmu se tek kad ih stih zaista koristi. Svi s latin-ext (č ć š ž đ).
const serifItalic = Fraunces({ subsets: ['latin-ext'], style: 'italic', axes: ['SOFT', 'WONK', 'opsz'], variable: '--font-serif-italic', display: 'swap', preload: false })
const playfair = Playfair_Display({ subsets: ['latin-ext'], style: ['normal', 'italic'], variable: '--font-playfair', display: 'swap', preload: false })
const cormorant = Cormorant_Garamond({ subsets: ['latin-ext'], weight: ['400', '700'], style: ['normal', 'italic'], variable: '--font-cormorant', display: 'swap', preload: false })
const greatVibes = Great_Vibes({ subsets: ['latin-ext'], weight: '400', variable: '--font-greatvibes', display: 'swap', preload: false })
const dancing = Dancing_Script({ subsets: ['latin-ext'], variable: '--font-dancing', display: 'swap', preload: false })
const parisienne = Parisienne({ subsets: ['latin-ext'], weight: '400', variable: '--font-parisienne', display: 'swap', preload: false })
const ebGaramond = EB_Garamond({ subsets: ['latin-ext'], style: ['normal', 'italic'], variable: '--font-ebgaramond', display: 'swap', preload: false })
const bodoni = Bodoni_Moda({ subsets: ['latin-ext'], style: ['normal', 'italic'], axes: ['opsz'], variable: '--font-bodoni', display: 'swap', preload: false })
const dmSerif = DM_Serif_Display({ subsets: ['latin-ext'], weight: '400', style: ['normal', 'italic'], variable: '--font-dmserif', display: 'swap', preload: false })
const instrument = Instrument_Serif({ subsets: ['latin-ext'], weight: '400', style: ['normal', 'italic'], variable: '--font-instrument', display: 'swap', preload: false })
const cinzel = Cinzel({ subsets: ['latin-ext'], variable: '--font-cinzel', display: 'swap', preload: false })
const josefin = Josefin_Sans({ subsets: ['latin-ext'], style: ['normal', 'italic'], variable: '--font-josefin', display: 'swap', preload: false })
const montserrat = Montserrat({ subsets: ['latin-ext'], style: ['normal', 'italic'], variable: '--font-montserrat', display: 'swap', preload: false })
const allura = Allura({ subsets: ['latin-ext'], weight: '400', variable: '--font-allura', display: 'swap', preload: false })
const pinyon = Pinyon_Script({ subsets: ['latin-ext'], weight: '400', variable: '--font-pinyon', display: 'swap', preload: false })
const alexBrush = Alex_Brush({ subsets: ['latin-ext'], weight: '400', variable: '--font-alexbrush', display: 'swap', preload: false })
const caveat = Caveat({ subsets: ['latin-ext'], variable: '--font-caveat', display: 'swap', preload: false })
const verseFonts = [
  serifItalic, playfair, cormorant, greatVibes, dancing, parisienne,
  ebGaramond, bodoni, dmSerif, instrument, cinzel, josefin, montserrat, allura, pinyon, alexBrush, caveat,
]
  .map((f) => f.variable)
  .join(' ')

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
    icon: [{ url: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png?v=2', sizes: '180x180' }],
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
  // tamno platno od prvog bajta — bez bijelog bljeska prije CSS-a
  colorScheme: 'dark',
  viewportFit: 'cover',
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bs" className={`${serif.variable} ${sans.variable} ${roboto.variable} ${verseFonts}`} suppressHydrationWarning>
      <head>
        {/* crno prije nego stigne globals.css — instalirana aplikacija inače trepne bijelo */}
        <style dangerouslySetInnerHTML={{ __html: 'html{background:#000}' }} />
        <script dangerouslySetInnerHTML={{ __html: OS_SCRIPT }} />
        {/* obavijest možda čeka — zastor prije prvog kadra, da se ne vidi stih pa tombola (lib/cekaj.ts) */}
        <script dangerouslySetInnerHTML={{ __html: CEKAJ_SCRIPT }} />
        {/* potpis na pločici tombole je CSS maska — maska se traži posebnim (CORS)
            zahtjevom tek kad se tombola pojavi; ovako stigne s HTML-om i stoji od prvog kadra */}
        <link rel="preload" as="image" href="/brand/signature.webp?v=2" crossOrigin="anonymous" fetchPriority="high" />
      </head>
      <body>{children}</body>
    </html>
  )
}
