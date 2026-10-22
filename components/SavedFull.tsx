'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Verse } from '@/data/verses'
import { MOODS } from '@/data/moods'
import { haptic } from '@/lib/haptic'
import { swallowClick } from '@/lib/tap'
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
const OPEN = { duration: 600, easing: 'cubic-bezier(0.45, 0, 0.15, 1)' }
const CLOSE = { duration: 500, easing: 'cubic-bezier(0.45, 0, 0.15, 1)' }
/** spuštena prstom — nastavi brzinom prsta (bez sporog početka), pa mekano sjedne */
const FLING = { duration: 440, easing: 'cubic-bezier(0.22, 0.75, 0.2, 1)' }
/** kratko pretapanje kopije i male karte na početku i kraju */
const SETTLE = 140
/** zaobljenje karte u špilu (SavedCarousel) */
const RADIUS = 26
/** koliko viri svaka karta iza */
const PEEK = 9

/** `visible`: koliko karte se stvarno vidi odozgo — dno joj prekriva plejer */
type Rect = { left: number; top: number; width: number; height: number; visible: number }

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
  // prvi kadar: vidi se samo ono što se vidi od male karte — do plejera koji
  // joj prekriva dno; ostatak raste do dna. Dno ravno (mala se tu pretapa u
  // plejer, nema ruba), pa i pri skupljanju sleti tačno tu. Bez `clip-path`
  // animacije (iPhone je vrti na glavnoj niti): okvir koji reže (overflow)
  // pomjeren gore za odsječeni dio, sadržaj u njemu isto toliko dolje — oba
  // `transform`, na grafičkom procesoru; ivica okvira je tad tačno dno
  const off = Math.max(0, H - r.visible * k)
  const cut = `translateY(${-off}px)`
  const back = `translateY(${off}px)`
  return { k, left, top, W, H, small, cut, back }
}
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Karta u pokretu (`data-moving`): ukrasne animacije unutra stanu
 * (globals.css), pa se tokom rasta i skupljanja ništa ne iscrtava iznova —
 * samo se pomjeraju gotovi slojevi. Na telefonu to je razlika između
 * glatko i trzaja.
 */
function moving(el: HTMLElement, ms: number) {
  el.dataset.moving = ''
  window.setTimeout(() => delete el.dataset.moving, ms + 40)
}

/**
 * Što je samo na maloj karti (`data-small`: "Raširi") i samo na
 * velikoj (`data-big`: "Skupi", "Sačuvano", "Podijeli") pretapa se TOKOM
 * kretnje — prvi kadar velike je tačno mala karta, a zadnji kadar pri
 * vraćanju opet tačno mala karta. Ništa ne iskoči ni ne nestane naglo.
 */
function swap(el: HTMLElement, toBig: boolean, total: number, k: number, lead = 0, curve?: string) {
  const ease = curve ?? (toBig ? OPEN : CLOSE).easing
  const fade = (n: HTMLElement, show: boolean, delay: number, duration: number) => {
    n.style.visibility = ''
    n.style.pointerEvents = show ? '' : 'none'
    const a = n.animate([{ opacity: show ? 0 : 1 }, { opacity: show ? 1 : 0 }], { delay: lead + delay, duration, easing: 'ease-in-out', fill: 'both' })
    // nevidljivo se ne može ni slučajno dodirnuti
    if (!show) a.finished.then(() => (n.style.visibility = 'hidden'), () => {})
  }
  const small = el.querySelectorAll<HTMLElement>('[data-small]')
  const big = el.querySelectorAll<HTMLElement>('[data-big]')
  // jedno pa drugo, ne preklopljeno: "Raširi" i "Skupi" stoje na istom
  // mjestu — dvije ikone napola vidljive jedna preko druge izgledaju kao mig
  small.forEach((n) => fade(n, !toBig, toBig ? 0 : total * 0.25, total * (toBig ? 0.28 : 0.5)))
  big.forEach((n) => fade(n, toBig, toBig ? total * 0.35 : 0, total * (toBig ? 0.4 : 0.28)))
  // dugmad u uglu: na maloj karti krupna za prst — raširena ih vrati na
  // pravu veličinu, kao na ekranu stiha
  el.querySelectorAll<HTMLElement>('[data-shrink]').forEach((n) => {
    const kf = [{ transform: 'none' }, { transform: `scale(${1 / k})` }]
    n.animate(toBig ? kf : kf.reverse(), { duration: total, delay: lead, easing: ease, fill: 'both' })
  })
  // stih: raširena karta je viša — klizne na njenu sredinu, i nazad
  // gramofon: ista ploča (bez uvećavanja — slova ostaju oštra) klizne na dno, i nazad
  el.querySelectorAll<HTMLElement>('[data-grow]').forEach((n) => {
    const big = n.dataset.grow!
    n.animate([{ transform: toBig ? 'none' : big }, { transform: toBig ? big : 'none' }], {
      duration: total,
      delay: lead,
      easing: ease,
      fill: 'both',
    })
  })
  el.querySelectorAll<HTMLElement>('[data-drop]').forEach((n) => {
    const big = `translateY(${n.dataset.drop}em)`
    n.animate([{ transform: toBig ? 'none' : big }, { transform: toBig ? big : 'none' }], {
      duration: total,
      delay: lead,
      easing: ease,
      fill: 'both',
    })
  })
}

