import { BRAND } from '@/lib/brand'

/**
 * Znak u zaglavlju drawera — zlatni krug s istom ikonom kao dugme koje ga
 * otvara (sačuvano, podijeli), pa se odmah zna gdje si.
 */
export function DrawerIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
      style={{
        borderColor: `${BRAND.gold}55`,
        background: `radial-gradient(circle, ${BRAND.gold}24, transparent 70%)`,
        color: BRAND.gold,
      }}
      aria-hidden
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  )
}
