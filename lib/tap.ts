import type { MouseEvent as ReactMouseEvent, PointerEvent } from 'react'

/*
 * Dodir koji ne propadne. iPhone proguta `click` kad prst dotakne traku dok
 * se karta još dosjeda (dodir samo zaustavi skrol) — raširi/skupi je tad
 * tražilo drugi dodir. Ovdje se dodir broji već na puštanju prsta (ako se
 * prst nije pomjerio), a `click` koji stigne odmah poslije se proguta — da
 * ne padne na ono što se u međuvremenu otvorilo ispod prsta. Tastatura i
 * dalje ide kroz `click`.
 */

let down: { x: number; y: number } | null = null
let swallowing = 0

const swallow = (e: MouseEvent) => {
  // `label.click()` iz lib/haptic.ts nije pravi klik — ne dira se
  if (!e.isTrusted) return
  e.stopPropagation()
  e.preventDefault()
  stop()
}
function stop() {
  clearTimeout(swallowing)
  swallowing = 0
  window.removeEventListener('click', swallow, true)
}

/** `click` koji iPhone pošalje odmah poslije puštanja prsta se proguta */
export function swallowClick() {
  stop()
  window.addEventListener('click', swallow, true)
  swallowing = window.setTimeout(stop, 400)
}

export function tapProps(fn: () => void, skip?: string) {
  return {
    onPointerDown: (e: PointerEvent) => {
      down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null
    },
    onPointerUp: (e: PointerEvent) => {
      const d = down
      down = null
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) return
      if (skip && (e.target as Element).closest(skip)) return
      swallowClick()
      fn()
    },
    onClick: (e: ReactMouseEvent) => {
      if (skip && (e.target as Element).closest(skip)) return
      fn()
    },
  }
}
