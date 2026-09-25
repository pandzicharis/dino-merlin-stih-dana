import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { VERSES } from '@/data/verses'
import { MOODS } from '@/data/moods'
import { BRAND } from '@/lib/brand'
import { verseById } from '@/lib/pickVerse'
import { withPeriod } from '@/lib/text'

/**
 * Share slika — jedini kanal rasta koji nam treba.
 *   /og/<id>/story  → 1080×1920 (IG Story)
 *   /og/<id>/post   → 1080×1080 (feed)
 *
 * Slika za dati stih se ne mijenja nikad, a stihova je šaka — pa se svih
 * nekoliko desetina generiše U BUILDU i dalje su običan statični fajl s CDN-a.
 *
 * Ranije se crtalo na zahtjev. To znači Satori render i odlazak po font na
 * Google Fonts u trenutku kad neko podijeli stih — dakle najsporiji mogući
 * odgovor tačno u trenutku kad WhatsApp ili Instagram čeka preview, i vanjska
 * zavisnost koja u produkciji može pasti. Sad se oboje desi jednom, kod nas.
 *
 * Zato je format u putanji a ne u `?f=`: query string ne može biti dio
 * `generateStaticParams`.
 */

export const dynamic = 'force-static'

const FORMATS = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1080 },
} as const

type Format = keyof typeof FORMATS

export function generateStaticParams() {
  return VERSES.flatMap((v) => Object.keys(FORMATS).map((format) => ({ id: v.id, format })))
}

/** Logotip kao data URI — Satori ga tako umeće bez mrežnog poziva. */
let wordmark: string | null = null
function wordmarkDataUri(): string {
  if (wordmark === null) {
    try {
      const svg = readFileSync(join(process.cwd(), 'public/brand/wordmark.svg'), 'utf8')
      wordmark = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
    } catch {
      wordmark = ''
    }
  }
  return wordmark
}

/**
 * Font iz Google Fonts-a, sveden na znakove koji se stvarno crtaju.
 * Build crta desetine slika u istom procesu, pa se isti podskup ne skida dvaput.
 */
const fontCache = new Map<string, Promise<ArrayBuffer | null>>()

function loadFont(family: string, text: string): Promise<ArrayBuffer | null> {
  const key = `${family}|${text}`
  const hit = fontCache.get(key)
  if (hit) return hit

  const p = (async () => {
    try {
      const css = await fetch(
        `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000) },
      ).then((r) => r.text())
      const url = css.match(/src:\s*url\((.+?)\)/)?.[1]
      if (!url) throw new Error('Google Fonts nije vratio putanju do fajla')
      return await fetch(url, { signal: AbortSignal.timeout(10_000) }).then((r) => r.arrayBuffer())
    } catch (e) {
      // Slika i bez ovoga izađe, ali u sistemskom fontu — u buildu se to mora vidjeti.
      console.warn(`[og] font ${family} nije preuzet, ide fallback:`, (e as Error).message)
      return null
    }
  })()

  fontCache.set(key, p)
  return p
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; format: string }> }) {
  const { id, format } = await ctx.params
  const verse = verseById(id)
  if (!verse || !(format in FORMATS)) return new Response('Nepoznat stih', { status: 404 })

  const { width, height } = FORMATS[format as Format]
  const m = MOODS[verse.mood]

  const text = withPeriod(verse.text)
  const chars = `${text}${verse.song}${verse.album}${verse.year}Stih dana${BRAND.name}`
  const [serif, sans] = await Promise.all([
    loadFont('Fraunces:opsz,wght@9..144,400', chars),
    loadFont('Rubik:wght@500', chars.toUpperCase() + chars),
  ])
  const logo = wordmarkDataUri()

  const long = text.length > 70
  const fontSize = Math.round((height === 1080 ? 82 : 92) * (long ? 0.82 : 1))

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: height === 1080 ? 96 : 120,
          background: `radial-gradient(circle at 25% 20%, ${m.gradient[2]} 0%, transparent 62%), radial-gradient(circle at 78% 82%, ${m.gradient[1]} 0%, transparent 60%), ${m.gradient[0]}`,
          fontFamily: serif ? 'Serif' : 'Sans',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} width={300} height={40} alt={BRAND.name} />
          ) : (
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: '#F4F4F4' }}>
              {BRAND.name.toUpperCase()}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              letterSpacing: 9,
              textTransform: 'uppercase',
              color: BRAND.gold,
              fontFamily: 'Sans',
            }}
          >
            Stih dana
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize,
            lineHeight: 1.28,
            color: m.text,
            textAlign: 'center',
            alignItems: 'center',
          }}
        >
          {text.split('\n').map((line, i) => (
            <div key={i} style={{ display: 'flex' }}>
              {line}
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            fontFamily: 'Sans',
          }}
        >
          <div style={{ display: 'flex', fontSize: 32, letterSpacing: 6, color: BRAND.gold }}>
            {verse.song.toUpperCase()}
          </div>
          <div style={{ display: 'flex', fontSize: 22, letterSpacing: 3, color: 'rgba(255,255,255,0.4)' }}>
            {verse.album.toUpperCase()} · {verse.year}
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts: [
        ...(serif ? [{ name: 'Serif', data: serif, style: 'normal' as const, weight: 400 as const }] : []),
        ...(sans ? [{ name: 'Sans', data: sans, style: 'normal' as const, weight: 500 as const }] : []),
      ],
      headers: {
        // Slika za dati stih je nepromjenjiva — i u pregledniku i na CDN-u.
        'Cache-Control': 'public, immutable, no-transform, max-age=31536000, s-maxage=31536000',
      },
    },
  )
}
