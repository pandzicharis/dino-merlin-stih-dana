'use client'

import { useEffect, useRef } from 'react'
import { MOOD_KEYS } from '@/data/moods'
import { TIPS_ON, startTips } from './Tips'
import { playIntro, playTombola } from './IntroSplash'
import { OVERRIDE_ON, addDays, daysSinceEpoch, setDevDate } from '@/lib/date'
import { redraw } from '@/lib/draw'
import { isFirstVerse } from '@/lib/text'
import { saveAllFavorites, seedMonth } from '@/lib/storage'
import { loadVerses } from '@/lib/verses-client'
import { Icon, TOAST_BAD, TOAST_OK, dismissToast, toast, type Toast } from './Toast'
import { openRecap, recapDate } from './RecapHost'

/** Sve poruke aplikacije redom — svaki klik na "poruke" pokaže sljedeću. */
const SAMPLES: Toast[] = [
  { id: 'update', title: 'Nova verzija', color: '#D9C3A0', icon: <Icon.refresh />, sticky: true, action: { label: 'Osvježi', onClick: () => dismissToast('update') } },
  { id: 'notify', title: 'Obavijesti uključene', sub: 'Stih stiže u 12:00', color: TOAST_OK, icon: <Icon.bell /> },
  { id: 'notify', title: 'Obavijesti isključene', color: TOAST_BAD, icon: <Icon.bellOff /> },
  { id: 'notify', title: 'Obavijesti su blokirane', sub: 'Uključi ih u postavkama telefona', icon: <Icon.info /> },
  { id: 'notify', title: 'Dodaj na početni ekran', sub: 'Tek tada obavijesti rade', icon: <Icon.info /> },
  { id: 'share', title: 'Slika je sačuvana', color: TOAST_OK, icon: <Icon.ok /> },
  { id: 'share', title: 'Slika je preuzeta', sub: 'Dijeljenje nije podržano', icon: <Icon.download /> },
  { id: 'share', title: 'Nije uspjelo', sub: 'Pokušaj ponovo', color: TOAST_BAD, icon: <Icon.bad /> },
]
let sample = 0

/** Okidač za poruke — u obje dev trake (ova i ona na uvodu). */
export function DevToastsButton() {
  return (
    <button onClick={() => toast(SAMPLES[sample++ % SAMPLES.length])} className="px-1.5 text-white/50 hover:text-white">
      poruke
    </button>
  )
}

/**
 * Ručno pomjeranje datuma — samo u dev modu (ili uz NEXT_PUBLIC_DATE_OVERRIDE=1).
 *
 *   [  dan nazad      ]  dan naprijed      \  reset na danas
 *   m  sljedeći mood  0  ukloni override mooda  i  izvuci ponovo
 */
