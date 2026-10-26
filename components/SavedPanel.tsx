'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import type { Verse } from '@/data/verses'
import { BRAND, MAGAZA_BESIDE, MAGAZA_DROP_CSS } from '@/lib/brand'
import { MOODS } from '@/data/moods'
import { albumOf, softOf } from '@/data/albums'
import { SavedVerses, type SavedView } from './SavedVerses'
import { closeSaved, dismissSaved, expandSaved, stopSaved, useSavedPlayerSelect } from '@/lib/player'
import { EqBars, MiniPlayer, SEARCH_SAVED } from './SavedPlayer'
import { Signature } from './Signature'
import { MagazaLogo } from './MagazaLogo'
import { MonthButton } from './RecapHost'
import { SettingsButton } from './Settings'
import { loadVerses } from '@/lib/verses-client'
import { pruneFavorites } from '@/lib/storage'
import { useFavorites } from '@/lib/client-store'
import { haptic } from '@/lib/haptic'
import { AfterOpen, useSheetOpen } from './Sheet'
import { Pocket } from './Pocket'

/**
 * Zatvaranje: prvo samo kretnja, a sve ostalo (stanje plejera, gašenje
 * muzike, mini plejer, stranica ispod) ovoliko kasnije — kad panel već klizi
 * na grafičkom procesoru. Inače bi prvi kadar zatvaranja bio težak i panel bi
 * "preskočio" početak.
 */
const LAG = 120

/** zapamćen pogled: špil karata ili lista */
const VIEW = 'stihdana:savedView'

/**
 * Plejer pjesama — sačuvani stihovi kao poseban ekran: stihovi (špil
 * karata), pjesme ili albumi, a ispod plejer. Izlazi s lijeva (džep na
 * početnoj), a ekran stiha klizne udesno i utihne (globals.css
 * `html[data-page]`). Džep uz desnu ivicu (ili strelica) vraća na stih dana:
 * muzika ide dalje, a iznad dna početne pluta mini plejer (MiniPlayer).
 * Dodir ga vrati; povlačenje dolje gasi muziku.
 */
/** zatvori plejer do kraja, muzika stane (prezentacija) */
export const CLOSE_PLAYER = 'stihdana:close-player'

