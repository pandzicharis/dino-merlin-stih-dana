/**
 * Kratak trzaj pod prstom — na Androidu i na iPhoneu.
 *
 * Android ima `navigator.vibrate`. Safari ga nema, ali od iOS-a 18 sistemski
 * prekidač (`<input type="checkbox" switch>`) pri promjeni da haptički "klik".
 * Zato se nevidljiv prekidač napravi, klikne i odmah ukloni. Mora se zvati
 * iz dodira (onClick), inače iOS ne pusti trzaj.
 *
 * Uzorak je kao kod `vibrate`: broj = jedan trzaj, niz = trzaj, pauza, trzaj…
 */
export function haptic(pattern: number | number[] = 8) {
  if (typeof window === 'undefined') return
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
      return
    }
    const steps = Array.isArray(pattern) ? pattern : [pattern]
    let at = 0
    steps.forEach((ms, i) => {
      if (i % 2 === 0) {
        if (at === 0) tick()
        else window.setTimeout(tick, at)
      }
      at += ms
    })
  } catch {
    /* bez trzaja — nije bitno */
  }
}

function tick() {
  const label = document.createElement('label')
  label.ariaHidden = 'true'
  label.style.display = 'none'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  label.appendChild(input)
  document.head.appendChild(label)
  label.click()
  label.remove()
}
