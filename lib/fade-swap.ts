/**
 * Ekran se mekano utiša, promijeni (`swap`) i vrati. Promjena se desi u
 * svakom slučaju — i kad animacija ne stigne do kraja (stranica u pozadini,
 * zaključan ekran): tad odmah, bez prelaza.
 *
 * `lift` (px, sa smjerom): stari sadržaj blago ode gore (ili dolje, kad je
 * negativan) i malo se umanji, a novi dođe s druge strane — kao prelaz
 * između dva ekrana, ne samo zatamnjenje.
 */
export function fadeSwap(el: HTMLElement | null, swap: () => void, out = 260, back = 520, lift = 0) {
  if (!el || document.visibilityState !== 'visible' || matchMedia('(prefers-reduced-motion: reduce)').matches) return swap()
  let done = false
  const away = (y: number) => (lift ? { transform: `translateY(${y}px) scale(0.985)` } : {})
  const still = lift ? { transform: 'none' } : {}
  const a = el.animate([{ opacity: 1, ...still }, { opacity: 0, ...away(-lift) }], { duration: out, easing: 'ease-in', fill: 'forwards' })
  const finish = () => {
    if (done) return
    done = true
    swap()
    a.cancel()
    el.animate([{ opacity: 0, ...away(lift) }, { opacity: 1, ...still }], { duration: back, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
  }
  a.finished.then(finish, finish)
  // osigurač: animacija u pozadini ne završi — promjena ipak dođe
  window.setTimeout(finish, out + 150)
}
