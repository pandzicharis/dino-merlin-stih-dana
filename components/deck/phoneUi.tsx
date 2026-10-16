'use client'

import type { CSSProperties } from 'react'
import { motion } from 'motion/react'

/**
 * Zajednički dijelovi sistemskih ekrana — iOS 18 i Android (One UI /
 * Material You), dark mode. Sve u `em`: 1em = 1 piksel ekrana telefona.
 */

export type Platform = 'ios' | 'android'

export const HOST = 'dino-merlin-stih-dana.vercel.app'
export const SF = '-apple-system, "SF Pro Text", "Helvetica Neue", var(--font-sans), sans-serif'
export const ROBOTO = '"Google Sans", Roboto, var(--font-sans), sans-serif'

export const IOS_BLUE = '#0A84FF'
export const IOS_SEP = 'rgba(84,84,88,0.65)'
export const IOS_GRAY = 'rgba(235,235,245,0.6)'

/**
 * Superelipsa kao maska ikonice. iOS ima "kontinuirane" uglove (n≈5), a ne
 * obični border-radius; One UI je nešto obliji (n≈4).
 */
function squircle(n: number) {
  const N = 120
  let d = ''
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    const x = 50 + 50 * Math.sign(c) * Math.abs(c) ** (2 / n)
    const y = 50 + 50 * Math.sign(s) * Math.abs(s) ** (2 / n)
    d += `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='${d}Z'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
const MASK = { ios: squircle(5), android: squircle(4) }

export function iconMask(platform: Platform): CSSProperties {
  const m = MASK[platform]
  return { WebkitMaskImage: m, maskImage: m, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' }
}

/** Ikonica Stiha dana onako kako je sistem crta na početnom ekranu. */
export function AppIcon({ platform, size, style }: { platform: Platform; size: number; style?: CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={platform === 'ios' ? '/icons/apple-touch-icon.png?v=2' : '/icons/icon-maskable-512.png?v=2'}
      alt=""
      style={{ width: `${size}em`, height: `${size}em`, display: 'block', ...iconMask(platform), ...style }}
    />
  )
}

/** Sistemska ikonica s gradijentom i bijelim znakom. */
export function SysIcon({ platform, size, bg, d }: { platform: Platform; size: number; bg: string; d: string }) {
  return (
    <span className="flex items-center justify-center" style={{ width: `${size}em`, height: `${size}em`, background: bg, ...iconMask(platform) }}>
      <Sym d={d} size={size * 0.52} color="#fff" weight={2} />
    </span>
  )
}

/**
 * Dodir — kao "Show touches" na snimku ekrana: na iPhoneu siva prozirna
 * tačka s rubom, na Androidu manji bijeli krug. Bez x/y sjedi u sredini
 * roditelja (koji mora biti `relative`).
 */
export function Tap({ platform, x, y }: { platform: Platform; x?: number; y?: number }) {
  const ios = platform === 'ios'
  const size = ios ? 44 : 38
  return (
    <motion.span
      className="pointer-events-none absolute rounded-full"
      style={{
        left: x === undefined ? '50%' : `${x}em`,
        top: y === undefined ? '50%' : `${y}em`,
        width: `${size}em`,
        height: `${size}em`,
        marginLeft: `${-size / 2}em`,
        marginTop: `${-size / 2}em`,
        background: ios ? 'rgba(205,205,210,0.45)' : 'rgba(255,255,255,0.34)',
        border: ios ? '1.5em solid rgba(255,255,255,0.65)' : undefined,
        boxShadow: '0 1em 8em rgba(0,0,0,0.3)',
        zIndex: 60,
      }}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: [0.5, 1, 0.86], opacity: [0, 1, 0.92] }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    />
  )
}

/* ── početni ekran ─────────────────────────────────────────── */

/** Prvo mjesto u mreži ikonica — tu sjeda Stih dana. */
export function homeSlot(platform: Platform, w: number, top: number) {
  if (platform === 'ios') {
    // iPhone: 4 kolone, ikonica 62, isti razmak sa strane i između
    const size = 62
    const side = 27
    return { x: side, y: top + 22, size, pitch: size + (w - 2 * side - 4 * size) / 3 }
  }
  const size = 58
  const side = 26
  return { x: side, y: top + 64, size, pitch: size + (w - 2 * side - 4 * size) / 3 }
}

/** Safarijev kompas: 36 crtica po rubu. */
const TICKS = Array.from({ length: 36 }, (_, k) => {
  const a = (k * Math.PI) / 18
  const r1 = k % 3 ? 36 : 33
  const p = (r: number) => `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`
  return `M${p(r1)}L${p(38.5)}`
}).join('')

export type IosApp = 'phone' | 'safari' | 'messages' | 'music'

/** Ikonice iz iPhoneovog docka — Phone, Safari, Messages, Music. */
export function IosAppIcon({ app, size }: { app: IosApp; size: number }) {
  const id = `ios-${app}`
  const bg: Record<IosApp, [string, string]> = {
    phone: ['#5DF376', '#0BBF2E'],
    safari: ['#FFFFFF', '#E3E3E8'],
    messages: ['#5DF376', '#0BBF2E'],
    music: ['#FB5C74', '#FA233B'],
  }
  return (
    <span className="block" style={{ width: `${size}em`, height: `${size}em`, ...iconMask('ios') }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={bg[app][0]} />
            <stop offset="1" stopColor={bg[app][1]} />
          </linearGradient>
          {app === 'safari' && (
            <linearGradient id="ios-safari-dial" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#19D7FF" />
              <stop offset="1" stopColor="#1E5CF3" />
            </linearGradient>
          )}
        </defs>
        <rect width="100" height="100" fill={`url(#${id})`} />
        {app === 'phone' && (
          <path
            fill="#fff"
            transform="translate(20 20) scale(2.5)"
            d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"
          />
        )}
        {app === 'messages' && (
          <g fill="#fff">
            <ellipse cx="50" cy="47" rx="32" ry="26.5" />
            <path d="M28 63c-1 7-5 12-10 15 8 1 16-2 21-8z" />
          </g>
        )}
        {app === 'music' && (
          <g fill="#fff" transform="translate(-1 2)">
            <path d="M40 28.5 70 21.5v8l-30 7z" />
            <rect x="40" y="30" width="5" height="34" />
            <rect x="65" y="23" width="5" height="34" />
            <ellipse cx="35.5" cy="64" rx="9" ry="7" transform="rotate(-18 35.5 64)" />
            <ellipse cx="60.5" cy="57" rx="9" ry="7" transform="rotate(-18 60.5 57)" />
          </g>
        )}
        {app === 'safari' && (
          <>
            <circle cx="50" cy="50" r="41" fill="url(#ios-safari-dial)" />
            <path d={TICKS} stroke="#fff" strokeOpacity="0.85" strokeWidth="1.1" strokeLinecap="round" />
            <path d="M68.4 31.6 52.8 52.8 47.2 47.2z" fill="#FF3B30" />
            <path d="M31.6 68.4 47.2 47.2 52.8 52.8z" fill="#fff" />
          </>
        )}
      </svg>
    </span>
  )
}

