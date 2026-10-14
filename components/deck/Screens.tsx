import type { CSSProperties } from 'react'
import { MOODS, FIGURE_SRC, type Mood } from '@/data/moods'
import type { Verse } from '@/data/verses'
import { albumOf } from '@/data/albums'
import { BRAND } from '@/lib/brand'
import { formatDateBs, formatDayBs, formatFullDateBs } from '@/lib/date'
import { oneLine, withPeriod } from '@/lib/text'

/**
 * Mirni ekrani aplikacije za mockupe — plakat i slajdove.
 *
 * Ovo nije pravi `VerseScreen`: on računa veličine iz `vw` i živi preko
 * cijelog prozora, a ovdje ekran mora stati u okvir telefona i ostati isti
 * na papiru. Zato je ista kompozicija prepisana u `em` (1em = 1 piksel
 * ekrana), bez animacija i bez ičega što se ne štampa.
 */

const fill: CSSProperties = { position: 'absolute', inset: 0 }

// omot albuma: isto utapanje kao u aplikaciji (MoodBackground)
const ART_MASK =
  'linear-gradient(to bottom, transparent 0%, black 18%, black 40%, rgba(0,0,0,0.35) 64%, transparent 86%), linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)'
const ART_SHADE =
  'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.12) 22%, rgba(0,0,0,0.38) 50%, rgba(0,0,0,0.7) 78%, rgba(0,0,0,0.85) 100%)'

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

