import { notFound } from 'next/navigation'
import { ALBUMS, albumOf } from '@/data/albums'
import type { Verse } from '@/data/verses'
import { catalogVerses } from '@/lib/catalog'
import { OVERRIDE_ON } from '@/lib/date'
import { AlbumPhones } from './AlbumPhones'

/**
 * Svi albumi na telefonu, jedan po jedan (prevuci) — svaki s jednim stihom
 * sa tog albuma, kako izgleda na početnoj. Album bez stiha dobije primjer
 * (prvi stih, s nazivom tog albuma). Samo lokalno, kao /dev/moods.
 */
export default async function AlbumsPage() {
  if (!OVERRIDE_ON) notFound()
  const verses = (await catalogVerses()).filter((v) => v.active !== false)
  const base = verses[0]
  const list: { album: string; verse: Verse; sample: boolean }[] = ALBUMS.map((a) => {
    const own = verses.find((v) => albumOf(v.album)?.id === a.id)
    if (own) return { album: a.title, verse: own, sample: false }
    return { album: a.title, verse: { ...base, id: `primjer-${a.id}`, album: a.title, year: a.year }, sample: true }
  })
  return <AlbumPhones list={list} />
}
