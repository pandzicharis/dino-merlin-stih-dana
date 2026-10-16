import Link from 'next/link'
import { FIGURE_SRC } from '@/data/moods'
import { BRAND } from '@/lib/brand'
import { DrawerIcon } from './DrawerIcon'

/**
 * Okvir za sporedne stranice (sačuvano, admin).
 *
 * Ista atmosfera kao glavni ekran — tamna podloga, zlatni sjaj, tihi
 * portret, zrno — ali MIRNA: nijedan sloj se ne animira i sve je CSS, pa
 * stranica sa dugom listom skrola glatko i na starom telefonu.
 */
export function PageShell({
  eyebrow,
  title,
  back = '/',
  right,
  children,
  wide = false,
  icon,
}: {
  eyebrow: string
  title: string
  /** znak ispred naslova, kao na drawerima (putanje za DrawerIcon) */
  icon?: React.ReactNode
  back?: string | null
  right?: React.ReactNode
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    // `isolate`: pozadina na -z-10 ostaje unutar ove stranice, iznad crne <html>
    <div className="relative isolate min-h-dvh">
      <Backdrop />

      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl">
        <div
          className={`mx-auto flex items-center gap-4 px-5 pb-3 pt-[max(0.9rem,var(--sat))] ${wide ? 'max-w-5xl' : 'max-w-xl'}`}
        >
          {back !== null && (
            <Link
              href={back}
              aria-label="Nazad"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/70 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m14.5 18-6-6 6-6" />
              </svg>
            </Link>
          )}
          {icon && <DrawerIcon>{icon}</DrawerIcon>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.28em]" style={{ color: BRAND.gold }}>
              {eyebrow}
            </p>
            <h1
              className="truncate text-[1.35rem] leading-tight text-white/95"
              style={{ fontFamily: 'var(--font-serif), serif', fontVariationSettings: "'opsz' 72, 'SOFT' 30" }}
            >
              {title}
            </h1>
          </div>
          {right}
        </div>
      </header>

      <main className={`relative mx-auto px-5 pb-[max(3rem,env(safe-area-inset-bottom))] pt-6 ${wide ? 'max-w-5xl' : 'max-w-xl'}`}>
        {children}
      </main>
    </div>
  )
}

function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#0c0c0d]" aria-hidden>
      {/* jednobojno: samo tiho svjetlo odozgo, da staklo ima šta lomiti */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(90% 55% at 50% -10%, rgba(255,255,255,0.07) 0%, transparent 70%)' }}
      />
      <div
        className="absolute inset-x-0 top-[9vh] h-[70vh] bg-no-repeat grayscale"
        style={{
          backgroundImage: `url(${FIGURE_SRC})`,
          backgroundSize: 'auto 100%',
          backgroundPosition: '85% 0%',
          mixBlendMode: 'screen',
          opacity: 0.1,
          maskImage: 'radial-gradient(ellipse 65% 75% at 75% 25%, black 25%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(ellipse 65% 75% at 75% 25%, black 25%, transparent 78%)',
        }}
      />
    </div>
  )
}
