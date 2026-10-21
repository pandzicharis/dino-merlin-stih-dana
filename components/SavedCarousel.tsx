'use client'

import { memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Verse } from '@/data/verses'
import { ExpandIcon } from './ExpandIcon'
import { FavoriteButton } from './FavoriteButton'
import { ShareButton } from './ShareSheet'
import { MOODS } from '@/data/moods'
import { albumOf, blurOf, cardArtOf, thumbOf } from '@/data/albums'
import { lookCss, lookScale, parseFont, preloadFonts } from '@/lib/fonts'
import { asWritten } from '@/lib/text'
import { savedDay, toggleFavorite } from '@/lib/storage'
import { formatFullDateBs } from '@/lib/date'
import { MAGAZA_BESIDE, MAGAZA_DROP_CSS } from '@/lib/brand'
import { FontedLines, MagazaMark, MoodStill, Notes } from './deck/Screens'
import { FitLines } from './deck/FitLines'
import { SongRow } from './SongCredit'
import { SAVED_TRACK, playSaved, savedVerse, setSavedPlaylist, useSavedPlayerSelect } from '@/lib/player'
import { whenCalm } from '@/lib/calm'

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
/** mjesto sa svake strane prednje karte — tu vire susjedne */
const SIDE = 54
/** zraka unutar karte, lijevo i desno (em od W) */
const SIDE_PAD = 32
/**
 * Dno karte (em od H) se pretapa u plejer ispod špila — karta kao da izlazi
 * iz plejera. Stih stoji iznad toga, na sredini vidljivog dijela.
 */
