'use client'

import { useState } from 'react'
import type { Verse } from '@/data/verses'

type State = 'idle' | 'busy' | 'done' | 'error'

/**
 * Share — dijeli se link, ništa više.
 *
 * Ranije se ovdje generisala slika pa slala kao fajl: čekalo se na server,
 * na desktopu se umjesto dijeljenja pokretao download, a slika nikad nije
 * izgledala kao ekran sa stihom. Link se otvara u aplikaciji i sam povuče
 * svoj pregled — slika za pregled i dalje postoji u metapodacima stranice.
 */
export function ShareButton({ verse, accent }: { verse: Verse; accent: string }) {
  const [state, setState] = useState<State>('idle')

  const share = async () => {
    if (state === 'busy') return
    setState('busy')

    const url = `${location.origin}/stih/${verse.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Stih dana', text: `${verse.song} — Dino Merlin`, url })
      } else {
        await navigator.clipboard.writeText(url)
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
