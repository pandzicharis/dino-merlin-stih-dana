'use client'

import { useEffect, useRef, useState } from 'react'
import type { Verse } from '@/data/verses'
import { MOODS } from '@/data/moods'
import { IPHONE, IPhone, IosStatus, Island, Glass, deviceOuter } from '@/components/deck/Devices'

/** statusna traka okvira (kao u adminu i prezentaciji) */
const STATUS_BAR = 50
const OUTER = deviceOuter('iphone')

/**
 * Jedan telefon s pravim ekranom stiha (`/pregled` u iframeu) — strelice,
 * prevlačenje ili dodir na naziv mijenjaju album. Jedan iframe za sve: više
 * aplikacija odjednom preglednik ne stigne nacrtati.
 */
export function AlbumPhones({ list }: { list: { album: string; verse: Verse; sample: boolean }[] }) {
  const [at, setAt] = useState(0)
  const frame = useRef<HTMLIFrameElement>(null)
  const ready = useRef(false)
  const cur = list[at]
  const go = (k: number) => setAt(((k % list.length) + list.length) % list.length)

  // stih u iframe: kad se javi da je spreman, i pri svakoj promjeni albuma
  useEffect(() => {
    const send = () => frame.current?.contentWindow?.postMessage({ type: 'stihdana:preview', verse: cur.verse, instant: true }, location.origin)
    if (ready.current) send()
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow || e.data?.type !== 'stihdana:preview-ready') return
      ready.current = true
      send()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [cur])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setAt((a) => (a + 1) % list.length)
      if (e.key === 'ArrowLeft') setAt((a) => (a - 1 + list.length) % list.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [list.length])

  // prevlačenje lijevo/desno preko telefona
  const x0 = useRef<number | null>(null)

  return (
    <div className="flex min-h-dvh flex-col items-center gap-4 bg-[#0b0a0a] py-6 text-white">
      <div className="flex items-center gap-4">
        <button onClick={() => go(at - 1)} className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/70" aria-label="Prethodni">
          ←
        </button>
        <p className="min-w-[260px] text-center font-mono text-[12px] text-white/60">
          {at + 1} / {list.length} · {cur.album}
          {cur.sample ? ' · primjer' : ` · ${cur.verse.id}`}
        </p>
        <button onClick={() => go(at + 1)} className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/70" aria-label="Sljedeći">
          →
        </button>
      </div>

      <div
        style={{ position: 'relative', width: OUTER.w, height: OUTER.h, touchAction: 'pan-y' }}
        onPointerDown={(e) => (x0.current = e.clientX)}
        onPointerUp={(e) => {
          const d = x0.current == null ? 0 : e.clientX - x0.current
          x0.current = null
          if (Math.abs(d) > 40) go(at + (d < 0 ? 1 : -1))
        }}
      >
        <IPhone width={`${OUTER.w}px`} time={null}>
          {null}
        </IPhone>
        <div
          style={{
            position: 'absolute',
            left: IPHONE.rim + IPHONE.bezel,
            top: IPHONE.rim + IPHONE.bezel,
            width: IPHONE.w,
            height: IPHONE.h,
            borderRadius: IPHONE.radius,
            overflow: 'hidden',
            isolation: 'isolate',
            background: MOODS[cur.verse.mood].gradient[0],
          }}
        >
          <iframe
            ref={frame}
            src={`/pregled?top=${STATUS_BAR}`}
            title="Album"
            tabIndex={-1}
            style={{ position: 'absolute', inset: 0, width: IPHONE.w, height: IPHONE.h, border: 0, pointerEvents: 'none' }}
          />
          <IosStatus time="12:00" />
          <Island />
          <Glass />
        </div>
      </div>

      <div className="flex max-w-[520px] flex-wrap justify-center gap-2 px-4">
        {list.map((x, i) => (
          <button
            key={x.verse.id}
            onClick={() => setAt(i)}
            className={`rounded-full border px-3 py-1 text-[12px] ${i === at ? 'border-white/60 text-white' : 'border-white/15 text-white/55'}`}
          >
            {x.album}
          </button>
        ))}
      </div>
    </div>
  )
}
