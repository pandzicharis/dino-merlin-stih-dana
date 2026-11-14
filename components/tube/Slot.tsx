'use client'

import { useEffect, useRef, useState } from 'react'
import { addSlot } from '@/lib/youtube'

/**
 * Mjesto YouTube plejera (TubeStage ga drži iznad): dok video ne krene,
 * oštra slika pjesme (najveća koju YouTube ima — mala se razvuče i mutna je)
 * i krug koji se vrti.
 */
export function Slot({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    return addSlot({ el, id })
  }, [id])
  // maxresdefault ima samo HD video — bez nje YouTube vrati sivu sličicu 120×90
  const [small, setSmall] = useState<string | null>(null)
  const src = small === id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
  return (
    // zaobljenje preuzme i plejer koji pluta iznad (TubeStage)
    <div ref={ref} data-tube-slot className="relative flex aspect-video min-h-[200px] w-full items-center justify-center overflow-hidden rounded-[18px] bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt=""
        draggable={false}
        onLoad={(e) => e.currentTarget.naturalWidth <= 120 && setSmall(id)}
        onError={() => setSmall(id)}
        className="absolute inset-0 h-full w-full object-cover"
        // hqdefault je 4:3 s crnim trakama — malo uvećana, trake ispadnu
        style={small === id ? { transform: 'scale(1.34)' } : undefined}
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" aria-hidden />
      <span className="tube-spin relative block h-8 w-8 rounded-full border-2 border-white/30 border-t-white" role="status" aria-label="Pjesma se učitava" />
    </div>
  )
}
