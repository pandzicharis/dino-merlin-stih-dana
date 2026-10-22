'use client'

import Link from 'next/link'
import { Activity, memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Verse } from '@/data/verses'
import { useFavorites, useLovedIds, useMounted } from '@/lib/client-store'
import { BRAND } from '@/lib/brand'
import { useSavedFull } from './SavedFull'
import { SavedCarousel } from './SavedCarousel'
import { SAVED_TRACK, closeSaved, setSavedPlaylist } from '@/lib/player'
import { whenCalm } from '@/lib/calm'
import { loose } from '@/lib/text'
import { ALBUM_H, SavedAlbums, SavedList, SavedLoved, SavedPlayer, keyOf, type View } from './SavedPlayer'

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
/** visina reda pjesme (omot 46 + razmak) — liste su visoke koliko pjesama ima */
const ROW = 70
/** najviše ovoliko redova se vidi odjednom — ostalo se skrola (pola reda viri) */
const MAX_ROWS = 5.5
/** plejer prekriva dno prikaza za ovoliko (-mt-20) */
const UNDER = 80

/**
 * Visina prikaza iznad plejera: špil koliko je karta visoka, liste koliko
 * pjesama ima (najviše 5–6), albumi koliko je kartica. Mijenja se mekano
 * pri prebacivanju, pa panel ne skače.
 */
function paneHeight(view: SavedView, songs: number, loved: number, page: boolean): string {
  if (view === 'cards') {
    // karta: visina iz FIT, ili širina panela (do 440) ako je uža
    return `calc(12px + min(${page ? 'min(56dvh, 560px)' : FIT}, (min(100vw, 440px) - 108px) * ${(620 / 390).toFixed(4)}))`
  }
  if (view === 'albums') return `calc(${ALBUM_H} + ${44 + UNDER + 8}px)`
  const n = view === 'loved' ? loved : songs
  if (!n) return `${200 + UNDER}px`
  return `${Math.round(Math.min(n, MAX_ROWS) * ROW + 12 + UNDER)}px`
}

/**
 * Pretraga pjesama: svaka riječ upita negdje u nazivu, albumu ili stihu (bez
 * kvačica — "sta" nađe "šta"). Pjesme kojima naziv odgovara su prve.
 */
function search(songs: Verse[], query: string): Verse[] {
  const words = loose(query).split(' ').filter(Boolean)
  if (!words.length) return songs
  const hits: [Verse, number][] = []
  for (const v of songs) {
    const title = loose(v.song)
    const all = `${title} ${loose(v.album)} ${loose(v.description)} ${loose(v.text)}`
    if (!words.every((w) => all.includes(w))) continue
    hits.push([v, title.startsWith(words[0]) ? 0 : words.every((w) => title.includes(w)) ? 1 : 2])
  }
  return hits.sort((a, b) => a[1] - b[1]).map(([v]) => v)
}

/** prikazi po redu — svi ostaju montirani, pa je prebacivanje samo pretapanje */
const VIEWS: SavedView[] = ['cards', 'list', 'albums', 'loved']

/**
 * Memo: otvaranje i spuštanje panela (SavedPanel) ga ne crta iznova — props
 * su stalni (stihovi, pogled, useCallback), a sve ostalo sluša sam.
 */
