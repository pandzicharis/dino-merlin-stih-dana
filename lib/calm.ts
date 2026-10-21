/**
 * Posao koji može čekati (slaganje panela unaprijed, ostali prikazi, priprema
 * slika) — tek kad prst miruje `quiet` ms, nema tombole ni uvoda (zastor),
 * stranica se vidi i `ok()` dozvoli. Tako nikad ne uzme kadar animaciji ni
 * dodiru: na telefonu je to razlika između glatko i "zastane".
 * Vraća otkazivanje.
 */
export function whenCalm(fn: () => void, quiet = 1200, ok: () => boolean = () => true): () => void {
  let t = 0
  let last = performance.now()
  const touch = () => {
    last = performance.now()
  }
  const opts = { capture: true, passive: true } as const
  window.addEventListener('pointerdown', touch, opts)
  window.addEventListener('pointermove', touch, opts)
  const stop = () => {
    clearTimeout(t)
    window.removeEventListener('pointerdown', touch, opts)
    window.removeEventListener('pointermove', touch, opts)
  }
  const check = () => {
    const busy =
      document.hidden ||
      'cekaj' in document.documentElement.dataset ||
      Boolean(document.querySelector('[data-izvlacenje], [data-cover]')) ||
      !ok()
    const wait = quiet - (performance.now() - last)
    if (busy || wait > 0) {
      t = window.setTimeout(check, busy ? quiet : wait)
      return
    }
    stop()
    fn()
  }
  t = window.setTimeout(check, quiet)
  return stop
}
