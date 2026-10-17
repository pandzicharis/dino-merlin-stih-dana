'use client'

import { useEffect, useState } from 'react'
import type { Verse } from '@/data/verses'
import { todayInTz } from '@/lib/date'
import { VerseScreen } from './VerseScreen'

/** `instant`: admin — stih odmah, bez ispisa (prezentacija ga izostavi i zadrži ispis) */
export type PreviewMessage = { type: 'stihdana:preview'; verse: Verse; date?: string; instant?: boolean }

/** Prima stih od admina (isto porijeklo) i crta ga tačno kao glavna stranica. */
export function PreviewScreen() {
  const [msg, setMsg] = useState<PreviewMessage | null>(null)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin) return
      const d = e.data as PreviewMessage
      if (d?.type === 'stihdana:preview' && d.verse) setMsg(d)
    }
    window.addEventListener('message', onMessage)
    // javi roditelju da može poslati prvi stih
    window.parent?.postMessage({ type: 'stihdana:preview-ready' }, location.origin)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // prvi stih nacrtan — admin tek tad pokaže ekran (do tad boja raspoloženja, ne crno)
  const shown = Boolean(msg)
  useEffect(() => {
    if (shown) requestAnimationFrame(() => window.parent?.postMessage({ type: 'stihdana:preview-shown' }, location.origin))
  }, [shown])

  if (!msg) return null
  // `inert`: pregled je samo za gledanje — srce, zvono, dijeljenje i
  // YouTube ne rade. (Srce bi inače stvarno sačuvalo stih: pregled dijeli
  // localStorage sa sajtom jer je na istoj adresi.)
  // `?top=` — statusna traka okvira u adminu, umjesto prave "safe area"
  const top = Number(new URLSearchParams(location.search).get('top')) || 0
  return (
    <div inert style={top ? ({ '--sat': `${top}px` } as React.CSSProperties) : undefined}>
      <VerseScreen verse={msg.verse} date={msg.date ?? todayInTz()} instant={msg.instant} />
    </div>
  )
}
