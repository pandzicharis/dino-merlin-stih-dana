import { lookCss, lookScale, parseFont, wordFont } from '@/lib/fonts'
import { FitLines } from './FitLines'
import { Fragment, type CSSProperties } from 'react'
import { MOODS, FIGURE_SRC, type Mood } from '@/data/moods'
import type { Verse } from '@/data/verses'
import { albumOf, ALBUMS } from '@/data/albums'
import { BRAND, MAGAZA_BESIDE, MAGAZA_DROP_CSS, MAGAZA_RATIO } from '@/lib/brand'
import { MAGAZA_PATH } from '@/lib/magaza-path'
import { formatDateBs, formatDayBs, formatFullDateBs } from '@/lib/date'
import { asWritten } from '@/lib/text'
import { INVITE } from '@/lib/notify'
import { audioFile } from '@/lib/audio-name'
import AUDIO from '@/data/audio.json'

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
/** boja iznad omota: puna do njegovog ruba, pa se utopi; strane kao omot */
const FILL_MASK =
  'linear-gradient(to bottom, black 62%, transparent 100%), linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)'
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
  const coverFill = cover ? ALBUMS.find((a) => a.cover === cover)?.fill : undefined
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
          {/* boja iznad omota (npr. bijeli papir) — nastavi ga do vrha, kao u aplikaciji */}
          {coverFill && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: `${((w - art) / 2).toFixed(1)}em`,
                width: `${art.toFixed(1)}em`,
                height: `${(h * 0.06 + art * (0.3 - lift)).toFixed(1)}em`,
                background: coverFill,
                opacity: 0.42,
                maskImage: FILL_MASK,
                WebkitMaskImage: FILL_MASK,
                maskComposite: 'intersect',
                WebkitMaskComposite: 'source-in',
              }}
            />
          )}
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
export function Notes({ accent, spots }: { accent: string; spots: [number, number, number, string][] }) {
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

/** Naziv pored ploče — kao `cardSongSize` u SongCredit. */
function cardSongSize(song: string, width: number) {
  const em = Math.max(song.length, 1) * 0.9 + 0.18
  return Math.min(15, (width - 108) / em)
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
  streak = 7,
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
  /** dana zaredom — pilula iznad datuma, tek od drugog dana (Streak.tsx) */
  streak?: number
}) {
  const m = MOODS[mood ?? verse.mood]
  const text = asWritten(verse.text)
  // dizajn cijelog stiha (lib/fonts.ts) — kao VerseText u aplikaciji
  const look = parseFont(verse.font).look
  const size = verseSize(text, w) * lookScale(look)

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
          padding: `${top}em 24em ${savedCount > 0 ? 116 : 62}em`,
        }}
      >
        {/* zaglavlje */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* potpis | Magaza — kao VerseScreen */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14em' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/signature.webp?v=2" alt="" style={{ height: '36em', width: 'auto', opacity: 0.9 }} />
            <span style={{ width: '1em', height: '24em', background: 'rgba(255,255,255,0.2)' }} />
            <MagazaMark height={36 * MAGAZA_BESIDE} style={{ opacity: 0.9, transform: MAGAZA_DROP_CSS }} />
          </div>
          {/* sačuvani i postavke — kao VerseScreen (obavijesti su u postavkama) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20em', color: 'rgba(255,255,255,0.6)' }}>
            {savedCount > 0 && <SavedIcon count={savedCount} />}
            <Gear />
          </div>
        </div>

        {/* datum → stih → srce — malo iznad sredine, kao na ekranu stiha */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            // razmaci kao na ekranu stiha: datum → stih → dugmad (32 / 52)
            gap: '32em',
            padding: '16em 0 72em',
          }}
        >
          {/* niz dana → datum, kao na ekranu stiha (više zraka do stiha) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12em' }}>
            {streak > 1 && <StreakPill n={streak} />}
            <p
              className="tabular"
              style={{
                fontSize: '12em',
                fontWeight: 700,
                letterSpacing: '0.2em',
                whiteSpace: 'nowrap',
                textTransform: 'uppercase',
                color: m.accent,
                textShadow: '0 1px 2px rgba(0,0,0,0.85), 0 0 14px rgba(0,0,0,0.65)',
              }}
            >
              {formatFullDateBs(date)}
            </p>
          </div>
          <p
            className="verse"
            style={{
              ...lookCss(look, m.accent),
              fontSize: `${size}em`,
              color: m.text,
              textShadow: `0 0.07em 1em rgba(0,0,0,0.5), 0 0 1.6em ${m.accent}2e`,
              alignSelf: 'stretch',
            }}
          >
            {/* svaki red cio, kao u aplikaciji — slova se smanje, red se ne lomi */}
            <FitLines>
              <FontedLines text={text} font={verse.font} />
            </FitLines>
          </p>
          {/* radnje stiha: sačuvaj i podijeli, jedno do drugog — FavoriteButton i ShareButton */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10em', marginTop: '20em' }}>
            <Pill accent={m.accent} on={saved} wide>
              <svg viewBox="0 0 24 24" style={{ width: '1.4em', height: '1.4em' }} fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                <path d={HEART} />
              </svg>
              {saved ? 'Sačuvano' : 'Sačuvaj'}
            </Pill>
            <Pill accent={m.accent}>
              <svg viewBox="0 0 24 24" style={{ width: '1.4em', height: '1.4em' }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={SHARE} />
              </svg>
              Podijeli
            </Pill>
          </div>
        </div>

        {/* podnožje */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <PlayerMock verse={verse} w={w} />
          {/* "Player pjesama" ispod gramofona (kad ima sačuvanih) — mreže su u postavkama */}
          {/* crtica ispod gramofona; "Player pjesama" je traka na dnu (kao u aplikaciji) */}
          {savedCount === 0 && (
            <span
              style={{
                margin: '22em 0',
                width: '64em',
                height: '1em',
                background: `linear-gradient(to right, transparent, ${m.accent}59, transparent)`,
              }}
            />
          )}
        </div>
      </div>
      {/* "Player pjesama" — na dnu, bez okvira, odmaknut od gramofona (PlayerDock) */}
      {savedCount > 0 && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            padding: '12em 0 24em',
          }}
        >
          {/* pilula na sredini footera: omoti · natpis · trake */}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12em',
              padding: '7em 16em 7em 7em',
              borderRadius: '99em',
              background: 'rgba(255,255,255,0.05)',
            }}
          >
            <span style={{ display: 'flex' }} aria-hidden>
              {ALBUMS.slice(0, 3).map((al, i) => (
                <span
                  key={al.cover}
                  style={{
                    width: '24em',
                    height: '24em',
                    marginLeft: i ? '-9em' : 0,
                    borderRadius: '50%',
                    border: '1.5em solid #0c0b0a',
                    backgroundImage: `url(${al.cover})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    boxShadow: '0 2em 6em rgba(0,0,0,0.5)',
                    position: 'relative',
                    zIndex: 3 - i,
                  }}
                />
              ))}
            </span>
            <span style={{ fontSize: '9.5em', fontWeight: 500, letterSpacing: '0.26em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
              Player pjesama <span style={{ color: 'rgba(255,255,255,0.35)' }}>{savedCount}</span>
            </span>
            {/* trake kao na dugmetu u aplikaciji */}
            <span style={{ display: 'flex', alignItems: 'flex-end', gap: '2em', height: '12em' }} aria-hidden>
              {[0.55, 1, 0.4, 0.8].map((h, i) => (
                <span key={i} style={{ width: '2em', height: `${h * 100}%`, borderRadius: '2em', background: m.accent }} />
              ))}
            </span>
          </span>
        </span>
      )}
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
  /** kartica dnevnog poziva (lib/notify.ts); bez nje samo sat i pozadina */
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
            // tanki sat zaključanog ekrana (kao na telefonu), ne zaobljeni Rubik
            fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", var(--font-sans), sans-serif',
            fontWeight: 250,
            letterSpacing: '-0.02em',
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
            <img src="/icons/icon-192.png?v=2" alt="" style={{ width: '20em', height: '20em', borderRadius: '6em' }} />
            <span style={{ fontSize: '12.5em' }}>Stih dana</span>
            <span style={{ fontSize: '12.5em', opacity: 0.7 }}>· sada</span>
          </div>
          <p style={{ marginTop: `${(10 / 15).toFixed(3)}em`, fontSize: '15em', fontWeight: 600 }}>
            {INVITE.title}
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
            {/* poziv, ne stih — stih se otkriva tek kad se izvuče */}
            {INVITE.body}
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

const SHARE = 'M12 3v13M12 3 8 7M12 3l4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6'
const HEART = 'M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z'

/** Pilula radnje ispod stiha — isti oblik kao FavoriteButton / ShareButton (h-11, verzal). */
function Pill({ accent, on = false, wide = false, children }: { accent: string; on?: boolean; wide?: boolean; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '10em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.8em',
        height: '4.4em',
        minWidth: wide ? '13.6em' : undefined,
        padding: wide ? '0 1.6em' : '0 2em',
        borderRadius: '99em',
        border: `0.1em solid ${on ? `${accent}66` : 'rgba(255,255,255,0.14)'}`,
        background: on ? `${accent}14` : 'rgba(255,255,255,0.03)',
        color: on ? accent : 'rgba(255,255,255,0.75)',
        fontWeight: 500,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  )
}

/** Niz dana — tamna pilula s vatricom iznad datuma (Streak.tsx). */
function StreakPill({ n }: { n: number }) {
  return (
    <span
      className="tabular"
      style={{
        fontSize: '9.5em',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6em',
        padding: '0.4em 1.05em 0.4em 0.85em',
        borderRadius: '99em',
        border: '0.1em solid rgba(255,255,255,0.1)',
        background: 'rgba(0,0,0,0.3)',
        color: 'rgba(255,255,255,0.8)',
        fontWeight: 500,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
      }}
    >
      <svg viewBox="0 0 24 24" style={{ width: '1.26em', height: '1.26em' }} aria-hidden>
        <defs>
          <linearGradient id="mock-flame" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFD27A" />
            <stop offset="0.55" stopColor="#FF9A3D" />
            <stop offset="1" stopColor="#F2552C" />
          </linearGradient>
        </defs>
        <path
          fill="url(#mock-flame)"
          d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        />
      </svg>
      {n}. stih dana
    </span>
  )
}

/** Zupčanik postavki — isti kao `SettingsButton` u aplikaciji. */
function Gear() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '23em', height: '23em' }} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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

/** Na grafikama pjesma nije na početku — pauzirana negdje u prvoj polovini. */
const AT = 0.38

/** Plejer ispod stiha — ista ploča kao u SongCredit, mirna, pauzirana usred pjesme. */
function PlayerMock({ verse, w }: { verse: Verse; w: number }) {
  // kao CARD_W u SongCredit: min(100vw − 2.5rem, 360px)
  const width = Math.min(w - 40, 360)
  // kao u aplikaciji: kad je pjesma krenula, piše koliko je ostalo
  const dur = (AUDIO as Record<string, number>)[audioFile(verse.song)] ?? 225
  const left = Math.round(dur * (1 - AT))
  const time = `-${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
  return (
    <div style={{ width: `${width}em`, display: 'flex', alignItems: 'center', gap: '16em', textAlign: 'left' }}>
      <span style={{ position: 'relative', width: '62em', height: '62em', flexShrink: 0 }}>
        <svg viewBox="0 0 60 60" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} aria-hidden>
          <defs>
            <radialGradient id="vm-disc" cx="50%" cy="50%" r="50%">
              <stop offset="0.3" stopColor="#36312B" />
              <stop offset="0.7" stopColor="#1B1917" />
              <stop offset="1" stopColor="#0B0A09" />
            </radialGradient>
            <linearGradient id="vm-rim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F1E2BF" stopOpacity="0.95" />
              <stop offset="0.5" stopColor={BRAND.gold} stopOpacity="0.35" />
              <stop offset="1" stopColor="#8A7148" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="vm-label" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F1E2BF" />
              <stop offset="0.45" stopColor={BRAND.gold} />
              <stop offset="1" stopColor="#8A7148" />
            </linearGradient>
          </defs>
          <circle cx="30" cy="30" r="28.5" fill="none" stroke={`${BRAND.gold}47`} strokeWidth="1.5" />
          <circle cx="30" cy="30" r="26" fill="url(#vm-disc)" />
          <circle cx="30" cy="30" r="25.4" fill="none" stroke="url(#vm-rim)" strokeWidth="1.1" />
          {[23.5, 22, 20.5, 19, 17.5, 16, 14.5].map((r, i) => (
            <circle key={r} cx="30" cy="30" r={r} fill="none" stroke="#fff" strokeOpacity={i % 2 ? 0.05 : 0.1} strokeWidth="0.5" />
          ))}
          <path d="M30 6.5A23.5 23.5 0 0 1 50.4 18.3L30 30z" fill="#fff" fillOpacity="0.13" />
          <path d="M30 53.5A23.5 23.5 0 0 1 9.6 41.7L30 30z" fill="#fff" fillOpacity="0.08" />
          <circle cx="30" cy="30" r="12" fill="url(#vm-label)" />
          <circle cx="30" cy="30" r="12" fill="none" stroke="#5E4C30" strokeWidth="0.6" />
          {/* ručica gramofona u mirovanju, lijevo od ploče */}
          <g transform="rotate(14 2 4)">
            <rect x="-1" y="-6.5" width="6" height="6.5" rx="1.4" fill="#2A2622" stroke={BRAND.gold} strokeOpacity="0.6" strokeWidth="0.5" />
            <path d="M2 4V37Q2 41.5 4.8 44.6" fill="none" stroke="#DCCBA4" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M6.8 42.6l-4.4 2.8 2.6 4.1 4.4-2.8z" fill={BRAND.gold} stroke="#5E4C30" strokeWidth="0.4" />
            <circle cx="2" cy="4" r="4.6" fill="#2A2622" stroke={BRAND.gold} strokeOpacity="0.7" strokeWidth="0.7" />
            <circle cx="2" cy="4" r="1.6" fill={BRAND.gold} />
          </g>
          <path d="M28 25.5v9l7.5-4.5z" fill="#16110A" />
        </svg>
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
              fontSize: `${cardSongSize(verse.song, width).toFixed(2)}em`,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              lineHeight: 1,
              color: BRAND.gold,
            }}
          >
            {verse.song}
          </span>
        </span>
        <span
          style={{
            display: 'block',
            marginTop: `${(8 / 10.5).toFixed(3)}em`,
            fontSize: '10.5em',
            lineHeight: 1,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          {verse.album} · {verse.year}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '10em', height: '24em', marginTop: '4em' }}>
          <span style={{ position: 'relative', flex: 1, height: '2em', borderRadius: '2em', background: 'rgba(255,255,255,0.15)' }}>
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `calc(${AT} * (100% - 10em) + 5em)`,
                borderRadius: '2em',
                background: `linear-gradient(90deg, #8A7148, ${BRAND.gold})`,
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: `calc(${AT} * (100% - 10em))`,
                top: '50%',
                width: '10em',
                height: '10em',
                marginTop: '-5em',
                borderRadius: '50%',
                background: '#F1E2BF',
              }}
            />
          </span>
          <span style={{ width: `${(36 / 10.5).toFixed(3)}em`, textAlign: 'right', fontSize: '10.5em', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.6)' }}>
            {time}
          </span>
        </span>
      </span>
    </div>
  )
}

/** Znak Magaze u `em` — `MagazaLogo` radi u pikselima. Putanja iz koda, bez zahtjeva. */
export function MagazaMark({
  height,
  color = '#FFFFFF',
  style,
}: {
  height: number
  color?: string
  style?: CSSProperties
}) {
  return (
    <svg
      role="img"
      aria-label="Magaza"
      viewBox="0 0 316 67"
      style={{ display: 'inline-block', flexShrink: 0, height: `${height}em`, width: `${(height * MAGAZA_RATIO).toFixed(2)}em`, ...style }}
    >
      <path d={MAGAZA_PATH} fill={color} fillRule="evenodd" clipRule="evenodd" />
    </svg>
  )
}

/** Stih po redovima, svaka riječ u svom fontu (lib/fonts.ts) — kao na ekranu aplikacije. */
export function FontedLines({ text, font }: { text: string; font?: string }) {
  const map = parseFont(font)
  let n = 0
  return (
    <>
      {text.split('\n').map((l, i) => (
        <span key={i} style={{ display: 'block' }}>
          {l
            .trim()
            .split(/\s+/)
            .map((w, j) => {
              const k = n++
              return (
                <Fragment key={j}>
                  <span style={wordFont(map, k)}>{w}</span>{' '}
                </Fragment>
              )
            })}
        </span>
      ))}
    </>
  )
}
