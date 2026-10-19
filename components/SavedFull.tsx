'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Verse } from '@/data/verses'
import { MOODS } from '@/data/moods'
import { haptic } from '@/lib/haptic'
import { CardFace } from './SavedCarousel'

/*
 * Raširena sačuvana karta — ista karta iz špila, samo uvećana: isti
 * sadržaj i raspored, pa se ništa ne mijenja, samo raste i smanjuje se.
 * Iznad nje vire rubovi ostalih sačuvanih (špil), a linija na vrhu je
 * hvataljka kao na drawerima: povuci nadolje i karta se skupi.
 *
 * Oštrina: velika karta se slaže U PUNOJ VELIČINI (CSS `zoom` — slova,
 * dugmad i plejer se iscrtaju veliki, ne razvuku), a kretnja je samo
 * `transform` koji je smanji na mjesto male i pusti do pune — umanjena
 * slika je oštra, a na kraju je karta 1:1.
 *
 * Bez treptaja: velika karta krene tek kad je iscrtana (dva kadra), a mala
 * je ispod nje cijelo vrijeme — pri zatvaranju velika sleti tačno na nju.
 *
 * Karta u špilu nosi `data-stih={id}` — po tome se nađe.
 */

const cardOf = (id: string) => document.querySelector<HTMLElement>(`[data-stih="${CSS.escape(id)}"]`)
// sporije i mekano na oba kraja — jasno se vidi kako karta raste i vraća se
const OPEN = { duration: 760, easing: 'cubic-bezier(0.45, 0, 0.15, 1)' }
const CLOSE = { duration: 640, easing: 'cubic-bezier(0.45, 0, 0.15, 1)' }
/** kratko pretapanje kopije i male karte na početku i kraju */
const SETTLE = 180
/** zaobljenje karte u špilu (SavedCarousel) */
const RADIUS = 26
/** koliko viri svaka karta iza */
const PEEK = 9

type Rect = { left: number; top: number; width: number; height: number }

/** Visina izreza na vrhu ekrana (iPhone) — `env()` se izmjeri preko probe. */
function safeTop() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;top:0;padding-top:env(safe-area-inset-top);visibility:hidden'
  document.body.appendChild(probe)
  const v = parseFloat(getComputedStyle(probe).paddingTop) || 0
  probe.remove()
  return v
}

/**
 * Koliko se karta uveća i gdje stoji — široka kao ekran (kao na telefonu),
 * ispod izreza s mjestom iznad za rubove ostalih karata, i do samog dna.
 * Na širokom ekranu koliko visina dopušta.
 */
function layout(r: Rect) {
  const above = safeTop() + 12 + PEEK * 2
  const k = Math.min(innerWidth / r.width, (innerHeight - above) / r.height)
  const W = r.width * k
  const H = innerHeight - above
  const left = (innerWidth - W) / 2
  const top = above
  // velika karta smanjena tačno na mjesto male
  const small = `translate(${r.left - left}px, ${r.top - top}px) scale(${1 / k})`
  // prvi kadar: vidi se samo vrh, visok kao mala karta — ostatak raste do dna
  const R = RADIUS * k
  const cut = `inset(0px 0px ${Math.max(0, H - r.height * k)}px 0px round ${R}px)`
  const whole = `inset(0px 0px 0px 0px round ${R}px ${R}px 0px 0px)`
  return { k, left, top, W, H, small, cut, whole }
}
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Što je samo na maloj karti (`data-small`: "Raširi") i samo na
 * velikoj (`data-big`: "Skupi", "Sačuvano", "Podijeli") pretapa se TOKOM
 * kretnje — prvi kadar velike je tačno mala karta, a zadnji kadar pri
 * vraćanju opet tačno mala karta. Ništa ne iskoči ni ne nestane naglo.
 */
