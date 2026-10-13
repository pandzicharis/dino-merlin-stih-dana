import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { findVerse, getCatalog } from '@/lib/catalog'
import { oneLine, withPeriod } from '@/lib/text'
import { todayInTz } from '@/lib/date'
import { VerseScreen } from '@/components/VerseScreen'
import { BackLink } from '@/components/BackLink'

/** Trajni link na jedan stih — meta za WhatsApp/IG preview. */

// Novi stih iz admina dobije svoju stranicu na prvi zahtjev, pa ide na CDN.
export const revalidate = 3600

export async function generateStaticParams() {
  return (await getCatalog()).verses.map((v) => ({ id: v.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const v = await findVerse(id)
  if (!v) return { title: 'Stih dana' }

  const image = { url: `/og/${id}/post`, width: 1080, height: 1080 }
  const text = oneLine(withPeriod(v.text))
  return {
    title: v.song,
    description: text,
    openGraph: { title: v.song, description: text, images: [image] },
    twitter: { card: 'summary_large_image', images: [image.url] },
  }
}

export default async function StihPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const verse = await findVerse(id)
  if (!verse) notFound()

  return (
    <>
      <BackLink />
      <VerseScreen verse={verse} date={todayInTz()} />
    </>
  )
}
