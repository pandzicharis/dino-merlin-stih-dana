'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'

/**
 * Stih red po red, kako se pjeva — red se nikad ne lomi, nego se slova
 * smanje koliko treba da najduži stane u širinu (kao useFit u VerseText).
 * Za statične ekrane u prezentaciji i na grafikama, gdje nema prave
 * aplikacije: veličina iz broja slova ne zna da su VELIKA slova šira.
 */
export function FitLines({ children }: { children: ReactNode }) {
  const box = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = box.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const fit = () => {
      el.style.fontSize = '1em'
      // širine s ekrana (getBoundingClientRect) — i roditelj i redovi, pa
      // vrijedi i kad je cijeli uređaj umanjen transformom
      const avail = parent.getBoundingClientRect().width
      const range = document.createRange()
      let widest = 0
      for (const line of Array.from(el.children)) {
        range.selectNodeContents(line)
        widest = Math.max(widest, range.getBoundingClientRect().width)
      }
      if (avail && widest > avail * 0.98) el.style.fontSize = `${((avail * 0.98) / widest).toFixed(4)}em`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(parent)
    document.fonts?.addEventListener('loadingdone', fit)
    void document.fonts?.ready.then(fit)
    return () => {
      ro.disconnect()
      document.fonts?.removeEventListener('loadingdone', fit)
    }
  }, [children])
  return (
    <span ref={box} style={{ display: 'block', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}
