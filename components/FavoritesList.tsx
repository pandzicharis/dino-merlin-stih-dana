'use client'

import { useFavorites, useMounted } from '@/lib/client-store'
import { verseById } from '@/lib/pickVerse'
import { VerseList } from './VerseList'

export function FavoritesList() {
  const mounted = useMounted()
  const ids = useFavorites()

  // localStorage ne postoji na serveru — bez ovoga puca hidratacija
  if (!mounted) return null

  const items = ids
    .map((id) => verseById(id))
    .filter((v): v is NonNullable<typeof v> => Boolean(v))
    .reverse()
    .map((verse) => ({ verse }))

  return <VerseList items={items} />
}
