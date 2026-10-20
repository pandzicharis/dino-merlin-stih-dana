'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Verse } from '@/data/verses'
import { useFavorites, useMounted } from '@/lib/client-store'
import { BRAND } from '@/lib/brand'
import { useSavedFull } from './SavedFull'
import { SavedCarousel } from './SavedCarousel'
import { SAVED_TRACK, closeSaved, setSavedPlaylist } from '@/lib/player'
import { SavedAlbums, SavedList, SavedLoved, SavedPlayer, type View } from './SavedPlayer'

/** Kako se sačuvani prikazuju iznad plejera: špil karata, lista ili albumi. */
export type SavedView = View

/**
 * Plejer pjesama: sačuvani stihovi (najnoviji prvi) kao špil karata ili
 * lista, a ispod njih zamućeni plejer. Samo na ovom uređaju.
 */
/**
 * Visina karte u panelu: panel (96dvh) bez zaglavlja i plejera — plejer
 * malo prekrije dno karte, koja se u njega pretapa. Širinu karta i dalje
 * uzme koliko ima (SavedCarousel).
 */
const FIT = 'calc(96dvh - 250px - env(safe-area-inset-bottom, 0px))'
/** blago pretapanje liste pjesama: gore malo, dole prema plejeru više */
const LIST_FADE = 'linear-gradient(to bottom, transparent 0, black 12px, black calc(100% - 72px), rgba(0,0,0,0.15) 100%)'

export function SavedVerses({
  verses,
  onClose,
  view: shown,
  onView,
}: {
  verses: Verse[]
  onClose?: () => void
  /** špil ili lista — panel ga pamti; bez toga (stranica /sacuvano) drži se ovdje */
  view?: SavedView
  onView?: (v: SavedView) => void
}) {
  const [own, setOwn] = useState<SavedView>('cards')
  const view = shown ?? own
  const setView = onView ?? setOwn
  const mounted = useMounted()
  const ids = useFavorites()
  const list = useMemo(() => {
    const byId = new Map(verses.map((v) => [v.id, v]))
    return ids.flatMap((id) => {
      const verse = byId.get(id)
      return verse ? [verse] : []
    })
  }, [verses, ids])
  // red plejera — u svakom prikazu (ne samo u špilu): sljedeća pjesma, mini
  // plejer i zaključan ekran znaju šta svira. U albumima: samo pjesme albuma
  // koji se sluša (SavedAlbums javi koji je)
  const [queue, setQueue] = useState<Verse[] | null>(null)
  // (prazne Omiljene — plejer ostaje na svim sačuvanim)
  const albums = (view === 'albums' || view === 'loved') && queue?.length ? queue : null
  useEffect(() => setSavedPlaylist(albums ?? list), [albums, list])
  // "Raširi" na karti: ista karta, uvećana; ostale vire iza (components/SavedFull.tsx)
  const full = useSavedFull(list)
  // prednja karta (ili pjesma na koju je plejer prešao) — plejer je pokazuje
  const [frontId, setFrontId] = useState<string | null>(null)
  const onFront = useCallback((v: Verse) => setFrontId(v.id), [])
  useEffect(() => {
    const onTrack = (e: Event) => setFrontId(String((e as CustomEvent).detail))
    window.addEventListener(SAVED_TRACK, onTrack)
    return () => window.removeEventListener(SAVED_TRACK, onTrack)
  }, [])
  const front = list.find((v) => v.id === frontId) ?? list[0] ?? null
  // odlaskom sa stranice /sacuvano njihove pjesme stanu (panel to radi sam — SavedPanel)
  const page = !onClose
  useEffect(() => {
    if (page) return () => closeSaved()
  }, [page])

  // do hidratacije se ne zna šta je sačuvano — bez praznog stanja koje trepne
  if (!mounted) return null

  if (list.length)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {/* isolate: karte (z-index u špilu) ostaju ispod plejera, ne preko njega */}
        <div
          className={`isolate min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 ${view === 'cards' ? 'pt-3' : ''}`}
          // pjesme se blago gube prema plejeru (i ispod zaglavlja) dok se skrola
          style={view === 'list' || view === 'loved' ? { maskImage: LIST_FADE, WebkitMaskImage: LIST_FADE } : undefined}
        >
          {view === 'list' ? (
            <SavedList verses={list} front={front} />
          ) : view === 'albums' ? (
            <SavedAlbums verses={list} front={front} onQueue={setQueue} />
          ) : view === 'loved' ? (
            <SavedLoved verses={list} front={front} onQueue={setQueue} />
          ) : (
            <SavedCarousel verses={list} size={onClose ? FIT : 'min(56dvh, 560px)'} onOpen={full.open} onFront={onFront} dots={false} />
          )}
        </div>
        {/* plejer uz dno panela — karta se pretapa u njega (prekrije joj dno) */}
        <div className={`relative z-10 shrink-0 ${view === 'cards' ? '-mt-20' : '-mt-6'}`}>
          <SavedPlayer verses={albums ?? list} front={front} view={view} onView={setView} />
        </div>
        {full.view}
      </div>
    )

  return (
    <div className={`flex flex-col items-center text-center ${onClose ? 'py-10' : 'mt-16'}`}>
      <span
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border"
        style={{ borderColor: `${BRAND.gold}40`, background: `radial-gradient(circle, ${BRAND.gold}1f, transparent 70%)` }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={BRAND.gold} strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
          <path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z" />
        </svg>
      </span>
      <p className="text-[1.15rem] text-white/85" style={{ fontFamily: 'var(--font-serif), serif' }}>
        Još nema sačuvanih stihova
      </p>
      <p className="mt-2 max-w-[16rem] text-[13px] leading-relaxed text-white/40">
        Dodirni „Sačuvaj“ ispod stiha koji te pogodi i ovdje će te čekati.
      </p>
      {onClose ? (
        <button
          onClick={onClose}
          className="mt-7 rounded-full border px-5 py-2.5 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors hover:bg-white/5"
          style={{ borderColor: `${BRAND.gold}55`, color: BRAND.gold }}
        >
          Današnji stih
        </button>
      ) : (
        <Link
          href="/"
          className="mt-7 rounded-full border px-5 py-2.5 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors hover:bg-white/5"
          style={{ borderColor: `${BRAND.gold}55`, color: BRAND.gold }}
        >
          Današnji stih
        </Link>
      )}
    </div>
  )
}
