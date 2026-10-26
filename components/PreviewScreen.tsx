'use client'

import { useEffect, useRef, useState } from 'react'
import type { Verse } from '@/data/verses'
import { verseDayInTz } from '@/lib/date'
import { VerseScreen } from './VerseScreen'
import { LyricsPanel } from './Lyrics'

/** `instant`: admin — stih odmah, bez ispisa (prezentacija ga izostavi i zadrži ispis) */
export type PreviewMessage = { type: 'stihdana:preview'; verse: Verse; date?: string; instant?: boolean }
/** admin → pregled: pjesma iz forme svira (`on`: tekst pjesme otvoren i prati je) */
export type PreviewLyrics = { type: 'stihdana:preview-lyrics'; on: boolean; t: number; d: number; playing: boolean }
/** pregled → admin: dugmad u tekstu upravljaju pjesmom u formi */
export type PreviewAudio = { type: 'stihdana:preview-audio'; cmd: 'toggle' | 'seek' | 'close'; at?: number }

const toAdmin = (m: Omit<PreviewAudio, 'type'>) => window.parent?.postMessage({ type: 'stihdana:preview-audio', ...m }, location.origin)

/** Prima stih od admina (isto porijeklo) i crta ga tačno kao glavna stranica. */
export function PreviewScreen() {
  const [msg, setMsg] = useState<PreviewMessage | null>(null)
  // tekst pjesme iz admina: vrijeme stiže par puta u sekundi, između se broji ovdje
  const [lyricsOn, setLyricsOn] = useState(false)
  const song = useRef({ t: 0, d: 0, playing: false, at: 0 })

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin) return
      const d = e.data as PreviewMessage | PreviewLyrics
      if (d?.type === 'stihdana:preview' && d.verse) setMsg(d)
      if (d?.type === 'stihdana:preview-lyrics') {
        song.current = { t: d.t, d: d.d, playing: d.playing, at: performance.now() }
        setLyricsOn(d.on)
      }
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
    <>
      <div inert style={top ? ({ '--sat': `${top}px` } as React.CSSProperties) : undefined}>
        <VerseScreen verse={msg.verse} date={msg.date ?? verseDayInTz()} instant={msg.instant} preview month />
      </div>
      {/* tekst pjesme dok pjesma iz forme svira — dugmad šalju adminu */}
      <LyricsPanel
        open={lyricsOn}
        verse={msg.verse}
        clock={() => {
          const s = song.current
          const t = s.t + (s.playing ? (performance.now() - s.at) / 1000 : 0)
          return { t: s.d ? Math.min(t, s.d) : t, d: s.d, playing: s.playing }
        }}
        controls={{
          toggle: () => toAdmin({ cmd: 'toggle' }),
          seek: (f) => toAdmin({ cmd: 'seek', at: f * song.current.d }),
        }}
        onSeek={(at) => toAdmin({ cmd: 'seek', at })}
        onClose={() => toAdmin({ cmd: 'close' })}
      />
    </>
  )
}
