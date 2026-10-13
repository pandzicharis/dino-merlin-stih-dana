import type { Metadata } from 'next'
import { PosterLandscape } from '@/components/deck/Poster'
import { PromoToolbar } from '@/components/deck/PromoToolbar'
import { deckData } from '../../data'

export const metadata: Metadata = { title: 'Plakat A4 položeno' }

export const revalidate = 3600

/** A4 položeno — za pult, izlog ili ram na zidu. Štampa bez margina. */
export default async function PlakatA4Page({ searchParams }: { searchParams: Promise<{ samo?: string }> }) {
  const [{ samo }, data] = await Promise.all([searchParams, deckData()])

  // ?samo=1: samo plakat preko cijelog prozora — za izvoz u sliku od 300 DPI
  if (samo) {
    return (
      <div style={{ background: '#070708' }}>
        <PosterLandscape data={data.poster} width="100vw" />
      </div>
    )
  }

  return (
    <div className="print-page" style={{ ['--w' as string]: 'min(94vw, calc((100dvh - 120px) * 1.4142))' }}>
      <style>{'@page { size: A4 landscape; margin: 0 } @media print { .print-page { --w: 297mm !important } }'}</style>
      <PromoToolbar
        active="/prezentacija/plakat/a4"
        title={`Plakat A4 položeno · kod vodi na ${data.poster.host}`}
        hint="U dijalogu za štampu: papir A4, položeno, margine „Nema“, uključi „Pozadinska grafika“."
      />
      <div className="print-sheet">
        <PosterLandscape data={data.poster} width="var(--w)" />
      </div>
    </div>
  )
}
