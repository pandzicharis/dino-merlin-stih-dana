'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { useDevParams } from '@/lib/client-store'
import { unseat, useDraw, type ListVerse } from '@/lib/draw'
import { setLastSeen } from '@/lib/storage'
import { primeVerses } from '@/lib/verses-client'
import { clearBadge, clearPushMark, hasPushMark } from '@/lib/push-client'
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

  const picked = verseId ? (listed ?? (fetched?.id === verseId ? fetched : undefined)) : drawn?.verse
  // dev: `?font=greatvibes` ili `?font=cormorant+parisienne` — pregled fontova (lib/fonts.ts)
  const devFont =
    process.env.NODE_ENV !== 'production' && typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('font')
      : null
  const verse = picked && devFont ? { ...picked, font: devFont } : picked

  // splash: kad papirić sleti, ekran sa stihom se ispiše ispočetka
  const [replay, setReplay] = useState(0)
  // papirić otvoren = obavijest pročitana
  const land = useCallback(() => {
    setReplay((r) => r + 1)
    clearPushMark()
  }, [])
  const reduced = useReducedMotion()

  // prvo otvaranje danas — stih se izvlači pred očima
  const fresh = Boolean(drawn?.fresh)
  const drawnId = drawn?.verse.id
  useEffect(() => {
    if (fresh && drawnId) playDraw()
  }, [fresh, drawnId, date])

  // PRAVILO: dok ima nepročitana obavijest (oznaka iz service workera,
  // tačka na ikonici), svako otvaranje je tombola — i kad je stih danas već
  // viđen. Briše se tek kad papirić sleti (`land`). Na dan instalacije stih
  // iz uvoda je probni: obavijest ga zamijeni pravim izvlačenjem.
  // Bez obavijesti — samo makni tačku i obavijesti, kao i prije.
  useEffect(() => {
    if (!drawnId || verseId) return
    let busy = false
    const check = async () => {
      if (busy || document.visibilityState !== 'visible') return
      busy = true
      try {
        if (!(await hasPushMark())) return clearBadge()
        // probni stih: dan se izvuče ispočetka — novi stih sam pokrene tombolu
        if (unseat(date, verses)) return
        if (reduced) return clearPushMark()
        // ako se već izvlači (prvo otvaranje danas), IntroHost ovo preskoči
        playDraw()
      } finally {
        busy = false
      }
    }
    const onMessage = (e: MessageEvent) => e.data?.type === 'stihdana:izvuci' && check()
    check()
    document.addEventListener('visibilitychange', check)
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => {
      document.removeEventListener('visibilitychange', check)
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
  }, [drawnId, verseId, date, reduced, verses])

  // panel sačuvanih ne mora ponovo po listu — stranica je već donijela
  useEffect(() => {
    primeVerses(verses)
  }, [verses])

  useEffect(() => setLastSeen(date), [date])

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
      {verse && <IntroHost key={verse.id} text={verse.text} others={others} mood={tone} date={date} onLand={land} fresh={fresh} font={verse.font} />}
      <Tips />
      <UpdatePrompt accent={MOODS[tone].accent} />
      {verse && <DevDateBar date={date} verseId={verse.id} mood={tone} verses={verses} />}
    </>
  )
}
