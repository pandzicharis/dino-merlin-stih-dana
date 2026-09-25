import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { VERSES } from '@/data/verses'
import { verseById } from '@/lib/pickVerse'
import { oneLine, withPeriod } from '@/lib/text'
import { todayInTz } from '@/lib/date'
import { VerseScreen } from '@/components/VerseScreen'
import { BackLink } from '@/components/BackLink'

/** Trajni link na jedan stih — meta za WhatsApp/IG preview. */

export function generateStaticParams() {
  return VERSES.map((v) => ({ id: v.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const v = verseById(id)
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
  const verse = verseById(id)
  if (!verse) notFound()

  return (
    <>
      <BackLink />
      <VerseScreen verse={verse} date={todayInTz()} />
    </>
  )
}
