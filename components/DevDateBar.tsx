'use client'

import { useEffect } from 'react'
import { MOOD_KEYS } from '@/data/moods'
import { TIPS_ON, startTips } from './Tips'
import { playIntro } from './IntroSplash'
import { OVERRIDE_ON, addDays, daysSinceEpoch, setDevDate } from '@/lib/date'
import { redraw } from '@/lib/draw'

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
}: {
  date: string
  verseId: string
  mood: string
}) {
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

  if (!OVERRIDE_ON) return null

  const day = daysSinceEpoch(date)

  return (
    <div className="dev-bar fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 bg-black/85 px-3 py-2 font-mono text-[11px] text-white/80 backdrop-blur">
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
      <button onClick={() => playIntro(true)} className="px-1.5 text-white/50 hover:text-white">
        splash
      </button>
      {/* zaboravi današnji (i dalje) — izvuče se ponovo, s animacijom */}
      <button onClick={() => redraw(date)} className="px-1.5 text-white/50 hover:text-white" title="i">
        izvuci
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
      <span className="text-white">
        {verseId} · {mood}
      </span>
    </div>
  )
}
