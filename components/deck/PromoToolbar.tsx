import Link from 'next/link'
import { PrintButton } from './PrintButton'

const FORMATS = [
  { href: '/prezentacija/plakat', label: 'Plakat A3' },
  { href: '/prezentacija/plakat/a4', label: 'A4 položeno' },
  { href: '/prezentacija/plakat/a5', label: 'QR A5' },
  { href: '/prezentacija/objava', label: 'Društvene mreže' },
] as const

/** Traka iznad promo materijala — ne ide u štampu ni u izvoz slike. */
export function PromoToolbar({
  active,
  title,
  hint,
  print = true,
}: {
  active: (typeof FORMATS)[number]['href']
  title: string
  hint?: string
  print?: boolean
}) {
  return (
    <div className="print-toolbar sticky top-0 z-10 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-white/[0.06] bg-black/70 px-5 py-3 backdrop-blur-xl">
      <Link
        href="/prezentacija#grafike"
        className="flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-[13px] text-white/70 hover:text-white"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m14.5 18-6-6 6-6" />
        </svg>
        Prezentacija
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em]" style={{ color: '#BFA87F' }}>
          Promo materijal
        </p>
        <p className="truncate text-[15px] text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
          {title}
        </p>
      </div>
      <nav className="flex rounded-full border border-white/10 bg-white/[0.04] p-1">
        {FORMATS.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors"
            style={
              f.href === active
                ? { background: 'linear-gradient(180deg, #E2CFA6, #BFA87F)', color: '#14100A' }
                : { color: 'rgba(255,255,255,0.6)' }
            }
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {hint && <p className="hidden max-w-[20rem] text-[12px] leading-snug text-white/45 xl:block">{hint}</p>}
      {print && <PrintButton />}
    </div>
  )
}
