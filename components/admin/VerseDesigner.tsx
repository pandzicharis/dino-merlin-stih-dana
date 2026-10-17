'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { BRAND } from '@/lib/brand'
import { MOODS, type Mood } from '@/data/moods'
import { suggestColors, type Suggestion } from '@/lib/palette'
import {
  FONT_KINDS,
  LIMITS,
  VERSE_FONTS,
  VERSE_FONT_KEYS,
  canItalic,
  lookCss,
  normalize,
  parseFont,
  stringifyFont,
  styleCss,
  styleOf,
  verseWords,
  type FontMap,
  type VerseFont,
  type VerseLook,
  type WordStyle,
} from '@/lib/fonts'

/**
 * Dizajner stiha, red po red. Izabereš red (ili sve redove), pa mu biraš
 * font, podebljano, ukoso, velika slova, veličinu i boju — boju s prijedlozima
 * koje aplikacija izvuče iz pozadine (raspoloženje + omot albuma), uvijek
 * čitljivim na njoj. Dolje je izgled cijelog stiha (veličina, prored, razmak
 * slova, mala/velika slova), a gotovi stilovi slože sve odjednom. Pregled
 * pored forme je pravi ekran aplikacije.
 *
 * Zapis je obični tekst (lib/fonts.ts), isti onaj koji već nosi baza.
 */
