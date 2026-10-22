'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useReducedMotion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { useDevParams } from '@/lib/client-store'
import { isProbe, markSeen, unseat, useDraw, type ListVerse } from '@/lib/draw'
import { bumpStreak, peekStreak, setLastSeen } from '@/lib/storage'
import { primeVerses } from '@/lib/verses-client'
import { AUTOPLAY } from '@/lib/player'
import { isFirstVerse } from '@/lib/text'
import { clearBadge, clearPushMark, hasPushMark, reportSeen } from '@/lib/push-client'
import { cover, handledToday, markHandled, markUsed, mayWait, uncover } from '@/lib/cekaj'
import { MOODS } from '@/data/moods'
import { VerseScreen } from './VerseScreen'
import { DevDateBar } from './DevDateBar'
import { Onboarding } from './Onboarding'
import { Tips } from './Tips'
import { UpdatePrompt } from './UpdatePrompt'
import { PullRefresh } from './PullRefresh'
import { INTRO_DONE, IntroHost, playDraw } from './IntroSplash'

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
  const firstVerse = verse && isFirstVerse(verse.text) ? verse.id : null
  const land = useCallback(() => {
    setReplay((r) => r + 1)
    if (!verseId) markSeen(date)
    // izvučen prije obavijesti (nema oznake) — obavijest danas ne treba.
    // Probni stih s dana instalacije se ne broji: obavijest ga zamijeni pravim
    if (!verseId && !isProbe(date))
      void hasPushMark().then((fromPush) => {
        // izvučeno s obavijesti — kasna ili ponovljena oznaka danas ne pokreće tombolu
        if (fromPush) markUsed(date)
        clearPushMark()
        if (!fromPush) void reportSeen(date)
      })
    else clearPushMark()
    // poslije podneva — obavijest je izvučena, danas više nema zastora
    markHandled()
    uncover()
  }, [verseId, date])
  // "Mir svim dobrim ljudima": pjesma krene sama kad se uvod (ili tombola)
  // završi i ekran stiha se smiri (dugmad, gramofon) — ne usred splasha
  useEffect(() => {
    if (!firstVerse) return
    let t = 0
    const go = () => {
      clearTimeout(t)
      t = window.setTimeout(() => window.dispatchEvent(new CustomEvent(AUTOPLAY, { detail: firstVerse })), 1800)
    }
    window.addEventListener(INTRO_DONE, go)
    return () => {
      clearTimeout(t)
      window.removeEventListener(INTRO_DONE, go)
    }
  }, [firstVerse])
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
        // današnja obavijest je već izvučena — oznaka je zaostala ili kasna
        // (ponovljena obavijest, dodir obrađen poslije izvlačenja): bez nove tombole
        if (handledToday(date) && !isProbe(date)) {
          uncover()
          return clearPushMark()
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

  // panel sačuvanih i "Player pjesama" ne traže ponovo listu — stranica ju
  // je već donijela. Odmah u renderu (ne u efektu): efekti djece idu prije
  // roditeljevih, pa bi footer s plejerom čekao poseban fetch i kasnio
  if (typeof window !== 'undefined') primeVerses(verses)

  // niz dana zaredom (na serveru 0) — zapiše se prije `setLastSeen`, da
  // prvi put zna je li stih otvoren i jučer
  const streak = useSyncExternalStore(noop, () => peekStreak(date), () => 0)
  useEffect(() => {
    bumpStreak(date)
    setLastSeen(date)
  }, [date])

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
      {verse && <VerseScreen verse={verse} date={date} mood={mood} replay={replay} streak={verseId ? 0 : streak} />}
      {/* povuci nadolje — osvježi (instalirana aplikacija) */}
      <PullRefresh />
      {/* key: novi stih — zastor od prvog frejma, prije tombole */}
      {verse && <IntroHost key={verse.id} text={verse.text} others={others} mood={tone} date={date} onLand={land} fresh={fresh} font={verse.font} />}
      <Tips />
      <UpdatePrompt accent={MOODS[tone].accent} />
      {verse && <DevDateBar date={date} verseId={verse.id} mood={tone} verses={verses} />}
    </>
  )
}
