'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'

/**
 * Stih red po red, kako se pjeva — red se nikad ne lomi, nego se slova
 * smanje koliko treba da najduži stane u širinu (kao useFit u VerseText).
 * Za statične ekrane u prezentaciji i na grafikama, gdje nema prave
 * aplikacije: veličina iz broja slova ne zna da su VELIKA slova šira.
 */
/** izmjerene veličine (`cacheKey` + širina) — karta koja se ponovo složi ne mjeri iznova */
const sizes = new Map<string, number>()

export function FitLines({ children, cacheKey }: { children: ReactNode; cacheKey?: string }) {
  const box = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = box.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const fit = (again = false) => {
      // širina rasporeda (bez transformacija) — ista karta u bilo kojem dijelu špila
      const key = cacheKey && parent.clientWidth ? `${cacheKey}|${parent.clientWidth}` : null
      const known = key && !again ? sizes.get(key) : undefined
      if (known) {
        el.style.fontSize = `${known.toFixed(4)}em`
        return
      }
      // širine s ekrana (getBoundingClientRect) — i roditelj i redovi, pa
      // vrijedi i kad je cijeli uređaj umanjen transformom
      const avail = parent.getBoundingClientRect().width * 0.98
      const range = document.createRange()
      const widest = () => {
        let w = 0
        for (const line of Array.from(el.children)) {
          range.selectNodeContents(line)
          w = Math.max(w, range.getBoundingClientRect().width)
        }
        return w
      }
      // razmak između slova (tracking roditelja) se ne smanjuje sa slovima —
      // zato par krugova: smanji, izmjeri, opet, dok ne stane
      let size = 1
      el.style.fontSize = '1em'
      for (let i = 0; i < 4 && avail; i++) {
        const w = widest()
        if (w <= avail) break
        size *= avail / w
        el.style.fontSize = `${size.toFixed(4)}em`
      }
      if (key && avail) sizes.set(key, size)
    }
    fit()
    const ro = new ResizeObserver(() => fit())
    ro.observe(parent)
    // font stigao — mjeri se ponovo (i zapamćeno)
    const loaded = () => fit(true)
    document.fonts?.addEventListener('loadingdone', loaded)
    if (document.fonts && document.fonts.status !== 'loaded') void document.fonts.ready.then(loaded)
    return () => {
      ro.disconnect()
      document.fonts?.removeEventListener('loadingdone', loaded)
    }
  }, [children, cacheKey])
  return (
    <span ref={box} style={{ display: 'block', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}