function swap(el: HTMLElement, toBig: boolean, total: number, k: number, lead = 0) {
  const fade = (n: HTMLElement, show: boolean, delay: number, duration: number) => {
    n.style.visibility = ''
    n.style.pointerEvents = show ? '' : 'none'
    const a = n.animate([{ opacity: show ? 0 : 1 }, { opacity: show ? 1 : 0 }], { delay: lead + delay, duration, easing: 'ease-in-out', fill: 'both' })
    // nevidljivo se ne može ni slučajno dodirnuti
    if (!show) a.finished.then(() => (n.style.visibility = 'hidden'), () => {})
  }
  const small = el.querySelectorAll<HTMLElement>('[data-small]')
  const big = el.querySelectorAll<HTMLElement>('[data-big]')
  // pretapaju se preklopljeno — uvijek se nešto vidi, ništa ne iskoči
  small.forEach((n) => fade(n, !toBig, toBig ? total * 0.1 : total * 0.3, total * 0.5))
  big.forEach((n) => fade(n, toBig, toBig ? total * 0.25 : total * 0.1, total * 0.5))
  // dugmad u uglu: na maloj karti krupna za prst — raširena ih vrati na
  // pravu veličinu, kao na ekranu stiha
  el.querySelectorAll<HTMLElement>('[data-shrink]').forEach((n) => {
    const kf = [{ transform: 'none' }, { transform: `scale(${1 / k})` }]
    n.animate(toBig ? kf : kf.reverse(), { duration: total, delay: lead, easing: (toBig ? OPEN : CLOSE).easing, fill: 'both' })
  })
  // stih: raširena karta je viša — klizne na njenu sredinu, i nazad
  // gramofon: ista ploča (bez uvećavanja — slova ostaju oštra) klizne na dno, i nazad
  el.querySelectorAll<HTMLElement>('[data-grow]').forEach((n) => {
    const big = n.dataset.grow!
    n.animate([{ transform: toBig ? 'none' : big }, { transform: toBig ? big : 'none' }], {
      duration: total,
      delay: lead,
      easing: (toBig ? OPEN : CLOSE).easing,
      fill: 'both',
    })
  })
  el.querySelectorAll<HTMLElement>('[data-drop]').forEach((n) => {
    const big = `translateY(${n.dataset.drop}em)`
    n.animate([{ transform: toBig ? 'none' : big }, { transform: toBig ? big : 'none' }], {
      duration: total,
      delay: lead,
      easing: (toBig ? OPEN : CLOSE).easing,
      fill: 'both',
    })
  })
}

/** `saved`: svi sačuvani redom — dvije sljedeće vire iza raširene. */
export function useSavedFull(saved: Verse[] = []): { open: (verse: Verse) => void; view: ReactNode } {
  const [full, setFull] = useState<{ verse: Verse; from: Rect } | null>(null)

  const open = useCallback((verse: Verse) => {
    const card = cardOf(verse.id)
    if (!card) return
    haptic(6)
    const r = card.getBoundingClientRect()
    setFull({ verse, from: { left: r.left, top: r.top, width: r.width, height: r.height } })
  }, [])
  const done = useCallback(() => setFull(null), [])

  let behind: Verse[] = []
  if (full && saved.length > 1) {
    const i = saved.findIndex((v) => v.id === full.verse.id)
    behind = [1, 2].map((d) => saved[(i + d) % saved.length]).filter((v) => v.id !== full.verse.id)
    behind = behind.filter((v, d) => behind.findIndex((x) => x.id === v.id) === d)
  }

  return {
    open,
    view: full && <SavedFull key={full.verse.id} verse={full.verse} from={full.from} behind={behind} onClosed={done} />,
  }
}

