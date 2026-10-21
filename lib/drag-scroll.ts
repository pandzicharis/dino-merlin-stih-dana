/**
 * Prevlačenje MIŠEM (računar) po vodoravnoj traci sa zaustavljanjem na
 * kartici — karte stihova, albumi. Prst i trackpad traku skrolaju sami
 * (sistem), a miš ne: klik i povlačenje bi inače stajali. Jedan potez je
 * jedna kartica, kao prstom (dovoljno dug ili brz potez; inače nazad), a
 * povlačenje nije klik na kartu. `step`: razmak između kartica u pikselima.
 */
export function dragScroll(el: HTMLElement, step: () => number): () => void {
  let s: { x: number; left: number; id: number; moved: boolean; last: [number, number][] } | null = null
  let restore = 0
  const down = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    if ((e.target as Element).closest('input, textarea, select, [role="slider"], [data-nodrag]')) return
    s = { x: e.clientX, left: el.scrollLeft, id: e.pointerId, moved: false, last: [[e.clientX, e.timeStamp]] }
  }
  const move = (e: PointerEvent) => {
    if (!s || e.pointerId !== s.id) return
    const dx = e.clientX - s.x
    if (!s.moved) {
      if (Math.abs(dx) < 6) return
      s.moved = true
      clearTimeout(restore)
      // bez zaustavljanja dok miš vuče — traka prati miš 1:1
      el.style.scrollSnapType = 'none'
      try {
        el.setPointerCapture(s.id)
      } catch {
        /* miš je već pušten */
      }
    }
    el.scrollLeft = s.left - dx
    s.last = [...s.last.slice(-4), [e.clientX, e.timeStamp]]
  }
  const up = (e: PointerEvent) => {
    const d = s
    s = null
    if (!d || !d.moved) return
    const st = step()
    if (!st) return void (el.style.scrollSnapType = '')
    const from = Math.round(d.left / st)
    const dx = e.clientX - d.x
    const [x0, t0] = d.last[0]
    const [x1, t1] = d.last[d.last.length - 1]
    const v = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0
    const dir = Math.abs(dx) > st * 0.2 || Math.abs(v) > 0.4 ? (dx < 0 ? 1 : -1) : 0
    const max = Math.round((el.scrollWidth - el.clientWidth) / st)
    el.scrollTo({ left: Math.max(0, Math.min(max, from + dir)) * st, behavior: 'smooth' })
    restore = window.setTimeout(() => (el.style.scrollSnapType = ''), 500)
    // povlačenje nije dodir na kartu (klik stiže odmah poslije puštanja)
    const stop = (c: MouseEvent) => {
      c.stopPropagation()
      c.preventDefault()
    }
    el.addEventListener('click', stop, { capture: true, once: true })
    window.setTimeout(() => el.removeEventListener('click', stop, { capture: true }), 0)
  }
  // slika ili link se ne "vuku" mišem (preglednik bi progutao povlačenje)
  const noDrag = (e: DragEvent) => e.preventDefault()
  el.addEventListener('pointerdown', down)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  el.addEventListener('dragstart', noDrag)
  return () => {
    clearTimeout(restore)
    el.removeEventListener('pointerdown', down)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
    el.removeEventListener('dragstart', noDrag)
  }
}
