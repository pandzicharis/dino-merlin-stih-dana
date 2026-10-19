'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import type { Verse } from '@/data/verses'
import { useFavorites, useMounted } from '@/lib/client-store'
import { BRAND } from '@/lib/brand'
import { useSavedFull } from './SavedFull'
import { SavedCarousel } from './SavedCarousel'
import { closeSaved } from '@/lib/player'

/** Sačuvani stihovi — najnoviji prvi, kao špil karata. Samo na ovom uređaju. */
/**
 * Visina karte u panelu — ista kao dok je plejer bio na dnu: susjede vire
 * jednako, a špil ne pritiska ekran. Širinu karta i dalje uzme koliko ima (SavedCarousel).
 */
const FIT = 'calc(96dvh - 400px - env(safe-area-inset-bottom, 0px))'

export function SavedVerses({
  verses,
  onClose,
}: {
  verses: Verse[]
  onClose?: () => void
}) {
  const mounted = useMounted()
  const ids = useFavorites()
  const byId = new Map(verses.map((v) => [v.id, v]))
  const list = ids.flatMap((id) => {
    const verse = byId.get(id)
    return verse ? [verse] : []
  })
  // "Raširi" na karti: ista karta, uvećana; ostale vire iza (components/SavedFull.tsx)
  const full = useSavedFull(list)
  // odlaskom sa stranice /sacuvano njihove pjesme stanu (panel to radi sam — SavedPanel)
  const page = !onClose
  useEffect(() => {
    if (page) return () => closeSaved()
  }, [page])

  // do hidratacije se ne zna šta je sačuvano — bez praznog stanja koje trepne
  if (!mounted) return null

  if (list.length)
    return (
      <>
        <SavedCarousel verses={list} size={onClose ? FIT : 'min(62dvh, 620px)'} onOpen={full.open} />
        {full.view}
      </>
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
