'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BRAND } from '@/lib/brand'

/** stanje teksta pjesme iz /api/admin/audio (lib/lyrics-store.ts) */
type LyricsState = 'synced' | 'plain' | 'missing' | 'loading'
type Info = { state: 'ready' | 'loading' | 'missing' | 'error'; lyrics?: LyricsState } | null

const LINES = 'M3.5 6h11M3.5 10.5h11M3.5 15h6M17.5 19.5a2 2 0 1 1-2-2V9.5l4-1'

function Spinner() {
  return (
    <motion.span
      className="block h-2.5 w-2.5 shrink-0 rounded-full border border-current border-t-transparent"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
      aria-hidden
    />
  )
}

/** Znak teksta u listi stihova: spremljen (zlatni; jači kad prati pjesmu), preuzima se, ili nije spremljen. */
export function LyricsBadge({ info }: { info: Info }) {
  const l = info?.lyrics
  if (!l) return null
  if (l === 'loading')
    return (
      <span className="flex shrink-0 items-center text-white/50" title="Tekst se preuzima" data-lyrics-state="loading">
        <Spinner />
      </span>
    )
  const title = l === 'synced' ? 'Tekst prati pjesmu' : l === 'plain' ? 'Tekst spremljen (bez vremena redova)' : 'Tekst nije spremljen'
  return (
    <span className="shrink-0" title={title} aria-label={title} data-lyrics-state={l} style={{ color: l === 'missing' ? 'rgba(255,255,255,0.22)' : BRAND.gold, opacity: l === 'plain' ? 0.6 : 0.85 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={LINES} />
        {l === 'missing' && <path d="M3 3l18 18" />}
      </svg>
    </span>
  )
}

/**
 * Tekst pjesme u formi stiha: spremljen — pregled (prvi redovi, dodir
 * otvori cio); preuzima se; ili nije — napomena i "Preuzmi tekst", kao za
 * pjesmu. Tekst ide uz pjesmu, pa se preuzima kad je pjesma tu.
 */
export function LyricsRow({
  song,
  info,
  canFetch,
  onFetch,
  onOffset,
}: {
  song: string
  info: Info
  canFetch: boolean
  onFetch: () => void
  /** sačuvaj pomak teksta (sekunde, + = ranije); vrati poruku greške ili null */
  onOffset: (offset: number) => Promise<string | null>
}) {
  const l = info?.lyrics
  const stored = l === 'synced' || l === 'plain'
  const [lines, setLines] = useState<string[] | null>(null)
  const [open, setOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!stored) return
    let on = true
    // svježe sa servera — tekst se upravo mogao spremiti
    fetch(`/api/lyrics/${encodeURIComponent(song)}`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { lines?: string[]; synced?: { l: string }[]; offset?: number } | null) => {
        if (!on) return
        setLines(b ? (b.synced?.length ? b.synced.map((s) => s.l) : (b.lines ?? [])) : [])
        setOffset(b?.offset ?? 0)
      })
      .catch(() => on && setLines([]))
    return () => {
      on = false
    }
  }, [song, stored])

  if (stored) {
    const text = (lines ?? []).filter((x, i, all) => x || (i > 0 && all[i - 1]))
    return (
      <div className="col-span-2 -mt-1 overflow-hidden rounded-xl border border-white/[0.08] bg-black/30" data-lyrics-preview>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px]">
          <span style={{ color: BRAND.gold }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={LINES} />
            </svg>
          </span>
          <span className="text-white/75">Tekst</span>
          <span
            className="rounded-full border px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.12em]"
            style={l === 'synced' ? { borderColor: `${BRAND.gold}66`, color: BRAND.gold } : { borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)' }}
          >
            {l === 'synced' ? 'prati pjesmu' : 'bez vremena'}
          </span>
          <span className="ml-auto tabular text-white/35">{lines ? `${text.filter(Boolean).length} redova` : '…'}</span>
          <motion.svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/40" animate={{ rotate: open ? 180 : 0 }} aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </motion.svg>
        </button>
        {/* prvi redovi, pa cio tekst kad se otvori */}
        <motion.div
          className="relative overflow-hidden px-3"
          initial={false}
          animate={{ height: open ? 'auto' : 58 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className={`pb-3 text-center text-[14px] leading-[1.45] text-white/80 ${open ? 'max-h-72 overflow-y-auto overscroll-contain' : ''}`} style={{ fontFamily: 'var(--font-serif), serif' }}>
            {text.map((x, i) => (x ? <p key={i}>{x}</p> : <div key={i} className="h-2.5" aria-hidden />))}
          </div>
          <AnimatePresence>
            {!open && (
              <motion.span
                className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
                style={{ background: 'linear-gradient(180deg, transparent, rgba(12,11,10,0.95))' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                aria-hidden
              />
            )}
          </AnimatePresence>
        </motion.div>
        {/* bez vremena redova — LRCLIB iznova (zna biti pretrpan pa vrati manje) */}
        {l === 'plain' && canFetch && (
          <div className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-2 text-[11px] text-white/55" data-lyrics-plain>
            <span className="min-w-0 flex-1">Tekst ne prati pjesmu</span>
            <button
              type="button"
              onClick={onFetch}
              data-lyrics-retry
              className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-2.5 text-[11px] text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
              </svg>
              Traži vremena
            </button>
          </div>
        )}
        {/* pomak: kad tekst kasni ili žuri za pjesmom — + svijetli ranije */}
        {l === 'synced' && (
          <div className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-2 text-[11px] text-white/55" data-lyrics-offset>
            <span className="min-w-0 flex-1">Pomak teksta</span>
            {[-0.25, 0.25].map((step) => (
              <button
                key={step}
                type="button"
                disabled={saving}
                onClick={async () => {
                  const next = Math.round((offset + step) * 100) / 100
                  setOffset(next)
                  setSaving(true)
                  if (await onOffset(next)) setOffset(offset)
                  setSaving(false)
                }}
                aria-label={step > 0 ? 'Tekst ranije' : 'Tekst kasnije'}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-white/70 transition-colors hover:bg-white/5 disabled:opacity-40"
                style={{ order: step > 0 ? 2 : 0 }}
              >
                {step > 0 ? '+' : '−'}
              </button>
            ))}
            <span className="tabular w-14 text-center" style={{ order: 1, color: offset ? BRAND.gold : undefined }}>
              {offset > 0 ? '+' : ''}
              {offset.toFixed(2)} s
            </span>
          </div>
        )}
      </div>
    )
  }

  // bez spremljenog teksta — napomena kao za pjesmu
  const ready = info?.state === 'ready'
  return (
    <p className="col-span-2 -mt-1 flex items-center gap-2 text-[11px] text-white/45" data-lyrics-hint>
      <span style={{ color: BRAND.gold }} className="flex">
        {l === 'loading' ? (
          <Spinner />
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={LINES} />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        {l === 'loading' ? 'Tekst se upravo preuzima.' : ready ? 'Tekst još nije spremljen.' : 'Tekst se spremi uz pjesmu, kad se preuzme.'}
      </span>
      {ready && l !== 'loading' && canFetch && (
        <button
          type="button"
          onClick={onFetch}
          data-lyrics-retry
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-2.5 text-[11px] text-white/60 transition-colors hover:bg-white/5 hover:text-white"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
          </svg>
          Preuzmi tekst
        </button>
      )}
    </p>
  )
}