export default function SavedPanel({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  const [verses, setVerses] = useState<Verse[] | null>(null)

  useEffect(() => {
    if (verses) return
    let alive = true
    loadVerses().then((v) => {
      if (!alive) return
      setVerses(v)
      // obrisani stihovi ispadnu iz sačuvanih — brojač na zaglavlju se ispravi
      if (v.length) pruneFavorites(new Set(v.map((x) => x.id)))
    })
    return () => {
      alive = false
    }
  }, [verses])

  useSheetOpen(open)
  // spušten (strelica, povlačenje, dodir pored) — stanje plejera se sredi kadar
  // poslije (dismiss), pa ga ovdje ne treba gasiti; ponovo otvoren prije toga — ništa
  const dismissing = useRef(false)
  // otvoren — mini plejer na dnu se sklopi u njega; zatvoren bez pjesme — sve
  // stane (samo pri zatvaranju — panel se montira unaprijed, zatvoren)
  const wasOpen = useRef(false)
  // otvoren baš sad — posao odgođen pri zatvaranju se ne radi ako je panel u međuvremenu opet otvoren
  const openNow = useRef(open)
  // spušten: panel stoji dolje, viri samo mini plejer. Sluša se samo ovo — promjena
  // pjesme ili pauza ne crta panel iznova
  const hasId = useSavedPlayerSelect((s) => Boolean(s.id))
  const mini = useSavedPlayerSelect((s) => s.mini)
  const [view, setView] = useState<SavedView>(() => {
    // ništa ne svira — otvara se na "Stihovi", pa se špil složi već sad (unaprijed)
    if (!hasId) return 'cards'
    try {
      const v = localStorage.getItem(VIEW)
      return v === 'list' || v === 'albums' || v === 'loved' ? v : 'cards'
    } catch {
      return 'cards'
    }
  })
  // pretraga pjesama: polje u zaglavlju, pogoci u "Pjesme"; `null` — zatvorena
  const [query, setQuery] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  /** pogled prije pretrage — × ga vrati */
  const before = useRef<SavedView>('cards')
  const favs = useFavorites()
  const hasSaved = favs.length > 0
  const hasSavedRef = useRef(hasSaved)
  useEffect(() => {
    hasSavedRef.current = hasSaved
  })
  // pozadina ekrana — pjesma koja svira, inače prvi sačuvani stih
  const nowId = useSavedPlayerSelect((s) => s.id)
  const backdrop = verses ? (verses.find((v) => v.id === nowId) ?? verses.find((v) => favs.includes(v.id)) ?? null) : null
  const searching = query !== null
  const searchOn = useRef(false)
  const startSearch = () => {
    haptic(5)
    // fokus iz samog dodira — iPhone inače ne otvori tastaturu
    input.current?.focus()
    searchOn.current = true
    before.current = view
    setView('list')
    setQuery('')
  }
  const endSearch = useCallback((to?: SavedView) => {
    input.current?.blur()
    if (!searchOn.current) return
    searchOn.current = false
    setQuery(null)
    setView(to ?? before.current)
  }, [])
  // stalan (useCallback) — sadržaj (SavedVerses, memo) se ne crta iznova pri otvaranju
  const pick = useCallback((v: SavedView) => {
    // tab ispod plejera usred pretrage — pretraga se zatvori
    endSearch(v)
    setView(v)
    try {
      localStorage.setItem(VIEW, v)
    } catch {
      /* privatni prozor */
    }
  }, [endSearch])
  useEffect(() => {
    openNow.current = open
    if (open) {
      dismissing.current = false
      expandSaved()
      wasOpen.current = open
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = open
    // tastatura ode odmah, pretraga se zatvori tek kad panel ode
    input.current?.blur()
    const t = window.setTimeout(() => !openNow.current && endSearch(), 460)
    const u = dismissing.current ? 0 : window.setTimeout(() => !openNow.current && closeSaved(), LAG)
    return () => {
      clearTimeout(t)
      clearTimeout(u)
    }
  }, [open, endSearch])
  // otvoren, a ništa ne svira — počinje od "Stihovi" (zapamćen pogled važi
  // dok se sluša)
  const idle = !hasId
  const [shown, setShown] = useState(open)
  // otvoren iz mini plejera — panel se podiže sporije, kao da izraste iz njega
  const [rise, setRise] = useState(false)
  if (shown !== open) {
    setShown(open)
    if (open && idle) setView('cards')
    setRise(open && mini && hasId)
  }

  const peek = !open && mini && hasId
  // spušten i muzika stala — "Stihovi" se vrate dok je panel dolje (poslije
  // spuštanja), ne pri otvaranju: otvaranje je onda samo kretnja, bez slaganja špila
  useEffect(() => {
    if (open || !idle || view === 'cards') return
    const t = window.setTimeout(() => setView('cards'), 600)
    return () => clearTimeout(t)
  }, [open, idle, view])
  // strelica, povlačenje dolje, dodir pored, Escape — panel se spusti; ima li
  // pjesmu, ona svira dalje i na dnu početne viri mini plejer. Prvo kretnja,
  // pa stanje plejera (LAG) — mini plejer i mjesto za njega ionako kreću tek
  // kad panel prođe, a prvi kadar zatvaranja ostaje lak
  const dismiss = useCallback(() => {
    dismissing.current = true
    onClose()
    window.setTimeout(() => {
      if (!dismissing.current || openNow.current) return
      dismissing.current = false
      dismissSaved()
      closeSaved()
    }, LAG)
  }, [onClose])
  // do kraja zatvoren (muzika stane) — prezentacija između koraka (components/deck/slides.tsx)
  useEffect(() => {
    const shut = () => {
      onClose()
      window.setTimeout(() => !openNow.current && stopSaved(), LAG)
    }
    window.addEventListener(CLOSE_PLAYER, shut)
    return () => window.removeEventListener(CLOSE_PLAYER, shut)
  }, [onClose])
  // lupa ispod plejera (SavedPlayer) — pretraga u zaglavlju; iz istog dodira (tastatura)
  const searchFrom = useRef(startSearch)
  useEffect(() => {
    searchFrom.current = startSearch
  })
  useEffect(() => {
    const go = () => hasSavedRef.current && searchFrom.current()
    window.addEventListener(SEARCH_SAVED, go)
    return () => window.removeEventListener(SEARCH_SAVED, go)
  }, [])
  // povuci zaglavlje nadolje — plejer se spusti (lista i karte skrolaju svoje)
  const drag = useDragControls()
  const playing = useSavedPlayerSelect((s) => s.playing)
  // stih dana se povuče u dubinu dok je plejer otvoren (globals.css)
  useEffect(() => {
    const d = document.documentElement
    if (open) d.dataset.page = 'player'
    else delete d.dataset.page
    return () => void delete d.dataset.page
  }, [open])

  // Escape zatvara, a stranica ispod ne skrola dok je panel otvoren
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismiss()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      // stranica se vrati kad panel ode — ne u prvom kadru zatvaranja (cijela stranica bi se iznova rasporedila)
      window.setTimeout(() => !openNow.current && (document.body.style.overflow = prev), 460)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, dismiss])

  if (typeof document === 'undefined') return null

  return createPortal(
    // uvijek montiran (SavedLink ga složi u tišini): otvoren, spušten do mini
    // plejera, ili sklonjen ispod ekrana — otvaranje je samo kretnja
    <div className="pointer-events-none fixed inset-0 z-[100]">
          {/* mini plejer je ispod ekrana plejera — pri otvaranju ga prirodno prekrije */}
          <AnimatePresence custom={open ? 'open' : 'stop'}>{peek && <MiniPlayer key="mini" onOpen={onOpen} />}</AnimatePresence>

          {/* ekran plejera — izađe odozdo preko cijelog ekrana, kao nova stranica (stih
              dana se iza povuče u dubinu); spusti se nadolje; zatvoren se ne crta */}
          <motion.div
            role="dialog"
            aria-modal={open}
            aria-label="Player pjesama"
            aria-hidden={!open}
            data-player-page
            className={`os-sheet ${open ? 'pointer-events-auto' : ''} absolute inset-0 mx-auto flex max-w-[520px] flex-col sm:border-x sm:border-white/10`}
            style={{
              borderRadius: 0,
              paddingTop: 'max(0.75rem, var(--sat, 0px))',
              background: '#0a0909',
              willChange: 'transform',
            }}
            initial={false}
            animate={open ? { y: '0%', visibility: 'visible' } : { y: '100%', transitionEnd: { visibility: 'hidden' } }}
            transition={{ duration: rise ? 0.6 : 0.55, ease: [0.32, 0.72, 0, 1] }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 1 }}
            dragSnapToOrigin
            onDragEnd={(_, i) => (i.offset.y > 110 || i.velocity.y > 600) && dismiss()}
          >
            <span
              className="pointer-events-none absolute inset-x-10 top-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${BRAND.gold}80, transparent)` }}
              aria-hidden
            />

            {/* pozadina ekrana: atmosfera pjesme (boja stiha, zamućen omot) — pretopi se s pjesmom */}
            <Backdrop verse={backdrop} />

            {/* zaglavlje — isto kao na naslovnoj (potpis | Magaza, ista dugmad); povuci ga
                nadolje i plejer se spusti */}
            <div className="relative z-[1] shrink-0 touch-none px-5 pb-1 pt-3" onPointerDown={(e) => !(e.target as Element).closest('button, input, a') && drag.start(e)}>
              {/* hvataljka — povuci nadolje */}
              <span className="mx-auto -mt-1 mb-2 block h-1 w-9 rounded-full bg-white/20" aria-hidden />
              <div className="relative mb-3 flex items-center justify-between">
                {/* pretraga — preko naslova i dugmadi, pretopi se */}
                <div
                  className={`absolute inset-0 z-[1] flex items-center gap-3 transition-opacity duration-200 ${searching ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <label
                    className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border bg-white/[0.04] pl-3.5 pr-1.5 transition-colors"
                    style={{ borderColor: query ? `${BRAND.gold}55` : 'rgba(255,255,255,0.1)' }}
                  >
                    <SearchGlyph className="shrink-0 text-white/40" />
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
                    {/* × — pretraga se zatvori, sve kao prije */}
                    <button
                      type="button"
                      tabIndex={searching ? 0 : -1}
                      onClick={() => {
                        haptic(5)
                        endSearch()
                      }}
                      aria-label="Zatvori pretragu"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:text-white active:scale-90"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                        <path d="M6 6l12 12M18 6 6 18" />
                      </svg>
                    </button>
                  </label>
                </div>
                <div className={`flex items-center gap-3.5 transition-opacity duration-200 ${searching ? 'pointer-events-none opacity-0' : ''}`}>
                  <Signature height={36} wipe={false} className="opacity-90" />
                  <span className="h-6 w-px bg-white/20" aria-hidden />
                  <MagazaLogo height={Math.round(36 * MAGAZA_BESIDE)} color="#FFFFFF" style={{ transform: MAGAZA_DROP_CSS, opacity: 0.9 }} />
                </div>
                <div className={`flex items-center gap-2 transition-opacity duration-200 ${searching ? 'pointer-events-none opacity-0' : ''}`}>
                  {/* dugme plejera kao na naslovnoj — ovdje upaljeno; dodir vraća na stih
                      dana (muzika ide dalje, na dnu početne viri mini plejer) */}
                  <button
                    onClick={dismiss}
                    aria-label="Na stih dana"
                    title="Na stih dana"
                    className="hdr-btn gap-1.5 pl-2.5 pr-3"
                    style={{ color: '#14100A', background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})`, borderColor: 'transparent' }}
                  >
                    {playing ? (
                      <EqBars accent="currentColor" on h={12} />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3.5 6h11M3.5 10.5h11M3.5 15h6.5" />
                        <path d="M18 16.5V5.2l3 1.1" />
                        <circle cx="15.7" cy="16.8" r="2.3" fill="currentColor" stroke="none" />
                      </svg>
                    )}
                    <span className="tabular text-[12px] font-semibold leading-none">{favs.length}</span>
                  </button>
                  <MonthButton />
                  <SettingsButton />
                </div>
              </div>
            </div>

            {/* špil (ili lista) i plejer ispod — SavedVerses sam rasporedi i skrola */}
            <div className="relative z-[1] flex min-h-[200px] flex-1 flex-col">
              {verses ? (
                // karte i plejer se slože dok panel već klizi
                <AfterOpen fallback={<Skeleton />}>
                  <SavedVerses verses={verses} onClose={onClose} view={view} onView={pick} query={query ?? ''} />
                </AfterOpen>
              ) : (
                <Skeleton />
              )}
            </div>

            {/* džep uz desnu ivicu — nazad na stih dana */}
            {open && (
              <Pocket side="right" kind="paper" label="Stih dana" onOpen={dismiss} />
            )}
          </motion.div>
    </div>,
    document.body,
  )
}

