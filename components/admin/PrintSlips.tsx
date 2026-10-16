'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
import { paperCase, withPeriod } from '@/lib/text'

type AdminVerse = Verse & { active: boolean }

/**
 * Papirići za štampu — isti kao oni na pultu ispred Magaze: 5,3 × 1,7 cm,
 * crna slova, štampa se na papir u boji pa se reže.
 *
 * A4 (210 × 297 mm): 3 kolone × 15 redova = 45 papirića, jedan do drugog
 * (zajedničke linije reza), mreža na sredini lista sa širokim marginama
 * (~25 mm lijevo i desno, ~21 mm gore i dolje) — nijedan printer ne odsiječe.
 * Mjere su u mm, pa se u štampi ("Sačuvaj kao PDF", razmjera 100 %) dobije
 * tačna veličina.
 */
const SLIP = { w: 53, h: 17 }
const COLS = 3
const ROWS = 15
export const PER_PAGE = COLS * ROWS
const PAGE = { w: 210, h: 297 }
const PAD = { x: 2.6, y: 1.6 }
const MM = 96 / 25.4

/** Veličina slova (mm) da najduži red stane u širinu, a svi redovi u visinu. */
function slipFont(text: string): number {
  const lines = text.split('\n')
  const longest = Math.max(...lines.map((l) => l.trim().length), 1)
  const byWidth = (SLIP.w - PAD.x * 2) / (longest * 0.5)
  const byHeight = (SLIP.h - PAD.y * 2) / (lines.length * 1.14)
  return Math.max(1.9, Math.min(3.4, byWidth, byHeight))
}

