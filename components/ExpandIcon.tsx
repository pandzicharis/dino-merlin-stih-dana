/** Raširi kartu preko cijelog ekrana / skupi je nazad u špil (components/SavedFull.tsx). */
export function ExpandIcon({ collapse = false, size = 15 }: { collapse?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {collapse ? (
        <>
          <path d="M4 14h6v6M3 21l7-7" />
          <path d="M20 10h-6V4M21 3l-7 7" />
        </>
      ) : (
        <>
          <path d="M14 4h6v6M20 4l-7 7" />
          <path d="M10 20H4v-6M4 20l7-7" />
        </>
      )}
    </svg>
  )
}