const FADE = 190
// prozirnost tek ispod plejera (on prekriva dno karte) — gdje se karta vidi,
// pretapa se u NEPROZIRNU boju panela (sloj ispod), pa se karte iza ne naziru
const CARD_MASK = 'linear-gradient(to bottom, black 86%, transparent 100%)'
/** atmosfera se pri dnu pretopi u boju karte — na raširenoj, višoj karti nema ruba */
const STILL_MASK = 'linear-gradient(to bottom, black 80%, transparent 100%)'

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
      return Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / step)))
    }
    const live = () => {
      raf = 0
      const i = nearest()
      if (i >= 0) setAt(i)
    }
    const settle = () => {
      clearTimeout(t)
      const i = nearest()
      step = 0
      if (i < 0) return
      setAt(i)
      setRest(i)
      startTransition(() => setNear(i))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(live)
      clearTimeout(t)
      t = window.setTimeout(settle, 90)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('scrollend', settle)
    return () => {
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
  // plejer ispod (pjesma, atmosfera) pokazuje prednju kartu — odmah, čim
  // karta pređe pola puta (listanje je sistemsko, ovo ga ne usporava)
  useEffect(() => {
    const v = verses[cur]
    if (v) onFront?.(v)
  }, [cur, verses, onFront])
  // i obrnuto: prevučena karta dok muzika svira — svira njena pjesma, kad
  // listanje stane. Kad plejer pređe na drugu pjesmu, špil je stiže — tad se ništa ne pušta
  const restN = Math.min(rest, Math.max(0, n - 1))
  const lastRest = useRef(restN)
  const live = useRef({ playing: player.playing, verses })
  useEffect(() => {
    live.current = { playing: player.playing, verses }
  }, [player.playing, verses])
  useEffect(() => {
    if (lastRest.current === restN) return
    lastRest.current = restN
    const v = live.current.verses[restN]
    if (live.current.playing && v && v.id !== savedVerse()?.id) playSaved(v)
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
      if (i >= 0) go(i)
    }
    window.addEventListener(SAVED_TRACK, onTrack)
    return () => window.removeEventListener(SAVED_TRACK, onTrack)
  }, [verses, go])

  // Slike SVIH karata (po albumu — najviše dvije po albumu) se preuzmu i
  // dekodiraju unaprijed, kad je mirno — otvaranje panela i listanje ih
  // samo nacrtaju, ne čekaju mrežu ni dekoder
  useEffect(() => {
    const urls = new Set<string>(['/brand/signature.webp?v=2'])
    for (const v of verses) {
      const cover = albumOf(v.album)?.cover
      const art = cardArtOf(cover)
      const soft = blurOf(cover, Math.round(W * 0.14) / (1.3 * Math.max(W, H)))
      // i sličica omota — plejer ispod je pokaže čim se karta promijeni
      const thumb = thumbOf(cover)
      if (art) urls.add(art)
      if (soft) urls.add(soft)
      if (thumb) urls.add(thumb)
    }
    return whenCalm(() => urls.forEach(decodeOnce), 800)
  }, [verses])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
          '--cw': `min(calc(${size} * ${W / H}), calc(100cqw - ${SIDE * 2}px))`,
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
        style={{ height: `calc(var(--cw) * ${H / W})`, gap: STRIP_GAP, touchAction: 'pan-x' }}
      >
        {/* razmak do prve/zadnje karte — da i one stanu na sredinu */}
        <div aria-hidden className="shrink-0" style={{ width: `calc((100% - var(--cw)) / 2 - ${STRIP_GAP}px)` }} />
        {verses.map((v, i) => (
          <Card
            key={v.id}
            verse={v}
            index={i}
            front={i === cur}
            far={Math.abs(i - cur) >= 2}
            full={Math.abs(i - near) <= 3}
            onOpen={onOpen}
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
  far,
  full,
  onOpen,
  onPick,
}: {
  verse: Verse
  index: number
  front: boolean
  /** dalje od prve susjede — crta se tek kad panel sjedne (globals.css) */
  far: boolean
  full: boolean
  onOpen?: (verse: Verse) => void
  onPick: (i: number) => void
}) {
  // dodir na prednju kartu je otvara, na susjednu — dovede je na sredinu
  const tap = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('button, a, input, [data-nodrag]')) return
    if (!front) return onPick(index)
    onOpen?.(verse)
  }
  return (
    <div data-card data-far={far ? '' : undefined} aria-hidden={!front} className="relative h-full shrink-0 snap-center snap-always" style={{ width: 'var(--cw)' }}>
      <div className="absolute inset-0" style={{ willChange: 'transform' }}>
        {/* `data-stih` — po njemu je nađe raširena karta */}
        <div data-stih={front && onOpen ? verse.id : undefined} className={`absolute inset-0 ${front && onOpen ? 'cursor-pointer' : ''}`} onClick={tap}>
          {full ? (
            <>
              <CardFace verse={verse} o={0} onOpen={onOpen} />
              {/* obris dok se plejer otvara (SavedPanel `data-skel`) */}
              <CardSkeleton verse={verse} overlay />
            </>
          ) : (
            <CardSkeleton verse={verse} />
          )}
        </div>
        {/* susjedne su tamnije — prednja se ističe */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[26px] bg-black"
          style={{ opacity: front ? 0 : 0.2, transition: 'opacity 0.2s ease', willChange: 'opacity' }}
        />
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
    box.dataset.drop = String(Math.max(0, Math.round((tall - H) / 2)))
    const g = row.current
    if (g) {
      // donja zona iPhonea (traka za početni ekran), u em karte
      const probe = document.createElement('div')
      probe.style.cssText = 'position:fixed;bottom:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden'
      document.body.appendChild(probe)
      const safe = (parseFloat(getComputedStyle(probe).paddingBottom) || 0) / em
      probe.remove()
      // dno ploče iznad trake za početni ekran
      const down = tall - H + 18 - 30 - safe
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
        // karta u špilu se pri dnu stvarno izgubi (i rubovi) — izlazi iz plejera
        ...(onCollapse ? {} : { maskImage: CARD_MASK, WebkitMaskImage: CARD_MASK }),
      }}
    >
      {/* atmosfera je uvijek visoka kao karta u špilu (H em) — raširena,
          viša karta je ima istu na vrhu, pa prvi kadar uvećanja = mala karta */}
      {/* isolate: slojevi atmosfere (z-index unutra) ostaju ispod sadržaja karte */}
      <div className="absolute inset-x-0 top-0 isolate" style={{ height: `${H}em`, maskImage: STILL_MASK, WebkitMaskImage: STILL_MASK }}>
        <MoodStill mood={verse.mood} w={W} h={H} cover={album?.cover} art={onCollapse ? undefined : cardArtOf(album?.cover)} lift={album?.lift} />
        <Notes
          accent={m.accent}
          // note sa strane, ne preko stiha ni dugmadi (ni na raširenoj karti)
          spots={[
            [8, 36, 26, '♫'],
            [88, 50, 18, '♪'],
            [84, 22, 16, '♩'],
          ]}
        />
      </div>

      <div
        className={`absolute inset-x-0 top-0 z-[1] flex flex-col justify-between ${actionsZoom ? '' : 'bottom-0'}`}
        // zraka od lijeve i desne ivice karte (isto za zaglavlje, stih i gramofon)
        style={{ padding: `26em ${SIDE_PAD}em ${FADE * 0.75}em`, height: actionsZoom ? `${H}em` : undefined }}
      >
        {/* zaglavlje — potpis | Magaza, kao na ekranu stiha; desno raširi i srce */}
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: '14em' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/signature.webp?v=2" alt="" draggable={false} style={{ height: '36em', width: 'auto', opacity: 0.9 }} />
            <span style={{ width: '1em', height: '24em', background: 'rgba(255,255,255,0.2)' }} />
            <MagazaMark height={36 * MAGAZA_BESIDE} style={{ opacity: 0.9, transform: MAGAZA_DROP_CSS }} />
          </div>
          <div data-shrink className="flex items-center gap-2" style={{ transformOrigin: 'right center' }}>
            {/* raširi kartu preko cijelog ekrana / skupi je nazad */}
            {(onOpen || onCollapse) && (
              <button
                data-nodrag
                onClick={() => (onCollapse ? onCollapse() : onOpen?.(verse))}
                aria-label={onCollapse ? 'Skupi' : 'Raširi'}
                title={onCollapse ? 'Skupi' : 'Raširi'}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white/80 transition-transform active:scale-90"
              >
                {/* na raširenoj karti obje ikone, jedna preko druge — pretapaju se dok
                    karta raste (components/SavedFull.tsx `data-small` / `data-big`) */}
                <span className="relative block h-[15px] w-[15px]">
                  <span data-small className="absolute inset-0">
                    <ExpandIcon />
                  </span>
                  {onCollapse && (
                    <span data-big className="absolute inset-0" style={{ opacity: 0 }}>
                      <ExpandIcon collapse />
                    </span>
                  )}
                </span>
              </button>
            )}
            {/* srce — i na raširenoj karti */}
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
          </div>
        </div>

        {/* dan kad je sačuvan → stih — datum isti kao na ekranu stiha */}
        {/* razmaci isti kao na ekranu stiha: datum → stih → dugmad (32 / 52) */}
        <div ref={mid} className="flex flex-1 flex-col items-center justify-center" style={{ gap: '32em' }}>
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
              <div data-nodrag data-big className="flex items-center gap-2.5" style={{ zoom: actionsZoom, opacity: 0 }}>
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
            style={{ left: `${SIDE_PAD}em`, right: `${SIDE_PAD}em`, bottom: '18em', opacity: 0, transformOrigin: 'center bottom' }}
          >
            <SongRow verse={verse} accent={m.accent} fit vinyl={46} />
          </div>
        )}
      </div>


      {/* pjesma i album na dnu male karte — tik iznad mjesta gdje se karta
          pretapa u plejer; na raširenoj ih nosi gramofon (data-small → nestanu) */}
      <div
        data-small
        className="pointer-events-none absolute z-[1] flex flex-col items-center text-center"
        // naziv ostaje gdje je bio (bez zvjezdice iznad njega)
        style={{ left: `${SIDE_PAD}em`, right: `${SIDE_PAD}em`, top: `${H - FADE - 7}em`, gap: '7em' }}
      >
        <p className="max-w-full truncate font-semibold uppercase" style={{ fontSize: '12.5em', letterSpacing: '0.2em', color: m.accent }}>
          {verse.song}
        </p>
        <p className="max-w-full truncate uppercase" style={{ fontSize: '9.5em', letterSpacing: '0.24em', color: 'rgba(255,255,255,0.55)' }}>
          {verse.album} · {verse.year}
        </p>
      </div>

      {/* rub male karte (i na raširenoj u prvom kadru) — pretopi se u rub velike */}
      <span
        data-small
        className={`pointer-events-none absolute inset-x-0 top-0 rounded-[26px] border ${front ? 'border-white/15' : 'border-white/30'}`}
        style={{ height: `${H}em` }}
        aria-hidden
      />
      <span
        data-big
        className="pointer-events-none absolute inset-0 rounded-[inherit] border border-b-0 border-white/15"
        style={{ opacity: 0 }}
        aria-hidden
      />

      {/* dno se pretopi u boju panela, pa u plejer ispod — na raširenoj karti
          (data-small) nestane dok raste */}
      <span
        data-small
        className="pointer-events-none absolute inset-x-[-1px]"
        style={{ top: `${H - FADE}em`, height: `${FADE + 1}em`, background: 'linear-gradient(180deg, rgba(12,11,11,0) 0%, rgba(12,11,11,0.75) 40%, #0c0b0b 68%)' }}
        aria-hidden
      />

    </div>
  )
}