function SavedFull({
  verse,
  from,
  behind,
  onClosed,
}: {
  verse: Verse
  from: Rect
  behind: Verse[]
  onClosed: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  // odsijecanje (karta raste do dna) je na unutrašnjem sloju — pokretni
  // sloj ima samo transform, pa na kraju ne trepne
  const clip = useRef<HTMLDivElement>(null)
  const shade = useRef<HTMLDivElement>(null)
  const extras = useRef<HTMLDivElement>(null)
  const grab = useRef<HTMLDivElement>(null)
  const closing = useRef(false)
  const drag = useRef<{ y0: number; dy: number } | null>(null)
  const [{ k, left, top, W, H, small, cut, whole }] = useState(() => layout(from))

  // otvaranje: velika karta stoji nevidljiva na mjestu male dok se ne iscrta,
  // pa se uveća do pune — mala je ispod, pa nema treptaja; rubovi ostalih i
  // hvataljka se pojave kad karta sjedne
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const cl = clip.current
    if (cl) cl.style.clipPath = whole
    if (still()) {
      // bez kretnje: odmah velika karta, bez stvari male
      el.querySelectorAll<HTMLElement>('[data-small]').forEach((n) => (n.style.visibility = 'hidden'))
      el.querySelectorAll<HTMLElement>('[data-big]').forEach((n) => {
        n.style.opacity = '1'
        n.style.visibility = ''
      })
      el.querySelectorAll<HTMLElement>('[data-drop]').forEach((n) => (n.style.transform = `translateY(${n.dataset.drop}em)`))
      el.querySelectorAll<HTMLElement>('[data-grow]').forEach((n) => (n.style.transform = n.dataset.grow!))
      el.querySelectorAll<HTMLElement>('[data-shrink]').forEach((n) => (n.style.transform = `scale(${1 / k})`))
      return
    }
    // sve što se pojavljuje — nevidljivo od prvog kadra (bez bljeska zatamnjenja)
    const fading = [shade.current, extras.current, grab.current]
    el.style.transform = small
    if (cl) cl.style.clipPath = cut
    el.style.opacity = '0'
    for (const n of fading) if (n) n.style.opacity = '0'
    let b = 0
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => {
        el.style.opacity = ''
        el.style.transform = ''
        if (cl) cl.style.clipPath = whole
        // kopija se prvo pretopi preko male karte NA MJESTU (obje se poklapaju),
        // a tek onda krene — nikad se ne vide dvoja slova koja se razilaze
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SETTLE, easing: 'ease-in-out' })
        const lead = SETTLE
        el.animate([{ transform: small }, { transform: 'none' }], { ...OPEN, delay: lead, fill: 'backwards' })
        cl?.animate([{ clipPath: cut }, { clipPath: whole }], { ...OPEN, delay: lead, fill: 'backwards' })
        swap(el, true, OPEN.duration, k, lead)
        shade.current?.animate([{ opacity: 0 }, { opacity: 1 }], { ...OPEN, delay: lead, fill: 'backwards' })
        for (const n of [extras.current, grab.current])
          n?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: lead + OPEN.duration * 0.7, fill: 'backwards' })
        for (const n of fading) if (n) n.style.opacity = ''
      })
    })
    return () => {
      cancelAnimationFrame(a)
      cancelAnimationFrame(b)
    }
  }, [small, k, cut, whole])

  /** smanji nazad tačno na malu kartu (i iz povučenog položaja), pa zatvori */
  const close = useCallback(
    (fromTransform = 'none') => {
      if (closing.current) return
      closing.current = true
      haptic(6)
      const el = box.current
      if (!el || still()) return onClosed()
      for (const n of [extras.current, grab.current])
        n?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE.duration * 0.4, easing: 'ease-out', fill: 'forwards' })
      // sleti tačno na malu kartu, pa se kratko pretopi u nju — bez treptaja
      el.animate([{ transform: fromTransform }, { transform: small }], { ...CLOSE, fill: 'forwards' })
      clip.current?.animate([{ clipPath: whole }, { clipPath: cut }], { ...CLOSE, fill: 'forwards' })
        .finished.then(() => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SETTLE, easing: 'ease-in-out', fill: 'forwards' }).finished)
        .then(onClosed, onClosed)
      swap(el, false, CLOSE.duration, k)
      shade.current?.animate([{ opacity: Number(shade.current.style.opacity || 1) }, { opacity: 0 }], { ...CLOSE, fill: 'forwards' })
    },
    [small, k, cut, whole, onClosed],
  )
  const collapse = useCallback(() => close(), [close])

  // hvataljka: karta prati prst nadolje; dovoljno nisko — skupi se, inače nazad
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (closing.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { y0: e.clientY, dy: 0 }
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || !box.current) return
    d.dy = Math.max(0, e.clientY - d.y0)
    box.current.style.transform = `translateY(${d.dy}px)`
    if (shade.current) shade.current.style.opacity = String(Math.max(0.3, 1 - d.dy / 500))
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (!d || !box.current) return
    const at = `translateY(${d.dy}px)`
    box.current.style.transform = ''
    if (d.dy > 110) return close(at)
    box.current.animate([{ transform: at }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' })
    if (shade.current) shade.current.style.opacity = ''
  }

  // Escape zatvara; stranica ispod ne skrola
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && collapse()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [collapse])

  return createPortal(
    <div data-full role="dialog" aria-modal="true" aria-label={`Sačuvani stih — ${verse.song}`} className="fixed inset-0 z-[110]">
      {/* zatamnjenje — dodir pored karte je skupi */}
      <div ref={shade} className="absolute inset-0 bg-black/85" onClick={collapse} />

      <div ref={extras} aria-hidden>
        {/* ostali sačuvani — rubovi vire iznad, kao karte ispod u špilu */}
        {behind
          .slice()
          .reverse()
          .map((v, i, all) => {
            const d = all.length - i // 2 = dalja, 1 = bliža
            const m = MOODS[v.mood]
            return (
              <div
                key={v.id}
                className="absolute border border-b-0 border-white/20"
                style={{
                  left: left + W * 0.045 * d,
                  width: W * (1 - 0.09 * d),
                  top: top - PEEK * d,
                  height: 60,
                  borderRadius: `${RADIUS * k}px ${RADIUS * k}px 0 0`,
                  background: `linear-gradient(180deg, ${m.gradient[1]}, ${m.gradient[0]})`,
                  filter: `brightness(${1 - d * 0.18})`,
                }}
              />
            )
          })}
      </div>

      <div
        ref={box}
        className="absolute"
        style={{ left, top, width: W, height: H, transformOrigin: '0 0', willChange: 'transform' }}
      >
        {/* ista karta, složena u punoj veličini — oštra */}
        <div ref={clip} className="h-full w-full">
          <div style={{ width: from.width, height: H / k, zoom: k, '--cw': `${from.width}px` } as CSSProperties}>
            <CardFace verse={verse} onCollapse={collapse} actionsZoom={1 / k} />
          </div>
        </div>
        {/* hvataljka — kao na drawerima; za nju se karta povuče nadolje */}
        <div
          ref={grab}
          className="absolute inset-x-[30%] top-0 flex h-6 cursor-grab touch-none justify-center pt-2 active:cursor-grabbing"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-hidden
        >
          <span className="h-1 w-10 rounded-full bg-white/35" />
        </div>
      </div>
    </div>,
    document.body,
  )
}
