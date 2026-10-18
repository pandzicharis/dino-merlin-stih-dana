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
 * Dizajner stiha. Na platnu je stih kakav jeste (fontovi, boje); gore biraš
 * šta uređuješ — cijeli stih, redove ili pojedine riječi — i dodirom na tekst
 * označiš. Izabranom biraš font, podebljano, ukoso, velika slova, veličinu i boju — boju s prijedlozima
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

  // šta se uređuje: cijeli stih, redovi (više odjednom) ili riječi (više odjednom)
  const [mode, setMode] = useState<'all' | 'line' | 'word'>('line')
  const [picked, setPicked] = useState<number[]>([0])
  const chosen = picked.filter((li) => li < rows.length).sort((a, b) => a - b)
  const lines = chosen.length ? chosen : rows.length ? [0] : []
  // dodir na red: u "Redovi" ga doda/makne (bar jedan ostaje), iz drugih načina pređe na taj red
  const toggleRow = (li: number) => {
    if (mode !== 'line') {
      setMode('line')
      return setPicked([li])
    }
    setPicked(lines.includes(li) ? (lines.length > 1 ? lines.filter((x) => x !== li) : lines) : [...lines, li])
  }
  const [pickedWords, setPickedWords] = useState<number[]>([0])
  const words = (() => {
    const w = pickedWords.filter((i) => i < total).sort((a, b) => a - b)
    return w.length ? w : total ? [0] : []
  })()
  const toggleWord = (i: number) => {
    if (mode !== 'word') {
      setMode('word')
      return setPickedWords([i])
    }
    setPickedWords(words.includes(i) ? (words.length > 1 ? words.filter((x) => x !== i) : words) : [...words, i])
  }
  const lineOf = (li: number) => rows[li].map((_, j) => starts[li] + j)
  // cijeli stih (ili svi redovi) = i glavni stil
  const sel = mode === 'all' ? [] : mode === 'word' ? words : lines.length === rows.length ? [] : lines.flatMap(lineOf)
  const flat = rows.flat()
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
  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} i ${xs[xs.length - 1]}` : (xs[0] ?? ''))
  const scope =
    mode === 'all' || (mode === 'line' && lines.length === rows.length)
      ? 'cijeli stih'
      : mode === 'word'
        ? words.length > 3
          ? `${words.length} riječi`
          : list(words.map((i) => `„${(flat[i] ?? '').replace(/[.,!?…:;]+$/, '')}“`))
        : `${list(lines.map((li) => `${li + 1}.`))} red`
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

        {/* platno: stih u svojim fontovima — gore se bira šta se uređuje, dodirom se označi */}
        <SectionTitle
          title="Uređivanje"
          hint={mode === 'all' ? 'cijeli stih odjednom' : mode === 'line' ? 'dodirni red' : 'dodirni riječ'}
          right={
            <div className="flex shrink-0 rounded-full border border-white/[0.1] p-0.5 text-[10px] font-medium normal-case tracking-normal" role="tablist">
              {(
                [
                  ['all', 'Cijeli stih'],
                  ['line', 'Redovi'],
                  ['word', 'Riječi'],
                ] as const
              ).map(([m, l]) => (
                <button
                  type="button"
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  data-edit-mode={m}
                  onClick={() => {
                    // na "Riječi": prva riječ reda koji je bio izabran
                    if (m === 'word' && mode !== 'word') setPickedWords([starts[lines[0] ?? 0] ?? 0])
                    setMode(m)
                  }}
                  className="h-6 rounded-full px-2.5 transition-colors"
                  style={{ background: mode === m ? BRAND.gold : 'transparent', color: mode === m ? '#14100A' : 'rgba(255,255,255,0.55)' }}
                >
                  {l}
                </button>
              ))}
            </div>
          }
        />
        <div className="mx-2 mb-2 rounded-xl border border-white/[0.06] bg-black/30 py-1.5" style={lookCss(map.look, accent)}>
          {rows.length === 0 && <p className="px-3 py-2 text-[12px] text-white/35">Upiši stih — onda ga ovdje oblikuješ.</p>}
          {rows.map((r, li) => {
            const lineOn = mode === 'all' || (mode === 'line' && lines.includes(li))
            return (
              <div
                key={li}
                // cijeli red je klikabilan — riječ i broj imaju svoje (dugmad unutra)
                onClick={(e) => {
                  if (!(e.target as Element).closest('button')) toggleRow(li)
                }}
                className="relative flex cursor-pointer items-center gap-2 py-2.5 pl-3 pr-2 transition-colors hover:bg-white/[0.025]"
                style={{ background: lineOn ? `${BRAND.gold}12` : undefined }}
              >
                {/* zlatna crta — izabran red */}
                <span
                  className="absolute bottom-1 left-0 top-1 w-[2px] rounded-full transition-opacity"
                  style={{ background: BRAND.gold, opacity: lineOn ? 1 : 0 }}
                  aria-hidden
                />
                {/* broj reda — dodir bira cijeli red */}
                <button
                  type="button"
                  data-edit-line={li}
                  onClick={() => toggleRow(li)}
                  aria-pressed={mode === 'line' && lines.includes(li)}
                  title={`${li + 1}. red`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums transition-colors"
                  style={{
                    color: lineOn ? '#14100A' : 'rgba(255,255,255,0.4)',
                    background: lineOn ? BRAND.gold : 'rgba(255,255,255,0.05)',
                  }}
                >
                  {li + 1}
                </button>
                <span className="min-w-0 flex-1 text-[21px] leading-[1.3] text-white/90" style={{ textTransform: 'inherit' }}>
                  {r.map((w, j) => {
                    const i = starts[li] + j
                    const st = styleOf(map, i)
                    const css = sampleCss(st)
                    const wordOn = mode === 'word' && words.includes(i)
                    return (
                      <span key={j}>
                        <button
                          type="button"
                          data-edit-word={i}
                          onClick={() => (mode === 'word' ? toggleWord(i) : mode === 'line' ? toggleRow(li) : toggleWord(i))}
                          aria-pressed={wordOn}
                          className="rounded-[6px] px-[2px] transition-colors"
                          style={{
                            ...css,
                            fontSize: `${Math.min(1.5, css.fontSize ? parseFloat(String(css.fontSize)) : 1)}em`,
                            lineHeight: 1.3,
                            paddingInline: '2px',
                            marginInline: '-2px',
                            color: st.color ? `#${st.color}` : st.accent ? accent : undefined,
                            background: wordOn ? `${BRAND.gold}33` : 'transparent',
                            boxShadow: wordOn ? `inset 0 -2px 0 ${BRAND.gold}` : undefined,
                          }}
                        >
                          {w}
                        </button>{' '}
                      </span>
                    )
                  })}
                </span>
              </div>
            )
          })}
        </div>

        {/* izabrani red: font, oznake, veličina, boja */}
        <div className="border-t border-white/[0.06]" style={{ background: `${BRAND.gold}08` }}>
          <SectionTitle
            title={`Uređuješ: ${scope}`}
            hint={sel.length === 0 ? 'važi za sve' : (mode === 'word' ? words.length : lines.length) > 1 ? 'isto za sve izabrane' : 'samo za izabrano'}
            dot
          />
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