export function VerseDesigner({
  value,
  text,
  mood,
  cover,
  onChange,
}: {
  value: string
  text: string
  /** raspoloženje — boja naglaska i pozadina za prijedloge boje */
  mood: Mood
  /** omot albuma u pozadini ekrana stiha — i iz njega idu prijedlozi */
  cover?: string
  onChange: (font: string) => void
}) {
  const map = parseFont(value)
  const rows = verseWords(text)
  const starts = rows.reduce<number[]>((acc, r, i) => [...acc, i ? acc[i - 1] + rows[i - 1].length : 0], [])
  const total = rows.reduce((a, r) => a + r.length, 0)
  const accent = MOODS[mood].accent

  // redovi koji se uređuju — može više odjednom; bar jedan je uvijek izabran
  const [picked, setPicked] = useState<number[]>([0])
  const chosen = picked.filter((li) => li < rows.length).sort((a, b) => a - b)
  const lines = chosen.length ? chosen : rows.length ? [0] : []
  const toggleRow = (li: number) =>
    setPicked(lines.includes(li) ? (lines.length > 1 ? lines.filter((x) => x !== li) : lines) : [...lines, li])
  const lineOf = (li: number) => rows[li].map((_, j) => starts[li] + j)
  // svi redovi izabrani = cijeli stih (i glavni stil)
  const sel = lines.length === rows.length ? [] : lines.flatMap(lineOf)
  const targets = sel.length ? sel : Array.from({ length: total }, (_, i) => i)
  const styles = targets.length ? targets.map((i) => styleOf(map, i)) : [map.main]
  const all = <K extends keyof WordStyle>(k: K) => styles.every((s) => Boolean(s[k]))
  const same = <K extends keyof WordStyle>(k: K) => (styles.every((s) => s[k] === styles[0][k]) ? styles[0][k] : undefined)

  const save = (next: FontMap) => onChange(stringifyFont(next) ?? '')

  /** Izmjena stila na izabranom redu (ili svima, i glavnom stilu). */
  const apply = (patch: Partial<WordStyle>) => {
    const next: FontMap = { ...map, words: { ...map.words } }
    if (!sel.length) {
      next.main = normalize({ ...map.main, ...patch })
      for (const k of Object.keys(map.words)) next.words[+k] = normalize({ ...map.words[+k], ...patch })
    } else {
      for (const i of sel) next.words[i] = normalize({ ...styleOf(map, i), ...patch })
    }
    save(next)
  }
  const toggle = (k: 'bold' | 'italic' | 'upper') => apply({ [k]: !all(k) })
  const setLook = (patch: Partial<VerseLook>) => save({ ...map, look: { ...map.look, ...patch } })

  // prijedlozi boje iz pozadine — računaju se kad se promijeni raspoloženje ili album
  const [suggested, setSuggested] = useState<Suggestion[]>([])
  useEffect(() => {
    let off = false
    suggestColors(mood, cover).then((s) => !off && setSuggested(s))
    return () => {
      off = true
    }
  }, [mood, cover])

  const font = same('font') ?? null
  const size = styles[0].size ?? 100
  const color = same('color')
  const accentOn = all('accent')
  const plain = styles.every((s) => !s.color && !s.accent)
  const italicOk = styles.every((s) => canItalic(s.font))
  const names = lines.map((li) => `${li + 1}.`)
  const scope = names.length > 1 ? `${names.slice(0, -1).join(', ')} i ${names[names.length - 1]} red` : `${names[0] ?? '1.'} red`
  // uzorak na pločicama fontova: prva riječ reda (kratka), inače "Aa"
  const sample = (() => {
    const w = rows.flat()[targets[0]]
    return w && w.length <= 9 ? w.replace(/[.,!?…]+$/, '') : 'Aa'
  })()

  // gotovi stilovi složeni za ovaj stih (koliko riječi u kojem redu)
  const counts = rows.map((r) => r.length)
  const presets = PRESETS.map((p) => ({ ...p, font: stringifyFont(p.make(counts)) ?? '' }))
  const empty = !value

  return (
    <div data-designer>
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-black/25">
        {/* gotovi stilovi */}
        <SectionTitle
          title="Gotovi stilovi"
          hint="jedan klik složi cijeli stih"
          right={
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={empty}
              className="shrink-0 text-[11px] font-normal normal-case tracking-normal text-white/40 transition-colors hover:text-white disabled:opacity-30"
            >
              Vrati osnovno
            </button>
          }
        />
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-white/[0.06] px-2 pb-2">
          {presets.map((p) => {
            const on = p.font === value || (p.id === 'cisto' && empty)
            return (
              <button
                type="button"
                key={p.id}
                data-edit-preset={p.id}
                onClick={() => onChange(p.font)}
                aria-pressed={on}
                className="flex h-14 min-w-[86px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-2.5 transition-colors"
                style={tile(on)}
              >
                <span className="whitespace-nowrap leading-none" style={{ ...sampleCss(normalize(p.sample)), fontSize: `${17 * VERSE_FONTS[p.sample.font].scale}px`, lineHeight: 1, color: p.sample.accent ? accent : undefined, paddingInline: undefined }}>
                  {p.label}
                </span>
                <span className="text-[8.5px] uppercase tracking-[0.12em] text-white/35">{p.note}</span>
              </button>
            )
          })}
        </div>

        {/* redovi stiha, svaki u svom stilu — klik bira red */}
        <SectionTitle title="Uređivanje po redu" hint="izaberi red, ili više njih odjednom" />
        <div className="space-y-1 px-2 pb-2" style={lookCss(map.look, accent)}>
          {rows.length === 0 && <p className="px-1 py-2 text-[12px] text-white/35">Upiši stih — onda ga ovdje oblikuješ red po red.</p>}
          {rows.map((r, li) => {
            const on = lines.includes(li)
            return (
              <button
                type="button"
                key={li}
                data-edit-line={li}
                onClick={() => toggleRow(li)}
                role="checkbox"
                aria-checked={on}
                className="flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-left transition-colors"
                style={{ borderColor: on ? BRAND.gold : 'rgba(255,255,255,0.06)', background: on ? `${BRAND.gold}14` : 'transparent' }}
              >
                {/* kvačica — redova može biti više */}
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors"
                  style={{ borderColor: on ? BRAND.gold : 'rgba(255,255,255,0.25)', background: on ? BRAND.gold : 'transparent' }}
                  aria-hidden
                >
                  {on && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#14100A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                  )}
                </span>
                <span className="w-9 shrink-0 text-[9px] uppercase tracking-[0.14em]" style={{ color: on ? BRAND.gold : 'rgba(255,255,255,0.35)' }}>
                  {li + 1}. red
                </span>
                <span className="min-w-0 flex-1 truncate text-[19px] leading-tight text-white/90" style={{ textTransform: 'inherit' }}>
                  {r.map((w, j) => {
                    const st = styleOf(map, starts[li] + j)
                    const css = sampleCss(st)
                    return (
                      <span
                        key={j}
                        style={{
                          ...css,
                          fontSize: `${Math.min(1.5, css.fontSize ? parseFloat(String(css.fontSize)) : 1)}em`,
                          lineHeight: 1.25,
                          paddingInline: undefined,
                          color: st.color ? `#${st.color}` : st.accent ? accent : undefined,
                        }}
                      >
                        {w}{' '}
                      </span>
                    )
                  })}
                </span>
              </button>
            )
          })}
        </div>

        {/* izabrani red: font, oznake, veličina, boja */}
        <div className="border-t border-white/[0.06]" style={{ background: `${BRAND.gold}08` }}>
          <SectionTitle title={`Uređuješ: ${scope}`} hint={lines.length > 1 ? 'isto za sve izabrane' : 'font, veličina i boja samo za njega'} dot />
          <div className="px-2.5 pb-2.5">
          <div className="space-y-2">
            {FONT_KINDS.map(({ kind, label }) => (
              <div key={kind}>
                <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-white/30">{label}</p>
                <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
                  {VERSE_FONT_KEYS.filter((k) => VERSE_FONTS[k].kind === kind).map((k) => (
                    <FontTile key={k} k={k} on={font === k} sample={sample} onPick={() => apply({ font: k })} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Toggle on={all('bold')} onClick={() => toggle('bold')} title="Podebljano" data-edit-b>
              <b>B</b>
            </Toggle>
            <Toggle on={all('italic')} onClick={() => toggle('italic')} disabled={!italicOk} title={italicOk ? 'Ukoso' : 'Ovaj font nema ukoso'} data-edit-i>
              <i className="font-serif">I</i>
            </Toggle>
            <Toggle on={all('upper')} onClick={() => toggle('upper')} title="Velika slova" data-edit-upper wide>
              AA
            </Toggle>
            <Slider label="Veličina" value={size} min={60} max={160} step={5} base={100} unit="%" onChange={(v) => apply({ size: v })} data="size" />
          </div>

          {/* boja: osnovna, naglasak raspoloženja, prijedlozi iz pozadine, ili svoja */}
          <div className="mt-3">
            <p className="mb-1.5 text-[9px] uppercase tracking-[0.18em] text-white/30">Boja</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Swatch on={plain} onClick={() => apply({ color: undefined, accent: false })} title="Osnovna boja stiha" data-edit-color="none">
                <span className="h-full w-full rounded-full" style={{ background: MOODS[mood].text }} />
              </Swatch>
              <Swatch on={accentOn} onClick={() => apply({ color: undefined, accent: true })} title="Naglasak — boja raspoloženja (prati raspoloženje)" data-edit-accent>
                <span className="h-full w-full rounded-full" style={{ background: accent, boxShadow: `0 0 10px ${accent}` }} />
              </Swatch>
              <span className="mx-0.5 h-5 w-px bg-white/10" aria-hidden />
              {suggested.map((s) => (
                <Swatch key={s.hex} on={color === s.hex} onClick={() => apply({ color: s.hex, accent: false })} title={`Iz pozadine — ${s.from}`} data-edit-color={s.hex}>
                  <span className="h-full w-full rounded-full" style={{ background: `#${s.hex}` }} />
                </Swatch>
              ))}
              {/* svoja boja */}
              <label
                title="Svoja boja"
                className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border text-[13px] text-white/60 transition-colors hover:text-white"
                style={{ borderColor: color && !suggested.some((s) => s.hex === color) ? BRAND.gold : 'rgba(255,255,255,0.15)' }}
              >
                {color && !suggested.some((s) => s.hex === color) ? <span className="h-4 w-4 rounded-full" style={{ background: `#${color}` }} /> : '+'}
                <input
                  type="color"
                  value={`#${color ?? 'ffffff'}`}
                  onChange={(e) => apply({ color: e.target.value.slice(1), accent: false })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  data-edit-color-custom
                />
              </label>
            </div>
          </div>
          </div>
        </div>

        {/* cijeli stih */}
        <div className="border-t border-white/[0.06] bg-white/[0.015]">
          <SectionTitle title="Cijeli stih" hint="važi za sve redove" />
          <div className="grid grid-cols-1 gap-y-2.5 px-2.5 pb-2.5">
            <Slider label="Veličina" value={map.look.size ?? 100} min={LIMITS.size.min} max={LIMITS.size.max} step={5} base={100} unit="%" onChange={(v) => setLook({ size: v })} data="look-size" />
            <Slider label="Prored" value={map.look.lh ?? LIMITS.lh.base} min={LIMITS.lh.min} max={LIMITS.lh.max} step={2} base={LIMITS.lh.base} onChange={(v) => setLook({ lh: v })} format={(v) => (v / 100).toFixed(2)} data="look-lh" />
            <Slider label="Razmak slova" value={map.look.ls ?? 0} min={LIMITS.ls.min} max={LIMITS.ls.max} step={1} base={0} onChange={(v) => setLook({ ls: v })} format={(v) => (v > 0 ? `+${v}` : String(v))} data="look-ls" />
            <div className="flex items-center gap-2">
              <span className="w-[74px] shrink-0 text-[11px] text-white/50">Slova</span>
              <div className="grid flex-1 grid-cols-3 rounded-lg border border-white/[0.08] p-0.5">
                {(
                  [
                    [undefined, 'Kao tekst'],
                    ['lower', 'mala'],
                    ['upper', 'VELIKA'],
                  ] as const
                ).map(([c, l]) => {
                  const on = map.look.case === c
                  return (
                    <button
                      type="button"
                      key={l}
                      data-edit-case={c ?? 'none'}
                      onClick={() => setLook({ case: c })}
                      className="h-7 whitespace-nowrap rounded-md text-[11px] transition-colors"
                      style={{ background: on ? `${BRAND.gold}2e` : 'transparent', color: on ? '#fff' : 'rgba(255,255,255,0.55)' }}
                    >
                      {l}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Stil riječi za uzorke u adminu. Osnovni Fraunces nema svoj CSS (dolazi iz
 * `.verse`), a dugme bi inače nasljedilo font aplikacije.
 */
function sampleCss(w: WordStyle): React.CSSProperties {
  return {
    fontFamily: 'var(--font-serif), ui-serif, Georgia, serif',
    fontVariationSettings: "'wght' 400, 'opsz' 144, 'SOFT' 30, 'WONK' 0",
    ...styleCss(w),
  }
}

/* ── gotovi stilovi ─────────────────────────────────────────── */

/** riječi zadnjeg reda (kod jednog reda: druga polovina) */
function last(rows: number[]): number[] {
  const total = rows.reduce((a, b) => a + b, 0)
  const from = rows.length > 1 ? total - rows[rows.length - 1] : Math.floor(total / 2)
  return Array.from({ length: total - from }, (_, k) => from + k)
}
const on = (idx: number[], w: WordStyle) => Object.fromEntries(idx.map((i) => [i, w]))

type Preset = { id: string; label: string; note: string; sample: WordStyle; make: (rows: number[]) => FontMap }

const PRESETS: Preset[] = [
  { id: 'cisto', label: 'Čisto', note: 'osnovno', sample: { font: 'fraunces' }, make: () => ({ main: { font: 'fraunces' }, words: {}, look: {} }) },
  {
    id: 'romantika',
    label: 'Romantika',
    note: 'pisani kraj',
    sample: { font: 'greatvibes', accent: true },
    make: (r) => ({ main: { font: 'cormorant', italic: true }, words: on(last(r), { font: 'greatvibes', accent: true, size: 112 }), look: {} }),
  },
  {
    id: 'elegancija',
    label: 'Elegancija',
    note: 'bodoni',
    sample: { font: 'bodoni', italic: true },
    make: (r) => ({ main: { font: 'bodoni' }, words: on(last(r), { font: 'pinyon', accent: true, size: 110 }), look: { lh: 128 } }),
  },
  {
    id: 'moderno',
    label: 'Moderno',
    note: 'velika slova',
    sample: { font: 'josefin', upper: true },
    make: (r) => ({ main: { font: 'josefin' }, words: on(last(r), { font: 'josefin', bold: true, accent: true }), look: { case: 'upper', ls: 8, size: 86, lh: 132 } }),
  },
  {
    id: 'kontrast',
    label: 'Kontrast',
    note: 'kapitale + pero',
    sample: { font: 'alexbrush', accent: true },
    make: (r) => ({ main: { font: 'cinzel', size: 80 }, words: on(last(r), { font: 'alexbrush', size: 150, accent: true }), look: { ls: 6, lh: 124 } }),
  },
  {
    id: 'klasika',
    label: 'Klasika',
    note: 'garamond',
    sample: { font: 'ebgaramond', italic: true },
    make: (r) => ({ main: { font: 'ebgaramond' }, words: on(last(r), { font: 'ebgaramond', italic: true, accent: true }), look: { size: 106 } }),
  },
  {
    id: 'naslov',
    label: 'Naslov',
    note: 'dm serif',
    sample: { font: 'dmserif' },
    make: (r) => ({ main: { font: 'dmserif' }, words: on(last(r), { font: 'dmserif', italic: true, accent: true }), look: { ls: -2, lh: 110 } }),
  },
  { id: 'rukopis', label: 'Rukopis', note: 'caveat', sample: { font: 'caveat' }, make: () => ({ main: { font: 'caveat' }, words: {}, look: { size: 108 } }) },
]

/* ── dijelovi ───────────────────────────────────────────────── */

const tile = (on: boolean) => ({
  borderColor: on ? BRAND.gold : 'rgba(255,255,255,0.08)',
  background: on ? `${BRAND.gold}26` : 'rgba(0,0,0,0.3)',
  color: on ? '#fff' : 'rgba(255,255,255,0.7)',
})

function FontTile({ k, on, sample, onPick }: { k: VerseFont; on: boolean; sample: string; onPick: () => void }) {
  const f = VERSE_FONTS[k]
  return (
    <button
      type="button"
      onClick={onPick}
      data-edit-font={k}
      aria-pressed={on}
      title={f.label}
      className="flex h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border px-1 transition-colors"
      style={tile(on)}
    >
      <span className="max-w-full truncate" style={{ ...sampleCss({ font: k }), fontSize: `${17 * f.scale}px`, lineHeight: 1.15, paddingInline: undefined }}>
        {sample}
      </span>
      <span className="text-[8.5px] uppercase tracking-[0.1em] text-white/40">{f.label}</span>
    </button>
  )
}

/** Naslov dijela dizajnera — zlatno, s kratkim objašnjenjem. */
function SectionTitle({ title, hint, dot, right }: { title: string; hint: string; dot?: boolean; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 px-2.5 pb-2 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: BRAND.gold }}>
      {dot && <span className="h-1.5 w-1.5 shrink-0 -translate-y-px self-center rounded-full" style={{ background: BRAND.gold, boxShadow: `0 0 8px ${BRAND.gold}` }} />}
      <span className="shrink-0">{title}</span>
      <span className="min-w-0 flex-1 truncate text-[11px] font-normal normal-case tracking-normal text-white/35">— {hint}</span>
      {right}
    </div>
  )
}

function Swatch({ on, onClick, title, children, ...rest }: { on: boolean; onClick: () => void; title: string; children: React.ReactNode } & Record<`data-${string}`, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border p-[3px] transition-transform hover:scale-110"
      style={{ borderColor: on ? BRAND.gold : 'rgba(255,255,255,0.12)', boxShadow: on ? `0 0 0 1px ${BRAND.gold}` : undefined }}
      {...rest}
    >
      {children}
    </button>
  )
}

function Toggle({
  on,
  onClick,
  disabled,
  title,
  wide,
  children,
  ...rest
}: {
  on: boolean
  onClick: () => void
  disabled?: boolean
  title: string
  wide?: boolean
  children: React.ReactNode
} & Record<`data-${string}`, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={on}
      className={`flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border text-[12px] transition-colors disabled:opacity-30 ${wide ? 'px-2.5' : 'w-8'}`}
      style={tile(on)}
      {...rest}
    >
      {children}
    </button>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  base,
  unit = '',
  format,
  onChange,
  data,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  /** podrazumijevana vrijednost — dvoklik je vrati */
  base: number
  unit?: string
  format?: (v: number) => string
  onChange: (v: number) => void
  data: string
}) {
  const changed = value !== base
  return (
    <label className="flex min-w-[200px] flex-1 items-center gap-2" data-edit-slider={data} onDoubleClick={() => onChange(base)}>
      <span className="w-[74px] shrink-0 text-[11px] text-white/50">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer accent-[#BFA87F]"
      />
      <motion.button
        type="button"
        onClick={() => onChange(base)}
        title="Vrati"
        className="w-11 shrink-0 text-right text-[11px] tabular-nums"
        style={{ color: changed ? BRAND.gold : 'rgba(255,255,255,0.4)' }}
        whileTap={{ scale: 0.92 }}
      >
        {format ? format(value) : value}
        {unit}
      </motion.button>
    </label>
  )
}
