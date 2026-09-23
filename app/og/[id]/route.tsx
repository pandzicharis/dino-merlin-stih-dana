import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { MOODS } from '@/data/moods'
import { BRAND } from '@/lib/brand'
import { verseById } from '@/lib/pickVerse'
import { withPeriod } from '@/lib/text'

/**
 * Share slika — jedini kanal rasta koji nam treba.
 *   /og/<id>?f=story  → 1080×1920 (IG Story)
 *   /og/<id>?f=post   → 1080×1080 (feed)
 *
 * Slika za dati id se nikad ne mijenja, pa se generiše jednom u životu
 * i keširá zauvijek.
 */

export const runtime = 'nodejs'

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

const FORMATS = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1080 },
} as const

/** Font iz Google Fonts-a, sveden na znakove koji se stvarno crtaju. */
async function loadFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 86_400 } },
    ).then((r) => r.text())
    const url = css.match(/src:\s*url\((.+?)\)/)?.[1]
    if (!url) return null
    return await fetch(url).then((r) => r.arrayBuffer())
  } catch {
    return null
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const verse = verseById(id)
  if (!verse) return new Response('Nepoznat stih', { status: 404 })

  const f = new URL(req.url).searchParams.get('f')
  const { width, height } = FORMATS[f === 'post' ? 'post' : 'story']
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
      headers: { 'Cache-Control': 'public, immutable, no-transform, max-age=31536000' },
    },
  )
}