/** Sadržaj modala za štampu (AdminPanel): lijevo izbor stihova, desno A4. */
export function PrintSlips({ verses, onCount }: { verses: AdminVerse[]; onCount?: (n: number) => void }) {
  const [picked, setPicked] = useState<string[]>([])
  const [fill, setFill] = useState(true)
  const [q, setQ] = useState('')

  const byId = useMemo(() => new Map(verses.map((v) => [v.id, v])), [verses])
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = verses.filter((v) => !s || `${v.text} ${v.song} ${v.album}`.toLowerCase().includes(s))
    // aktivni prvi
    return [...list.filter((v) => v.active), ...list.filter((v) => !v.active)]
  }, [verses, q])

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < PER_PAGE ? [...p, id] : p))

  // papirići na listu: izabrani redom; "popuni" ih ponavlja do punog lista
  const slips = useMemo(() => {
    const base = picked.map((id) => byId.get(id)).filter((v): v is AdminVerse => Boolean(v))
    if (!fill || !base.length) return base
    return Array.from({ length: PER_PAGE }, (_, i) => base[i % base.length])
  }, [picked, byId, fill])
  useEffect(() => onCount?.(slips.length), [slips.length, onCount])

  // pregled: cijeli A4 stane u svoj prostor (desno)
  const box = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(0.5)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) =>
      setK(Math.max(0.2, Math.min(1, e.contentRect.width / (PAGE.w * MM), e.contentRect.height / (PAGE.h * MM)))),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="flex min-h-0 flex-col gap-6 lg:flex-1 lg:flex-row">
      <style>{`
        @page { size: A4; margin: 0; }
        .print-only { display: none; }
        @media print {
          html, body { background: #fff !important; overflow: visible !important; }
          body > *:not(.print-only) { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>

      {/* lijevo: izbor */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <p className="max-w-2xl text-[13px] leading-snug text-white/50">
          Izaberi stihove — do {PER_PAGE} na jednom A4 — pa „Štampaj / PDF“. U prozoru za štampu: „Sačuvaj kao PDF“ ili
          printer, A4, razmjera 100 %, bez margina. Štampa se crnim na papir u boji i reže po linijama; svaki papirić je
          5,3 × 1,7 cm.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Traži stih, pjesmu, album…"
            className="h-10 min-w-[12rem] flex-1 rounded-full border border-white/10 bg-black/40 px-4 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-[#BFA87F]/60"
          />
          <button
            type="button"
            onClick={() => setPicked(verses.filter((v) => v.active).slice(0, PER_PAGE).map((v) => v.id))}
            data-print-all
            className="h-10 rounded-full border border-white/10 px-4 text-[12px] text-white/70 hover:text-white"
          >
            Svi aktivni
          </button>
          <button
            type="button"
            onClick={() => setPicked([])}
            className="h-10 rounded-full border border-white/10 px-4 text-[12px] text-white/70 hover:text-white"
          >
            Očisti
          </button>
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-white/10 px-4 text-[12px] text-white/70">
            <input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} className="accent-[#BFA87F]" data-print-fill />
            Popuni list ponavljanjem
          </label>
        </div>
        <p className="tabular mt-2 text-[12px] text-white/45">
          Izabrano {picked.length}/{PER_PAGE} · na listu {slips.length}
        </p>

        <ul className="mt-3 max-h-[50dvh] min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[18px] border border-white/10 bg-white/[0.03] lg:max-h-none">
          {shown.map((v) => {
            const on = picked.includes(v.id)
            const n = picked.indexOf(v.id) + 1
            const full = !on && picked.length >= PER_PAGE
            return (
              <li key={v.id} className="border-b border-white/[0.06] last:border-0">
                <button
                  type="button"
                  onClick={() => toggle(v.id)}
                  disabled={full}
                  data-print-pick
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.04] disabled:opacity-35"
                >
                  <span
                    className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px]"
                    style={{ borderColor: on ? BRAND.gold : 'rgba(255,255,255,0.18)', background: on ? BRAND.gold : 'transparent', color: on ? '#14100A' : 'transparent' }}
                  >
                    {n || ''}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-white/85" style={{ fontFamily: 'var(--font-serif), serif' }}>
                      {v.text.replace(/\n/g, ' / ')}
                    </span>
                    <span className="block truncate text-[10px] uppercase tracking-[0.16em] text-white/35">
                      {v.song} · {v.album}
                      {!v.active && ' · arhiviran'}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* desno: A4, umanjen da stane cijeli */}
      <div ref={box} className="flex h-[60vh] shrink-0 items-start justify-center lg:h-auto lg:w-[min(46%,620px)] lg:self-stretch">
        <div style={{ width: PAGE.w * MM * k, height: PAGE.h * MM * k, boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
          <A4 slips={slips} style={{ transform: `scale(${k})`, transformOrigin: '0 0' }} />
        </div>
      </div>

      {/* za štampu: isti list, pun, direktno u body (modal ima svoje pomake) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="print-only">
            <A4 slips={slips} style={{ height: '296.5mm', overflow: 'hidden' }} />
          </div>,
          document.body,
        )}
    </div>
  )
}

function A4({ slips, style }: { slips: AdminVerse[]; style?: React.CSSProperties }) {
  return (
    <div style={{ width: `${PAGE.w}mm`, height: `${PAGE.h}mm`, background: '#fff', position: 'relative', ...style }}>
      <div
        style={{
          position: 'absolute',
          left: `${(PAGE.w - SLIP.w * COLS) / 2}mm`,
          top: `${(PAGE.h - SLIP.h * ROWS) / 2}mm`,
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, ${SLIP.w}mm)`,
          gridAutoRows: `${SLIP.h}mm`,
          // linije reza: tanke, sive — na papiru u boji se vide, a ne smetaju
          borderTop: '0.15mm solid #9a9a9a',
          borderLeft: '0.15mm solid #9a9a9a',
        }}
      >
        {Array.from({ length: PER_PAGE }, (_, i) => {
          const v = slips[i]
          const text = v ? withPeriod(paperCase(v.text)) : ''
          return (
            <div
              key={i}
              data-slip
              style={{
                boxSizing: 'border-box',
                borderRight: '0.15mm solid #9a9a9a',
                borderBottom: '0.15mm solid #9a9a9a',
                padding: `${PAD.y}mm ${PAD.x}mm`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                overflow: 'hidden',
                color: '#111',
                fontFamily: 'var(--font-serif), Georgia, serif',
                fontVariationSettings: "'wght' 400, 'opsz' 144, 'SOFT' 30, 'WONK' 0",
                fontSize: v ? `${slipFont(text).toFixed(2)}mm` : undefined,
                lineHeight: 1.12,
                letterSpacing: '-0.01em',
              }}
            >
              {v && (
                <span>
                  {text.split('\n').map((l, j) => (
                    <span key={j} className="block">
                      {l.trim()}
                    </span>
                  ))}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
