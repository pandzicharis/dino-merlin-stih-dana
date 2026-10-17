import type { CSSProperties, ReactNode } from 'react'
import { BRAND } from '@/lib/brand'
import { FIGURE_SRC } from '@/data/moods'
import type { Verse } from '@/data/verses'
import type { QrMatrix } from '@/lib/qr'
import { SEND_TIME } from '@/lib/date'
import { IPhone, Galaxy, IPHONE, GALAXY } from './Devices'
import { VerseMock, LockScreenMock, MagazaMark } from './Screens'
import { QrCode } from './QrCode'

export type PosterData = {
  qr: QrMatrix
  /** adresa ispisana ispod koda, bez https:// */
  host: string
  /** stih na iPhoneu */
  hero: Verse
  /** stih u obavijesti na Samsungu */
  notify: Verse
  date: string
}

/**
 * Promo materijal za Magazu: plakat A3 uspravno, A4 položeno i objave za
 * društvene mreže — svi iz istih dijelova.
 *
 * Nijedna mjera nije apsolutna: 1em je 1% širine formata. Isti fajl se zato
 * štampa na A3, A2 ili A1 samo izborom papira, a na slajdu je ista
 * komponenta, umanjena.
 */

const serif = "var(--font-serif), serif"

export function Sheet({
  width,
  ratio,
  children,
  style,
}: {
  width: string
  /** visina / širina */
  ratio: number
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      className="poster"
      style={{
        fontSize: `calc(${width} / 100)`,
        width: '100em',
        height: `${(100 * ratio).toFixed(3)}em`,
        position: 'relative',
        overflow: 'hidden',
        background: '#070708',
        color: '#F4F4F4',
        fontFamily: 'var(--font-sans), sans-serif',
        isolation: 'isolate',
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/* ═══ A3 uspravno ═══════════════════════════════════════════════ */

export function Poster({ data, width, style }: { data: PosterData; width: string; style?: CSSProperties }) {
  return (
    <Sheet width={width} ratio={Math.SQRT2} style={style}>
      <Backdrop portrait={{ right: '-14em', top: '-2em', width: '78em', height: '104em' }} />

      <Headline top="5em" sig="8em" h1="9em" sub="1.9em" center />

      {/* cijeli telefon, s gramofonom — ne tone u donji panel */}
      <Phones data={data} top="47em" height="52em" iphone="24em" galaxy="22.9em" spread="55em" />

      <Fade top="99em" span={6} />

      <div
        style={{
          position: 'absolute',
          left: '7em',
          right: '7em',
          bottom: '5.5em',
          display: 'flex',
          alignItems: 'center',
          gap: '5em',
          zIndex: 4,
        }}
      >
        <QrCard qr={data.qr} width="24em" label="1.35em" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Steps title="2.65em" sub="1.55em" gap="2.1em" />
          <Rule margin="3em 0 2em" />
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '2em' }}>
            <div>
              <Platforms size="1.25em" />
              <p style={{ marginTop: '0.6em', fontSize: '1.45em', color: 'rgba(255,255,255,0.5)' }}>{data.host}</p>
            </div>
            <MagazaMark height={3.6} color="rgba(255,255,255,0.9)" />
          </div>
        </div>
      </div>

    </Sheet>
  )
}

/* ═══ A4 položeno ═══════════════════════════════════════════════ */

export function PosterLandscape({ data, width, style }: { data: PosterData; width: string; style?: CSSProperties }) {
  return (
    <Sheet width={width} ratio={1 / Math.SQRT2} style={style}>
      <Backdrop portrait={{ right: '-4em', top: '-6em', width: '62em', height: '84em' }} />

      <MagazaMark
        height={2.3}
        color="rgba(255,255,255,0.85)"
        style={{ position: 'absolute', right: '5em', top: '5em', zIndex: 4 }}
      />

      {/* lijevo: poruka, kod, koraci */}
      <div style={{ position: 'absolute', left: '5.5em', top: '6em', width: '45em', zIndex: 4 }}>
        <Headline sig="5.6em" h1="6.3em" sub="1.32em" />
        <div style={{ marginTop: '3.4em', display: 'flex', alignItems: 'center', gap: '3.2em' }}>
          <QrCard qr={data.qr} width="18.5em" label="1em" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Steps title="1.62em" sub="0.98em" gap="1.35em" />
          </div>
        </div>
        <Rule margin="3.2em 0 1.6em" />
        {/* adresa u jednom redu — s PWA oznakom je red tijesan, pa se ona ne lomi */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5em' }}>
          <Platforms size="0.9em" />
          <p style={{ fontSize: '1em', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', flexShrink: 0 }}>{data.host}</p>
        </div>
      </div>

      {/* desno: telefoni */}
      <div style={{ position: 'absolute', left: '51em', right: '1.5em', top: '9em', height: '56em' }}>
        <Phones data={data} top="0em" height="56em" iphone="23.5em" galaxy="22.4em" spread="47em" />
      </div>
    </Sheet>
  )
}

/* ═══ društvene mreže ═══════════════════════════════════════════ */

/** Objava 4:5 (Instagram, Facebook) — telefon je ionako u ruci, pa umjesto koda link. */
export function SocialPost({ data, width, style }: { data: PosterData; width: string; style?: CSSProperties }) {
  return (
    <Sheet width={width} ratio={1.25} style={style}>
      <Backdrop portrait={{ right: '-18em', top: '-4em', width: '86em', height: '115em' }} />
      <Headline top="4em" sig="7.5em" h1="8.4em" sub="1.95em" center />
      {/* cijeli telefon, s gramofonom — ne tone u poziv ispod */}
      <Phones data={data} top="44.5em" height="50em" iphone="23em" galaxy="21.9em" spread="53em" />
      <Fade top="94.5em" span={5} />
      <div
        style={{
          position: 'absolute',
          left: '7em',
          right: '7em',
          bottom: '15em',
          zIndex: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <Platforms size="1.5em" />
        <LinkPill host={data.host} size="2.25em" style={{ marginTop: '1.4em' }} />
      </div>
      {/* znak sam pri dnu, odvojen od poziva */}
      <MagazaMark
        height={3.4}
        color="rgba(255,255,255,0.85)"
        style={{ position: 'absolute', left: 0, right: 0, bottom: '5em', margin: '0 auto', zIndex: 4 }}
      />
    </Sheet>
  )
}

/**
 * Story 9:16. Vrh i dno pokrivaju Instagramove kontrole i polje za
 * odgovor — gore stoji samo potpis, dolje samo pozadina.
 */
export function SocialStory({ data, width, style }: { data: PosterData; width: string; style?: CSSProperties }) {
  return (
    <Sheet width={width} ratio={16 / 9} style={style}>
      <Backdrop portrait={{ right: '-26em', top: '8em', width: '100em', height: '133em' }} />
      <Headline top="15em" sig="9em" h1="10em" sub="2.35em" center />
      {/* cijeli telefon, s gramofonom — ne tone u poziv ispod */}
      <Phones data={data} top="64em" height="68em" iphone="31em" galaxy="29.5em" spread="72em" />
      <Fade top="132em" span={5} />
      <div
        style={{
          position: 'absolute',
          left: '8em',
          right: '8em',
          bottom: '28em',
          zIndex: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <Platforms size="1.9em" />
        <LinkPill host={data.host} size="2.7em" style={{ marginTop: '1.5em' }} />
      </div>
      {/* znak sam pri dnu, odvojen od poziva */}
      <MagazaMark
        height={4.2}
        color="rgba(255,255,255,0.85)"
        style={{ position: 'absolute', left: 0, right: 0, bottom: '15em', margin: '0 auto', zIndex: 4 }}
      />
    </Sheet>
  )
}

/* ═══ dijelovi ══════════════════════════════════════════════════ */

/** Potpis, nadnaslov, naslov u dva reda i podnaslov. */
function Headline({
  top,
  sig,
  h1,
  sub,
  center = false,
}: {
  top?: string
  sig: string
  h1: string
  sub: string
  center?: boolean
}) {
  const n = parseFloat
  return (
    <div
      style={{
        position: top ? 'absolute' : 'relative',
        top,
        left: 0,
        right: 0,
        zIndex: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: center ? 'center' : 'flex-start',
        textAlign: center ? 'center' : 'left',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/signature.webp?v=2" alt="Dino Merlin" style={{ height: sig, width: 'auto' }} />
      <p
        style={{
          // razmaci su u em-u formata, pa se dijele veličinom vlastitog fonta
          marginTop: `${(n(sig) * 0.5) / (n(h1) * 0.15)}em`,
          fontSize: `${n(h1) * 0.15}em`,
          fontWeight: 500,
          letterSpacing: '0.42em',
          textTransform: 'uppercase',
          color: BRAND.gold,
        }}
      >
        Stih dana
      </p>
      <h1
        style={{
          marginTop: '0.22em',
          fontFamily: serif,
          fontVariationSettings: "'opsz' 144, 'SOFT' 30, 'WONK' 0",
          fontWeight: 360,
          fontSize: h1,
          lineHeight: 0.98,
          letterSpacing: '-0.03em',
          color: '#FBF6EC',
        }}
      >
        Jedan stih.
        <br />
        <span style={{ fontStyle: 'italic', color: '#E9D9B6' }}>Svaki dan.</span>
      </h1>
      <p style={{ marginTop: '1.6em', fontSize: sub, lineHeight: 1.4, color: 'rgba(255,255,255,0.66)' }}>
        Stih Dine Merlina stiže na tvoj telefon — svaki dan u {SEND_TIME}.
      </p>
    </div>
  )
}

/** iPhone sa stihom, iza njega Samsung s obaviješću — nagnuti jedan prema drugom. */
function Phones({
  data,
  top,
  height,
  iphone,
  galaxy,
  spread,
}: {
  data: PosterData
  top: string
  height: string
  iphone: string
  galaxy: string
  spread: string
}) {
  return (
    <div
      data-phones
      style={{ position: 'absolute', top, left: 0, right: 0, height, display: 'flex', justifyContent: 'center' }}
    >
      <div
        style={{
          position: 'absolute',
          left: '10%',
          right: '10%',
          top: '8%',
          height: '80%',
          borderRadius: '50%',
          background: `radial-gradient(ellipse at center, ${BRAND.gold}38 0%, ${BRAND.gold}10 38%, transparent 70%)`,
        }}
      />
      <div style={{ position: 'relative', width: spread, height: '100%' }}>
        <Galaxy
          width={galaxy}
          style={{ position: 'absolute', right: '3%', top: '6%', transform: 'rotate(6deg)', zIndex: 1 }}
        >
          <LockScreenMock verse={data.notify} date={data.date} w={GALAXY.w} h={GALAXY.h} />
        </Galaxy>
        <IPhone width={iphone} style={{ position: 'absolute', left: '3%', top: 0, transform: 'rotate(-5deg)', zIndex: 2 }}>
          <VerseMock verse={data.hero} date={data.date} w={IPHONE.w} h={IPHONE.h} top={70} />
        </IPhone>
      </div>
    </div>
  )
}

/** QR na svijetloj kartici sa zlatnim rubom. */
function QrCard({ qr, width, label }: { qr: QrMatrix; width: string; label: string }) {
  return (
    <div
      style={{
        flexShrink: 0,
        width,
        padding: `calc(${width} * 0.06) calc(${width} * 0.06) calc(${width} * 0.045)`,
        borderRadius: `calc(${width} * 0.095)`,
        background: '#F6F1E7',
        // zlatni rub je pravi rub, ne sjena — u štampi sjene otpadaju
        border: `calc(${width} * 0.0095) solid ${BRAND.gold}`,
        boxShadow: '0 2em 5em rgba(0,0,0,0.55)',
        textAlign: 'center',
      }}
    >
      <QrCode qr={qr} style={{ width: '100%', height: 'auto', display: 'block' }} />
      <p
        style={{
          marginTop: '0.5em',
          fontSize: label,
          fontWeight: 600,
          letterSpacing: '0.36em',
          textTransform: 'uppercase',
          color: '#14100A',
        }}
      >
        Skeniraj
      </p>
    </div>
  )
}

/** Tri koraka od plakata do stiha. */
function Steps({ title, sub, gap }: { title: string; sub: string; gap: string }) {
  const steps: [string, string][] = [
    ['Skeniraj kod kamerom', 'Bez App Storea, bez registracije'],
    ['Dodaj na početni ekran', 'Prati uputstva u aplikaciji'],
    [`Svaki dan u ${SEND_TIME}`, 'Dozvoli obavijesti — i stih te sam pronađe'],
  ]
  const t = parseFloat(title)
  return (
    <ol style={{ display: 'flex', flexDirection: 'column', gap, textAlign: 'left' }}>
      {steps.map(([head, text], i) => (
        <li key={head} style={{ display: 'flex', alignItems: 'center', gap: `${t * 0.68}em`, listStyle: 'none' }}>
          <span
            className="tabular"
            style={{
              flexShrink: 0,
              width: `${t * 1.66}em`,
              height: `${t * 1.66}em`,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `${(t * 0.045).toFixed(3)}em solid ${BRAND.gold}80`,
              color: BRAND.gold,
            }}
          >
            <span style={{ fontSize: `${t * 0.68}em`, fontWeight: 600 }}>{i + 1}</span>
          </span>
          <span>
            <span
              style={{
                display: 'block',
                fontSize: title,
                lineHeight: 1.15,
                color: '#FBF6EC',
                fontFamily: serif,
                fontVariationSettings: "'opsz' 72, 'SOFT' 30",
              }}
            >
              {head}
            </span>
            <span style={{ display: 'block', marginTop: '0.35em', fontSize: sub, color: 'rgba(255,255,255,0.55)' }}>
              {text}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** "Besplatno" i znakovi platformi — da se odmah vidi da radi na oba. */
function Platforms({ size }: { size: string }) {
  return (
    <div style={{ fontSize: size, display: 'flex', alignItems: 'center', gap: '0.65em', flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: BRAND.gold }}>
        Besplatno
      </span>
      <Pill icon={<AppleGlyph />}>iPhone</Pill>
      <Pill icon={<AndroidGlyph />}>Android</Pill>
      {/* web aplikacija — da se zna da nema App Storea */}
      <Pill icon={<PwaGlyph />}>PWA</Pill>
    </div>
  )
}

function Pill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5em',
        height: '2.2em',
        padding: '0 0.95em 0 0.8em',
        borderRadius: '99em',
        border: `0.08em solid ${BRAND.gold}66`,
        background: `${BRAND.gold}14`,
        color: '#F1E6CF',
        letterSpacing: '0.04em',
      }}
    >
      {icon}
      {children}
    </span>
  )
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '1.15em', height: '1.15em', marginTop: '-0.12em' }} fill="currentColor" aria-hidden>
      <path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.4-.9-2.3-4.3zM14 5.3c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3z" />
    </svg>
  )
}

/** Telefon sa strelicom unutra — instalacija na početni ekran, bez storea. */
function PwaGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ width: '1.15em', height: '1.15em' }}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="6" y="2.5" width="12" height="19" rx="2.6" />
      <path d="M12 7v7.5M9 11.5l3 3 3-3" />
    </svg>
  )
}

function AndroidGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '1.2em', height: '1.2em' }} fill="currentColor" aria-hidden>
      <path d="M17.6 9.5l1.7-3a.4.4 0 0 0-.7-.4l-1.8 3A10.6 10.6 0 0 0 12 8.1c-1.7 0-3.3.4-4.8 1l-1.8-3a.4.4 0 0 0-.7.4l1.7 3C3.6 11 1.8 13.8 1.5 17h21c-.3-3.2-2.1-6-4.9-7.5zM7 14.4a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm10 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
    </svg>
  )
}

/** Adresa kao dugme — za objave, gdje se kod ne skenira. */
export function LinkPill({ host, size, style }: { host: string; size: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        fontSize: size,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.6em',
        height: '2.5em',
        padding: '0 1.2em',
        borderRadius: '99em',
        background: 'linear-gradient(180deg, #E2CFA6, #BFA87F)',
        color: '#14100A',
        fontWeight: 600,
        boxShadow: '0 0.6em 1.6em rgba(0,0,0,0.45)',
        ...style,
      }}
    >
      {host}
      <svg viewBox="0 0 24 24" style={{ width: '0.9em', height: '0.9em' }} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  )
}

