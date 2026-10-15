import type { Metadata } from 'next'
import { VideoScene } from '@/components/deck/VideoScene'
import { deckData } from '../data'

export const metadata: Metadata = { title: 'Video za mreže' }

export const revalidate = 3600

/**
 * Video: cijeli tok u pravom telefonu, uz natpise.
 *
 * `?format=story` (9:16) ili `?format=objava` (4:5). `&rec=1` — bez dugmadi,
 * čeka skriptu za snimanje (scripts/export-video.mjs) koja ga pretvori u MP4.
 */
export default async function VideoPage({ searchParams }: { searchParams: Promise<{ format?: string; rec?: string }> }) {
  const [{ format, rec }, data] = await Promise.all([searchParams, deckData()])
  return (
    <VideoScene
      format={format === 'objava' ? 'objava' : 'story'}
      verse={data.todayVerse}
      date={data.today}
      host={data.host}
      rec={rec === '1'}
    />
  )
}
