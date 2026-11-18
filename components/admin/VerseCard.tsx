'use client'

import { memo, type CSSProperties } from 'react'
import type { Verse } from '@/data/verses'
import { OWN_AUDIO } from '@/lib/flags'
import { CARD_CUT, CARD_CUT_RATIO, CARD_RATIO, CardFace } from '../SavedCarousel'

/** preko YouTubea karta završi odmah ispod albuma (kao u sačuvanima); sa svojim pjesmama je puna */
const CUT = OWN_AUDIO ? undefined : CARD_CUT
const RATIO = OWN_AUDIO ? CARD_RATIO : CARD_CUT_RATIO
/** lice karte je u `em` od širine karte (`--cw`) — ovdje širina okvira u mreži */
const FACE: CSSProperties = { ['--cw' as string]: '100cqw' }

/**
 * Stih kao mala karta u sačuvanima (admin → lista → Karte) — isto lice
 * (components/SavedCarousel.tsx `CardFace`), samo za pogled: dodir na kartu
 * otvara uređivanje, srce i dugmad ovdje ne rade. `day`: datum na karti.
 */
export const VerseCard = memo(function VerseCard({ verse, day }: { verse: Verse; day: string }) {
  return (
    <div className="relative w-full" style={{ aspectRatio: `1 / ${RATIO}`, containerType: 'inline-size' }}>
      <div className="pointer-events-none absolute inset-0" style={FACE} aria-hidden>
        <CardFace verse={verse} cut={CUT} day={day} />
      </div>
    </div>
  )
})