export function DevDateBar({
  date,
  verseId,
  mood,
  verses = [],
}: {
  date: string
  verseId: string
  mood: string
  /** svi stihovi — za izbor stiha koji se prikaže (`?verse=`) */
  verses?: { id: string; text: string; song: string; active?: boolean }[]
}) {
  /** Tačno ovaj stih (`?verse=`), ili prazno = izvučen kao i inače. */
  const pickVerse = (id: string) => {
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('verse', id)
    else url.searchParams.delete('verse')
    window.history.replaceState(null, '', url)
    window.dispatchEvent(new Event('devdatechange'))
  }
  const forced = typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('verse') ?? '')
  const move = (n: number) => setDevDate(addDays(date, n))
  const reset = () => setDevDate(null)

  /** Kroz sve moodove pa nazad na "bez override-a". */
  const cycleMood = () => {
    const url = new URL(window.location.href)
    const cur = url.searchParams.get('mood')
    const next = MOOD_KEYS[cur ? MOOD_KEYS.indexOf(cur as (typeof MOOD_KEYS)[number]) + 1 : 0]
    if (next) url.searchParams.set('mood', next)
    else url.searchParams.delete('mood')
    window.history.replaceState(null, '', url)
    window.dispatchEvent(new Event('devdatechange'))
  }

  useEffect(() => {
    if (!OVERRIDE_ON) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // kuca se (pretraga pjesama) — slova nisu prečice
      if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable]')) return
      if (e.key === '[') move(-1)
      else if (e.key === ']') move(1)
      else if (e.key === '\\') reset()
      else if (e.key === 'm') cycleMood()
      else if (e.key === 'i') redraw(date)
      else if (e.key === '0') {
        const url = new URL(window.location.href)
        url.searchParams.delete('mood')
        url.searchParams.delete('verse')
        window.history.replaceState(null, '', url)
        window.dispatchEvent(new Event('devdatechange'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // visina trake → `--dev-bar` na stranici: mini plejer pjesama pluta iznad
  // nje, ne preko nje (u prezentaciji je traka skrivena — 0)
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = bar.current
    if (!el) return
    const root = document.documentElement
    const ro = new ResizeObserver(() => root.style.setProperty('--dev-bar', `${el.offsetHeight}px`))
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--dev-bar')
    }
  }, [])

  if (!OVERRIDE_ON) return null

  const day = daysSinceEpoch(date)

  return (
    <div ref={bar} className="dev-bar fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 bg-black/85 px-3 py-2 font-mono text-[11px] text-white/80 backdrop-blur">
      <button onClick={() => move(-1)} className="px-1 hover:text-white" title="[">
        ◀
      </button>
      <span className="tabular-nums text-white">{date}</span>
      <button onClick={() => move(1)} className="px-1 hover:text-white" title="]">
        ▶
      </button>
      <button onClick={reset} className="px-1.5 text-white/50 hover:text-white" title="\">
        danas
      </button>
      <a href="/dev/moods" className="px-1.5 text-white/50 hover:text-white">
        moods
      </a>
      <a href="/admin" className="px-1.5 text-white/50 hover:text-white">
        admin
      </a>
      {TIPS_ON && (
        <button onClick={() => startTips(true)} className="px-1.5 text-white/50 hover:text-white">
          tips
        </button>
      )}
      {/* splash i tombola sa stihom na ekranu — i s onim izabranim dolje */}
      <button onClick={() => playTombola()} className="px-1.5 text-white/50 hover:text-white">
        tombola
      </button>
      {/* uvod kao novi korisnik — sa "Mir svim dobrim ljudima" (prvi stih), ako ga ima */}
      <button
        onClick={() => {
          const first = verses.find((v) => isFirstVerse(v.text))
          if (!first || first.id === verseId) return playIntro(true)
          pickVerse(first.id)
          // novi stih je novi uvod (IntroHost po stihu) — tek kad se složi
          window.setTimeout(() => playIntro(true), 150)
        }}
        className="px-1.5 text-white/50 hover:text-white"
      >
        splash
      </button>
      {/* nova verzija, obavijesti, dijeljenje — redom (components/Toast.tsx) */}
      <DevToastsButton />
      {/* zaboravi današnji (i dalje) — izvuče se ponovo, s animacijom */}
      <button onClick={() => redraw(date)} className="px-1.5 text-white/50 hover:text-white" title="i">
        izvuci
      </button>
      {/* svi stihovi iz baze u sačuvane — za rad na plejeru */}
      <button
        onClick={async () => {
          const n = saveAllFavorites((await loadVerses()).map((v) => v.id))
          toast({ id: 'save-all', title: n ? `Dodano ${n} stihova` : 'Svi su već sačuvani', color: TOAST_OK, icon: <Icon.ok /> })
        }}
        className="px-1.5 text-white/50 hover:text-white"
      >
        sačuvaj sve
      </button>
      {/* pregled mjeseca: probni podaci za ovaj mjesec (pa nova stranica — izvlačenje čita iznova) */}
      <button
        onClick={() => {
          // ovaj mjesec do jučer (ili cio prošli, prvih dana u mjesecu)
          const day = Number(date.slice(8, 10))
          const prev = addDays(`${date.slice(0, 7)}-01`, -1)
          if (day <= 7) seedMonth(verses, prev.slice(0, 7), Number(prev.slice(8, 10)))
          else seedMonth(verses, date.slice(0, 7), day - 1)
          window.location.reload()
        }}
        className="px-1.5 text-white/50 hover:text-white"
      >
        popuni mjesec
      </button>
      {/* pregled mjeseca, scenariji: mjesec bez ijednog podatka (prvi u mjesecu) … */}
      <button
        onClick={() => {
          // prvi sljedeći mjesec u kojem na ovom telefonu nema ni izvučenog ni sačuvanog stiha
          const used = (ym: string) => {
            try {
              const days = Object.keys(JSON.parse(localStorage.getItem('stihdana:draw') || '{}')?.days ?? {})
              const saved = Object.values(JSON.parse(localStorage.getItem('stihdana:favoriteDates') || '{}') as Record<string, string>)
              return [...days, ...saved].some((d) => d.startsWith(ym))
            } catch {
              return false
            }
          }
          const [y, m] = date.split('-').map(Number)
          let k = 0
          let first = ''
          do {
            first = new Date(Date.UTC(y, m + k, 1)).toISOString().slice(0, 10)
            k++
          } while (used(first.slice(0, 7)) && k < 36)
          openRecap(first)
        }}
        className="px-1.5 text-white/50 hover:text-white"
      >
        prazan mjesec
      </button>
      {/* … tek prva 3 dana u mjesecu … */}
      <button
        onClick={() => {
          const used = (ym: string) => {
            try {
              return Object.keys(JSON.parse(localStorage.getItem('stihdana:draw') || '{}')?.days ?? {}).some((d) => d.startsWith(ym))
            } catch {
              return false
            }
          }
          const [y, m] = date.split('-').map(Number)
          let k = 0
          let first = ''
          do {
            first = new Date(Date.UTC(y, m + k, 1)).toISOString().slice(0, 10)
            k++
          } while (used(first.slice(0, 7)) && k < 36)
          seedMonth(verses, first.slice(0, 7), 3, 0)
          openRecap(first)
        }}
        className="px-1.5 text-white/50 hover:text-white"
      >
        prva 3 dana
      </button>
      {/* … i preko 20 sačuvanih (svi stihovi iz baze) */}
      <button
        onClick={() => {
          const target = recapDate(date)
          const day = Number(date.slice(8, 10))
          seedMonth(verses, target.slice(0, 7), day <= 7 ? Number(target.slice(8, 10)) : day - 1, verses.length)
          openRecap(target)
        }}
        className="px-1.5 text-white/50 hover:text-white"
      >
        20+ sačuvanih
      </button>
      {/* mjesečni pregled — tekući mjesec */}
      <button onClick={() => openRecap(date)} className="px-1.5 text-white/50 hover:text-white">
        mjesec
      </button>
      {(['ios', 'android'] as const).map((o) => (
        <button
          key={o}
          onClick={() => {
            try {
              sessionStorage.setItem('stihdana:os', o)
            } catch {}
            document.documentElement.dataset.os = o
          }}
          className="px-1.5 text-white/50 hover:text-white"
        >
          {o}
        </button>
      ))}
      <span className="ml-auto text-white/40">
        dan {day}
      </span>
      <select
        value={forced}
        onChange={(e) => pickVerse(e.target.value)}
        title="Koji stih se prikaže"
        className="max-w-[min(46vw,320px)] truncate rounded border border-white/15 bg-black px-1.5 py-0.5 text-white outline-none [color-scheme:dark]"
      >
        <option value="">izvučen · {verseId}</option>
        {verses.map((v) => (
          <option key={v.id} value={v.id}>
            {v.active === false ? '(arhiva) ' : ''}
            {v.song} — {v.text.split('\n')[0].slice(0, 40)}
          </option>
        ))}
      </select>
      <span className="text-white/60">{mood}</span>
    </div>
  )
}
