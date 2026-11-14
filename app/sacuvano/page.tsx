import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { OWN_AUDIO } from '@/lib/flags'
import { PageShell } from '@/components/PageShell'
import { SavedVerses } from '@/components/SavedVerses'
import { allVerses } from '@/lib/catalog'

export const metadata: Metadata = { title: 'Sačuvani stihovi' }

/**
 * Favoriti žive u pregledniku (localStorage), pa server ne zna čiji su.
 * Zato stranica nosi cijeli katalog — statično, s CDN-a — a klijent sam
 * izabere svoje. Nula upita po korisniku, ma koliko ih bilo.
 */
export const revalidate = 3600

export default async function SacuvanoPage() {
  // stari plejer (špil) samo uz vlastite pjesme — inače je plejer na početnoj
  if (!OWN_AUDIO) redirect('/')
  const verses = await allVerses()
  return (
    <PageShell eyebrow="Sačuvani stihovi" title="Player pjesama">
      <SavedVerses verses={verses} />
    </PageShell>
  )
}
