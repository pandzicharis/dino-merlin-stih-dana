'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Verse } from '@/data/verses'
import { useDevParams } from '@/lib/client-store'
import { setLastSeen } from '@/lib/storage'
import { MOODS } from '@/data/moods'
import { VerseScreen } from './VerseScreen'
import { DevDateBar } from './DevDateBar'
import { Onboarding } from './Onboarding'
import { Tips } from './Tips'
import { UpdatePrompt } from './UpdatePrompt'
import { IntroHost } from './IntroSplash'

/**
 * Rješava KOJI stih se prikazuje.
 *
 * Server donese stihove za nekoliko dana oko danas, pa prelaz preko ponoći
 * ne treba mrežu. Tek kad je traženi dan van toga (aplikacija otvorena
 * danima, ili dev pomjeranje datuma), stih se dohvati s `/api/day` — a do
 * tad ostaje zadnji poznati, bez praznog ekrana.
 */
export function DailyVerse({ serverDate, days }: { serverDate: string; days: Record<string, Verse> }) {
  const { date, verseId, mood } = useDevParams(serverDate)
  const known = verseId ? undefined : days[date]
  const key = verseId ? `id=${encodeURIComponent(verseId)}` : `d=${date}`
  const [fetched, setFetched] = useState<{ key: string; verse: Verse } | null>(null)
  // splash: kad papirić sleti, ekran sa stihom se ispiše ispočetka
  const [replay, setReplay] = useState(0)
  const land = useCallback(() => setReplay((r) => r + 1), [])

  useEffect(() => {
    if (known) return
    let alive = true
    fetch(`/api/day?${key}`)
      .then((r) => (r.ok ? (r.json() as Promise<Verse>) : null))
      .then((v) => alive && v && setFetched({ key, verse: v }))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [known, key])

  const verse =
    known ?? (fetched?.key === key ? fetched.verse : undefined) ?? fetched?.verse ?? days[serverDate] ?? Object.values(days)[0]

  useEffect(() => setLastSeen(date), [date])

  // Otvorena aplikacija = stih je viđen: makni tačku s ikonice i obavijest
  // iz centra obavijesti. Isto i kad se vrati iz pozadine.
  useEffect(() => {
    const clear = () => {
      if (document.visibilityState !== 'visible') return
      navigator.clearAppBadge?.().catch(() => {})
      navigator.serviceWorker?.getRegistration().then((reg) =>
        reg?.getNotifications().then((list) => list.forEach((n) => n.close())),
      )
    }
    clear()
    document.addEventListener('visibilitychange', clear)
    return () => document.removeEventListener('visibilitychange', clear)
  }, [])


  return (
    <>
      <Onboarding mood={mood ?? verse.mood} seed={verse.id} />
      <VerseScreen verse={verse} date={date} mood={mood} replay={replay} />
      <IntroHost
        lines={[verse, ...Object.values(days).filter((v) => v.id !== verse.id)].map((v) => v.text)}
        bg={MOODS[mood ?? verse.mood].gradient[0]}
        onLand={land}
      />
      <Tips />
      <UpdatePrompt accent={MOODS[mood ?? verse.mood].accent} />
      <DevDateBar date={date} verseId={verse.id} mood={mood ?? verse.mood} />
    </>
  )
}