/**
 * Pozadina ekrana plejera — kao ekran stiha: boja raspoloženja pjesme i
 * zamućen omot albuma (unaprijed, bez CSS blura), pa tama prema plejeru.
 * Druga pjesma — pozadina se pretopi u njenu.
 */
function Backdrop({ verse }: { verse: Verse | null }) {
  const m = verse ? MOODS[verse.mood] : null
  const cover = albumOf(verse?.album)?.cover
  const img = softOf(cover) ?? cover
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <AnimatePresence initial={false}>
        <motion.div key={verse?.id ?? 'none'} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: 'easeInOut' }}>
          <div className="absolute inset-0" style={{ background: m ? `radial-gradient(120% 70% at 50% 0%, ${m.gradient[2]}cc, transparent 65%), ${m.gradient[0]}` : `radial-gradient(120% 60% at 50% 0%, ${BRAND.gold}1a, transparent 60%), #0a0909` }} />
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" draggable={false} className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40" style={softOf(cover) ? undefined : { filter: 'blur(48px)' }} />
          )}
          {/* gore oštar omot koji se pretapa u tamu (kao drawer teksta) — vrh ekrana nije
              samo zamućen; ispod statusne trake se vidi slika, ne magla */}
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              draggable={false}
              className="absolute inset-x-0 top-0 h-[60%] w-full object-cover opacity-30"
              style={{
                maskImage: 'linear-gradient(180deg, #000 0%, rgba(0,0,0,0.5) 45%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(180deg, #000 0%, rgba(0,0,0,0.5) 45%, transparent 100%)',
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.82))' }} />
      {/* ispod statusne trake tamno, kao na ekranu stiha: iOS 26 tu sam zamuti ono što je
          ispod (rub ekrana) — svijetla boja i omot bi se vidjeli kao magla */}
      <div className="absolute inset-x-0 top-0" style={{ height: 'calc(env(safe-area-inset-top, 0px) + 72px)', background: 'linear-gradient(180deg, rgba(0,0,0,0.78), rgba(0,0,0,0.35) 55%, transparent)' }} />
    </div>
  )
}

/** lupa — pretraga pjesama */
function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.6-4.6" />
    </svg>
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1].map((i) => (
        <div key={i} className="h-[140px] animate-pulse rounded-[22px] bg-white/[0.04]" />
      ))}
    </div>
  )
}
