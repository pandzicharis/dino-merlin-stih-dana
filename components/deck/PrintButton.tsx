'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-semibold text-black"
      style={{ background: 'linear-gradient(180deg, #E2CFA6, #BFA87F)' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M7 14h10v7H7z" />
      </svg>
      Štampaj / sačuvaj PDF
    </button>
  )
}
