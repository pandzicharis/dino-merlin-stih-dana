'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { albumOf } from '@/data/albums'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
import { WIDE_MEDIA, useFavorites } from '@/lib/client-store'
import { haptic } from '@/lib/haptic'
import { lockScroll } from '@/lib/scroll-lock'
import { pruneFavorites } from '@/lib/storage'
import { loadVerses } from '@/lib/verses-client'
import { closeTube, minimizeTube, openTube, tubeSnap, tubeVerse, useTube } from '@/lib/youtube'
import { CARD_CUT, SavedCarousel } from '../SavedCarousel'
import { useSavedFull } from '../SavedFull'
import { SheetBackdrop, SheetLayer, SheetSlide, useSheetDrag, useSheetOpen } from '../Sheet'
import { DrawerHeader } from '../DrawerIcon'
import { Search } from './icons'
import { TubeDrawer } from './TubeDrawer'
import { MiniSong } from './MiniSong'
import { NowPlaying, SongBackdrop } from './NowPlaying'
import { Albums, Slips, SongList, VIEWS, searchSongs, uniqueSongs, type TubeView } from './TubeViews'

const SCOPE = 'saved'

/**
 * Pjesma u istoj ladici kao sačuvani — nije druga ladica preko njih: sadržaj
 * se pretopi (i nazad) dok ladica glatko mijenja visinu. Dok odlazi, `inert` —
 * video (TubeStage) se skloni odmah, a slika pjesme ispod njega izblijedi sa slojem.
 */
