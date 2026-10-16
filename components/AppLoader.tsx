'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { MagazaLogo } from './MagazaLogo'

type Loader = { live(path: string): boolean; show(): void; hide(): void }

/** postoji samo na živoj aplikaciji (lib/loader.ts) */
const loader = () => (window as Window & { __stihLoader?: Loader }).__stihLoader

/**
 * Crni ekran s potpisom i Magazom (lib/loader.ts). Ovdje je samo njegov
 * sadržaj i znak "spremno" — kad se pojavi i kad nestane odlučuje skripta
 * iz <head>, pa radi i prije nego ova komponenta oživi.
 */
export function AppLoader() {
  const pathname = usePathname()

  // stranica je oživjela (prvo otvaranje ili prelaz) — dva frejma da se
  // nacrta ono što se postavi pri montaži (izvučeni stih), pa fontovi
  useEffect(() => {
    const l = loader()
    if (!l) return
    let off = false
    const fonts = Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 600))])
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        fonts.then(() => !off && l.hide())
      }),
    )
    return () => {
      off = true
    }
  }, [pathname])

  // prelaz na drugu stranicu aplikacije — ako kasni, i tu se pojavi
  useEffect(() => {
    const l = loader()
    if (!l) return
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]')
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const url = new URL(a.href)
      if (url.origin !== location.origin || url.pathname === location.pathname || !l.live(url.pathname)) return
      l.show()
    }
    addEventListener('click', onClick)
    return () => removeEventListener('click', onClick)
  }, [])

  return (
    // skripta mu mijenja stil prije hidracije kad istekne MAX
    <div id="app-loader" aria-hidden suppressHydrationWarning>
      <div className="ld-lockup">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ld-sig" src="/brand/signature.webp?v=2" alt="" width={70} height={50} />
        <span className="ld-bar" />
        <MagazaLogo height={30} color="#FFFFFF" className="ld-mag" />
      </div>
    </div>
  )
}
