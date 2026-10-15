'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Verse } from '@/data/verses'
import { useDevParams } from '@/lib/client-store'
import { useDraw, type ListVerse } from '@/lib/draw'
import { setLastSeen } from '@/lib/storage'
import { primeVerses } from '@/lib/verses-client'
import { MOODS } from '@/data/moods'
import { VerseScreen } from './VerseScreen'
import { DevDateBar } from './DevDateBar'
import { Onboarding } from './Onboarding'
import { Tips } from './Tips'
import { UpdatePrompt } from './UpdatePrompt'
import { IntroHost, playDraw } from './IntroSplash'

/**
 * Rješava KOJI stih se prikazuje.
 *
 * Svako izvlači svoj (lib/draw.ts): stranica nosi listu, a uređaj izvuče
 * stih za danas i zapamti ga. Prvo otvaranje u danu ide uz animaciju
 * izvlačenja. Prezentacija i dev `?verse=` i dalje pokazuju tačno zadani stih.
 */
export function DailyVerse({
  serverDate,
  verses,
  deckVerse,
}: {
  serverDate: string
  /** svi stihovi s oznakom aktivnog — iz aktivnih se izvlači */
  verses: ListVerse[]
  /** stih prezentacije (lib/deck.ts) — da ga telefon u prezentaciji ima odmah */
  deckVerse?: Verse
}) {
  const { date, verseId, mood } = useDevParams(serverDate)
  const drawn = useDraw(date, verses, !verseId)

  // zadani stih (prezentacija, dev): iz liste, ili s `/api/day` ako ga nema
  const listed = verseId ? (verses.find((v) => v.id === verseId) ?? (deckVerse?.id === verseId ? deckVerse : undefined)) : undefined
  const [fetched, setFetched] = useState<Verse | null>(null)
  useEffect(() => {
    if (!verseId || listed) return
    let alive = true
    fetch(`/api/day?id=${encodeURIComponent(verseId)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Verse>) : null))
      .then((v) => alive && v && setFetched(v))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [verseId, listed])

  const verse = verseId ? (listed ?? (fetched?.id === verseId ? fetched : undefined)) : drawn?.verse

  // splash: kad papirić sleti, ekran sa stihom se ispiše ispočetka
  const [replay, setReplay] = useState(0)
  const land = useCallback(() => setReplay((r) => r + 1), [])

  // prvo otvaranje danas — stih se izvlači pred očima
  const fresh = Boolean(drawn?.fresh)
  const drawnId = drawn?.verse.id
  useEffect(() => {
    if (fresh && drawnId) playDraw()
  }, [fresh, drawnId, date])

  // panel sačuvanih ne mora ponovo po listu — stranica je već donijela
  useEffect(() => {
    primeVerses(verses)
  }, [verses])

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

  const tone = mood ?? verse?.mood ?? 'nostalgija'
  // ostali aktivni stihovi — papirići u gomili na prvom otvaranju
  const others = useMemo(
    () => verses.filter((v) => v.active !== false && v.id !== verse?.id).map((v) => v.text),
    [verses, verse?.id],
  )

  return (
    <>
      {/* kapija postoji i dok se stih izvlači — inače bi ga sakrila tek kasnije */}
      <Onboarding mood={tone} seed={verse?.id ?? 'stih-dana'} />
      {/* dok uređaj ne izvuče stih (prvi frejm), ekran je prazan — pozadina
          i stih uđu zajedno, kao i inače */}
      {verse && <VerseScreen verse={verse} date={date} mood={mood} replay={replay} />}
      {/* key: novi stih — zastor od prvog frejma, prije tombole */}
      {verse && <IntroHost key={verse.id} text={verse.text} others={others} mood={tone} date={date} onLand={land} fresh={fresh} />}
      <Tips />
      <UpdatePrompt accent={MOODS[tone].accent} />
      {verse && <DevDateBar date={date} verseId={verse.id} mood={tone} />}
    </>
  )
}
