import type { CSSProperties } from 'react'
import type { QrMatrix } from '@/lib/qr'

/**
 * QR kod u stilu aplikacije: zaobljeni moduli, zaobljena "oka" i potpis u
 * sredini. Provjereno dekoderom (jsQR), ne samo okom.
 *
 * Tamni moduli na svijetloj podlozi — obrnut kod (svijetlo na tamnom) čitaju
 * novi telefoni, ali stariji Androidi i pojedini skeneri ne. Na plakatu u
 * izlogu ne smije biti nijednog "ne radi mi".
 *
 * Sredina se prekriva potpisom; kod je generisan s korekcijom H (~30%), a
 * rupa zauzima ~7% površine — daleko ispod granice.
 */
export function QrCode({
  qr,
  ink = '#0E0D0C',
  paper = '#F6F1E7',
  logo = true,
  className,
  style,
  title = 'QR kod — otvori Stih dana',
}: {
  qr: QrMatrix
  ink?: string
  paper?: string
  logo?: boolean
  className?: string
  style?: CSSProperties
  title?: string
}) {
  const n = qr.size
  const at = (r: number, c: number) => qr.bits[r * n + c] === '1'

  // rupa za potpis: neparna širina, tačno u sredini
  const hole = logo ? Math.floor(n * 0.27) | 1 : 0
  const h0 = (n - hole) / 2
  const inHole = (r: number, c: number) => logo && r >= h0 && r < h0 + hole && c >= h0 && c < h0 + hole
  const inEye = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)

  // Blago zaobljeni kvadratići, ne tačke: okrugle module jsQR (a s njim i
  // dio slabijih skenera) ne pročita, a ovi prolaze i s potpisom u sredini.
  let dots = ''
  const S = 0.9
  const k = 0.25
  const o = (1 - S) / 2
  const side = S - 2 * k
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!at(r, c) || inEye(r, c) || inHole(r, c)) continue
      dots +=
        `M${c + o + k} ${r + o}h${side}a${k} ${k} 0 0 1 ${k} ${k}v${side}a${k} ${k} 0 0 1 ${-k} ${k}` +
        `h${-side}a${k} ${k} 0 0 1 ${-k} ${-k}v${-side}a${k} ${k} 0 0 1 ${k} ${-k}z`
    }
  }

  const q = 2 // tiha zona u modulima; ostatak margine daje kartica oko koda
  const eyes: [number, number][] = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ]

  return (
    <svg
      viewBox={`${-q} ${-q} ${n + 2 * q} ${n + 2 * q}`}
      className={className}
      style={style}
      role="img"
      aria-label={title}
      shapeRendering="geometricPrecision"
    >
      <rect x={-q} y={-q} width={n + 2 * q} height={n + 2 * q} fill={paper} rx={1.6} />
      <path d={dots} fill={ink} />
      {eyes.map(([x, y]) => (
        <g key={`${x}-${y}`} fill="none">
          <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.9} stroke={ink} strokeWidth={1} />
          <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.95} fill={ink} />
        </g>
      ))}
      {logo && (
        <g>
          <circle cx={n / 2} cy={n / 2} r={hole / 2 - 0.35} fill={ink} />
          <circle cx={n / 2} cy={n / 2} r={hole / 2 - 0.75} fill="none" stroke="#BFA87F" strokeWidth={0.14} opacity={0.9} />
          <image
            href="/brand/signature.webp"
            x={n / 2 - hole * 0.33}
            y={n / 2 - hole * 0.25}
            width={hole * 0.66}
            height={hole * 0.5}
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      )}
    </svg>
  )
}
