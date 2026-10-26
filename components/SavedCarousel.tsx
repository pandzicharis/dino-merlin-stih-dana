'use client'

import { memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import type { Verse } from '@/data/verses'
import { ExpandMorph } from './ExpandIcon'
import { FavoriteButton } from './FavoriteButton'
import { ShareButton } from './ShareSheet'
import { MOODS } from '@/data/moods'
import { albumOf, cardArtOf, cardStillOf, softOf, thumbOf } from '@/data/albums'
import { lookCss, lookScale, parseFont, preloadFonts } from '@/lib/fonts'
import { albumLine, asWritten } from '@/lib/text'
import { savedDay, toggleFavorite } from '@/lib/storage'
import { formatFullDateBs } from '@/lib/date'
import { MAGAZA_BESIDE, MAGAZA_DROP_CSS } from '@/lib/brand'
import { FontedLines, MagazaMark } from './deck/Screens'
import { CardAtmosphere } from './CardAtmosphere'
import { FitLines } from './deck/FitLines'
import { SongRow } from './SongCredit'
import { SAVED_TRACK, playSaved, savedVerse, setSavedPlaylist, useSavedPlayerSelect, warmSaved } from '@/lib/player'
import { whenCalm } from '@/lib/calm'
import { dragScroll } from '@/lib/drag-scroll'
import { tapProps } from '@/lib/tap'

/**
 * Sačuvani kao traka karata: svaka karta je ekran aplikacije u malom (isti
 * raspored, atmosfera i font stiha), prednja je na sredini, a sa strane
 * vire susjedne: prethodna lijevo, sljedeća desno. Listanje je pravi
 * vodoravni skrol sistema sa zaustavljanjem na karti — glatko kao nativno.
 *
 * Unutra je sve u `em` kao na mockupima (1em = 1 piksel ekrana širokog W),
 * pa karta izgleda isto na svakoj veličini. Plejer je pravi, u pikselima.
 */

/** ekran telefona u pikselima — karta je on, umanjen */
const W = 390
const H = 620
/** mala karta je kraća od ekrana — dno (tamno pretapanje) odsječeno, atmosfera ostaje H */
const SH = 590
/** mjesto sa svake strane prednje karte — tu vire susjedne */
const SIDE = 54
/** zraka unutar karte, lijevo i desno (em od W) */
const SIDE_PAD = 32
/**
 * Dno karte (em od H) se pretapa u plejer ispod špila — karta kao da izlazi
 * iz plejera. Stih stoji iznad toga, na sredini vidljivog dijela.
 */
const FADE = 190

/**
 * Karta na sredini dok se lista (čim pređe pola puta) — plejer je sluša
 * direktno, pa se pjesma u njemu promijeni odmah, a ništa drugo se ne crta.
 */
let liveId: string | null = null
const liveSubs = new Set<() => void>()
function setLiveFront(id: string | null) {
  if (liveId === id) return
  liveId = id
  liveSubs.forEach((f) => f())
}
const subscribeLive = (f: () => void) => {
  liveSubs.add(f)
  return () => void liveSubs.delete(f)
}
export function useLiveFront(): string | null {
  return useSyncExternalStore(subscribeLive, () => liveId, () => null)
}

/** Isto pravilo kao `verseFontSize` (i VerseMock) — za ekran širok W. */
function verseSize(text: string) {
  const longest = Math.max(...text.split('\n').map((l) => l.trim().length), 1)
  const vw = Math.min(16, Math.max(6.4, 174 / longest))
  return Math.min(76, Math.max(28, (vw * W) / 100))
}

export function SavedCarousel({
  verses,
  size,
  onOpen,
  onFront,
  dots = true,
}: {
  verses: Verse[]
  size: string
  /** dodir na prednju kartu — stih preko cijelog ekrana (components/SavedFull.tsx) */
  onOpen?: (verse: Verse) => void
  /** prednja karta se promijenila — plejer ispod pokazuje njenu pjesmu */
  onFront?: (verse: Verse) => void
  /** tačkice ispod špila (u panelu ih zamijeni plejer: "2 / 4") */
  dots?: boolean
}) {
  const n = verses.length
  // samo pjesma i svira li — spuštanje i podizanje panela ne crtaju špil iznova
  const player = { id: useSavedPlayerSelect((s) => s.id), playing: useSavedPlayerSelect((s) => s.playing) }
  // karta na sredini — čim pređe pola puta (plejer je pokaže odmah)
  const [at, setAt] = useState(() => Math.max(0, verses.findIndex((v) => v.id === player.id)))
  const cur = Math.min(at, Math.max(0, n - 1))
  // gdje je listanje stalo — tad se prebaci muzika (ako svira)
  const [rest, setRest] = useState(cur)
  // lica karata oko sredine — slože se odmah poslije (prekidivo), ne u kadru promjene
  const [near, setNear] = useState(cur)

  const strip = useRef<HTMLDivElement>(null)
  // zadnji pomak trake — pjesma se mijenja tek kad karta odstoji (DWELL)
  const movedAt = useRef(0)
  // traka ide za plejerom (sam prešao na sljedeću) — usput se ništa ne pušta
  const following = useRef(false)
  const versesRef = useRef(verses)
  const nearRef = useRef(near)
  useEffect(() => {
    versesRef.current = verses
  }, [verses])
  /** karta `i` na sredini trake — `smooth`: mekano (tačkice, plejer prešao na drugu pjesmu) */
  const scrollToCard = useCallback((i: number, smooth: boolean) => {
    const el = strip.current
    const card = el?.querySelectorAll<HTMLElement>('[data-card]')[i]
    if (!el || !card) return
    el.scrollTo({ left: card.offsetLeft + card.offsetWidth / 2 - el.clientWidth / 2, behavior: smooth ? 'smooth' : 'instant' })
  }, [])
  const go = useCallback(
    (i: number, smooth = true) => {
      if (n < 2) return
      scrollToCard(Math.max(0, Math.min(n - 1, i)), smooth)
    },
    [n, scrollToCard],
  )
  // raširi: karta prvo tačno na sredinu (i usred dosjedanja ili zaleta — dodir
  // na prednju kartu je uvijek otvara, nikad samo dovede), pa se mjeri
  const open = useMemo(
    () =>
      onOpen &&
      ((v: Verse) => {
        const el = strip.current
        const i = versesRef.current.findIndex((x) => x.id === v.id)
        const card = el?.querySelectorAll<HTMLElement>('[data-card]')[i]
        if (el && card) {
          const want = card.offsetLeft + card.offsetWidth / 2 - el.clientWidth / 2
          // već stoji — ne dira se (offsetLeft je zaokružen, pa bi je pomjerio za djelić piksela)
          if (Math.abs(el.scrollLeft - want) > 1) el.scrollTo({ left: want, behavior: 'instant' })
        }
        onOpen(v)
      }),
    [onOpen],
  )

  // Listanje vodi sistem (vodoravni skrol uz zaustavljanje na karti): prst,
  // zalet i zaustavljanje idu van JavaScripta, glatko i kad je glavna nit
  // zauzeta. Ovdje se samo sazna koja je na sredini (jednom po kadru) i gdje
  // je stalo
  useEffect(() => {
    const el = strip.current
    if (!el || n < 2) return
    let t = 0
    let raf = 0
    let step = 0
    const nearest = () => {
      if (!step) {
        const cards = el.querySelectorAll<HTMLElement>('[data-card]')
        if (cards.length < 2) return -1
        step = cards[1].offsetLeft - cards[0].offsetLeft
      }
      // sakriven prikaz (0) — ništa se ne zaključuje
      if (!(step > 0)) return (step = 0), -1
      return Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / step)))
    }
    const live = () => {
      raf = 0
      const i = nearest()
      if (i < 0) return
      setAt(i)
      setLiveFront(versesRef.current[i]?.id ?? null)
      // dug zalet — lica karata idu za njim (prekidivo)
      if (Math.abs(i - nearRef.current) > 2) {
        nearRef.current = i
        startTransition(() => setNear(i))
      }
    }
    const settle = () => {
      clearTimeout(t)
      following.current = false
      const i = nearest()
      step = 0
      if (i < 0) return
      setAt(i)
      setRest(i)
      setLiveFront(versesRef.current[i]?.id ?? null)
      nearRef.current = i
      startTransition(() => setNear(i))
    }
    const onScroll = () => {
      movedAt.current = performance.now()
      if (!raf) raf = requestAnimationFrame(live)
      clearTimeout(t)
      t = window.setTimeout(settle, 90)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('scrollend', settle)
    // mišem (računar) — prst i trackpad ionako skrolaju sami
    const undrag = dragScroll(el, () => {
      const cards = el.querySelectorAll<HTMLElement>('[data-card]')
      return cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 0
    })
    return () => {
      undrag()
      clearTimeout(t)
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('scrollend', settle)
    }
  }, [n])

  // na svoje mjesto odmah — pri slaganju, kad se prikaz ponovo pokaže
  // (Activity) i kad se karta ukloni; uvijek na zadnju prednju
  const curRef = useRef(cur)
  useEffect(() => {
    curRef.current = cur
  }, [cur])
  useLayoutEffect(() => {
    scrollToCard(Math.min(curRef.current, n - 1), false)
  }, [n, scrollToCard])

  // plejer sačuvanih svira ovim redom; kad pređe na drugu pjesmu, špil klizi za njom
  useEffect(() => setSavedPlaylist(verses), [verses])
  // plejer ispod (pjesma, atmosfera) pokazuje prednju kartu — tek kad listanje
  // stane: usred listanja se ne crta ništa osim karata
  const restN = Math.min(rest, Math.max(0, n - 1))
  useEffect(() => {
    const v = verses[restN]
    if (v) onFront?.(v)
  }, [restN, verses, onFront])
  // i obrnuto: prevučena karta dok muzika svira — svira njena pjesma, čim traka
  // stane na njoj (DWELL); usred zaleta se ne mijenja. Kad plejer pređe na
  // drugu pjesmu, špil je stiže — tad se ništa ne pušta
  const lastRest = useRef(restN)
  const live = useRef({ playing: player.playing, verses })
  useEffect(() => {
    live.current = { playing: player.playing, verses }
  }, [player.playing, verses])
  // čim nova karta pređe na sredinu (i kratko ostane — brzo listanje ne pušta
  // svaku usput), svira njena pjesma; ne čeka se da traka sasvim stane
  const prevCur = useRef(cur)
  useEffect(() => {
    // samo kad se prednja karta promijeni (ne pri otvaranju ni ponovnom pokazivanju)
    if (prevCur.current === cur) return
    prevCur.current = cur
    if (following.current) return
    const t = window.setTimeout(() => {
      if (following.current) return
      const vs = live.current.verses
      const v = vs[cur]
      if (!live.current.playing || !v) return
      if (v.id !== savedVerse()?.id) playSaved(v)
      warmSaved([vs[cur + 1], vs[cur - 1]])
    }, 160)
    return () => clearTimeout(t)
  }, [cur])
  useEffect(() => {
    if (lastRest.current === restN) return
    lastRest.current = restN
    let t = 0
    const check = () => {
      // traka se opet pomjera — čeka se da stane i odstoji
      const still = performance.now() - movedAt.current
      if (still < DWELL) return void (t = window.setTimeout(check, DWELL - still))
      const vs = live.current.verses
      const v = vs[restN]
      if (live.current.playing && v && v.id !== savedVerse()?.id) playSaved(v)
      // dok svira, susjedne su spremne — sljedeće prevlačenje svira odmah
      if (live.current.playing) warmSaved([vs[restN + 1], vs[restN - 1]])
    }
    t = window.setTimeout(check, DWELL)
    return () => clearTimeout(t)
  }, [restN])
  // prikaz opet vidljiv (Activity) — prednja je pjesma koja sad svira
  useEffect(() => {
    const i = verses.findIndex((v) => v.id === savedVerse()?.id)
    if (i >= 0 && i !== cur) scrollToCard(i, false)
    // samo pri pokazivanju prikaza
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const onTrack = (e: Event) => {
      const i = verses.findIndex((v) => v.id === (e as CustomEvent).detail)
      if (i < 0) return
      if (i !== curRef.current) following.current = true
      go(i)
    }
    window.addEventListener(SAVED_TRACK, onTrack)
    return () => window.removeEventListener(SAVED_TRACK, onTrack)
  }, [verses, go])

  // Unaprijed preuzeto i dekodirano, kad je mirno — otvaranje panela i
  // listanje samo nacrtaju, ne čekaju mrežu ni dekoder: sličice omota (plejer
  // ispod), potpis, i ispečene atmosfere karata oko mjesta gdje se lista
  // (držane samo za bliže karte — malo memorije i kad je sačuvanih stotinu)
  useEffect(() => {
    const urls = new Set<string>(['/brand/signature.webp?v=2'])
    for (const v of verses) {
      const cover = albumOf(v.album)?.cover
      const thumb = thumbOf(cover)
      if (thumb) urls.add(thumb)
      // zamućen omot — pozadina plejera i kartica albuma
      const soft = softOf(cover)
      if (soft) urls.add(soft)
    }
    return whenCalm(() => urls.forEach(decodeOnce), 800)
  }, [verses])
  useEffect(() => {
    const want = new Set<string>()
    for (let k = -6; k <= 6; k++) {
      const v = verses[near + k]
      if (!v) continue
      const still = cardStillOf(v.album, v.mood)
      const art = still ? undefined : cardArtOf(albumOf(v.album)?.cover)
      if (still) want.add(still)
      if (art) want.add(art)
    }
    for (const u of [...stills.keys()]) if (!want.has(u)) stills.delete(u)
    return whenCalm(() => want.forEach(keepDecoded), 400)
  }, [near, verses])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // strelice u polju za pretragu pomjeraju kursor, ne špil
      if ((e.target as Element | null)?.closest?.('input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowRight') go(cur + 1)
      if (e.key === 'ArrowLeft') go(cur - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, cur])

  return (
    <div
      // do ruba ekrana — karta što šira, a susjedne vire sa strane
      className="-mx-5 flex flex-col items-center"
      style={
        {
          containerType: 'inline-size',
          '--cw': `min(calc(${size} * ${W / SH}), calc(100cqw - ${SIDE * 2}px))`,
        } as CSSProperties
      }
    >
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Karte"
        ref={strip}
        data-hscroll
        className="relative flex w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ height: `calc(var(--cw) * ${SH / W})`, gap: STRIP_GAP, touchAction: 'pan-x' }}
      >
        {/* razmak do prve/zadnje karte — da i one stanu na sredinu */}
        <div aria-hidden className="shrink-0" style={{ width: `calc((100% - var(--cw)) / 2 - ${STRIP_GAP}px)` }} />
        {verses.map((v, i) => (
          <Card
            key={v.id}
            verse={v}
            index={i}
            front={i === cur}
            full={Math.abs(i - near) <= 3}
            onOpen={open}
            onPick={go}
          />
        ))}
        <div aria-hidden className="shrink-0" style={{ width: `calc((100% - var(--cw)) / 2 - ${STRIP_GAP}px)` }} />
      </div>

      {dots &&
        verses.length > 1 &&
        (verses.length <= 8 ? (
          <div className="mt-3 flex items-center gap-1.5">
            {verses.map((v, i) => (
              <button
                key={v.id}
                onClick={() => go(i)}
                aria-label={`Stih ${i + 1}`}
                aria-current={i === cur}
                className="flex h-6 items-center justify-center px-0.5"
              >
                <span
                  className="block h-1.5 rounded-full transition-all duration-300"
                  style={{ width: i === cur ? 18 : 6, background: i === cur ? MOODS[verses[cur].mood].accent : 'rgba(255,255,255,0.22)' }}
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="tabular mt-3 h-6 text-[11px] tracking-[0.2em] text-white/50">
            {cur + 1} / {verses.length}
          </p>
        ))}
    </div>
  )
}

/** slike već dekodirane (iste kao pozadine karata — dekodiranje se dijeli) */
// slike se drže (ne bace se poslije dekodiranja) — preglednik ih ne mora opet dekodirati
const decoded = new Map<string, HTMLImageElement>()
function decodeOnce(src: string) {
  if (decoded.has(src)) return
  const img = new Image()
  decoded.set(src, img)
  img.src = src
  img.decode().catch(() => decoded.delete(src))
}
/** atmosfere karata oko mjesta gdje se lista — dekodirane i držane dok su blizu */
const stills = new Map<string, HTMLImageElement>()
function keepDecoded(src: string) {
  if (stills.has(src)) return
  const img = new Image()
  stills.set(src, img)
  img.src = src
  img.decode().catch(() => stills.delete(src))
}

/** koliko karta mora stajati na sredini da njena pjesma zamijeni onu koja svira (ms) — 0: čim traka stane */
const DWELL = 0

/** razmak između karata u traci (px) */
const STRIP_GAP = 14

/**
 * Jedna karta u traci. Sve su iste veličine i istog lica — promjena prednje
 * ne crta ništa iznova; susjedne su samo tamnije (sloj boje, prelaz na
 * grafičkom procesoru). `full`: lice karte; inače samo obris (daleko od
 * sredine). Svoj sloj (will-change): nacrta se jednom, a skrol je samo pomjera.
 */
const Card = memo(function Card({
  verse,
  index,
  front,
  full,
  onOpen,
  onPick,
}: {
  verse: Verse
  index: number
  front: boolean
  full: boolean
  onOpen?: (verse: Verse) => void
  onPick: (i: number) => void
}) {
  // daleko od sredine: samo mjesto za zaustavljanje, u boji karte — bez sloja i sadržaja
  if (!full) {
    const g = MOODS[verse.mood].gradient[0]
    return (
      <div
        data-card
        aria-hidden
        className="relative h-full shrink-0 cursor-pointer snap-center snap-always rounded-[26px]"
        style={{ width: 'var(--cw)', opacity: 0.8, background: `linear-gradient(180deg, ${g} 0%, ${g} 75%, rgba(12,11,11,0) 100%)` }}
        onClick={() => onPick(index)}
      />
    )
  }
  // dodir na prednju kartu je otvara (dugmad rade svoje)
  const tap = front && onOpen ? tapProps(() => onOpen(verse), 'button, a, input, [data-nodrag]') : undefined
  return (
    <div
      data-card
      aria-hidden={!front}
      className={`relative h-full shrink-0 snap-center snap-always ${front ? '' : 'cursor-pointer'}`}
      style={{ width: 'var(--cw)' }}
      // susjedna: dodir je dovede na sredinu — njena dugmad (srce, raširi) se
      // ne mogu slučajno pritisnuti (pointer-events ispod)
      onClick={front ? undefined : () => onPick(index)}
    >
      {/* svaka karta svoj stalni sloj: nacrta se jednom, a skrol je samo pomjera
          (slojevi koji se prave i ruše pri svakom zaustavljanju — crtanje usred listanja) */}
      {/* susjedne su tamnije — providnost sloja preko tamnog panela (isto kao
          crni sloj od 20 %, a jedan sloj manje po karti), prelaz na grafičkom procesoru */}
      <div className="absolute inset-0" style={{ willChange: 'transform', opacity: front ? 1 : 0.8, transition: 'opacity 0.2s ease' }}>
        {/* `data-stih` — po njemu je nađe raširena karta */}
        <div
          data-stih={front && onOpen ? verse.id : undefined}
          className={`absolute inset-0 ${front && onOpen ? 'cursor-pointer' : ''}`}
          style={front ? undefined : { pointerEvents: 'none' }}
          {...tap}
        >
          <CardFace verse={verse} o={0} onOpen={onOpen} />
        </div>
      </div>
    </div>
  )
})

/**
 * Lice karte — isto u špilu i raširenoj karti (components/SavedFull.tsx).
 * Sve je u `em` od `--cw` (širina karte), pa raširena karta izgleda isto,
 * samo veća. `o`: mjesto u špilu (karte ispod su tamnije).
 */
function CardFaceView({
  verse,
  o = 0,
  onOpen,
  onCollapse,
  actionsZoom,
}: {
  verse: Verse
  o?: number
  /** "Raširi" — samo prednja karta u špilu */
  onOpen?: (verse: Verse) => void
  /** "Skupi" — raširena karta */
  onCollapse?: () => void
  /**
   * Raširena karta: "Sačuvano" i "Podijeli" ispod stiha, kao na ekranu stiha.
   * Karta je uvećana (CSS `zoom`), pa se dugmad vrate na pravu veličinu ovim.
   */
  actionsZoom?: number
}) {
  const m = MOODS[verse.mood]
  const album = albumOf(verse.album)
  // atmosfera kao jedna ispečena slika — i na raširenoj karti (bez maski i zrna)
  const still = cardStillOf(verse.album, verse.mood)
  // raširena karta: sve što se tokom rasta pretapa ili pomjera je svoj sloj od
  // prvog kadra — animacija ne mora usred kretnje iznova crtati cijelu kartu
  const layer: CSSProperties | undefined = onCollapse ? { willChange: 'transform, opacity' } : undefined
  const text = asWritten(verse.text)
  const look = parseFont(verse.font).look
  const front = o === 0

  useEffect(() => preloadFonts(verse.font), [verse.font])
  // karte postoje samo na klijentu (poslije hidratacije) — smije se čitati odmah
  const [saved] = useState(() => savedDay(verse.id))
  // isti elementi iz rendera u render: FitLines mjeri samo kad se stih stvarno
  // promijeni, a ne pri svakom prevlačenju špila (inače mjere sve karte — trzaj)
  const dateLine = useMemo(() => <span>{formatFullDateBs(saved)}</span>, [saved])
  const lines = useMemo(() => <FontedLines text={text} font={verse.font} />, [text, verse.font])

  // raširena karta je viša (do dna ekrana), a raspored joj je isti kao na
  // maloj (gornjih H em) — prvi i zadnji kadar su tačno mala karta. Stih
  // (i dugmad ispod njega) mekano klizne na sredinu visoke karte (SavedFull,
  // `data-drop`: koliko em niže kad je raširena)
  const root = useRef<HTMLDivElement>(null)
  const mid = useRef<HTMLDivElement>(null)
  // gramofon samo na raširenoj karti: ploča se pojavi (data-big) i klizne na
  // dno (`data-grow`) dok karta raste — u špilu je pjesma u plejeru ispod
  const row = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const r = root.current
    const box = mid.current
    if (!actionsZoom || !r || !box) return
    const rr = r.getBoundingClientRect()
    if (!rr.width) return
    const em = rr.width / W
    const tall = rr.height / em
    box.dataset.drop = String(Math.max(0, Math.round((tall - SH) / 2)))
    const g = row.current
    if (g) {
      // donja zona iPhonea (traka za početni ekran), u em karte
      const probe = document.createElement('div')
      probe.style.cssText = 'position:fixed;bottom:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden'
      document.body.appendChild(probe)
      const safe = (parseFloat(getComputedStyle(probe).paddingBottom) || 0) / em
      probe.remove()
      // dno ploče iznad trake za početni ekran
      const down = tall - SH + 18 - 30 - safe
      g.dataset.grow = `translateY(${down.toFixed(1)}em)`
    }
  }, [actionsZoom])

  return (
    <div
      ref={root}
      data-face
      // raširena karta ide do dna ekrana — zaobljena samo gore
      className={`relative h-full w-full select-none overflow-hidden ${onCollapse ? 'rounded-t-[26px]' : 'rounded-[26px]'} ${onCollapse ? 'shadow-[0_24px_60px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]' : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'}`}
      style={{
        fontSize: `calc(var(--cw) / ${W})`,
        color: '#f5f5f5',
        background: m.gradient[0],
        // font ekrana stiha — i u panelu (koji ima sistemski font) i na
        // raširenoj karti isti, pa se pri pretapanju slova poklope slovo u slovo
        fontFamily: 'var(--font-sans), sans-serif',
        // dno karte (ispod plejera) se pretapa u boju panela slojem ispod (bez
        // maske preko cijele karte — ona je karti udvostručavala crtanje)
      }}
    >
      {/* atmosfera je uvijek visoka kao karta u špilu (H em) — raširena,
          viša karta je ima istu na vrhu, pa prvi kadar uvećanja = mala karta */}
      {/* isolate: slojevi atmosfere (z-index unutra) ostaju ispod sadržaja karte */}
      {/* u traci: atmosfera kao JEDNA unaprijed ispečena slika (scripts/bake-cards.ts) —
          brzo se crta i pri listanju; raširena karta je crta slojevima, oštro */}
      {still ? (
        <div aria-hidden className="absolute inset-x-0 top-0" style={{ height: `${H}em`, backgroundImage: `url(${still})`, backgroundSize: '100% 100%' }} />
      ) : (
        <CardAtmosphere mood={verse.mood} cover={album?.cover} art={onCollapse ? undefined : cardArtOf(album?.cover)} lift={album?.lift} />
      )}

      <div
        className={`absolute inset-x-0 top-0 z-[1] flex flex-col justify-between ${actionsZoom ? '' : 'bottom-0'}`}
        // zraka od lijeve i desne ivice karte (isto za zaglavlje, stih i gramofon)
        style={{ padding: `26em ${SIDE_PAD}em ${FADE * 0.75}em`, height: actionsZoom ? `${SH}em` : undefined }}
      >
        {/* zaglavlje — potpis | Magaza, kao na ekranu stiha; desno raširi i srce */}
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: '14em' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/signature.webp?v=2" alt="" draggable={false} style={{ height: '36em', width: 'auto', opacity: 0.9 }} />
            <span style={{ width: '1em', height: '24em', background: 'rgba(255,255,255,0.2)' }} />
            <MagazaMark height={36 * MAGAZA_BESIDE} style={{ opacity: 0.9, transform: MAGAZA_DROP_CSS }} />
          </div>
          {/* svako dugme se na raširenoj vrati na svoju veličinu oko svoje sredine
              (data-shrink) — ostaje na svom mjestu na karti, ne klizne prema uglu */}
          <div className="flex items-center gap-2">
            {/* raširi kartu preko cijelog ekrana / skupi je nazad */}
            {(onOpen || onCollapse) && (
              <span data-shrink className="flex" style={layer}>
                <button
                  data-nodrag
                  {...tapProps(() => (onCollapse ? onCollapse() : onOpen?.(verse)))}
                  aria-label={onCollapse ? 'Skupi' : 'Raširi'}
                  title={onCollapse ? 'Skupi' : 'Raširi'}
                  // bez pritiska (scale): karta se širi/skuplja odmah na dodir — kopija i karta
                  // ispod se pretapaju, pa bi dugme usred pritiska na tren bilo dvostruko
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white/80"
                >
                  {/* strelice se okrenu dok karta raste i skuplja se (SavedFull `data-flip`) */}
                  <ExpandMorph layer={layer} />
                </button>
              </span>
            )}
            {/* srce — i na raširenoj karti */}
            <span data-shrink className="flex" style={layer}>
              <button
                data-nodrag
                onClick={() => toggleFavorite(verse.id)}
                aria-label="Ukloni iz sačuvanih"
                title="Ukloni iz sačuvanih"
                className="flex h-8 w-8 items-center justify-center rounded-full border transition-transform active:scale-90"
                style={{ borderColor: `${m.accent}55`, background: `${m.accent}1a`, color: m.accent }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z" />
                </svg>
              </button>
            </span>
          </div>
        </div>

        {/* dan kad je sačuvan → stih — datum isti kao na ekranu stiha */}
        {/* razmaci isti kao na ekranu stiha: datum → stih → dugmad (32 / 52) */}
        <div ref={mid} className="flex flex-1 flex-col items-center justify-center" style={{ ...layer, gap: '32em' }}>
          <p
            className="tabular"
            style={{
              fontSize: '11em',
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: m.accent,
              textShadow: '0 1px 2px rgba(0,0,0,0.85), 0 0 14px rgba(0,0,0,0.65)',
              alignSelf: 'stretch',
              textAlign: 'center',
            }}
          >
            {/* dug dan (ČETVRTAK, SEPTEMBAR) se smanji — ne izlazi iz razmaka */}
            <FitLines cacheKey={`d|${saved}`}>{dateLine}</FitLines>
          </p>
          <p
            className="verse"
            style={{
              ...lookCss(look, m.accent),
              fontSize: `${verseSize(text) * lookScale(look)}em`,
              color: m.text,
              textShadow: `0 0.07em 1em rgba(0,0,0,0.5), 0 0 1.6em ${m.accent}2e`,
              alignSelf: 'stretch',
            }}
          >
            <FitLines cacheKey={`v|${verse.id}|${verse.font ?? ''}|${text}`}>{lines}</FitLines>
          </p>
          {/* radnje stiha — mjesto je i na maloj karti, pa se pri uvećanju ništa ne pomjeri */}
          <div className="flex items-center justify-center" style={{ height: '44em', marginTop: '20em' }}>
            {actionsZoom && (
              <div data-nodrag data-big className="flex items-center gap-2.5" style={{ ...layer, zoom: actionsZoom, opacity: 0 }}>
                <FavoriteButton id={verse.id} accent={m.accent} />
                <ShareButton verse={verse} accent={m.accent} date={saved} pill />
              </div>
            )}
          </div>
        </div>

        {/* gramofon — samo na raširenoj karti; ne mijenja raspored stiha (apsolutno, pri dnu) */}
        {onCollapse && (
          <div
            ref={row}
            data-nodrag
            data-big
            className="absolute flex items-center gap-2.5"
            style={{ ...layer, left: `${SIDE_PAD}em`, right: `${SIDE_PAD}em`, bottom: '18em', opacity: 0, transformOrigin: 'center bottom' }}
          >
            <SongRow verse={verse} accent={m.accent} fit vinyl={54} />
          </div>
        )}
      </div>


      {/* pjesma i album na dnu male karte — tik iznad mjesta gdje se karta
          pretapa u plejer; na raširenoj ih nosi gramofon (data-small → nestanu) */}
      <div
        data-small
        className="pointer-events-none absolute z-[1] flex flex-col items-center text-center"
        // niže, tik iznad plejera koji prekrije dno karte
        style={{ ...layer, left: `${SIDE_PAD}em`, right: `${SIDE_PAD}em`, top: `${SH - 120}em`, gap: '7em' }}
      >
        <p className="max-w-full truncate font-semibold uppercase" style={{ fontSize: '15em', letterSpacing: '0.18em', color: m.accent }}>
          {verse.song}
        </p>
        <p className="max-w-full truncate uppercase" style={{ fontSize: '12em', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.6)' }}>
          {albumLine(verse)}
        </p>
      </div>

      {/* rub male karte (i na raširenoj u prvom kadru) — pretopi se u rub velike */}
      <span
        data-small
        className={`pointer-events-none absolute inset-x-0 top-0 rounded-[26px] border ${front ? 'border-white/15' : 'border-white/30'}`}
        style={{ ...layer, height: `${SH}em` }}
        aria-hidden
      />
      <span
        data-big
        className="pointer-events-none absolute inset-0 rounded-[inherit] border border-b-0 border-white/15"
        style={{ ...layer, opacity: 0 }}
        aria-hidden
      />

      {/* dno se pretopi u boju panela, pa u plejer ispod — na raširenoj karti
          (data-small) nestane dok raste */}
      <span
        data-small
        className="pointer-events-none absolute inset-x-[-1px]"
        style={{ ...layer, top: `${SH - FADE}em`, height: `${FADE + 1}em`, background: 'linear-gradient(180deg, rgba(12,11,11,0) 0%, rgba(12,11,11,0.75) 40%, #0c0b0b 68%)' }}
        aria-hidden
      />

    </div>
  )
}

/**
 * Lice karte, memoizovano: pri prevlačenju svaka karta promijeni mjesto u
 * špilu (`o`), ali se iscrta iznova samo kad postane (ili prestane biti)
 * prednja — atmosfera i stih su skupi za crtanje; tamnjenje je van lica.
 */
export const CardFace = memo(
  CardFaceView,
  (a, b) =>
    a.verse === b.verse &&
    ((a.o ?? 0) === 0) === ((b.o ?? 0) === 0) &&
    a.onOpen === b.onOpen &&
    a.onCollapse === b.onCollapse &&
    a.actionsZoom === b.actionsZoom,
)
