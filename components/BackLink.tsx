import Link from 'next/link'
import { Wordmark } from './Wordmark'

export function BackLink({ href = '/' }: { href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Nazad na stih dana"
      className="fixed left-5 top-[max(1.25rem,env(safe-area-inset-top))] z-40 flex items-center gap-2 text-white/45 transition-colors hover:text-white/85"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 18-6-6 6-6" />
      </svg>
      <Wordmark width={84} />
    </Link>
  )
}
