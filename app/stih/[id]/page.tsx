import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { findVerse, getCatalog } from '@/lib/catalog'
import { oneLine, withPeriod } from '@/lib/text'
import { todayInTz } from '@/lib/date'
import { VerseScreen } from '@/components/VerseScreen'
import { BackLink } from '@/components/BackLink'
import { OG_BASE } from '@/lib/og'

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

  const text = oneLine(withPeriod(v.text))
  const image = { url: `/og/${id}/post`, width: 1080, height: 1080, alt: text }
  // naziv pjesme i ime umjetnika (bez " — Stih dana" iz šablona layouta)
  const title = `${v.song} — Dino Merlin`
  return {
    title: { absolute: title },
    description: text,
    openGraph: { ...OG_BASE, url: `/stih/${id}`, title, description: text, images: [image] },
    twitter: { card: 'summary_large_image', title, description: text, images: [image.url] },
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
