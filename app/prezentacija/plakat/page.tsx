import type { Metadata } from 'next'
import { Poster } from '@/components/deck/Poster'
import { PromoToolbar } from '@/components/deck/PromoToolbar'
import { deckData } from '../data'

export const metadata: Metadata = { title: 'Plakat A3' }

export const revalidate = 3600

/**
 * Plakat za štampu. Ekran pokazuje pregled; štampa (ili "Sačuvaj kao PDF")
 * daje A3 bez margina. Sve osim fotografija je vektorsko, pa isti PDF ide
 * i na A2 ili A1.
 */
export default async function PlakatPage({ searchParams }: { searchParams: Promise<{ samo?: string }> }) {
  const [{ samo }, data] = await Promise.all([searchParams, deckData()])

  // ?samo=1: samo plakat preko cijelog prozora — za izvoz u sliku od 300 DPI
  if (samo) {
    return (
      <div style={{ background: '#070708' }}>
        <Poster data={data.poster} width="100vw" />
      </div>
    )
  }

  return (
    <div className="print-page" style={{ ['--w' as string]: 'min(92vw, calc((100dvh - 120px) / 1.4142))' }}>
      <style>{'@page { size: A3 portrait; margin: 0 } @media print { .print-page { --w: 297mm !important } }'}</style>
      <PromoToolbar
        active="/prezentacija/plakat"
        title={`Plakat A3 uspravno · kod vodi na ${data.poster.host}`}
        hint="U dijalogu za štampu: papir A3, margine „Nema“, uključi „Pozadinska grafika“. Za A2 ili A1 isti PDF — samo veći papir."
      />
      <div className="print-sheet">
        <Poster data={data.poster} width="var(--w)" />
      </div>
    </div>
  )
}
