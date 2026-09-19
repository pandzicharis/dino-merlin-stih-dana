'use client'

import { useState } from 'react'
import type { Verse } from '@/data/verses'

type State = 'idle' | 'busy' | 'done' | 'error'

/**
 * Share — pokuša native share sa slikom (mobitel), pa fallback
 * na download slike + kopiran link (desktop).
 */
export function ShareButton({ verse, accent }: { verse: Verse; accent: string }) {
  const [state, setState] = useState<State>('idle')

  const share = async () => {
    if (state === 'busy') return
    setState('busy')
    try {
      const res = await fetch(`/og/${verse.id}?f=story`)
      if (!res.ok) throw new Error('og')
      const blob = await res.blob()
      const file = new File([blob], `stih-dana-${verse.id}.png`, { type: 'image/png' })
      const url = `${location.origin}/stih/${verse.id}`

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${verse.song} — Dino Merlin`, url })
      } else {
        const href = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = href
        a.download = file.name
        a.click()
        URL.revokeObjectURL(href)
        await navigator.clipboard?.writeText(url).catch(() => {})
      }
      setState('done')
      setTimeout(() => setState('idle'), 2000)
    } catch (e) {
      // korisnik je otkazao native share — to nije greška
      if ((e as Error)?.name === 'AbortError') setState('idle')
      else setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  return (
    <button
      onClick={share}
      aria-label="Podijeli stih"
      disabled={state === 'busy'}
      className="-m-2 p-2 text-white/40 transition-all active:scale-90 disabled:opacity-40"
      style={state === 'done' ? { color: accent } : undefined}
    >
      {state === 'busy' ? <Spinner /> : state === 'done' ? <Check /> : <ShareIcon />}
    </button>
  )
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v13M12 3 8 7M12 3l4 4" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}

function Check() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  )
}
