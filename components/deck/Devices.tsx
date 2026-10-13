import type { CSSProperties, ReactNode } from 'react'

/**
 * Okviri uređaja za prezentaciju i plakat.
 *
 * Sve mjere su u `em`, a 1em je jedan CSS piksel ekrana uređaja. Veličina
 * cijelog telefona bira se tako jednim `width`, a okvir ostaje oštar i
 * vektorski i kad se plakat štampa na A2.
 */

/** iPhone 16 Pro — ekran u CSS pikselima. */
export const IPHONE = { w: 402, h: 874, rim: 3.5, bezel: 11, radius: 54 } as const
/** Samsung Galaxy S25 — ekran u CSS pikselima. */
export const GALAXY = { w: 384, h: 832, rim: 3, bezel: 8, radius: 34 } as const

export type DeviceKind = 'iphone' | 'galaxy'

export function deviceOuter(kind: DeviceKind) {
  const d = kind === 'iphone' ? IPHONE : GALAXY
  const edge = (d.rim + d.bezel) * 2
  return { w: d.w + edge, h: d.h + edge, screen: d }
}

type FrameProps = {
  /** širina cijelog uređaja, bilo koja CSS dužina */
  width: string
  children: ReactNode
  /** sat u statusnoj traci; null = bez trake (npr. kad je ekran pravi iframe) */
  time?: string | null
  className?: string
  style?: CSSProperties
}

export function IPhone({ width, children, time = '12:00', className, style }: FrameProps) {
  const { w, h } = deviceOuter('iphone')
  const { rim, bezel } = IPHONE
  return (
    <div
      className={className}
      style={{
        fontSize: `calc(${width} / ${w})`,
        width: `${w}em`,
        height: `${h}em`,
        position: 'relative',
        flexShrink: 0,
        ...style,
      }}
    >
      {/* bočna dugmad — iza tijela, da proviruju samo rubom */}
      <Button side="left" top={168} height={34} />
      <Button side="left" top={228} height={62} />
      <Button side="left" top={302} height={62} />
      <Button side="right" top={258} height={98} />
      <Button side="right" top={540} height={74} subtle />

      {/* titanijski rub */}
      <div
        className="poster-shadow"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '68em',
          padding: `${rim}em`,
          background:
            'linear-gradient(145deg, #8E8A84 0%, #3A3835 18%, #77736C 45%, #2B2A28 70%, #9A958D 100%)',
          boxShadow:
            '0 0 0 0.6em rgba(0,0,0,0.55), 0 3em 6em rgba(0,0,0,0.45), 0 30em 80em rgba(0,0,0,0.55)',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '64.5em',
            padding: `${bezel}em`,
            background: '#050505',
            boxShadow: 'inset 0 0 0 1em rgba(255,255,255,0.06)',
          }}
        >
          <Screen radius={IPHONE.radius} w={IPHONE.w} h={IPHONE.h}>
            {children}
            {time !== null && <IosStatus time={time} />}
            <Island />
            <Glass />
          </Screen>
        </div>
      </div>
    </div>
  )
}

export function Galaxy({ width, children, time = '12:00', className, style }: FrameProps) {
  const { w, h } = deviceOuter('galaxy')
  const { rim, bezel } = GALAXY
  return (
    <div
      className={className}
      style={{
        fontSize: `calc(${width} / ${w})`,
        width: `${w}em`,
        height: `${h}em`,
        position: 'relative',
        flexShrink: 0,
        ...style,
      }}
    >
      <Button side="right" top={200} height={112} flat />
      <Button side="right" top={330} height={58} flat />

      {/* ravan aluminijski okvir — Samsung je uglatiji od iPhonea */}
      <div
        className="poster-shadow"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '44em',
          padding: `${rim}em`,
          background: 'linear-gradient(180deg, #C9CDD2 0%, #9EA3AA 30%, #D7DADF 55%, #8C9198 100%)',
          boxShadow:
            '0 0 0 0.6em rgba(0,0,0,0.55), 0 3em 6em rgba(0,0,0,0.45), 0 30em 80em rgba(0,0,0,0.55)',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '41em',
            padding: `${bezel}em`,
            background: '#030303',
            boxShadow: 'inset 0 0 0 1em rgba(255,255,255,0.05)',
          }}
        >
          <Screen radius={GALAXY.radius} w={GALAXY.w} h={GALAXY.h}>
            {children}
            {time !== null && <AndroidStatus time={time} />}
            <PunchHole />
            <Glass />
          </Screen>
        </div>
      </div>
    </div>
  )
}

function Screen({ radius, w, h, children }: { radius: number; w: number; h: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: `${w}em`,
        height: `${h}em`,
        borderRadius: `${radius}em`,
        overflow: 'hidden',
        background: '#000',
        // bez ovoga Safari zna pustiti uglove iframea preko zaobljenja
        isolation: 'isolate',
        transform: 'translateZ(0)',
      }}
    >
      {children}
    </div>
  )
}