function SongLayer({ children }: { children: ReactNode }) {
  const present = useIsPresent()
  return (
    <motion.div
      className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-[#0c0b0b]"
      inert={!present}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** visina izreza na vrhu ekrana (safe area) */
function safeTop(): number {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden'
  document.body.append(probe)
  const h = probe.offsetHeight
  probe.remove()
  return h
}

/** visine ladice (px): niža dok se lista, do vrha dok svira pjesma — na širokom ekranu ista */
function sheetSizes(): { low: number; full: number } {
  if (typeof window === 'undefined') return { low: 0, full: 0 }
  const h = window.innerHeight
  if (window.matchMedia(WIDE_MEDIA).matches) return { low: Math.round(h * 0.82), full: Math.round(h * 0.82) }
  return { low: Math.round(h * 0.76), full: h - Math.max(safeTop(), 12) }
}
/**
 * karta u špilu — ista kao u plejeru iza prekidača (raspored, stih, razmaci), samo
 * odsječena ispod albuma (`CARD_CUT`): visoka koliko se vidi u prikazu (`cqh` —
 * prikaz je kontejner: bez 20 px iznad karte, a do samih dugmadi), a ispod nje
 * 72 px — broj "x / x" (20 px) je malo iznad sredine između kraja karte i
 * dugmadi. Susjedne vire 38 px (ne 54) — karta je šira, pa i viša. Spuštena
 * pjesma (traka iznad dugmadi) prikaz smanji — karta se smanji s njim.
 */
const CARD = 'calc(100cqh - 72px)'

/**
 * Sačuvani stihovi (YouTube — lib/youtube.ts): ladica kao postavke i
 * dijeljenje (zaglavlje, povlačenje nadolje, Escape).
 *
 *   prikazi   dugmad na dnu (kao u starom plejeru): Stihovi (špil karata, ispod "2 / 22"),
 *             Papirići (kao u Magazi — otvara se na njima), Pjesme (lista) i Albumi; lupa traži
 *             pjesmu. Ladica je niža dok se lista. Dodir na kartu ili papirić raširi stih
 *             (components/SavedFull.tsx); na raširenom je pjesma
 *   pjesma    izađe preko ove (ladica uzme visinu pjesme — pjesma i
 *             sačuvani su iste veličine) ili preko raširenog stiha
 *             (components/tube/NowPlaying.tsx); strelica nadolje je spusti:
 *             pjesma čeka u traci iznad prikaza (MiniSong.tsx), dodir je vrati
 *   red       pjesma iz "Pjesme" ili albuma ima red — tu listu: "sljedeća" u
 *             pjesmi, a kad završi, sljedeća krene sama (lib/youtube.ts)
 *
 * Zatvaranjem ladice pjesma stane.
 */
export default function TubePanel({ open, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  const [verses, setVerses] = useState<Verse[] | null>(null)
  useEffect(() => {
    let alive = true
    void loadVerses().then((v) => {
      if (!alive) return
      setVerses(v)
      // obrisani stihovi ispadnu iz sačuvanih — brojač na zaglavlju se ispravi
      if (v.length) pruneFavorites(new Set(v.map((x) => x.id)))
    })
    return () => {
      alive = false
    }
  }, [])
  const favs = useFavorites()
  const list = useMemo(() => {
    const byId = new Map((verses ?? []).map((v) => [v.id, v]))
    return favs.flatMap((id) => byId.get(id) ?? [])
  }, [verses, favs])
  // pjesme — svaka jednom (dva sačuvana stiha iste pjesme su jedna pjesma)
  const songs = useMemo(() => uniqueSongs(list), [list])

  // sačuvani se uvijek otvore na papirićima (panel ostaje montiran — svako otvaranje ispočetka)
  const [view, setView] = useState<TubeView>('slips')
  // pretraga pjesama: polje ispod zaglavlja, pogoci u "Pjesme"; `null` — zatvorena
  const [query, setQuery] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setView('slips')
      setQuery(null)
    }
  }
  const input = useRef<HTMLInputElement>(null)
  /** prikaz prije pretrage — × ga vrati */
  const before = useRef<TubeView>('slips')
  const searching = query !== null
  const found = useMemo(() => (query?.trim() ? searchSongs(songs, query) : songs), [songs, query])
  const endSearch = (to?: TubeView) => {
    input.current?.blur()
    if (query === null) return
    setQuery(null)
    setView(to ?? before.current)
  }
  const pick = (v: TubeView) => {
    haptic(5)
    endSearch(v)
    setView(v)
  }

  // pjesma otvorena iz ove ladice — druga ladica preko nje; spuštena čeka u traci
  const tube = useTube()
  const song = tube.scope === SCOPE && tube.videoId && !tube.min ? tubeVerse() : null
  const parked = (tube.scope === SCOPE || tube.scope === 'card') && tube.videoId && tube.min ? tubeVerse() : null
  // red za "sljedeća": lista iz koje je puštena — pjesme (i pogoci pretrage), ili pjesme albuma
  const playSong = useCallback((v: Verse) => void openTube(v, SCOPE, found), [found])
  const playAlbum = useCallback(
    (v: Verse) => {
      const album = albumOf(v.album)?.title
      void openTube(v, SCOPE, songs.filter((s) => albumOf(s.album)?.title === album))
    },
    [songs],
  )
  // raširen stih — karta ili papirić (components/SavedFull.tsx)
  const full = useSavedFull(list)

  // ladica je niža dok se lista; pjesma je raširi do vrha (pjesma je ista ladica — iste veličine)
  const [sizes, setSizes] = useState(sheetSizes)
  useEffect(() => {
    const on = () => setSizes(sheetSizes())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  // pjesma traži svoju visinu (NowPlaying) — ladica je iste veličine kao pjesma
  const [songH, setSongH] = useState(0)
  const height = song && songH ? songH : sizes.low

  useSheetOpen(open)
  const sheetDrag = useSheetDrag(onClose, open)
  // otvoreni sačuvani: pjesma s početne (ili poklona) se zatvori — ne ostaju dvije ladice jedna preko druge
  useEffect(() => {
    if (!open) return
    const scope = tubeSnap().scope
    if (scope && scope !== SCOPE && scope !== 'card') closeTube()
  }, [open])
  useEffect(() => {
    if (!open) return
    // Escape: pjesma se spusti na sačuvane, pa tek onda zatvori ladicu
    // (pjesma s raširenog stiha ima svoju ladicu — ona sama sluša Escape; raširen stih isto)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const { scope, min } = tubeSnap()
      if (scope === SCOPE && !min) minimizeTube()
      else if ((scope !== 'card' || min) && !document.querySelector('[data-full]')) onClose()
    }
    const unlock = lockScroll()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      unlock()
      // zatvorena: njena pjesma stane
      if (tubeSnap().scope === SCOPE || tubeSnap().scope === 'card') closeTube()
    }
  }, [open, onClose])

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <SheetLayer className="fixed inset-0 z-[100] flex items-end justify-center wide:items-center">
          <SheetBackdrop onClose={onClose} />
          <SheetSlide edge>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Sačuvani stihovi"
              className="os-sheet relative flex w-full flex-col overflow-hidden rounded-t-[30px] border border-b-0 border-white/10 wide:max-w-[440px] wide:rounded-[30px] wide:border-b"
              {...sheetDrag}
              initial={false}
              animate={{ height }}
              // visina klizi mirno (bez opruge — ne odbija se na kraju)
              transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
              style={{
                ...sheetDrag.style,
                background: `radial-gradient(120% 60% at 50% 0%, ${BRAND.gold}1a 0%, transparent 60%), linear-gradient(180deg, #121010 0%, #0c0b0b 100%)`,
              }}
            >
              {/* zaglavlje kao na ostalim panelima */}
              <DrawerHeader
                icon={
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z" />
                  </svg>
                }
                eyebrow="Stih dana"
                title="Sačuvani stihovi"
                onClose={onClose}
              />

              {list.length ? (
                <>
                  {/* pretraga — polje je uvijek tu (fokus iz samog dodira otvori tastaturu na iPhoneu), samo skupljeno;
                      20 px ispod zaglavlja, kao prvi red u svakom prikazu */}
                  <div className={`shrink-0 overflow-hidden px-5 transition-[height,opacity] duration-300 ${searching ? 'h-[64px] opacity-100' : 'h-0 opacity-0'}`}>
                    <label
                      className="mt-5 flex h-11 items-center gap-2.5 rounded-full border bg-white/[0.07] pl-4 pr-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors focus-within:bg-white/[0.1]"
                      style={{ borderColor: query ? `${BRAND.gold}66` : 'rgba(255,255,255,0.12)' }}
                    >
                      <Search size={16} className={query ? '' : 'text-white/45'} style={query ? { color: BRAND.gold } : undefined} />
                      <input
                        ref={input}
                        type="search"
                        enterKeyHint="search"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        tabIndex={searching ? 0 : -1}
                        value={query ?? ''}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                          if (e.key === 'Escape') {
                            e.stopPropagation()
                            endSearch()
                          }
                        }}
                        placeholder="Traži pjesmu"
                        aria-label="Traži pjesmu"
                        // 16 px — iPhone inače uveća stranicu pri kucanju
                        className="min-w-0 flex-1 appearance-none bg-transparent text-[16px] text-white/90 outline-none placeholder:text-white/35 [&::-webkit-search-cancel-button]:hidden"
                      />
                      <button
                        type="button"
                        tabIndex={searching ? 0 : -1}
                        onClick={() => {
                          haptic(5)
                          endSearch()
                        }}
                        aria-label="Zatvori pretragu"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.12] text-white/75 transition-colors hover:text-white active:scale-90"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                          <path d="M6 6l12 12M18 6 6 18" />
                        </svg>
                      </button>
                    </label>
                  </div>

                  {/* prikaz — novi se pretopi odmah (bez čekanja da stari ode: "wait" je znao zapeti i prikaz se ne bi promijenio) */}
                  <motion.div
                      key={view}
                      data-pane={view}
                      // u svakom prikazu prvo je 20 px ispod zaglavlja (i ispod pretrage): karta,
                      // album, papirić, omot prve pjesme (red ima svojih 10 px iznad omota).
                      // Karte: prikaz seže do samih dugmadi (-mb-3 preko njihovog razmaka), karta
                      // gore, a broj "x / x" na sredini između kraja karte i dugmadi
                      className={`min-h-0 flex-1 px-5 ${view === 'cards' ? '-mb-3 flex flex-col overflow-hidden pt-5 [container-type:size]' : view === 'albums' ? 'overflow-hidden pt-4' : `overflow-y-auto overflow-x-hidden overscroll-none ${view === 'list' ? 'pt-1.5' : 'pt-4'}`}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {view === 'cards' ? (
                        <SavedCarousel verses={list} size={CARD} cut={CARD_CUT} side={38} onOpen={full.open} count even lead />
                      ) : view === 'slips' ? (
                        <Slips verses={list} onPick={full.open} />
                      ) : view === 'list' ? (
                        <SongList verses={found} onPick={playSong} />
                      ) : (
                        <Albums verses={songs} onPick={playAlbum} />
                      )}
                    </motion.div>

                  {/* spuštena pjesma — traka iznad prikaza; dodir je vrati */}
                  <AnimatePresence initial={false}>
                    {parked && (
                      <motion.div
                        key="parked"
                        className="relative z-10 shrink-0 overflow-hidden px-5"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
                      >
                        <div className="pt-3">
                          <MiniSong verse={parked} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* prikazi i lupa — uz dno, pod palcem */}
                  <div className="relative z-10 flex shrink-0 items-center justify-center px-5 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-3">
                    <div className="relative flex rounded-full bg-white/[0.07] p-[3px]" role="tablist" aria-label="Prikaz">
                      {VIEWS.map(([v, label, icon]) => (
                        <button
                          key={v}
                          type="button"
                          role="tab"
                          aria-selected={view === v}
                          onClick={() => pick(v)}
                          data-view={v}
                          className="relative flex h-10 min-w-[44px] items-center justify-center gap-2 rounded-full px-3.5 text-[10px] font-medium uppercase tracking-[0.2em] transition-colors duration-300"
                          style={{ color: view === v ? '#14100A' : 'rgba(255,255,255,0.65)' }}
                        >
                          {view === v && <motion.span layoutId="tube-view" className="absolute inset-0 rounded-full" style={{ background: BRAND.gold }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                          <svg className="relative" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            {icon}
                          </svg>
                          {/* natpis samo na izabranom — četiri prikaza i lupa stanu i na malom ekranu */}
                          {view === v ? <span className="relative">{label}</span> : <span className="sr-only">{label}</span>}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        haptic(5)
                        // odmah, u istom dodiru — iPhone inače ne otvori tastaturu
                        input.current?.focus()
                        if (query !== null) return
                        before.current = view
                        setView('list')
                        setQuery('')
                      }}
                      aria-label="Traži pjesmu"
                      className="ml-2 flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white/65 transition-colors hover:text-white"
                    >
                      <Search size={17} />
                    </button>
                  </div>
                </>
              ) : (
                <p className="flex flex-1 items-center justify-center px-10 text-center text-[13px] text-white/45">{verses ? 'Još nema sačuvanih stihova' : ''}</p>
              )}

              {/* pjesma — ista ladica, drugi sadržaj: pretopi se preko sačuvanih dok ladica
                  mijenja visinu (i nazad); strelica je spusti u traku */}
              <AnimatePresence>
                {song && tube.videoId && (
                  <SongLayer key="song">
                    <SongBackdrop verse={song} />
                    <NowPlaying verse={song} id={tube.videoId} onClose={minimizeTube} onHeight={setSongH} minimize />
                  </SongLayer>
                )}
              </AnimatePresence>
            </motion.div>
          </SheetSlide>
          {full.view}
          {/* pjesma puštena s raširenog stiha — ladica preko njega; strelica je spusti na stih (dodir na pjesmu je vrati) */}
          <TubeDrawer scope="card" z={120} minimize />
        </SheetLayer>
      )}
    </AnimatePresence>,
    document.body,
  )
}
