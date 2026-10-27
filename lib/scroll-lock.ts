/**
 * Stranica ispod ne skrola dok je otvoren bar jedan prozor (plejer, drawer,
 * postavke…). Brojač, a ne "zapamti pa vrati": prozori se ne zatvaraju
 * redom kojim su otvoreni, a plejer pusti tek kad ode (kasnije) — vraćanje
 * zapamćenog bi stranicu ostavilo zaključanu i kad ništa nije otvoreno.
 * Vraća otključavanje (smije se pozvati više puta).
 */
let held = 0

export function lockScroll(): () => void {
  held++
  document.body.style.overflow = 'hidden'
  let done = false
  return () => {
    if (done) return
    done = true
    held = Math.max(0, held - 1)
    if (!held) document.body.style.overflow = ''
  }
}
