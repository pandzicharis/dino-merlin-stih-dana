'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useReducedMotion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { useDevParams } from '@/lib/client-store'
import { markSeen, unseat, useDraw, type ListVerse } from '@/lib/draw'
import { bumpStreak, favoriteDate, peekStreak, setLastSeen } from '@/lib/storage'
import { savedVerse, useSavedPlayer } from '@/lib/player'
import { primeVerses } from '@/lib/verses-client'
import { clearBadge, clearPushMark, hasPushMark } from '@/lib/push-client'
import { cover, markHandled, mayWait, uncover } from '@/lib/cekaj'
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
const noop = () => () => {}

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
  // papirić otvoren = stih izvučen (tek tad, ne kad se tombola pokaže) i
  // obavijest pročitana
  const land = useCallback(() => {
    setReplay((r) => r + 1)
    if (!verseId) markSeen(date)
    clearPushMark()
    // poslije podneva — obavijest je izvučena, danas više nema zastora
    markHandled()
    uncover()
  }, [verseId, date])
  const reduced = useReducedMotion()

  // danas još nije zavrćen — stih se izvlači pred očima (i poslije ubijene
  // aplikacije usred tombole). Bez animacija nema tombole — stih odmah.
  const fresh = Boolean(drawn?.fresh)
  const drawnId = drawn?.verse.id
  useEffect(() => {
    if (!fresh || !drawnId) return
    if (reduced) markSeen(date)
    playDraw()
  }, [fresh, drawnId, date, reduced])

  // PRAVILO: dok ima nepročitana obavijest (oznaka iz service workera,
  // tačka na ikonici), svako otvaranje je tombola — i kad je stih danas već
  // viđen. Briše se tek kad papirić sleti (`land`). Na dan instalacije stih
  // iz uvoda je probni: obavijest ga zamijeni pravim izvlačenjem.
  // Bez obavijesti — samo makni tačku i obavijesti, kao i prije.
  //
  // Oznaka je u kešu (asinhrono) — dok se čita, ekran je pod zastorom
  // (lib/cekaj.ts), pa se ne vidi stih pa tombola. Bez oznake zastor odmah ode.
  useEffect(() => {
    // zadani stih (prezentacija, dev) — obavijesti se ne gledaju, zastora nema
    if (verseId) return uncover()
    if (!drawnId) return
    let busy = false
    const check = async () => {
      if (busy || document.visibilityState !== 'visible') return
      busy = true
      try {
        if (!(await hasPushMark())) {
          uncover()
          return clearBadge()
        }
        // probni stih: dan se izvuče ispočetka — novi stih sam pokrene tombolu
        if (unseat(date, verses)) return
        if (reduced) {
          uncover()
          markHandled()
          return clearPushMark()
        }
        // ako se već izvlači (prvo otvaranje danas), IntroHost ovo preskoči
        playDraw()
      } finally {
        busy = false
      }
    }
    // povratak u aplikaciju (i odlazak iz nje): zastor odmah, prije prvog kadra
    const onVisibility = () => {
      if (mayWait()) cover()
      check()
    }
    // obavijest stigla dok je aplikacija otvorena (service worker javi odmah)
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== 'stihdana:izvuci') return
      cover()
      check()
    }
    check()
    document.addEventListener('visibilitychange', onVisibility)
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
  }, [drawnId, verseId, date, reduced, verses])

  // dodir na obavijest otvara `/?izvuci` (zastor iz <head>) — adresa se očisti
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('izvuci')) return
    url.searchParams.delete('izvuci')
    window.history.replaceState(null, '', url)
  }, [])

  // panel sačuvanih ne mora ponovo po listu — stranica je već donijela
  useEffect(() => {
    primeVerses(verses)
  }, [verses])

  // niz dana zaredom (na serveru 0) — zapiše se prije `setLastSeen`, da
  // prvi put zna je li stih otvoren i jučer
  const streak = useSyncExternalStore(noop, () => peekStreak(date), () => 0)
  useEffect(() => {
    bumpStreak(date)
    setLastSeen(date)
  }, [date])

  // sačuvani sviraju na početnoj — ekran pokazuje stih pjesme koja svira
  // (components/Listening.tsx); × na pilulici vraća današnji
  const player = useSavedPlayer()
  const playing = player.mini && player.id ? savedVerse() : null
  // nova pjesma dok sačuvani sviraju: stari stih se mekano utiša, pa dođe
  // novi (ispiše se, pozadina se pretopi) — bez naglog skoka
  const [shown, setShown] = useState<Verse | null>(null)
  const listening = playing && shown && shown.id !== playing.id ? shown : playing
  useEffect(() => {
    let alive = true
    const swap = () => alive && setShown(playing)
    if (!playing || !shown || shown.id === playing.id || reduced) {
      // ulazak/izlazak već ide kroz prelaz (components/Listening.tsx)
      if (shown?.id !== playing?.id) void Promise.resolve().then(swap)
      return () => {
        alive = false
      }
    }
    const main = document.querySelector<HTMLElement>('main')
    if (!main) {
      void Promise.resolve().then(swap)
      return () => {
        alive = false
      }
    }
    main
      .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'forwards' })
      .finished.then(
        (out) => {
          swap()
          requestAnimationFrame(() => {
            out.cancel()
            main.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
          })
        },
        swap,
      )
    return () => {
      alive = false
    }
  }, [playing, shown, reduced])

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
      {listening ? (
        <VerseScreen
          verse={listening}
          date={favoriteDate(listening.id) ?? date}
          listening
          today={verse ? { text: verse.text, mood: mood ?? verse.mood } : undefined}
        />
      ) : (
        verse && <VerseScreen verse={verse} date={date} mood={mood} replay={replay} streak={verseId ? 0 : streak} />
      )}
      {/* key: novi stih — zastor od prvog frejma, prije tombole */}
      {verse && <IntroHost key={verse.id} text={verse.text} others={others} mood={tone} date={date} onLand={land} fresh={fresh} font={verse.font} />}
      <Tips />
      <UpdatePrompt accent={MOODS[tone].accent} />
      {verse && <DevDateBar date={date} verseId={verse.id} mood={tone} verses={verses} />}
    </>
  )
}
