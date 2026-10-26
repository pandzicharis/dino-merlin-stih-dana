'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
import { albumLine, audioSlug } from '@/lib/text'

/** stanje pjesme iz /api/admin/audio (AdminPanel → useSongs) */
type Info = { state: 'ready' | 'loading' | 'missing' | 'error'; lyrics?: 'synced' | 'plain' | 'missing' | 'loading' } | null
/** rezultat pjesme (lib/song-sync.ts) */
type Item = { song: string; audio: 'wait' | 'run' | 'ok' | 'new' | 'fail'; lyrics: 'wait' | 'run' | 'synced' | 'plain' | 'none' | 'fail'; error?: string }

const GREEN = '#9BCB8E'
const RED = '#E6A4A4'

/**
 * Sinhronizacija (admin → modal): sve pjesme iz baze sa stanjem zvuka i
 * teksta. Filteri "Bez muzike" i "Tekst ne prati", izbor pjesama i jedno
 * dugme — za izabrane se preuzme zvuk koji fali i tekst iznova (LRCLIB,
 * vremena redova). Rezultat svake pjesme se vidi odmah u njenom redu:
 * lokalno dok posao ide, na produkciji provjera teksta odmah, a spremi GitHub.
 */
export function SyncModule({
  verses,
  info,
  onDone,
  flash,
}: {
  verses: Verse[]
  info: (song: string) => Info
  /** stanje pjesama iznova (lista u adminu) */
  onDone: () => void
  flash: (t: string, bad?: boolean) => void
}) {
  // svaka pjesma jednom, po abecedi
  const songs = useMemo(() => {
    const seen = new Map<string, Verse>()
    for (const v of verses) if (audioSlug(v.song) && !seen.has(audioSlug(v.song))) seen.set(audioSlug(v.song), v)
    return [...seen.values()].sort((a, b) => a.song.localeCompare(b.song, 'bs'))
  }, [verses])

  const [noAudio, setNoAudio] = useState(false)
  const [noSync, setNoSync] = useState(false)
  const hasAudio = (v: Verse) => info(v.song)?.state === 'ready'
  const synced = (v: Verse) => info(v.song)?.lyrics === 'synced'

  const [sel, setSel] = useState<Set<string>>(() => new Set())
  const toggle = (k: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  // rezultati: pjesma → stanje posla
  const [items, setItems] = useState<Item[]>([])
  const [running, setRunning] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const result = new Map(items.map((i) => [audioSlug(i.song), i]))
  // samo pjesme kojima nešto fali (muzika ili tekst koji prati) — i one iz zadnje
  // akcije, da im se vidi rezultat i kad su sad potpune
  const lacking = songs.filter((v) => !hasAudio(v) || !synced(v) || result.has(audioSlug(v.song)))
  const shown = lacking.filter((v) => (!noAudio || !hasAudio(v)) && (!noSync || !synced(v)))
  const allOn = shown.length > 0 && shown.every((v) => sel.has(audioSlug(v.song)))

  // lokalno: napredak dok posao ide
  const poll = useRef(0)
  useEffect(() => () => clearTimeout(poll.current), [])
  const follow = () => {
    poll.current = window.setTimeout(async () => {
      const r = await fetch('/api/admin/sync', { cache: 'no-store' }).catch(() => null)
      const b = (await r?.json().catch(() => null)) as { running?: boolean; items?: Item[] } | null
      if (b?.items) setItems(b.items)
      if (b?.running) return follow()
      setRunning(false)
      onDone()
    }, 1200)
  }

  const run = async () => {
    const names = songs.filter((v) => sel.has(audioSlug(v.song))).map((v) => v.song)
    if (!names.length || running) return
    setRunning(true)
    setNote(null)
    setItems(names.map((song) => ({ song, audio: 'wait', lyrics: 'wait' })))
    const r = await fetch('/api/admin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songs: names }),
    }).catch(() => null)
    const b = (await r?.json().catch(() => null)) as { state?: string; items?: Item[]; note?: string; error?: string } | null
    if (!r?.ok || !b) {
      setRunning(false)
      setItems([])
      return flash(b?.error ?? 'Sinhronizacija se nije mogla pokrenuti', true)
    }
    if (b.state === 'started') return follow()
    // produkcija: tekst provjeren odmah, sprema GitHub
    setItems(b.items ?? [])
    setNote(b.note ?? null)
    setRunning(false)
    onDone()
  }

  const done = items.filter((i) => i.lyrics !== 'wait' && i.lyrics !== 'run').length
  const sum = {
    synced: items.filter((i) => i.lyrics === 'synced').length,
    plain: items.filter((i) => i.lyrics === 'plain' || i.lyrics === 'none').length,
    fail: items.filter((i) => i.lyrics === 'fail' || i.audio === 'fail').length,
    audio: items.filter((i) => i.audio === 'new').length,
  }

  return (
    <div className="flex min-h-0 flex-col gap-4" data-sync-module>
      {/* filteri */}
      <div className="flex flex-wrap items-center gap-2">
        <Pill on={noAudio} onClick={() => setNoAudio((x) => !x)} label="Bez muzike" count={lacking.filter((v) => !hasAudio(v)).length} />
        <Pill on={noSync} onClick={() => setNoSync((x) => !x)} label="Tekst ne prati" count={lacking.filter((v) => !synced(v)).length} />
        <button
          type="button"
          onClick={() =>
            setSel((s) => {
              const n = new Set(s)
              for (const v of shown) {
                if (allOn) n.delete(audioSlug(v.song))
                else n.add(audioSlug(v.song))
              }
              return n
            })
          }
          className="ml-auto h-8 rounded-full border border-white/10 px-3 text-[11px] text-white/60 transition-colors hover:bg-white/5 hover:text-white"
        >
          {allOn ? 'Odznači sve' : `Označi sve (${shown.length})`}
        </button>
      </div>

      {/* rezultat akcije — odmah */}
      {items.length > 0 && (
        <div className="rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3 text-[12px] text-white/70" data-sync-result>
          <p className="flex items-center gap-2 font-medium text-white/90">
            {running && <Spinner />}
            {running ? `Sinhronizujem… ${done} / ${items.length}` : `Gotovo · ${items.length} ${songsWord(items.length)}`}
          </p>
          {!running && (
            <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {sum.audio > 0 && <span style={{ color: GREEN }}>Zvuk preuzet: {sum.audio}</span>}
              <span style={{ color: sum.synced ? GREEN : undefined }}>Prati pjesmu: {sum.synced}</span>
              <span>Bez vremena: {sum.plain}</span>
              {sum.fail > 0 && <span style={{ color: RED }}>Greška: {sum.fail}</span>}
            </p>
          )}
          {note && <p className="mt-1.5 text-white/45">{note}</p>}
        </div>
      )}

      {/* pjesme */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/[0.08]">
        {shown.length === 0 && (
          <p className="px-4 py-6 text-center text-[13px] text-white/45">{lacking.length ? 'Nema takvih pjesama' : 'Sve pjesme imaju muziku i tekst koji prati'}</p>
        )}
        {shown.map((v) => {
          const k = audioSlug(v.song)
          const s = info(v.song)
          const r = result.get(k)
          const on = sel.has(k)
          return (
            <label key={k} className="flex cursor-pointer items-center gap-3 border-b border-white/[0.06] px-4 py-2.5 last:border-b-0 hover:bg-white/[0.03]" data-sync-row={k}>
              <input type="checkbox" checked={on} onChange={() => toggle(k)} className="h-4 w-4 shrink-0 accent-[#BFA87F]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-white/90">{v.song}</span>
                <span className="block truncate text-[10.5px] uppercase tracking-[0.16em] text-white/40">{albumLine(v)}</span>
              </span>
              {r ? <Result item={r} /> : <State info={s} />}
            </label>
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-3">
        <span className="text-[12px] text-white/45">{sel.size ? `Izabrano: ${sel.size}` : 'Izaberi pjesme'}</span>
        <button
          type="button"
          onClick={run}
          disabled={!sel.size || running}
          data-sync-go
          className="flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-semibold text-black disabled:opacity-40"
          style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
        >
          {running ? <Spinner dark /> : <SyncGlyph />}
          Sinhronizuj{sel.size ? ` (${sel.size})` : ''}
        </button>
      </div>
    </div>
  )
}

/** 1 pjesma, 2–4 pjesme, 5+ pjesama (i 11–14 pjesama) */
function songsWord(n: number) {
  const d = n % 10
  const h = n % 100
  return d === 1 && h !== 11 ? 'pjesma' : d >= 2 && d <= 4 && (h < 12 || h > 14) ? 'pjesme' : 'pjesama'
}

/** Filter — pilula s brojem. */
function Pill({ on, onClick, label, count }: { on: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] transition-colors"
      style={on ? { borderColor: BRAND.gold, color: '#fff', background: `${BRAND.gold}1f` } : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}
    >
      {label}
      <span className="tabular opacity-60">{count}</span>
    </button>
  )
}

/** Stanje pjesme prije akcije: zvuk i tekst. */
function State({ info }: { info: Info }) {
  const audio = info?.state === 'ready' ? 'ok' : info?.state === 'loading' ? 'run' : 'fail'
  const l = info?.lyrics
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[10.5px]">
      <Chip tone={audio === 'ok' ? 'ok' : audio === 'run' ? 'run' : 'bad'}>{audio === 'ok' ? 'muzika' : audio === 'run' ? 'preuzima se' : 'bez muzike'}</Chip>
      <Chip tone={l === 'synced' ? 'ok' : l === 'loading' ? 'run' : l === 'plain' ? 'mid' : 'bad'}>{l === 'synced' ? 'prati' : l === 'loading' ? 'tekst…' : l === 'plain' ? 'bez vremena' : 'bez teksta'}</Chip>
    </span>
  )
}

/** Rezultat akcije za pjesmu. */
function Result({ item }: { item: Item }) {
  const a = item.audio
  const l = item.lyrics
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[10.5px]" title={item.error}>
      {(a === 'run' || a === 'new' || a === 'fail') && <Chip tone={a === 'new' ? 'ok' : a === 'run' ? 'run' : 'bad'}>{a === 'new' ? 'muzika preuzeta' : a === 'run' ? 'preuzimam…' : 'muzika: greška'}</Chip>}
      <Chip tone={l === 'synced' ? 'ok' : l === 'wait' || l === 'run' ? 'run' : l === 'fail' ? 'bad' : 'mid'}>
        {l === 'synced' ? 'prati ✓' : l === 'run' ? 'tekst…' : l === 'wait' ? 'čeka' : l === 'fail' ? 'tekst: greška' : l === 'plain' ? 'bez vremena' : 'nema teksta'}
      </Chip>
    </span>
  )
}

function Chip({ tone, children }: { tone: 'ok' | 'mid' | 'bad' | 'run'; children: React.ReactNode }) {
  const c = tone === 'ok' ? GREEN : tone === 'bad' ? RED : tone === 'run' ? BRAND.gold : 'rgba(255,255,255,0.55)'
  return (
    <span className="flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-[2px]" style={{ borderColor: `${c}55`, color: c }}>
      {tone === 'run' && <Spinner />}
      {children}
    </span>
  )
}

function Spinner({ dark = false }: { dark?: boolean }) {
  return <span className={`block h-2.5 w-2.5 shrink-0 animate-spin rounded-full border ${dark ? 'border-black' : 'border-current'} border-t-transparent`} aria-hidden />
}

function SyncGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 11a8 8 0 0 0-14.9-3.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.9 3.9L20 16M20 20v-4h-4" />
    </svg>
  )
}
