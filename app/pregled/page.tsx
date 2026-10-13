import type { Metadata } from 'next'
import { PreviewScreen } from '@/components/PreviewScreen'

export const metadata: Metadata = { title: 'Pregled', robots: { index: false, follow: false } }

/**
 * Pravi ekran sa stihom, za pregled u adminu (u iframeu). Stih stiže samo
 * porukom od roditeljske stranice s ISTOG porijekla — ova stranica sama
 * ništa ne prikazuje, pa se ne može iskoristiti za lažne "stihove" preko linka.
 */
export default function PregledPage() {
  return <PreviewScreen />
}
