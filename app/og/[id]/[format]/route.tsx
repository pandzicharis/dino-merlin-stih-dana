import { VERSE_FONTS, caseOf, lookScale, lookSpacing, parseFont, styleOf, verseWords, type WordStyle } from '@/lib/fonts'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { MOODS } from '@/data/moods'
import { BRAND } from '@/lib/brand'
import { findVerse, getCatalog } from '@/lib/catalog'
import { asWritten } from '@/lib/text'

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
// izmjena stiha u adminu stigne i do pregleda linka, najkasnije za sat
export const revalidate = 3600

const FORMATS = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1080 },
} as const

type Format = keyof typeof FORMATS

export async function generateStaticParams() {
  return (await getCatalog()).verses.flatMap((v) => Object.keys(FORMATS).map((format) => ({ id: v.id, format })))
}

/**
 * Fraunces stiha — statični rez s osama ekrana (`opsz 144, SOFT 30, WONK 0`,
 * globals.css `.verse`), upečen u fajl (public/fonts). Google Fonts bez njih
 * vrati drugi rez (WONK 1, SOFT 0), a Satori ose ionako ne zna postaviti.
 */
const frauncesCache = new Map<string, ArrayBuffer | null>()
function frauncesFont(bold: boolean, italic: boolean): ArrayBuffer | null {
  const file = `fraunces-og-${bold ? 620 : 400}${italic ? '-italic' : ''}.ttf`
  if (!frauncesCache.has(file)) {
    try {
      const b = readFileSync(join(process.cwd(), 'public/fonts', file))
      frauncesCache.set(file, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
    } catch {
      frauncesCache.set(file, null)
    }
  }
  return frauncesCache.get(file) ?? null
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

/** Google Fonts upit za stil riječi (lib/fonts.ts) — isti rez kao na ekranu. */
function googleFamily(st: WordStyle): string {
  const f = VERSE_FONTS[st.font]
  const i = st.italic ? 1 : 0
  if (st.font === 'fraunces') return `Fraunces:ital,opsz,wght@${i},9..144,${st.bold ? 620 : 400}`
  const w = st.bold && f.bold ? 700 : 400
  if (f.italic && f.bold) return `${f.google}:ital,wght@${i},${w}`
  if (f.italic) return `${f.google}:ital@${i}`
  if (f.bold) return `${f.google}:wght@${w}`
  return f.google
}
const styleName = (st: WordStyle) => `V-${st.font}-${st.bold ? 'b' : ''}${st.italic ? 'i' : ''}`

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
  const verse = await findVerse(id)
  if (!verse || !(format in FORMATS)) return new Response('Nepoznat stih', { status: 404 })

  const { width, height } = FORMATS[format as Format]
  const m = MOODS[verse.mood]

  const text = asWritten(verse.text)
  // i velika/mala slova — dizajn stiha zna ih promijeniti
  const chars = `${text}${text.toLocaleUpperCase('bs')}${text.toLocaleLowerCase('bs')}${verse.song}${verse.album}${verse.year}Stih dana${BRAND.name}`
  const [serif, sans] = await Promise.all([
    frauncesFont(false, false) ?? loadFont('Fraunces:opsz,wght@9..144,400', chars),
    loadFont('Rubik:wght@500', chars.toUpperCase() + chars),
  ])
  // fontovi stiha po riječi — svaki stil jednom, sveden na znakove stiha
  const map = parseFont(verse.font)
  const rows = verseWords(text)
  let n = 0
  // riječi već u velikim/malim slovima (dizajn stiha) — Satori nema text-transform po riječi
  const styled = rows.map((r) => r.map((w) => {
    const st = styleOf(map, n++)
    return { w: caseOf(w, st, map.look), st }
  }))
  const shown = styled.flat().map((x) => x.w).join(' ')
  const styles = new Map(styled.flat().map((x) => [styleName(x.st), x.st]))
  const verseFonts = (
    await Promise.all(
      [...styles].map(async ([name, st]) => ({
        name,
        st,
        data: (st.font === 'fraunces' && frauncesFont(Boolean(st.bold), Boolean(st.italic))) || (await loadFont(googleFamily(st), shown)),
      })),
    )
  ).filter((f) => f.data)
  const loaded = new Set(verseFonts.map((f) => f.name))
  const logo = wordmarkDataUri()

  const long = text.length > 70
  const pad = height === 1080 ? 96 : 120
  // svaki red cio: procjena širine po znakovima × uvećanje fonta (i riječi), pa smanji koliko treba
  const ls = lookSpacing(map.look)
  const est = Math.max(
    ...styled.map((r) =>
      r.reduce((a, x) => {
        const caps = x.w !== x.w.toLocaleLowerCase('bs') && x.w === x.w.toLocaleUpperCase('bs') ? 1.3 : 1
        return a + (x.w.length * (0.5 * caps + ls) + 0.3) * VERSE_FONTS[x.st.font].scale * ((x.st.size ?? 100) / 100)
      }, 0),
    ),
    1,
  )
  const fontSize = Math.round(Math.min((height === 1080 ? 82 : 92) * (long ? 0.82 : 1) * lookScale(map.look), (width - pad * 2) / est))
  const lh = 1.28 * ((map.look.lh ?? 118) / 118)

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: pad,
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
            lineHeight: lh,
            letterSpacing: `${ls}em`,
            color: m.text,
            textAlign: 'center',
            alignItems: 'center',
          }}
        >
          {styled.map((r, i) => (
            <div key={i} style={{ display: 'flex', whiteSpace: 'nowrap', gap: '0.26em' }}>
              {r.map((x, j) => {
                const name = styleName(x.st)
                const f = VERSE_FONTS[x.st.font]
                const size = (x.st.size ?? 100) / 100
                const own = loaded.has(name) && x.st.font !== 'fraunces'
                return (
                  <span
                    key={j}
                    style={{
                      ...(own
                        ? { fontFamily: name, fontSize: `${f.scale * size}em`, lineHeight: f.lh * (lh / 1.28) }
                        : loaded.has(name) && (x.st.bold || x.st.italic)
                          ? { fontFamily: name, ...(size !== 1 ? { fontSize: `${size}em` } : {}) }
                          : size !== 1
                            ? { fontSize: `${size}em` }
                            : {}),
                      ...(x.st.color ? { color: `#${x.st.color}` } : x.st.accent ? { color: m.accent } : {}),
                      ...(f.kind === 'pisani' ? { letterSpacing: 0 } : {}),
                    }}
                  >
                    {x.w}
                  </span>
                )
              })}
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
        ...verseFonts.map((f) => ({
          name: f.name,
          data: f.data!,
          style: (f.st.italic ? 'italic' : 'normal') as 'italic' | 'normal',
          weight: (f.st.bold ? 700 : 400) as 400 | 700,
        })),
      ],
      headers: {
        // Admin sada može ispraviti stih, pa slika više nije vječna: dan na
        // CDN-u, a zastarjela se servira dok se nova crta u pozadini.
        'Cache-Control': 'public, no-transform, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  )
}
