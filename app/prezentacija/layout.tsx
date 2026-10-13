import type { Metadata } from 'next'
import './deck.css'

export const metadata: Metadata = {
  title: 'Prezentacija',
  robots: { index: false, follow: false },
}

export default function PrezentacijaLayout({ children }: { children: React.ReactNode }) {
  return children
}