type Opened = { verse: Verse; from: Rect; n: number }
/** otvaranje ide pravo u sloj raširene karte — špil i plejer se ne crtaju iznova */
let show: ((o: Opened | null) => void) | null = null
let opened = 0

/** `saved`: svi sačuvani redom — dvije sljedeće vire iza raširene. */
export function useSavedFull(saved: Verse[] = []): { open: (verse: Verse) => void; view: ReactNode } {
  const open = useCallback((verse: Verse) => {
    const card = cardOf(verse.id)
    if (!card) return
    haptic(6)
    const r = card.getBoundingClientRect()
    // plejer ispod špila prekriva dno karte — kopija počinje (i sleti) iznad njega
    const player = document.querySelector('[data-player]')?.getBoundingClientRect()
    const visible = player && player.top > r.top ? Math.min(r.height, player.top - r.top) : r.height
    // svako otvaranje nova karta — i ista dok se još skuplja (inače dodir propadne)
    show?.({ verse, from: { left: r.left, top: r.top, width: r.width, height: r.height, visible }, n: ++opened })
  }, [])
  const view = useMemo(() => <SavedFullLayer saved={saved} />, [saved])
  return { open, view }
}

function SavedFullLayer({ saved }: { saved: Verse[] }) {
  const [full, setFull] = useState<Opened | null>(null)
  useEffect(() => {
    show = setFull
    return () => {
      if (show === setFull) show = null
    }
  }, [])
  const done = useCallback(() => setFull(null), [])

  let behind: Verse[] = []
  if (full && saved.length > 1) {
    const i = saved.findIndex((v) => v.id === full.verse.id)
    behind = [1, 2].map((d) => saved[(i + d) % saved.length]).filter((v) => v.id !== full.verse.id)
    behind = behind.filter((v, d) => behind.findIndex((x) => x.id === v.id) === d)
  }

  return full && <SavedFull key={full.n} verse={full.verse} from={full.from} behind={behind} onClosed={done} />
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
  // sadržaj unutar okvira — pomjeren suprotno od njega (vidi `layout`)
  const shift = useRef<HTMLDivElement>(null)
  const shade = useRef<HTMLDivElement>(null)
  const extras = useRef<HTMLDivElement>(null)
  const grab = useRef<HTMLDivElement>(null)
  const closing = useRef(false)
  const drag = useRef<{ x0: number; y0: number; dy: number; id: number; on: boolean; last: [number, number][] } | null>(null)
  // dodir na kartu je skupi tek kad je raširena — nestrpljiv drugi dodir ne vrati je odmah
  const born = useRef(0)
  useEffect(() => {
    born.current = performance.now()
  }, [])
  const [{ k, left, top, W, H, small, cut, back }] = useState(() => layout(from))

  // otvaranje: velika karta stoji nevidljiva na mjestu male dok se ne iscrta,
  // pa se uveća do pune — mala je ispod, pa nema treptaja; rubovi ostalih i
  // hvataljka se pojave kad karta sjedne
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const cl = clip.current
    const sh = shift.current
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
    if (cl) cl.style.transform = cut
    if (sh) sh.style.transform = back
    el.style.opacity = '0'
    for (const n of fading) if (n) n.style.opacity = '0'
    let b = 0
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => {
        el.style.opacity = ''
        el.style.transform = ''
        if (cl) cl.style.transform = ''
        if (sh) sh.style.transform = ''
        // kopija se prvo pretopi preko male karte NA MJESTU (obje se poklapaju),
        // a tek onda krene — nikad se ne vide dvoja slova koja se razilaze
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SETTLE, easing: 'ease-in-out' })
        const lead = SETTLE
        el.animate([{ transform: small }, { transform: 'none' }], { ...OPEN, delay: lead, fill: 'backwards' })
        cl?.animate([{ transform: cut }, { transform: 'none' }], { ...OPEN, delay: lead, fill: 'backwards' })
        sh?.animate([{ transform: back }, { transform: 'none' }], { ...OPEN, delay: lead, fill: 'backwards' })
        swap(el, true, OPEN.duration, k, lead)
        moving(el, lead + OPEN.duration)
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
  }, [small, k, cut, back])

  /** smanji nazad tačno na malu kartu (i iz povučenog položaja), pa zatvori */
  const close = useCallback(
    (fromTransform = 'none') => {
      if (closing.current) return
      closing.current = true
      haptic(6)
      const el = box.current
      if (!el || still()) return onClosed()
      // spuštena prstom: nastavi kretnju odmah, bez sporog početka
      const curve = fromTransform === 'none' ? CLOSE : FLING
      for (const n of [extras.current, grab.current])
        n?.animate([{ opacity: Number(n.style.opacity || 1) }, { opacity: 0 }], { duration: curve.duration * 0.4, easing: 'ease-out', fill: 'forwards' })
      // sleti tačno na malu kartu, pa se kratko pretopi u nju — bez treptaja
      const moved = el.animate([{ transform: fromTransform }, { transform: small }], { ...curve, fill: 'forwards' })
      clip.current?.animate([{ transform: 'none' }, { transform: cut }], { ...curve, fill: 'forwards' })
      shift.current?.animate([{ transform: 'none' }, { transform: back }], { ...curve, fill: 'forwards' })
      moved.finished
        .then(() => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SETTLE, easing: 'ease-in-out', fill: 'forwards' }).finished)
        .then(onClosed, onClosed)
      swap(el, false, curve.duration, k, 0, curve.easing)
      moving(el, curve.duration + SETTLE)
      shade.current?.animate([{ opacity: Number(shade.current.style.opacity || 1) }, { opacity: 0 }], { ...curve, fill: 'forwards' })
    },
    [small, k, cut, back, onClosed],
  )
  const collapse = useCallback(() => close(), [close])

  // hvataljka: karta prati prst nadolje; dovoljno nisko — skupi se, inače nazad
  // povuci kartu nadolje bilo gdje (ne s dugmadi, ploče ni trake) — prati
  // prst, a dovoljno nisko se skupi; dodir bez povlačenja ne radi ništa
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (closing.current) return
    if ((e.target as Element).closest('button, a, input, [role="slider"], [data-nodrag]')) return
    drag.current = { x0: e.clientX, y0: e.clientY, dy: 0, id: e.pointerId, on: false, last: [[e.clientY, e.timeStamp]] }
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || !box.current) return
    const dy = e.clientY - d.y0
    if (!d.on) {
      // tek kad krene nadolje (a ne u stranu) — onda je to povlačenje
      if (dy < 8 || Math.abs(e.clientX - d.x0) > dy) return
      d.on = true
      try {
        e.currentTarget.setPointerCapture(d.id)
      } catch {
        /* prst je već otišao — povlačenje i dalje ide kroz događaje */
      }
    }
    d.dy = Math.max(0, dy)
    d.last = [...d.last.slice(-3), [e.clientY, e.timeStamp]]
    box.current.style.transform = `translateY(${d.dy}px)`
    if (shade.current) shade.current.style.opacity = String(Math.max(0.3, 1 - d.dy / 500))
    // rubovi ostalih karata gore se mekano gube dok se karta vuče — ne stoje kao zalijepljeni
    if (extras.current) extras.current.style.opacity = String(Math.max(0, 1 - d.dy / 160))
  }
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (!d || !box.current) return
    // dodir (bez povlačenja) po karti — skupi je, kao što ju je dodir raširio
    if (!d.on) {
      if (e.type !== 'pointerup' || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 10) return
      if (performance.now() - born.current < SETTLE + OPEN.duration) return
      swallowClick()
      return close()
    }
    const at = `translateY(${d.dy}px)`
    box.current.style.transform = ''
    // dovoljno nisko ili brz potez nadolje
    const [y0, t0] = d.last[0]
    const [y1, t1] = d.last[d.last.length - 1]
    const v = t1 > t0 ? (y1 - y0) / (t1 - t0) : 0
    if (d.dy > 110 || (d.dy > 24 && v > 0.5)) return close(at)
    box.current.animate([{ transform: at }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' })
    if (extras.current) extras.current.style.opacity = ''
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
        className="absolute touch-none"
        style={{ left, top, width: W, height: H, transformOrigin: '0 0', willChange: 'transform' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* ista karta, složena u punoj veličini — oštra */}
        <div ref={clip} className="h-full w-full overflow-hidden" style={{ contain: 'strict', willChange: 'transform' }}>
          <div ref={shift} className="h-full w-full" style={{ willChange: 'transform' }}>
            {/* svoj sloj (will-change): karta se iscrta jednom, u punoj veličini —
                smanjivanje i odsijecanje dna tokom kretnje je onda samo posao
                GPU-a, bez ponovnog crtanja pozadine, slova i sjenki */}
            <div style={{ width: from.width, height: H / k, zoom: k, '--cw': `${from.width}px` } as CSSProperties}>
              <CardFace verse={verse} onCollapse={collapse} actionsZoom={1 / k} />
            </div>
          </div>
        </div>
        {/* hvataljka — kao na drawerima (karta se vuče nadolje bilo gdje) */}
        <div
          ref={grab}
          className="pointer-events-none absolute inset-x-[30%] top-0 flex h-6 justify-center pt-2"
          aria-hidden
        >
          <span className="h-1 w-10 rounded-full bg-white/35" />
        </div>
      </div>
    </div>,
    document.body,
  )
}