const DOCK = {
  ios: ['phone', 'safari', 'messages', 'music'] as IosApp[],
  android: [
    ['linear-gradient(180deg,#4CD07A,#1FA35A)', 'M6.6 3.5h2.6l1.6 4.2-2 1.4a10.5 10.5 0 0 0 5.1 5.1l1.4-2 4.2 1.6v2.6a2 2 0 0 1-2 2A15.6 15.6 0 0 1 4.6 5.5a2 2 0 0 1 2-2z'],
    ['linear-gradient(180deg,#4F8DFD,#2A5BEA)', 'M4 5h16v11H9l-5 4z'],
    ['linear-gradient(180deg,#8C7BFF,#5B45E0)', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z'],
    ['linear-gradient(180deg,#FF6B6B,#E5383B)', 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z'],
  ],
} as const

/**
 * Početni ekran: tapeta, Stih dana na prvom mjestu i dock. Druge ikonice u
 * mreži ne trebaju — oko jedne ikonice pogled nema šta tražiti.
 */
export function HomeScreen({
  platform,
  w,
  h,
  top,
  fresh = false,
  tapping = false,
  badge = false,
}: {
  platform: Platform
  w: number
  h: number
  top: number
  /** ikonica tek stigla — iskoči */
  fresh?: boolean
  /** dodir na ikonicu */
  tapping?: boolean
  /** nepročitana obavijest: broj na ikonici (iOS crveni, Samsung narandžasti) */
  badge?: boolean
}) {
  const ios = platform === 'ios'
  const s = homeSlot(platform, w, top)
  const label: CSSProperties = {
    fontSize: ios ? '12em' : '12.5em',
    marginTop: ios ? '0.45em' : '0.5em',
    color: '#fff',
    whiteSpace: 'nowrap',
    letterSpacing: ios ? '0.01em' : 0,
    textShadow: ios ? undefined : '0 1px 2px rgba(0,0,0,0.5)',
  }

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        fontFamily: ios ? SF : ROBOTO,
        background: ios
          ? 'radial-gradient(90% 55% at 20% 0%, #3B5C86 0%, rgba(59,92,134,0) 70%), radial-gradient(80% 50% at 100% 100%, #5B3F6E 0%, rgba(91,63,110,0) 70%), linear-gradient(180deg, #16223A 0%, #0B1020 55%, #07080F 100%)'
          : 'radial-gradient(90% 50% at 85% 10%, #1F4D5C 0%, rgba(31,77,92,0) 70%), radial-gradient(80% 45% at 0% 95%, #263A63 0%, rgba(38,58,99,0) 70%), linear-gradient(180deg, #0F1A24 0%, #0A0F16 60%, #06080C 100%)',
      }}
    >
      {/* Stih dana — prvo mjesto u mreži */}
      <div className="absolute flex flex-col items-center" style={{ left: `${s.x}em`, top: `${s.y}em`, width: `${s.size}em` }}>
        <motion.span
          className="relative block"
          initial={fresh ? { scale: 0, opacity: 0 } : false}
          animate={{ scale: fresh ? [0, 1.12, 0.97, 1] : 1, opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.7, times: [0, 0.55, 0.8, 1], ease: 'easeOut' }}
        >
          <AppIcon platform={platform} size={s.size} />
          {badge && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.35, 0.92, 1.12, 1] }}
              transition={{ duration: 0.9, times: [0, 0.35, 0.6, 0.8, 1], delay: 0.9, ease: 'easeOut' }}
              style={
                ios
                  ? {
                      position: 'absolute',
                      top: '-7em',
                      right: '-7em',
                      minWidth: '23em',
                      height: '23em',
                      borderRadius: '12em',
                      background: '#FF3B30',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                    }
                  : {
                      // Samsung (One UI) pokazuje broj — narandžasto-crveni krug
                      position: 'absolute',
                      top: '-5em',
                      right: '-5em',
                      minWidth: '21em',
                      height: '21em',
                      borderRadius: '11em',
                      background: '#F2593A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                    }
              }
            >
              <span style={{ fontSize: ios ? '14em' : '13em', fontWeight: 500, lineHeight: 1 }}>1</span>
            </motion.span>
          )}
          {tapping && <Tap platform={platform} />}
        </motion.span>
        <motion.span
          style={label}
          initial={fresh ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.4 }}
        >
          Stih dana
        </motion.span>
      </div>

      {ios ? (
        <>
          {/* "Search" umjesto tačaka stranica — iOS 16+ */}
          <div
            className="absolute left-1/2 flex -translate-x-1/2 items-center"
            style={{
              bottom: '122em',
              height: '30em',
              padding: '0 12em',
              gap: '5em',
              borderRadius: '15em',
              background: 'rgba(255,255,255,0.16)',
              backdropFilter: 'blur(20px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
              color: '#fff',
            }}
          >
            <Sym d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20" size={12} color="#fff" weight={2.4} />
            <span style={{ fontSize: '13em', fontWeight: 500 }}>Search</span>
          </div>
          {/* dock — staklena ploča, uglovi koncentrični s ekranom */}
          <div
            className="absolute"
            style={{
              left: '12em',
              right: '12em',
              bottom: '12em',
              height: '96em',
              borderRadius: '42em',
              background: 'rgba(255,255,255,0.14)',
              backdropFilter: 'blur(30px) saturate(1.7)',
              WebkitBackdropFilter: 'blur(30px) saturate(1.7)',
            }}
          >
            {DOCK.ios.map((app, k) => (
              <span key={app} className="absolute" style={{ left: `${s.x - 12 + k * s.pitch}em`, top: '17em' }}>
                <IosAppIcon app={app} size={s.size} />
              </span>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* tačke stranica */}
          <div className="absolute left-1/2 flex -translate-x-1/2 items-center" style={{ bottom: '128em', gap: '8em' }}>
            {[1, 0.35].map((o) => (
              <span key={o} style={{ width: '6em', height: '6em', borderRadius: '50%', background: '#fff', opacity: o }} />
            ))}
          </div>
          {/* dock bez ploče — One UI */}
          {DOCK.android.map(([bg, d], k) => (
            <span key={k} className="absolute" style={{ left: `${s.x + k * s.pitch}em`, bottom: '44em' }}>
              <SysIcon platform="android" size={s.size} bg={bg} d={d} />
            </span>
          ))}
          {/* traka za geste */}
          <span className="absolute left-1/2 -translate-x-1/2" style={{ bottom: '9em', width: '110em', height: '4em', borderRadius: '2em', background: 'rgba(255,255,255,0.85)' }} />
        </>
      )}
      <span hidden>{h}</span>
    </div>
  )
}

/* ── SF/Material znak ──────────────────────────────────────── */

export function Sym({
  d,
  size,
  color,
  weight = 1.7,
  fill,
}: {
  d: string
  size: number
  color: string
  weight?: number
  fill?: boolean
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ width: `${size}em`, height: `${size}em`, flexShrink: 0, color }}
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}
