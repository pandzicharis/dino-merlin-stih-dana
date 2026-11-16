'use client'

import { useEffect, useRef } from 'react'
import { SLOT_EVENT, pauseTube, setTubeHost, slotsOf, tubeShown, tubeSnap, useTube } from '@/lib/youtube'

/**
 * YouTube plejer (lib/youtube.ts) — jedan iframe, pluta iznad mjesta gdje je
 * pjesma na ekranu (ladica — `TubeDrawer`). Iframe se ne seli po stranici (preseljen bi
 * se učitao iznova), nego mu se svaki kadar postave položaj i veličina mjesta.
 *
 * Dok video ne krene, providan je — na mjestu je slika pjesme, a video se
 * pretopi preko nje. Poslije je to samo video — kontrole su naše, ispod pjesme.
 * Mjesto pokriveno (panel preko ladice) — pjesma stane.
 */
export function TubeStage() {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const { videoId } = useTube()

  useEffect(() => {
    setTubeHost(inner.current)
    return () => setTubeHost(null)
  }, [])

  useEffect(() => {
    const b = box.current
    if (!b) return
    if (!videoId) return void (b.style.visibility = 'hidden')
    let raf = 0
    let last = 0
    let lost = 0
    let spot: HTMLElement | null = null
    let z = 20
    let radius = '0px'
    // zadnje upisano — DOM se dira samo kad se nešto promijeni (na početku sklonjen)
    let was = 'off'
    const frame = (now: number) => {
      // mjesto se bira rjeđe (pokrivenost), položaj prati svaki kadar
      if (now - last > 200) {
        last = now
        const best = pick(videoId, b)
        spot = best?.el ?? null
        z = best?.z ?? 20
        if (spot) radius = getComputedStyle(spot).borderRadius
        // nigdje se ne vidi, a svira — stane (malo strpljenja: panel se tek podiže)
        if (spot || tubeSnap().status !== 'playing') lost = 0
        else if (!lost) lost = now
        else if (now - lost > 900) pauseTube()
      }
      const r = spot?.getBoundingClientRect()
      // mjesto se upravo pojavilo (pjesma se vratila) — okvir se pretopi, ne iskoči
      const on = Boolean(r) && tubeShown() && was !== 'off'
      const next = r ? `${Math.round(r.left)}|${Math.round(r.top)}|${Math.round(r.width)}|${Math.round(r.height)}|${z}|${on}|${radius}` : 'off'
      if (next !== was) {
        was = next
        if (!r) Object.assign(b.style, { visibility: 'hidden', opacity: '0' })
        else
          Object.assign(b.style, {
            visibility: 'visible',
            transform: `translate3d(${Math.round(r.left)}px, ${Math.round(r.top)}px, 0)`,
            width: `${Math.round(r.width)}px`,
            height: `${Math.round(r.height)}px`,
            zIndex: String(z),
            borderRadius: radius,
            opacity: on ? '1' : '0',
            pointerEvents: on ? 'auto' : 'none',
          } satisfies Partial<CSSStyleDeclaration>)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    // mjesto se sakrilo ili vratilo (Slot `away`) — bira se već u sljedećem kadru
    const now = () => void (last = 0)
    window.addEventListener(SLOT_EVENT, now)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener(SLOT_EVENT, now)
    }
  }, [videoId])

  return (
    <div
      ref={box}
      className="fixed left-0 top-0 overflow-hidden bg-black transition-opacity duration-500 ease-out"
      style={{ visibility: 'hidden', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
    >
      {/* data-tube-host: plejer ga nađe i kad je kod osvježen (lib/youtube.ts) */}
      <div ref={inner} data-tube-host className="h-full w-full [&_iframe]:block [&_iframe]:h-full [&_iframe]:w-full" />
    </div>
  )
}

/** Mjesto za okvir koje se vidi (nije pokriveno) — najgornje. */
function pick(id: string, stage: HTMLElement): { el: HTMLElement; z: number } | null {
  let best: { el: HTMLElement; z: number } | null = null
  for (const el of slotsOf(id)) {
    if (!shown(el, stage)) continue
    const z = layer(el)
    if (!best || z >= best.z) best = { el, z }
  }
  return best
}

/** Na ekranu (bar veći dio), nije sakriveno ni pokriveno panelom. */
function shown(el: HTMLElement, stage: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  if (r.width < 100 || r.height < 100 || el.closest('[aria-hidden="true"], [inert]')) return false
  const seen = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0))
  if (seen < r.height * 0.6) return false
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  return Boolean(hit && (el.contains(hit) || stage.contains(hit)))
}

/** Sloj mjesta: iznad panela u kom je (fiksni roditelj sa z-indexom). */
function layer(el: HTMLElement): number {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const cs = getComputedStyle(n)
    if (cs.position === 'fixed' && cs.zIndex !== 'auto') return Math.max(1, Number(cs.zIndex) + 1)
  }
  return 20
}