/**
 * Obris karte: boja raspoloženja i tihe linije umjesto datuma, stiha i
 * pjesme — crta se za tren. Dok se plejer otvara (`overlay`, preko lica) i
 * pri brzom listanju (karte van pripremljenog prozora).
 */
const CardSkeleton = memo(function CardSkeleton({ verse, overlay = false }: { verse: Verse; overlay?: boolean }) {
  const m = MOODS[verse.mood]
  const line = (w: string, h: number, bg: string) => <span className="block rounded-full" style={{ width: w, height: `${h}em`, background: bg }} />
  return (
    <div
      data-skel-card={overlay ? '' : undefined}
      aria-hidden
      className={`${overlay ? 'pointer-events-none absolute inset-0' : 'relative h-full w-full'} overflow-hidden rounded-[26px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`}
      style={{ fontSize: `calc(var(--cw) / ${W})`, background: `linear-gradient(180deg, ${m.gradient[0]} 0%, ${m.gradient[0]} 80%, rgba(12,11,11,0) 100%)` }}
    >
      <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: '210em', gap: '22em' }}>
        {line('34%', 9, `${m.accent}55`)}
        <div className="flex w-full flex-col items-center" style={{ gap: '14em' }}>
          {line('70%', 20, 'rgba(255,255,255,0.09)')}
          {line('58%', 20, 'rgba(255,255,255,0.09)')}
        </div>
      </div>
      <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: `${H - FADE - 7}em`, gap: '10em' }}>
        {line('30%', 11, `${m.accent}55`)}
        {line('42%', 8, 'rgba(255,255,255,0.12)')}
      </div>
    </div>
  )
})

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