function Rule({ margin }: { margin: string }) {
  return (
    <span
      style={{
        display: 'block',
        margin,
        height: '0.12em',
        background: `linear-gradient(90deg, ${BRAND.gold}99, transparent)`,
      }}
    />
  )
}

/**
 * Telefoni tonu u donji dio — tekst ispod njih ostaje na čistoj podlozi.
 * `span` je put od prozirnog do pune boje, u em-u formata.
 */
function Fade({ top, span }: { top: string; span: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top,
        bottom: 0,
        zIndex: 3,
        background: `linear-gradient(to bottom, rgba(7,7,8,0) 0em, rgba(7,7,8,0.9) ${(span * 0.66).toFixed(2)}em, #070708 ${span}em, rgba(7,7,8,0.96) 100%)`,
      }}
    />
  )
}

/** Tamna podloga s istim jezikom kao aplikacija: zlatni sjaj, tih portret, vinjeta. */
export function Backdrop({ portrait }: { portrait: CSSProperties }) {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: -1 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(70% 38% at 50% 0%, rgba(255,255,255,0.08) 0%, transparent 70%), radial-gradient(60% 40% at 50% 62%, #1B2A3A 0%, transparent 72%), radial-gradient(50% 30% at 85% 30%, #2A0A18 0%, transparent 70%)',
        }}
      />
      <div
        className="poster-fx"
        style={{
          position: 'absolute',
          ...portrait,
          backgroundImage: `url(${FIGURE_SRC})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'contain',
          backgroundPosition: 'right top',
          filter: 'grayscale(1)',
          mixBlendMode: 'screen',
          opacity: 0.16,
          maskImage: 'radial-gradient(ellipse 60% 55% at 60% 30%, black 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 55% at 60% 30%, black 20%, transparent 75%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.7) 100%)',
        }}
      />
    </div>
  )
}