/** Tihi odsjaj stakla — samo nagovještaj, ne smije prekriti stih. */
export function Glass() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 40,
        background: 'linear-gradient(115deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 32%)',
      }}
    />
  )
}

function Button({
  side,
  top,
  height,
  flat = false,
  subtle = false,
}: {
  side: 'left' | 'right'
  top: number
  height: number
  flat?: boolean
  subtle?: boolean
}) {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        [side]: '-2.6em',
        top: `${top}em`,
        width: '4em',
        height: `${height}em`,
        borderRadius: flat ? '1.5em' : '2.5em',
        background: flat
          ? 'linear-gradient(90deg, #A6ABB2, #D6D9DD, #8E939A)'
          : 'linear-gradient(90deg, #4A4743, #8F8A83, #3A3835)',
        opacity: subtle ? 0.7 : 1,
      }}
    />
  )
}

/* ── dijelovi ekrana — izvoze se i za živi telefon u prezentaciji ── */

/** Dynamic Island — iznad sadržaja, kao na pravom iPhoneu. */
export function Island() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: '11em',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '124em',
        height: '36em',
        borderRadius: '20em',
        background: '#000',
        zIndex: 30,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          right: '26em',
          top: '12em',
          width: '12em',
          height: '12em',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #2a3550 0%, #0b0e17 55%, #000 100%)',
        }}
      />
    </div>
  )
}

/** Kamera u rupici, centrirana — Galaxy. */
export function PunchHole() {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: '13em',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '13em',
        height: '13em',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 38%, #24304a 0%, #07090f 60%, #000 100%)',
        boxShadow: '0 0 0 1.5em #000',
        zIndex: 30,
        pointerEvents: 'none',
      }}
    />
  )
}

/* ── statusne trake ─────────────────────────────────────────── */

export function IosStatus({ time }: { time: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '54em',
        zIndex: 35,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 30em 0 52em',
        color: '#fff',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          fontSize: '17em',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          fontFamily: '-apple-system, "SF Pro Text", var(--font-sans), sans-serif',
        }}
      >
        {time}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6em' }}>
        <Signal />
        <Wifi />
        <Battery />
      </span>
    </div>
  )
}

export function AndroidStatus({ time }: { time: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '40em',
        zIndex: 35,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 22em',
        color: '#fff',
        pointerEvents: 'none',
      }}
    >
      <span style={{ fontSize: '13.5em', fontWeight: 500, fontFamily: 'var(--font-sans), sans-serif' }}>{time}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '5em' }}>
        <Wifi small />
        <Signal small />
        <Battery small />
      </span>
    </div>
  )
}

function Signal({ small = false }: { small?: boolean }) {
  const s = small ? 0.82 : 1
  return (
    <svg viewBox="0 0 18 12" style={{ width: `${18 * s}em`, height: `${12 * s}em` }} fill="currentColor">
      <rect x="0" y="8" width="3" height="4" rx="1" />
      <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
      <rect x="10" y="3" width="3" height="9" rx="1" />
      <rect x="15" y="0" width="3" height="12" rx="1" />
    </svg>
  )
}

function Wifi({ small = false }: { small?: boolean }) {
  const s = small ? 0.82 : 1
  return (
    <svg viewBox="0 0 16 12" style={{ width: `${16 * s}em`, height: `${12 * s}em` }} fill="currentColor">
      <path d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.3-1.4A10.8 10.8 0 0 0 8 .3 10.8 10.8 0 0 0 .4 3.3l1.3 1.4A9 9 0 0 1 8 2.2z" />
      <path d="M8 5.6c1.5 0 2.8.5 3.9 1.5l1.3-1.4A7.6 7.6 0 0 0 8 3.7a7.6 7.6 0 0 0-5.2 2l1.3 1.4A5.7 5.7 0 0 1 8 5.6z" />
      <path d="M8 9a2.3 2.3 0 0 1 1.6.6L8 11.4 6.4 9.6A2.3 2.3 0 0 1 8 9z" />
    </svg>
  )
}

function Battery({ small = false }: { small?: boolean }) {
  const s = small ? 0.82 : 1
  return (
    <svg viewBox="0 0 27 13" style={{ width: `${27 * s}em`, height: `${13 * s}em` }} fill="none">
      <rect x="0.5" y="0.5" width="23" height="12" rx="3.8" stroke="currentColor" opacity="0.4" />
      <rect x="2.2" y="2.2" width="17" height="8.6" rx="2.2" fill="currentColor" />
      <path d="M25 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2z" fill="currentColor" opacity="0.45" />
    </svg>
  )
}
