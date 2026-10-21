/**
 * Posao koji može čekati (slaganje panela unaprijed, ostali prikazi, priprema
 * slika) — tek kad prst miruje `quiet` ms, nema tombole ni uvoda (zastor),
 * stranica se vidi i `ok()` dozvoli. Tako nikad ne uzme kadar animaciji ni
 * dodiru: na telefonu je to razlika između glatko i "zastane".
 * `max`: najduže čekanje na miran prst. Vraća otkazivanje.
 */
export function whenCalm(fn: () => void, quiet = 1200, ok: () => boolean = () => true, max = Infinity): () => void {
  let t = 0
  const start = performance.now()
  let last = start
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
    // najkasnije poslije `max` ms ne čeka da prst miruje (tombola i zastor i dalje da)
    const wait = performance.now() - start > max ? 0 : quiet - (performance.now() - last)
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