export const SavedVerses = memo(function SavedVerses({
  verses,
  onClose,
  view: shown,
  onView,
  query = '',
}: {
  verses: Verse[]
  onClose?: () => void
  /** pretraga (zaglavlje panela) — "Pjesme" pokazuju samo pogotke */
  query?: string
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
  // pjesme — svaka jednom (dva sačuvana stiha iste pjesme su jedna pjesma);
  // u "Stihovi" ostaju svi stihovi, u Pjesmama, Albumima i Omiljenim pjesme
  const songs = useMemo(() => {
    const seen = new Set<string>()
    return list.filter((v) => {
      const k = keyOf(v)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }, [list])
  const found = useMemo(() => (query.trim() ? search(songs, query) : songs), [songs, query])
  // novi upit — pogoci od vrha
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const pane = box.current?.querySelector<HTMLElement>('[data-pane="list"]')
    if (pane && query) pane.scrollTop = 0
  }, [query])
  // red plejera — u svakom prikazu (ne samo u špilu): sljedeća pjesma, mini
  // plejer i zaključan ekran znaju šta svira. U albumima: samo pjesme albuma
  // koji se sluša (SavedAlbums javi koji je)
  const [queue, setQueue] = useState<Verse[] | null>(null)
  // (prazne Omiljene — plejer ostaje na pjesmama)
  const albums = (view === 'albums' || view === 'loved') && queue?.length ? queue : null
  // pretraga ne mijenja red — plejer i dalje pokazuje pjesmu koja svira
  const order = albums ?? (view === 'cards' ? list : songs)
  useEffect(() => setSavedPlaylist(order), [order])
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
  const lovedIds = useLovedIds()
  const loved = songs.filter((v) => lovedIds.includes(keyOf(v))).length
  // prikaz se složi kad se prvi put otvori, ostali u tišini poslije — dalje
  // ostaju montirani: prebacivanje je samo pretapanje, bez ponovnog slaganja
  const [made, setMade] = useState<SavedView[]>(() => [view])
  if (!made.includes(view)) setMade([...made, view])
  // Ostali prikazi se slože jedan po jedan, i to tek kad je panel otvoren i prst
  // miruje — ne pri svakom otvaranju aplikacije (panel se slaže unaprijed) i ne
  // usred prevlačenja karata. Izabran prikaz se ionako složi odmah (gore)
  const inPage = !onClose
  useEffect(() => {
    const next = VIEWS.find((v) => !made.includes(v))
    if (!next) return
    return whenCalm(
      // prekidivo — dodir na karte ne čeka slaganje skrivenog prikaza
      () => startTransition(() => setMade((m) => (m.includes(next) ? m : [...m, next]))),
      1200,
      () => inPage || Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')),
    )
  }, [made, inPage])
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
        {/* prikazi jedan preko drugog, svaki sa svojim skrolom; vidi se samo
            izabrani (pretopi se). isolate: karte ostaju ispod plejera */}
        <div
          ref={box}
          className="relative isolate min-h-0 shrink"
          // pretraga: visina kao cijela lista — panel ne skače dok se kuca
          style={{ height: paneHeight(view, songs.length, loved, !onClose) }}
        >
          {VIEWS.filter((v) => made.includes(v)).map((v) => {
            const on = v === view
            return (
              <div
                key={v}
                data-pane={v}
                aria-hidden={!on}
                className={`absolute inset-0 px-5 ${v === 'cards' ? 'overflow-hidden pt-3' : 'overflow-y-auto overscroll-none pb-20'} ${
                  on ? 'visible opacity-100' : 'pointer-events-none invisible opacity-0'
                }`}
                style={{ transition: on ? 'opacity 0.26s ease' : 'opacity 0.16s ease, visibility 0s linear 0.16s' }}
              >
                {/* sakriven prikaz se ne crta iznova (Activity) — promjena pjesme
                    osvježi samo ono što se vidi; stanje (mjesto u špilu, skrol) ostaje */}
                <Activity mode={on ? 'visible' : 'hidden'}>
                  {v === 'list' ? (
                    found.length ? (
                      <SavedList verses={found} front={front} active={on} />
                    ) : (
                      <p className="flex h-full items-center justify-center pb-6 text-[13px] text-white/45">Nema takve pjesme</p>
                    )
                  ) : v === 'albums' ? (
                    <SavedAlbums verses={songs} front={front} onQueue={setQueue} active={on} />
                  ) : v === 'loved' ? (
                    <SavedLoved verses={songs} front={front} onQueue={setQueue} active={on} />
                  ) : (
                    <SavedCarousel verses={list} size={onClose ? FIT : 'min(56dvh, 560px)'} onOpen={full.open} onFront={onFront} dots={false} />
                  )}
                </Activity>
              </div>
            )
          })}
        </div>
        {/* plejer uz dno panela — karta se pretapa u njega (prekrije joj dno);
            uvijek isto mjesto, pa se ništa ne pomjera pri prebacivanju */}
        <div className="relative z-10 -mt-20 shrink-0">
          <SavedPlayer verses={order} front={front} view={view} onView={setView} />
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
})
