import type { Metadata } from 'next'
import { PosterQr } from '@/components/deck/Poster'
import { PromoToolbar } from '@/components/deck/PromoToolbar'
import { deckData } from '../../data'

export const metadata: Metadata = { title: 'QR A5' }

export const revalidate = 3600

/** A5 uspravno (pola A4) — naslov i veliki QR, za pult. Štampa bez margina. */
export default async function PlakatA5Page({ searchParams }: { searchParams: Promise<{ samo?: string }> }) {
  const [{ samo }, data] = await Promise.all([searchParams, deckData()])

  // ?samo=1: samo grafika preko cijelog prozora — za izvoz u sliku od 300 DPI
  if (samo) {
    return (
      <div style={{ background: '#070708' }}>
        <PosterQr data={data.poster} width="100vw" />
      </div>
    )
  }

  return (
    <div className="print-page" style={{ ['--w' as string]: 'min(94vw, calc((100dvh - 120px) / 1.4142))' }}>
      <style>{'@page { size: A5 portrait; margin: 0 } @media print { .print-page { --w: 148mm !important } }'}</style>
      <PromoToolbar
        active="/prezentacija/plakat/a5"
        title="QR A5 · pola A4"
        hint="U dijalogu za štampu: papir A5 (ili A4, pa izreži), margine „Nema“, uključi „Pozadinska grafika“."
      />
      <div className="print-sheet">
        <PosterQr data={data.poster} width="var(--w)" />
      </div>
    </div>
  )
}
