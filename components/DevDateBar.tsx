'use client'

import { useEffect } from 'react'
import { MOOD_KEYS } from '@/data/moods'
import { OVERRIDE_ON, addDays, setDevDate } from '@/lib/date'
import { verseMeta } from '@/lib/pickVerse'
import { VERSES } from '@/data/verses'

/**
 * Ručno pomjeranje datuma — samo u dev modu (ili uz NEXT_PUBLIC_DATE_OVERRIDE=1).
 *
 *   [  dan nazad      ]  dan naprijed      \  reset na danas
 *   m  sljedeći mood  0  ukloni override mooda
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

  const { day, cycle, pos } = verseMeta(date)

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 bg-black/85 px-3 py-2 font-mono text-[11px] text-white/80 backdrop-blur">
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
      <span className="ml-auto text-white/40">
        dan {day} · ciklus {cycle} · {pos + 1}/{VERSES.length}
      </span>
      <span className="text-white">
        {verseId} · {mood}
      </span>
    </div>
  )
}