/** Pozadina po moodu — isti slojevi kao `MoodBackground`, zaustavljeni. */
export function MoodStill({
  mood,
  w,
  h,
  dim = 0,
  cover,
  lift = 0,
}: {
  mood: Mood
  w: number
  h: number
  dim?: number
  /** omot albuma stiha — umjesto portreta, kao u aplikaciji */
  cover?: string
  /** koliko je omot podignut (dio njegove visine) */
  lift?: number
}) {
  const m = MOODS[mood]
  const blob = Math.max(w, h) * 0.85
  const art = Math.min(w, h * 0.74)
  return (
    <div aria-hidden style={{ ...fill, overflow: 'hidden', background: m.gradient[0] }}>
      {m.gradient.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: `${blob}em`,
            height: `${blob}em`,
            left: `${[-15, 35, 5][i]}%`,
            top: `${[-10, 20, 55][i]}%`,
            borderRadius: '50%',
            background: `radial-gradient(circle at center, ${c} 0%, transparent 68%)`,
          }}
        />
      ))}
      {cover && (
        <>
          {/* atmosfera: omot preko svega, jako zamućen */}
          <div
            style={{
              position: 'absolute',
              inset: '-15%',
              backgroundImage: `url(${cover})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: `blur(${(w * 0.14).toFixed(0)}em) saturate(1.2)`,
              opacity: 0.32,
              transform: 'scale(1.1)',
            }}
          />
          {/* omot gore, preko cijele širine — nestaje u strane i prema stihu */}
          <div
            style={{
              position: 'absolute',
              // spušten od vrha, kao u aplikaciji
              top: `${(h * 0.06 - art * lift).toFixed(1)}em`,
              left: `${((w - art) / 2).toFixed(1)}em`,
              width: `${art.toFixed(1)}em`,
              height: `${art.toFixed(1)}em`,
              backgroundImage: `url(${cover})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.42,
              maskImage: ART_MASK,
              WebkitMaskImage: ART_MASK,
              maskComposite: 'intersect',
              WebkitMaskComposite: 'source-in',
            }}
          />
          <div style={{ ...fill, backgroundColor: m.gradient[1], mixBlendMode: 'color', opacity: 0.4 }} />
          <div style={{ ...fill, background: ART_SHADE }} />
        </>
      )}
      {!cover && (
      <div
        className="poster-fx"
        style={{
          ...fill,
          backgroundImage: `url(${FIGURE_SRC})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'auto 118%',
          // isto kao u aplikaciji: lice na ~70% širine ekrana
          backgroundPosition: `${(0.7 * w - 0.4 * h).toFixed(0)}em ${(-0.02 * h).toFixed(0)}em`,
          mixBlendMode: m.blend,
          opacity: m.figure * 1.15,
          maskImage: 'radial-gradient(ellipse 80% 62% at 78% 22%, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 62% at 78% 22%, black 30%, transparent 80%)',
        }}
      />
      )}
      {m.bloom > 0 && (
        <div
          style={{
            ...fill,
            background: `radial-gradient(ellipse 70% 40% at 50% 50%, ${m.accent} 0%, transparent 70%)`,
            opacity: m.bloom * 0.14,
          }}
        />
      )}
      <div
        className="poster-grain"
        style={{
          ...fill,
          opacity: m.grain * 0.4,
          mixBlendMode: 'overlay',
          backgroundImage: GRAIN,
          backgroundSize: '180em 180em',
        }}
      />
      <div
        style={{
          ...fill,
          background: `radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,${m.vignette}) 100%)`,
        }}
      />
      {dim > 0 && <div style={{ ...fill, background: `rgba(0,0,0,${dim})` }} />}
    </div>
  )
}

/** Note koje u aplikaciji plutaju — ovdje zaustavljene na lijepim mjestima. */
function Notes({ accent, spots }: { accent: string; spots: [number, number, number, string][] }) {
  return (
    <>
      {spots.map(([left, top, size, glyph], i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: 'absolute',
            left: `${left}%`,
            top: `${top}%`,
            fontSize: `${size}em`,
            lineHeight: 1,
            color: accent,
            opacity: 0.5,
            textShadow: `0 0 0.6em ${accent}73`,
          }}
        >
          {glyph}
        </span>
      ))}
    </>
  )
}

/** Isto pravilo kao `verseFontSize`, samo za ekran poznate širine. */
function verseSize(text: string, width: number) {
  const longest = Math.max(...text.split('\n').map((l) => l.trim().length), 1)
  const vw = Math.min(16, Math.max(6.4, 174 / longest))
  return Math.min(76, Math.max(28, (vw * width) / 100))
}

/** Naziv u kartici plejera — kao `cardSongSize` u SongCredit. */
function cardSongSize(song: string, width: number) {
  const em = Math.max(song.length, 1) * 0.86 + 0.16
  return Math.min(13, (Math.min(width * 0.86, 340) - 124) / em)
}

export function VerseMock({
  verse,
  date,
  w,
  h,
  mood,
  top = 64,
  saved = true,
  savedCount = 3,
  bellOn = true,
}: {
  verse: Verse
  date: string
  /** dimenzije ekrana u pikselima uređaja */
  w: number
  h: number
  mood?: Mood
  /** razmak do zaglavlja — ispod statusne trake */
  top?: number
  saved?: boolean
  /** broj na ikonici sačuvanih; 0 = ikonice nema, kao u aplikaciji */
  savedCount?: number
  bellOn?: boolean
}) {
  const m = MOODS[mood ?? verse.mood]
  const text = withPeriod(verse.text)
  const size = verseSize(text, w)

  return (
    <div style={{ ...fill, color: '#f5f5f5', fontFamily: 'var(--font-sans), sans-serif' }}>
      <MoodStill mood={mood ?? verse.mood} w={w} h={h} cover={albumOf(verse.album)?.cover} lift={albumOf(verse.album)?.lift} />
      <Notes
        accent={m.accent}
        spots={[
          [12, 61, 30, '♫'],
          [80, 72, 22, '♪'],
          [26, 75, 24, '♬'],
          [85, 30, 18, '♩'],
        ]}
      />

      <div
        style={{
          ...fill,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: `${top}em 24em 30em`,
        }}
      >
        {/* zaglavlje */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/signature.webp" alt="" style={{ height: '40em', width: 'auto', opacity: 0.9 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '18em', color: 'rgba(255,255,255,0.42)' }}>
            <Icon d={BELL} fill={bellOn ? 'rgba(141,201,163,0.22)' : 'none'} color={bellOn ? '#8DC9A3' : '#D08C8C'} />
            {savedCount > 0 && <SavedIcon count={savedCount} />}
            <Icon d={SHARE} />
          </div>
        </div>

        {/* datum → stih → srce */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '30em',
          }}
        >
          <p
            className="tabular"
            style={{
              fontSize: '10.5em',
              fontWeight: 600,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: m.accent,
              opacity: 0.78,
            }}
          >
            {formatFullDateBs(date)}
          </p>
          <p
            className="verse"
            style={{
              fontSize: `${size}em`,
              color: m.text,
              textShadow: `0 0.07em 1em rgba(0,0,0,0.5), 0 0 1.6em ${m.accent}2e`,
            }}
          >
            {text.split('\n').map((l, i) => (
              <span key={i} style={{ display: 'block' }}>
                {l}
              </span>
            ))}
          </p>
          <span
            style={{
              fontSize: '10em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.8em',
              height: '3.6em',
              minWidth: '15.2em',
              padding: '0 1.6em',
              borderRadius: '99em',
              border: `0.1em solid ${saved ? `${m.accent}66` : 'rgba(255,255,255,0.14)'}`,
              background: saved ? `${m.accent}14` : 'rgba(255,255,255,0.03)',
              color: saved ? m.accent : 'rgba(255,255,255,0.6)',
              fontWeight: 500,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              style={{ width: '1.4em', height: '1.4em' }}
              fill={saved ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            >
              <path d={HEART} />
            </svg>
            {saved ? 'Sačuvano' : 'Sačuvaj stih'}
          </span>
        </div>

        {/* podnožje */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <PlayerMock verse={verse} w={w} />
          <span
            style={{
              margin: '22em 0',
              width: '64em',
              height: '1em',
              background: `linear-gradient(to right, transparent, ${m.accent}59, transparent)`,
            }}
          />
          <MagazaMark height={22} style={{ marginTop: '22em', opacity: 0.9 }} />
        </div>
      </div>
    </div>
  )
}

/**
 * Zaključan ekran Androida s obavijesti od 12:00 — ritual u jednoj slici.
 * Pozadina je ista atmosfera kao stih koji stiže.
 */
export function LockScreenMock({
  verse,
  date,
  w,
  h,
  notify = true,
}: {
  verse: Verse
  date: string
  w: number
  h: number
  /** kartica obavijesti sa stihom; bez nje samo sat i pozadina */
  notify?: boolean
}) {
  const m = MOODS[verse.mood]
  const day = formatDayBs(date)
  const [d, mon] = formatDateBs(date).split(' ')

  return (
    <div style={{ ...fill, color: '#fff', fontFamily: 'var(--font-sans), sans-serif' }}>
      <MoodStill mood={verse.mood} w={w} h={h} dim={0.12} cover={albumOf(verse.album)?.cover} lift={albumOf(verse.album)?.lift} />
      <Notes
        accent={m.accent}
        spots={[
          [16, 70, 26, '♫'],
          [78, 80, 20, '♪'],
        ]}
      />

      <div style={{ position: 'absolute', top: '84em', left: 0, right: 0, textAlign: 'center' }}>
        <p style={{ fontSize: '15em', fontWeight: 500, color: 'rgba(255,255,255,0.88)' }}>
          {day[0].toUpperCase() + day.slice(1)}, {d} {mon}
        </p>
        <p
          className="tabular"
          style={{
            fontSize: '96em',
            fontWeight: 300,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            marginTop: '0.06em',
            textShadow: '0 0.04em 0.3em rgba(0,0,0,0.25)',
          }}
        >
          12:00
        </p>
      </div>

      {/* obavijest — kao u One UI: zaobljena kartica, ikona, naziv, vrijeme */}
      {notify && (
        <div
          style={{
            position: 'absolute',
            top: '322em',
            left: '14em',
            right: '14em',
            borderRadius: '26em',
            padding: '15em 16em 16em',
            background: 'rgba(28,28,32,0.72)',
            border: '1em solid rgba(255,255,255,0.08)',
            boxShadow: '0 10em 30em rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8em', color: 'rgba(255,255,255,0.62)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" style={{ width: '20em', height: '20em', borderRadius: '6em' }} />
            <span style={{ fontSize: '12.5em' }}>Stih dana</span>
            <span style={{ fontSize: '12.5em', opacity: 0.7 }}>· sada</span>
          </div>
          <p style={{ marginTop: `${(10 / 15).toFixed(3)}em`, fontSize: '15em', fontWeight: 600 }}>
            Stih dana — Dino Merlin
          </p>
          <p
            style={{
              marginTop: '0.25em',
              fontSize: '15em',
              lineHeight: 1.35,
              color: 'rgba(255,255,255,0.82)',
              fontFamily: 'var(--font-serif), serif',
            }}
          >
            {oneLine(withPeriod(verse.text))}
          </p>
        </div>
      )}

      {/* prečice na dnu */}
      <div
        style={{
          position: 'absolute',
          bottom: '36em',
          left: '34em',
          right: '34em',
          display: 'flex',
          justifyContent: 'space-between',
          color: 'rgba(255,255,255,0.85)',
        }}
      >
        <Shortcut d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
        <Shortcut d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      </div>
    </div>
  )
}

/* ── sitni dijelovi ─────────────────────────────────────────── */

const BELL = 'M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5M13.7 20a2 2 0 0 1-3.4 0'
const SHARE = 'M12 3v13M12 3 8 7M12 3l4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6'
const HEART = 'M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z'

function Icon({ d, color = 'currentColor', fill = 'none' }: { d: string; color?: string; fill?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ width: '20em', height: '20em', color }}
      fill={fill}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

/** Ikonica sačuvanih s brojačem — ista kao `SavedLink` u aplikaciji. */
function SavedIcon({ count }: { count: number }) {
  return (
    <span style={{ position: 'relative', display: 'flex' }}>
      <svg
        viewBox="0 0 24 24"
        style={{ width: '20em', height: '20em' }}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 3.5h9.5A2.5 2.5 0 0 1 20 6v11" />
        <rect x="4" y="6.5" width="13" height="14" rx="2.5" />
        <path
          d="M10.5 16.8s-3-1.8-3-4a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2.2-3 4-3 4z"
          fill="currentColor"
          stroke="none"
        />
      </svg>
      <span
        className="tabular"
        style={{
          position: 'absolute',
          right: '-8em',
          top: '-6em',
          height: '14em',
          minWidth: '14em',
          padding: '0 3em',
          borderRadius: '99em',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(191,168,127,0.22)',
          boxShadow: 'inset 0 0 0 1em rgba(191,168,127,0.45)',
          color: '#D9C49C',
        }}
      >
        <span style={{ fontSize: '8.5em', fontWeight: 600, lineHeight: 1 }}>{count}</span>
      </span>
    </span>
  )
}

function Shortcut({ d }: { d: string }) {
  return (
    <span
      style={{
        width: '50em',
        height: '50em',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.12)',
      }}
    >
      <svg
        viewBox="0 0 24 24"
        style={{ width: '22em', height: '22em' }}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      >
        <path d={d} />
      </svg>
    </span>
  )
}

/** Plejer ispod stiha — ista kartica kao u SongCredit, mirna, na početku pjesme. */
function PlayerMock({ verse, w }: { verse: Verse; w: number }) {
  return (
    <div
      style={{
        position: 'relative',
        width: `${Math.min(w * 0.86, 340)}em`,
        display: 'flex',
        alignItems: 'center',
        gap: '14em',
        padding: '14em 16em 14em 14em',
        borderRadius: '22em',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.045)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        textAlign: 'left',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: '24em',
          right: '24em',
          top: 0,
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${BRAND.gold}80, transparent)`,
        }}
      />
      <span
        style={{
          position: 'relative',
          width: '48em',
          height: '48em',
          flexShrink: 0,
          borderRadius: '50%',
          border: `1.5px solid ${BRAND.gold}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            width: '38em',
            height: '38em',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, #F1E2BF, ${BRAND.gold} 45%, #8A7148)`,
            boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          <svg viewBox="0 0 12 12" style={{ width: '14em', height: '14em', marginLeft: '2em' }} aria-hidden>
            <path d="M2 1v10l9-5z" fill="#16110A" />
          </svg>
        </span>
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8em' }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: `${cardSongSize(verse.song, w).toFixed(2)}em`,
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              lineHeight: 1,
              color: BRAND.gold,
            }}
          >
            {verse.song}
          </span>
          <span style={{ display: 'flex', alignItems: 'flex-end', gap: '2em', height: '14em' }}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ width: '3em', height: '3em', borderRadius: '2em', background: BRAND.gold }} />
            ))}
          </span>
        </span>
        <span
          style={{
            display: 'block',
            marginTop: `${(6 / 9.5).toFixed(3)}em`,
            fontSize: '9.5em',
            lineHeight: 1,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          {verse.album} · {verse.year}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '10em', height: '24em', marginTop: '4em' }}>
          <span style={{ position: 'relative', flex: 1, height: '3em', borderRadius: '2em', background: 'rgba(255,255,255,0.12)' }}>
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                width: '12em',
                height: '12em',
                marginTop: '-6em',
                marginLeft: '-6em',
                borderRadius: '50%',
                background: '#F1E2BF',
              }}
            />
          </span>
          <span style={{ width: '36em', textAlign: 'right', fontSize: '10em', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.55)' }}>
            3:45
          </span>
        </span>
      </span>
    </div>
  )
}

/** Znak Magaze u `em` — `MagazaLogo` radi u pikselima. */
export function MagazaMark({
  height,
  color = '#FFFFFF',
  style,
}: {
  height: number
  color?: string
  style?: CSSProperties
}) {
  const mask = 'url(/brand/magaza.svg) center / contain no-repeat'
  return (
    <span
      role="img"
      aria-label="Magaza"
      style={{
        display: 'inline-block',
        height: `${height}em`,
        width: `${((height * 316) / 87).toFixed(2)}em`,
        background: color,
        mask,
        WebkitMask: mask,
        ...style,
      }}
    />
  )
}
