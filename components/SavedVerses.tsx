'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import type { Verse } from '@/data/verses'
import { useFavorites, useMounted } from '@/lib/client-store'
import { toggleFavorite } from '@/lib/storage'
import { BRAND } from '@/lib/brand'
import { VerseList } from './VerseList'
import { SavedCarousel } from './SavedCarousel'

/* ── prikaz: karte (špil) ili lista — pamti se na uređaju ─────── */

type View = 'karte' | 'lista'
const VIEW = 'stihdana:savedView'
const VIEW_EVENT = 'stihdana:savedview'

function viewSnapshot(): View {
  try {
    return localStorage.getItem(VIEW) === 'lista' ? 'lista' : 'karte'
  } catch {
    return 'karte'
  }
}
function subscribeView(cb: () => void) {
  // `storage`: promjena iz drugog prozora (prezentacija oko telefona)
  const onStorage = (e: StorageEvent) => (e.key === VIEW || e.key === null) && cb()
  window.addEventListener(VIEW_EVENT, cb)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(VIEW_EVENT, cb)
    window.removeEventListener('storage', onStorage)
  }
}
function useSavedView(): View {
  return useSyncExternalStore(subscribeView, viewSnapshot, () => 'karte')
}
function setSavedView(v: View) {
  try {
    localStorage.setItem(VIEW, v)
  } catch {
    /* privatni prozor */
  }
  window.dispatchEvent(new Event(VIEW_EVENT))
}

/** Karte ili lista — samo ikonice, gore u zaglavlju. Bez sačuvanih ga nema. */
export function SavedViewToggle() {
  const view = useSavedView()
  const count = useFavorites().length
  const mounted = useMounted()
  if (!mounted || count === 0) return null
  const btn = (v: View, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setSavedView(v)}
      aria-label={label}
      title={label}
      aria-pressed={view === v}
      className="flex h-7 w-8 items-center justify-center rounded-full transition-colors"
      style={view === v ? { background: `${BRAND.gold}26`, color: BRAND.gold } : { color: 'rgba(255,255,255,0.45)' }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {icon}
      </svg>
    </button>
  )
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.04] p-0.5">
      {btn(
        'karte',
        'Karte',
        <>
          <rect x="6" y="3" width="12" height="15" rx="2.5" />
          <path d="M8 21h8" />
        </>,
      )}
      {btn('lista', 'Lista', <path d="M5 6h14M5 12h14M5 18h14" />)}
    </div>
  )
}

/** Sačuvani stihovi — najnoviji prvi, kao špil karata ili tiha lista. Samo na ovom uređaju. */
export function SavedVerses({ verses, onClose }: { verses: Verse[]; onClose?: () => void }) {
  const mounted = useMounted()
  const view = useSavedView()
  const ids = useFavorites()
  const byId = new Map(verses.map((v) => [v.id, v]))
  const items = ids.flatMap((id) => {
    const verse = byId.get(id)
    return verse ? [{ verse }] : []
  })

  // do hidratacije se ne zna šta je sačuvano — bez praznog stanja koje trepne
  if (!mounted) return null

  if (view === 'karte' && items.length)
    return <SavedCarousel verses={items.map((i) => i.verse)} size={onClose ? 'min(58dvh, 500px)' : 'min(68dvh, 600px)'} />

  return (
    <>
      <VerseList
        items={items}
        action={(v) => (
          <button
            onClick={() => toggleFavorite(v.id)}
            aria-label="Ukloni iz sačuvanih"
            title="Ukloni iz sačuvanih"
            className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#F2A7B8] transition-all hover:bg-white/10 active:scale-90"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z" />
            </svg>
          </button>
        )}
        empty={
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
              Dodirni „Sačuvaj stih“ ispod stiha koji te pogodi i ovdje će te čekati.
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
        }
      />
    </>
  )
}
