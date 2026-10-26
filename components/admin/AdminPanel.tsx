'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import type { Verse } from '@/data/verses'
import { MOODS, MOOD_KEYS, type Mood } from '@/data/moods'
import { ALBUMS, albumOf } from '@/data/albums'
import { BRAND } from '@/lib/brand'
import { albumLine, audioSlug, asWritten, sameVerse, youtubeId } from '@/lib/text'
import { inDeck } from '@/lib/deck'
import { PageShell } from '../PageShell'
import { DevicePreview, DeviceSwitch, phoneWidth, useWarmPreview, type Device } from './DevicePreview'
import { PrintSlips } from './PrintSlips'
import { VerseDesigner } from './VerseDesigner'
import { SongEdit, SongPicker, SongPlayer, type KnownSong } from './SongPicker'
import { LyricsBadge, LyricsRow } from './LyricsPreview'
import { audioFile } from '@/lib/audio-name'
import { DrawerIcon } from '../DrawerIcon'
import { Icon, TOAST_BAD, TOAST_OK, toast } from '../Toast'

type AdminVerse = Verse & { active: boolean }
type Snapshot = {
  verses: AdminVerse[]
  source: 'supabase' | 'file' | 'static'
  writable: 'supabase' | 'file' | null
}
type Draft = { text: string; song: string; album: string; description: string; year: string; mood: Mood; youtube: string; font: string }
/** pjesma stiha u aplikaciji (/api/admin/audio) */
type SongInfo = {
  state: 'ready' | 'loading' | 'missing' | 'error'
  error?: string
  /** tekst pjesme (data/lyrics.json): prati pjesmu, običan, nije spremljen, preuzima se */
  lyrics?: 'synced' | 'plain' | 'missing' | 'loading'
}
type SongsSnapshot = { mode: 'local' | 'github' | 'off'; job: string | null; songs: Record<string, SongInfo> }
type Op =
  | { op: 'add'; verse: Draft }
  | { op: 'update'; id: string; verse: Draft }
  | { op: 'archive'; id: string }
  | { op: 'restore'; id: string }

/** stihova po stranici liste */
const PAGE = 10
/** printer — dugme u zaglavlju i znak modala za štampu */
const PRINT_ICON = (
  <>
    <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" />
    <rect x="6" y="14" width="12" height="7" rx="1" />
  </>
)

function oneLine(t: string) {
  return asWritten(t).replace(/\s*\n\s*/g, ' / ')
}

/**
 * Admin: lista stihova. Svako izvlači svoj stih iz aktivnih (lib/draw.ts),
 * pa nema rasporeda ni kalendara — urednik samo dodaje, uređuje, arhivira
 * i vraća. Jednostavno namjerno.
 *
 * Sve izmjene idu kroz `/api/admin/catalog` kao operacije, a odgovor je
 * uvijek novo stanje — ekran nikad ne nagađa šta je server uradio.
 */
export function AdminPanel() {
  const router = useRouter()
  const [data, setData] = useState<Snapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [editor, setEditor] = useState<{ verse?: AdminVerse } | null>(null)
  const [archiving, setArchiving] = useState<AdminVerse | null>(null)
  // papirići za štampu (modal)
  const [printing, setPrinting] = useState(false)
  const [printCount, setPrintCount] = useState(0)
  // pregled u uređivanju se učita unaprijed, u pozadini — otvori se odmah
  useWarmPreview(data?.verses)

  const flash = useCallback((text: string, bad = false) => {
    toast(
      bad
        ? { id: 'admin', title: text, color: TOAST_BAD, icon: <Icon.bad /> }
        : { id: 'admin', title: text, color: TOAST_OK, icon: <Icon.ok /> },
      3200,
    )
  }, [])
  const songs = useSongs(Boolean(data), flash)

  useEffect(() => {
    fetch('/api/admin/catalog', { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) return router.refresh()
        setData((await r.json()) as Snapshot)
      })
      .catch(() => flash('Učitavanje nije uspjelo', true))
  }, [router, flash])

  const send = async (op: Op, ok: string) => {
    if (busy) return false
    setBusy(true)
    // U prezentaciji se izmjena vidi, ali ne ide na server — prava lista
    // ostaje netaknuta. Ponovno učitavanje sve vrati.
    if (inDeck() && data) {
      await new Promise((r) => setTimeout(r, 350))
      setData(applyLocal(data, op))
      flash(ok)
      setBusy(false)
      return true
    }
    try {
      const r = await fetch('/api/admin/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op),
      })
      const body = await r.json().catch(() => ({}))
      if (r.status === 401) {
        router.refresh()
        return false
      }
      if (!r.ok) {
        flash(body.error ?? 'Izmjena nije uspjela', true)
        return false
      }
      setData(body)
      flash(ok)
      return true
    } catch {
      flash('Nema veze sa serverom', true)
      return false
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.refresh()
  }

  const active = data?.verses.filter((v) => v.active).length ?? 0

  return (
    <PageShell
      wide
      back={null}
      eyebrow="Stih dana"
      title="Postavke"
      icon={
        <>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </>
      }
      right={
        <div className="flex items-center gap-2">
        {/* sve iz baze: pjesme i tekstovi koji fale */}
        <SyncButton disabled={!data} flash={flash} onDone={songs.reload} />
        {/* papirići za pult — A4 za štampu na papir u boji */}
        <button
          type="button"
          onClick={() => setPrinting(true)}
          disabled={!data}
          data-print
          className="flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-2 text-[11px] uppercase tracking-[0.16em] text-white/50 transition-colors hover:text-white disabled:opacity-40"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" />
            <rect x="6" y="14" width="12" height="7" rx="1" />
          </svg>
          Štampa
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-2 text-[11px] uppercase tracking-[0.16em] text-white/50 transition-colors hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
            <path d="M10 8l-4 4 4 4M6 12h10" />
          </svg>
          Odjava
        </button>
        </div>
      }
    >
      {!data ? (
        <Skeleton />
      ) : (
        <>
          <Status data={data} />

          <div className="mb-5 flex items-center gap-3">
            {/* koliko je stihova u špilu — iz njih svako izvlači svoj */}
            <div className="min-w-0 flex-1">
              <p className="text-[1.15rem] text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
                Stihovi <span className="tabular text-white/40">· {active}</span>
              </p>
            </div>
            <button
              onClick={() => setEditor({})}
              disabled={!data.writable}
              data-new
              className="flex h-11 shrink-0 items-center gap-2 rounded-full px-5 text-[13px] font-semibold text-black disabled:opacity-40"
              style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
            >
              <span className="text-lg leading-none">+</span> Novi stih
            </button>
          </div>

          <Library data={data} busy={busy} songs={songs} onEdit={(v) => setEditor({ verse: v })} onArchive={setArchiving} onRestore={(v) => send({ op: 'restore', id: v.id }, 'Stih je vraćen u izvlačenje')} />

          <AnimatePresence>
            {printing && (
              <Sheet
                key="print"
                huge
                eyebrow="Magaza · štampa"
                title="Papirići za štampu"
                icon={PRINT_ICON}
                onClose={() => setPrinting(false)}
                actions={
                  <button
                    type="button"
                    // u prezentaciji bez pravog prozora za štampu (iskočio bi na računaru prezentera)
                    onClick={() => (inDeck() ? flash('PDF je spreman — papirici-stih-dana.pdf') : window.print())}
                    disabled={!printCount}
                    data-print-go
                    className="flex h-9 items-center gap-2 rounded-full px-4 text-[12px] font-semibold text-black disabled:opacity-40"
                    style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      {PRINT_ICON}
                    </svg>
                    Štampaj / PDF
                  </button>
                }
              >
                <PrintSlips verses={data.verses} onCount={setPrintCount} />
              </Sheet>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {editor && (
              <Editor
                key="editor"
                initial={editor.verse}
                verses={data.verses}
                songOf={songs.of}
                fetchSong={songs.fetch}
                fetchLyrics={songs.fetchLyrics}
                songsMode={songs.mode}
                onSongSaved={(snap, note) => {
                  setData(snap)
                  songs.reload()
                  flash(note ?? 'Pjesma je sačuvana', Boolean(note))
                }}
                busy={busy}
                onClose={() => setEditor(null)}
                onSave={async (draft) => {
                  if (data.verses.some((v) => v.id !== editor.verse?.id && sameVerse(v, draft)))
                    return flash('Ovaj stih već postoji', true)
                  const ok = editor.verse
                    ? await send({ op: 'update', id: editor.verse.id, verse: draft }, 'Stih je sačuvan')
                    : await send({ op: 'add', verse: draft }, 'Stih je dodan · ulazi u izvlačenje od sutra')
                  if (!ok) return
                  setEditor(null)
                  // pjesma se sprema odmah — dok stih uđe u izvlačenje, pušta se bez čekanja
                  if (draft.youtube.trim() && songs.of(draft.song)?.state !== 'ready') songs.fetch(draft.song, draft.youtube)
                }}
              />
            )}
            {archiving && (
              <Confirm
                key="archive"
                title="Arhivirati stih?"
                tone="danger"
                confirmLabel="Arhiviraj"
                busy={busy}
                onCancel={() => setArchiving(null)}
                onConfirm={async () => {
                  if (await send({ op: 'archive', id: archiving.id }, 'Stih je arhiviran')) setArchiving(null)
                }}
              >
                <p className="text-[15px] leading-snug text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
                  {oneLine(archiving.text)}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: BRAND.gold }}>
                  {archiving.song}
                </p>
                <p className="mt-4 text-[13px] leading-relaxed text-white/50">
                  Više se neće izvlačiti. Ko ga ima danas, ima ga do kraja dana; sačuvani stihovi i linkovi ostaju, a iz
                  arhive ga možeš vratiti kad god želiš.
                </p>
              </Confirm>
            )}
          </AnimatePresence>
        </>
      )}

    </PageShell>
  )
}

/** Izmjena primijenjena samo na ekranu (prezentacija) — isti ishod kao sa servera. */
function applyLocal(s: Snapshot, op: Op): Snapshot {
  let verses = s.verses
  if (op.op === 'add') {
    const { year, youtube, ...rest } = op.verse
    verses = [...verses, { ...rest, id: `novi-${Date.now().toString(36)}`, year: Number(year), ...(youtube ? { youtube } : {}), active: true }]
  } else if (op.op === 'update') {
    const { year, youtube, ...rest } = op.verse
    verses = verses.map((v) => (v.id === op.id ? { ...v, ...rest, year: Number(year), youtube: youtube || undefined } : v))
  } else {
    const on = op.op === 'restore'
    verses = verses.map((v) => (v.id === op.id ? { ...v, active: on } : v))
  }
  return { ...s, verses }
}

/* ── dijelovi ───────────────────────────────────────────────── */

function Status({ data }: { data: Snapshot }) {
  // sve u redu — ništa se ne prikazuje
  if (data.writable === 'supabase') return null
  if (data.writable === 'file') {
    return (
      <p className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-[12px] leading-relaxed text-white/50">
        <b className="font-semibold text-white/75">Demo način.</b> Izmjene se čuvaju lokalno, na ovom računaru. Za
        produkciju se pokreće <code className="text-white/70">supabase/schema.sql</code> i sve ide u bazu.
      </p>
    )
  }
  return (
    <p className="mb-5 rounded-2xl border border-rose-300/20 bg-rose-300/5 p-3.5 text-[12px] leading-relaxed text-rose-100/80">
      Baza nije postavljena — uređivanje je isključeno. Pokreni <code>supabase/schema.sql</code> u Supabase SQL Editoru.
    </p>
  )
}

function Chevron({ dir }: { dir: 'l' | 'r' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d={dir === 'l' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </svg>
  )
}

/* ── pjesme: svaki stih mora imati pjesmu koja se pušta odmah ── */

type Songs = {
  mode: SongsSnapshot['mode'] | null
  of: (song: string) => SongInfo | null
  fetch: (song: string, youtube?: string) => void
  /** preuzmi tekst pjesme sada */
  fetchLyrics: (song: string) => void
  reload: () => void
}

/**
 * Stanje pjesama (lib/audio-files.ts) i preuzimanje. Lokalno se pjesma sprema
 * na ovom računaru, na produkciji je preuzme GitHub (.github/workflows/audio.yml)
 * i Vercel objavi — dok traje, lista pokazuje "preuzima se" i sama se osvježava.
 */
function useSongs(ready: boolean, flash: (t: string, bad?: boolean) => void): Songs {
  const [snap, setSnap] = useState<SongsSnapshot | null>(null)
  // poslano maloprije: GitHubu treba par sekundi da uopšte prijavi posao
  const [pending, setPending] = useState<Record<string, number>>({})
  // i tekstovi (lokalno par sekundi, na produkciji dok GitHub ne objavi)
  const [pendingLyrics, setPendingLyrics] = useState<Record<string, number>>({})
  const load = useCallback(async () => {
    const r = await fetch('/api/admin/audio', { cache: 'no-store' }).catch(() => null)
    if (r?.ok) setSnap((await r.json()) as SongsSnapshot)
  }, [])
  // u prezentaciji se stanje samo čita (znak ♪ u listi) — ništa se ne preuzima
  const live = ready && !inDeck()
  useEffect(() => {
    if (ready) void load()
  }, [ready, load])

  const of = useCallback(
    (song: string): SongInfo | null => {
      const k = audioSlug(song)
      const s = snap?.songs[k] ?? null
      const lyrics = pendingLyrics[k] && Date.now() - pendingLyrics[k] < 90_000 && s?.lyrics === 'missing' ? 'loading' : s?.lyrics
      if (s?.state === 'ready') return { ...s, lyrics }
      if (pending[k] && Date.now() - pending[k] < 90_000) return { state: 'loading', lyrics }
      return s && { ...s, lyrics }
    },
    [snap, pending, pendingLyrics],
  )

  // dok se nešto sprema, pitaj ponovo (lokalno brzo, GitHub sporije)
  const busy =
    Boolean(snap) &&
    (Object.values(snap!.songs).some((s) => s.state === 'loading' || s.lyrics === 'loading') ||
      Object.keys(pending).length > 0 ||
      Object.keys(pendingLyrics).length > 0)
  useEffect(() => {
    if (!live || !busy) return
    const t = setTimeout(() => {
      setPending((p) => Object.fromEntries(Object.entries(p).filter(([k, at]) => Date.now() - at < 90_000 && snap?.songs[k]?.state !== 'ready')))
      setPendingLyrics((p) => Object.fromEntries(Object.entries(p).filter(([k, at]) => Date.now() - at < 90_000 && snap?.songs[k]?.lyrics === 'missing')))
      void load()
    }, snap?.mode === 'local' ? 2000 : 7000)
    return () => clearTimeout(t)
  }, [live, busy, snap, load])

  const fetchSong = useCallback(
    async (song: string, youtube?: string) => {
      if (!live || !song.trim()) return
      const k = audioSlug(song)
      setPending((p) => ({ ...p, [k]: Date.now() }))
      const r = await fetch('/api/admin/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song, youtube }),
      }).catch(() => null)
      if (!r?.ok) {
        setPending(({ [k]: _drop, ...p }) => (void _drop, p))
        flash(((await r?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Pjesma se nije mogla pokrenuti', true)
      }
      void load()
    },
    [live, load, flash],
  )

  const fetchLyrics = useCallback(
    async (song: string) => {
      if (!live || !song.trim()) return
      const k = audioSlug(song)
      setPendingLyrics((p) => ({ ...p, [k]: Date.now() }))
      const r = await fetch('/api/admin/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song }),
      }).catch(() => null)
      if (!r?.ok) {
        setPendingLyrics(({ [k]: _drop, ...p }) => (void _drop, p))
        flash(((await r?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Tekst se nije mogao pokrenuti', true)
      }
      void load()
    },
    [live, load, flash],
  )

  return { mode: snap?.mode ?? null, of, fetch: fetchSong, fetchLyrics, reload: () => void load() }
}

type SyncSnap = {
  mode: 'local' | 'github' | 'off'
  songs: number
  audio: number
  lyrics: number
  synced: number
  running: boolean
  done: number
  total: number
  current: string | null
  failed: string[]
}

/**
 * Sinhronizuj: svaka pjesma iz baze dobije zvuk i tekst (lib/catalog-sync.ts).
 * Lokalno se vidi napredak (3/25); na produkciji posao preuzme GitHub.
 * Zlatna tačka: nekoj pjesmi fali zvuk ili tekst.
 */
function SyncButton({ disabled, flash, onDone }: { disabled: boolean; flash: (t: string, bad?: boolean) => void; onDone: () => void }) {
  const [s, setS] = useState<SyncSnap | null>(null)
  // svako povećanje = stanje iznova sa servera
  const [ask, setAsk] = useState(0)
  useEffect(() => {
    if (disabled) return
    let on = true
    fetch('/api/admin/sync', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<SyncSnap>) : null))
      .then((b) => on && b && setS(b))
      .catch(() => {})
    return () => {
      on = false
    }
  }, [disabled, ask])
  // dok radi — napredak svake sekunde i po; na kraju poruka (onDone je nov u svakom crtanju — preko refa)
  const was = useRef(false)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    if (!s) return
    if (s.running) {
      was.current = true
      const t = setTimeout(() => setAsk((n) => n + 1), 1500)
      return () => clearTimeout(t)
    }
    if (!was.current) return
    was.current = false
    flash(s.failed.length ? `Sinhronizovano · fali ${s.failed.length}` : 'Sve sinhronizovano', s.failed.length > 0)
    done.current()
  }, [s, flash])

  const running = Boolean(s?.running)
  const missing = s ? Math.max(s.songs - s.audio, s.songs - s.lyrics) : 0
  const start = async () => {
    if (running) return
    if (inDeck()) return flash('U prezentaciji se pjesme ne mijenjaju.')
    const r = await fetch('/api/admin/sync', { method: 'POST' }).catch(() => null)
    const body = (await r?.json().catch(() => null)) as { state?: string; error?: string } | null
    if (!r?.ok) return flash(body?.error ?? 'Sinhronizacija nije pokrenuta', true)
    if (body?.state === 'github') flash('Pokrenuto — stiže za par minuta')
    setAsk((n) => n + 1)
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled || s?.mode === 'off'}
      aria-busy={running}
      title={s ? `Pjesme ${s.audio}/${s.songs} · tekstovi ${s.lyrics}/${s.songs}` : undefined}
      data-sync
      className="relative flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-2 text-[11px] uppercase tracking-[0.16em] text-white/50 transition-colors hover:text-white disabled:opacity-40"
      style={running ? { color: BRAND.gold, borderColor: `${BRAND.gold}55` } : undefined}
    >
      <motion.svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ rotate: running ? 360 : 0 }}
        transition={running ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0.3 }}
        aria-hidden
      >
        <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
      </motion.svg>
      <span className="tabular">{running ? `${s!.done}/${s!.total}` : 'Sinhronizuj'}</span>
      {!running && missing > 0 && <i className="absolute right-1.5 top-1.5 block h-1.5 w-1.5 rounded-full" style={{ background: BRAND.gold }} aria-label={`Fali ${missing}`} />}
    </button>
  )
}

/** Desno u boxu stiha: pjesma se preuzima, ili nije preuzeta (natpis + ponovi). */
function SongIssue({ info, mode, onRetry }: { info: SongInfo | null; mode: Songs['mode']; onRetry: () => void }) {
  if (!info || info.state === 'ready') return null
  if (info.state === 'loading') {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-white/50" data-song-state="loading">
        <motion.span
          className="block h-2.5 w-2.5 rounded-full border border-current border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          aria-hidden
        />
        <span className="hidden sm:inline">{mode === 'github' ? 'pjesma se objavljuje…' : 'preuzimam pjesmu…'}</span>
      </span>
    )
  }
  // bez pjesme stih ne ulazi u izvlačenje (lib/draw.ts) — plejer bi bio nijem
  const hint = `${info.error ?? (mode === 'off' ? 'Na računaru: npm run audio, pa push.' : 'Pjesma još nije u aplikaciji.')} Dok ne stigne, stih se ne izvlači.`
  return (
    <span className="flex shrink-0 items-center gap-1" data-song-state={info.state}>
      <span
        title={hint}
        className="rounded-full border border-rose-300/25 bg-rose-300/[0.07] px-2 py-0.5 text-[10px] text-rose-200/85"
      >
        <span className="sm:hidden">ne izvlači se</span>
        <span className="hidden sm:inline">{info.state === 'error' ? 'pjesma nije preuzeta' : 'bez pjesme'} · ne izvlači se</span>
      </span>
      {mode !== 'off' && (
        <button
          type="button"
          onClick={onRetry}
          title="Preuzmi ponovo"
          aria-label="Preuzmi pjesmu ponovo"
          data-song-retry
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/5 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
          </svg>
        </button>
      )}
    </span>
  )
}

/** Mala oznaka uz naziv pjesme: spremna, preuzima se, ili fali (s dugmetom). */
function SongBadge({ info, mode, onFetch }: { info: SongInfo | null; mode: Songs['mode']; onFetch: () => void }) {
  if (!info) return null
  if (info.state === 'ready') {
    return (
      <span title="Pjesma je u aplikaciji — pušta se odmah" className="shrink-0 opacity-70" style={{ color: BRAND.gold }} aria-label="Pjesma spremna">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M9 18.5a3 3 0 1 1-2-2.83V5l12-2v12.5a3 3 0 1 1-2-2.83V7.3L9 8.6z" />
        </svg>
      </span>
    )
  }
  if (info.state === 'loading') {
    return (
      <span className="flex shrink-0 items-center gap-1.5 normal-case tracking-normal text-white/55" data-song-state="loading">
        <motion.span
          className="block h-2.5 w-2.5 rounded-full border border-current border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          aria-hidden
        />
        {mode === 'github' ? 'pjesma se objavljuje…' : 'preuzimam pjesmu…'}
      </span>
    )
  }
  const hint = info.error ?? (mode === 'off' ? 'Na računaru: npm run audio, pa push.' : 'Pjesma još nije u aplikaciji.')
  return (
    <span className="flex shrink-0 items-center gap-1.5 normal-case tracking-normal" title={hint} data-song-state={info.state}>
      <span className="text-rose-200/80">{info.state === 'error' ? 'pjesma nije preuzeta' : 'bez pjesme'}</span>
      {mode !== 'off' && (
        <button
          type="button"
          onClick={onFetch}
          className="rounded-full border px-2 py-[1px] text-[10px] transition-colors hover:bg-white/5"
          style={{ borderColor: `${BRAND.gold}66`, color: BRAND.gold }}
        >
          {info.state === 'error' ? 'Ponovo' : 'Preuzmi'}
        </button>
      )}
    </span>
  )
}

function Library({
  data,
  busy,
  songs,
  onEdit,
  onArchive,
  onRestore,
}: {
  data: Snapshot
  busy: boolean
  songs: Songs
  onEdit: (v: AdminVerse) => void
  onArchive: (v: AdminVerse) => void
  onRestore: (v: AdminVerse) => void
}) {
  const [q, setQ] = useState('')
  const [mood, setMood] = useState<Mood | null>(null)
  // filter po pjesmi: ima li stih pjesmu u aplikaciji (♪) ili ne
  const [withSong, setWithSong] = useState<boolean | null>(null)
  const hasSong = (v: AdminVerse) => songs.of(v.song)?.state === 'ready'
  const [archived, setArchived] = useState(false)
  const [page, setPage] = useState(0)
  const writable = Boolean(data.writable)

  const list = data.verses
    .filter(
      (v) =>
        v.active !== archived &&
        (!mood || v.mood === mood) &&
        (withSong == null || hasSong(v) === withSong) &&
        (!q || `${v.text} ${v.song} ${v.album}`.toLowerCase().includes(q.toLowerCase())),
    )
    // najnoviji prvi — to je ono što urednik najčešće traži
    .reverse()
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const p = Math.min(page, pages - 1)
  const shown = list.slice(p * PAGE, p * PAGE + PAGE)
  // nova stranica počinje od vrha liste
  const listRef = useRef<HTMLDivElement>(null)
  const go = (n: number) => {
    setPage(n)
    listRef.current?.scrollTo({ top: 0 })
  }
  const archivedCount = data.verses.filter((v) => !v.active).length

  return (
    <>
      {/* aktivni / arhiva — jasno, kao dvije kartice, a ne skriven prekidač */}
      <div className="mb-3 grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.035] p-1 backdrop-blur-xl">
        {(
          [
            [false, 'Aktivni', data.verses.length - archivedCount],
            [true, 'Arhiva', archivedCount],
          ] as const
        ).map(([isArchive, label, n]) => {
          const on = archived === isArchive
          return (
            <button
              key={label}
              data-scope={isArchive ? 'archive' : 'active'}
              onClick={() => {
                setArchived(isArchive)
                setPage(0)
              }}
              className="relative h-9 rounded-full text-[12px] font-medium transition-colors"
              style={{ color: on ? '#14100A' : 'rgba(255,255,255,0.6)' }}
            >
              {on && (
                <motion.span
                  layoutId="library-scope"
                  className="absolute inset-0 rounded-full"
                  style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
                />
              )}
              {isArchive ? (
                // arhiva: mali bedž s brojem, samo kad u njoj nešto ima
                <span className="relative inline-flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 7h16v3H4zM6 10v9h12v-9M10 14h4" />
                  </svg>
                  {label}
                  {n > 0 && (
                    <span
                      className="tabular inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-[3px] text-[8.5px] font-semibold leading-none"
                      style={
                        on
                          ? { background: 'rgba(20,16,10,0.85)', color: BRAND.gold }
                          : { background: `${BRAND.gold}33`, color: BRAND.gold, boxShadow: `inset 0 0 0 1px ${BRAND.gold}55` }
                      }
                    >
                      {n}
                    </span>
                  )}
                </span>
              ) : (
                <span className="relative">
                  {label} <span className="opacity-60">· {n}</span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setPage(0)
        }}
        placeholder="Traži stih, pjesmu ili album…"
        data-search
        className="mb-3 h-10 w-full rounded-full border border-white/10 bg-black/30 px-4 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[#BFA87F]/50"
      />

      {/* raspoloženja u jednom redu — na uskom ekranu klize vodoravno */}
      <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
        {MOOD_KEYS.map((k) => (
          <button
            key={k}
            data-filter={k}
            aria-pressed={mood === k}
            onClick={() => {
              setMood(mood === k ? null : k)
              setPage(0)
            }}
            className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[11px] transition-colors"
            style={{
              borderColor: mood === k ? MOODS[k].accent : 'rgba(255,255,255,0.08)',
              color: mood === k ? '#fff' : 'rgba(255,255,255,0.5)',
              background: mood === k ? `${MOODS[k].accent}14` : 'transparent',
            }}
          >
            <i className="block h-2 w-2 rounded-full" style={{ background: MOODS[k].accent }} />
            {MOODS[k].label}
          </button>
        ))}
        {/* pjesma: s njom / bez nje — tek kad je stanje pjesama stiglo */}
        {songs.mode && (
          <>
            <span className="mx-1 w-px shrink-0 self-stretch bg-white/10" aria-hidden />
            {(
              [
                [true, 'S pjesmom'],
                [false, 'Bez pjesme'],
              ] as const
            ).map(([k, label]) => {
              const on = withSong === k
              const n = data.verses.filter((v) => v.active !== archived && hasSong(v) === k).length
              return (
                <button
                  key={label}
                  data-song-filter={k ? 'with' : 'without'}
                  aria-pressed={on}
                  onClick={() => {
                    setWithSong(on ? null : k)
                    setPage(0)
                  }}
                  className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[11px] transition-colors"
                  style={{
                    borderColor: on ? BRAND.gold : 'rgba(255,255,255,0.08)',
                    color: on ? '#fff' : 'rgba(255,255,255,0.5)',
                    background: on ? `${BRAND.gold}14` : 'transparent',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill={k ? BRAND.gold : 'none'} stroke={k ? 'none' : 'currentColor'} strokeWidth="2" aria-hidden>
                    <path d="M9 18.5a3 3 0 1 1-2-2.83V5l12-2v12.5a3 3 0 1 1-2-2.83V7.3L9 8.6z" />
                  </svg>
                  {label}
                  <span className="tabular opacity-60">{n}</span>
                </button>
              )
            })}
          </>
        )}
      </div>

      {/* lista ima svoju visinu i skrola se unutra — filteri i kartice ostaju na mjestu */}
      <div
        ref={listRef}
        className="relative max-h-[min(62dvh,640px)] overflow-y-auto overscroll-contain rounded-[20px] border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
      >
        {/* izmjena ide na server — tanka zlatna traka dok traje */}
        {busy && <LoadBar />}
        <motion.div key={`${p}-${archived}-${mood}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
        {shown.map((v, i) => {
          const m = MOODS[v.mood]
          // klik na stih (bilo gdje na kartici) otvara uređivanje — dugmad unutra rade svoje
          const editable = writable && !archived && !busy
          return (
            <div
              key={v.id}
              role={editable ? 'button' : undefined}
              tabIndex={editable ? 0 : undefined}
              aria-label={editable ? `Uredi: ${oneLine(v.text)}` : undefined}
              onClick={(e) => {
                if (editable && !(e.target as Element).closest('button, a, input, label')) onEdit(v)
              }}
              onKeyDown={(e) => {
                if (editable && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onEdit(v)
                }
              }}
              className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] sm:gap-4 ${editable ? 'cursor-pointer' : ''}`}
              style={{ borderTop: i ? '1px solid rgba(255,255,255,0.05)' : undefined }}
            >
              <i className="block h-9 w-1 shrink-0 rounded-full" style={{ background: m.accent }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
                  {oneLine(v.text)}
                </p>
                <p className="mt-1 flex min-w-0 items-center gap-2 text-[10px] uppercase tracking-[0.14em]">
                  <span className="shrink-0" style={{ color: BRAND.gold }}>{v.song}</span>
                  {songs.of(v.song)?.state === 'ready' && <SongBadge info={songs.of(v.song)} mode={songs.mode} onFetch={() => {}} />}
                  {/* tekst: spremljen (prati pjesmu / bez vremena), preuzima se, ili nije */}
                  {songs.of(v.song)?.state === 'ready' && <LyricsBadge info={songs.of(v.song)} />}
                  <span className="truncate">
                  <span className="text-white/30">
                    {albumLine(v)}
                  </span>
                  </span>
                </p>
              </div>
              {/* pjesma koja nije preuzeta: natpis i diskretno dugme, pored ikonica */}
              {v.youtube ? (
                <SongIssue info={songs.of(v.song)} mode={songs.mode} onRetry={() => songs.fetch(v.song, v.youtube)} />
              ) : (
                // bez linka — ispod stiha je samo naziv pjesme, bez plejera
                <span
                  title="Bez YouTube linka — ispod stiha samo naziv pjesme i album"
                  className="shrink-0 rounded-full border border-amber-200/25 bg-amber-200/[0.07] px-2 py-0.5 text-[10px] text-amber-100/80"
                  data-no-link
                >
                  <span className="sm:hidden">bez linka</span>
                  <span className="hidden sm:inline">bez YouTube linka</span>
                </span>
              )}
              {writable && (
                <div className="flex shrink-0 gap-1">
                  {!archived && (
                    <IconBtn label="Uredi" disabled={busy} onClick={() => onEdit(v)}>
                      <path d="M4 20h4L19 9l-4-4L4 16z" />
                    </IconBtn>
                  )}
                  {archived ? (
                    <button
                      onClick={() => onRestore(v)}
                      disabled={busy}
                      className="h-8 whitespace-nowrap rounded-full border px-3 text-[11px] font-medium transition-colors hover:bg-white/5 disabled:opacity-40"
                      style={{ borderColor: `${BRAND.gold}66`, color: BRAND.gold }}
                    >
                      Vrati
                    </button>
                  ) : (
                    <IconBtn label="Arhiviraj" disabled={busy} onClick={() => onArchive(v)}>
                      <path d="M4 7h16v3H4zM6 10v9h12v-9M10 14h4" />
                    </IconBtn>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {shown.length === 0 && (
          <p className="py-12 text-center text-[13px] text-white/40">
            {archived && !archivedCount ? 'Arhiva je prazna.' : 'Ništa ne odgovara pretrazi.'}
          </p>
        )}
        </motion.div>
      </div>

      {/* stranice: koliko je prikazano, pa brojevi (s … kad ih je mnogo) */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3 text-[12px] text-white/50">
          <span className="tabular">
            {p * PAGE + 1}–{Math.min(list.length, p * PAGE + PAGE)} od {list.length}
          </span>
          <span className="flex items-center gap-1">
            <button
              onClick={() => go(p - 1)}
              disabled={p === 0}
              aria-label="Prethodna strana"
              data-page-prev
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 transition-colors hover:bg-white/5 disabled:opacity-25"
            >
              <Chevron dir="l" />
            </button>
            {pageNumbers(p, pages).map((n, i) =>
              n < 0 ? (
                <span key={`gap-${i}`} className="w-5 text-center text-white/30">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  onClick={() => go(n)}
                  aria-current={n === p ? 'page' : undefined}
                  data-page={n + 1}
                  className="tabular flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[12px] font-medium transition-colors"
                  style={
                    n === p
                      ? { background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})`, color: '#14100A' }
                      : { border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }
                  }
                >
                  {n + 1}
                </button>
              ),
            )}
            <button
              onClick={() => go(p + 1)}
              disabled={p >= pages - 1}
              aria-label="Sljedeća strana"
              data-page-next
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 transition-colors hover:bg-white/5 disabled:opacity-25"
            >
              <Chevron dir="r" />
            </button>
          </span>
        </div>
      )}
    </>
  )
}

/** Brojevi stranica oko trenutne; -1 je "…". */
function pageNumbers(p: number, pages: number): number[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i)
  const out = [0]
  const from = Math.max(1, Math.min(p - 1, pages - 4))
  const to = Math.min(pages - 2, Math.max(p + 1, 3))
  if (from > 1) out.push(-1)
  for (let i = from; i <= to; i++) out.push(i)
  if (to < pages - 2) out.push(-1)
  out.push(pages - 1)
  return out
}

/** Tanka zlatna traka koja putuje — nešto se radi na serveru. */
function LoadBar() {
  return (
    <span className="pointer-events-none absolute inset-x-0 top-0 z-10 block h-[2px] overflow-hidden rounded-t-[20px]" aria-hidden>
      <motion.span
        className="absolute inset-y-0 block w-1/3"
        style={{ background: `linear-gradient(90deg, transparent, ${BRAND.gold}, transparent)` }}
        animate={{ left: ['-35%', '100%'] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
      />
    </span>
  )
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-20"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  )
}

/**
 * Donji panel admina — isti kao paneli za dijeljenje i sačuvane: zlatna nit
 * gore, ručka, okruglo dugme za zatvaranje, i povlačenje nadolje za zatvaranje
 * (hvata se za zaglavlje, da skrolanje forme ne vuče panel).
 */
function Sheet({
  onClose,
  children,
  title,
  eyebrow = 'Stih dana',
  wide = false,
  huge = false,
  icon,
  actions,
  lead,
  aside,
  cols,
}: {
  onClose: () => void
  children: React.ReactNode
  title: string
  eyebrow?: string
  wide?: boolean
  /** veliki modal skoro preko cijelog ekrana (štampa) */
  huge?: boolean
  /** znak u zaglavlju, kao na drawerima (putanje za DrawerIcon) */
  icon?: React.ReactNode
  /** dugmad u zaglavlju, lijevo od zatvaranja */
  actions?: React.ReactNode
  /** dugmad uz desnu ivicu lijeve kolone (forma stiha) — zaglavlje ima iste kolone kao sadržaj */
  lead?: React.ReactNode
  /** lijevo iznad desne kolone (prekidač uređaja) */
  aside?: React.ReactNode
  /** kolone zaglavlja = kolone sadržaja (CSS grid-template-columns), da se ivice poklope */
  cols?: string
}) {
  const drag = useDragControls()
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <motion.div
      className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <button aria-label="Zatvori" className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[30px] border border-white/10 shadow-[0_-20px_80px_rgba(0,0,0,0.7)] sm:rounded-[30px] ${huge ? 'h-[94dvh] max-h-[94dvh] max-w-[min(1500px,96vw)]' : wide ? 'max-w-6xl' : 'max-w-[440px]'}`}
        style={{
          background: `radial-gradient(120% 60% at 50% 0%, ${BRAND.gold}1a 0%, transparent 60%), linear-gradient(180deg, #121010 0%, #0a0909 100%)`,
        }}
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 48, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        drag="y"
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 90 || info.velocity.y > 600) onClose()
        }}
      >
        <span
          className="pointer-events-none absolute inset-x-10 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${BRAND.gold}80, transparent)` }}
          aria-hidden
        />
        <div
          className="shrink-0 cursor-grab touch-none px-5 pt-3 active:cursor-grabbing"
          onPointerDown={(e) => drag.start(e)}
        >
          <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/15 sm:hidden" aria-hidden />
          <div
            className={`mb-4 flex items-center justify-between gap-3 ${cols ? 'md:grid md:grid-cols-[var(--cols)] md:gap-8' : ''}`}
            style={cols ? ({ '--cols': cols } as React.CSSProperties) : undefined}
          >
            <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {icon && <DrawerIcon>{icon}</DrawerIcon>}
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.28em]" style={{ color: BRAND.gold }}>
                  {eyebrow}
                </p>
                <p className="text-[1.1rem] text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
                  {title}
                </p>
              </div>
            </div>
            {lead && (
              <div className="hidden md:flex" onPointerDown={(e) => e.stopPropagation()}>
                {lead}
              </div>
            )}
            </div>
            <div className="flex min-w-0 items-center justify-end gap-2" onPointerDown={(e) => e.stopPropagation()}>
            {aside && <div className="mr-auto hidden md:flex">{aside}</div>}
            {/* na uskom ekranu ostala dugmad idu u red ispod — gore samo naslov i X */}
            <div className={`${lead || aside ? 'hidden md:flex' : 'flex'} items-center gap-2`}>{actions}</div>
            <button
              onClick={onClose}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Zatvori"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
            </div>
          </div>
          {(lead || aside) && (
            <div className="mb-4 mt-1 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3 md:hidden" onPointerDown={(e) => e.stopPropagation()}>
              {lead}
              {aside}
              {actions}
            </div>
          )}
        </div>
        <div className={`overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] ${huge ? 'flex min-h-0 flex-1 flex-col' : ''}`}>
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}

function Editor({
  initial,
  verses,
  songOf,
  fetchSong,
  fetchLyrics,
  songsMode,
  onSongSaved,
  busy,
  onClose,
  onSave,
}: {
  initial?: AdminVerse
  /** postojeći stihovi — ista pjesma donosi svoj link, album i godinu */
  verses: AdminVerse[]
  songOf: Songs['of']
  /** preuzmi pjesmu sada (ponovni pokušaj iz forme) */
  fetchSong: Songs['fetch']
  /** preuzmi tekst pjesme sada */
  fetchLyrics: Songs['fetchLyrics']
  songsMode: Songs['mode']
  /** pjesma preimenovana (lista pjesama → olovka) — nova lista stihova */
  onSongSaved: (snap: Snapshot, note: string | null) => void
  busy: boolean
  onClose: () => void
  onSave: (d: Draft) => void
}) {
  // forma s historijom: nazad / naprijed (dugmad u zaglavlju, ⌘Z / ⇧⌘Z)
  const history = useHistory<Draft>({
    text: initial?.text ?? '',
    song: initial?.song ?? '',
    album: initial?.album ?? '',
    description: initial?.description ?? '',
    year: String(initial?.year ?? ''),
    mood: initial?.mood ?? 'nostalgija',
    youtube: initial?.youtube ?? '',
    font: initial?.font ?? '',
  })
  const d = history.now
  const setD = history.set
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z' || k === 'y') {
        e.preventDefault()
        if (k === 'y' || e.shiftKey) history.redo()
        else history.undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history])

  // Na računaru pregled prati skrolanje: visok je koliko vidljivi dio
  // prozora (ili forma, ako je kraća) i ostaje pored onoga što se uređuje —
  // na dnu forme mu je dno poravnato sa zadnjim elementom. Forma ima svoju
  // visinu, pregled se samo prilagodi — nikad obrnuto, da se ne vrte u krug.
  const [wide, setWide] = useState(false)
  const [full, setFull] = useState(false)
  const [device, setDevice] = useState<Device>('phone')
  const formRef = useRef<HTMLFormElement>(null)
  const [formH, setFormH] = useState(0)
  const [viewH, setViewH] = useState(0)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const sync = () => setWide(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    const form = formRef.current
    const scroller = form?.closest<HTMLElement>('.overflow-y-auto')
    const ro = new ResizeObserver(() => {
      if (form) setFormH(form.getBoundingClientRect().height)
      if (scroller) setViewH(scroller.clientHeight - parseFloat(getComputedStyle(scroller).paddingBottom || '0'))
    })
    if (form) ro.observe(form)
    if (scroller) ro.observe(scroller)
    return () => {
      mq.removeEventListener('change', sync)
      ro.disconnect()
    }
  }, [])
  // brojači uz stih — ista pravila kao validacija na serveru (lib/catalog.ts)
  const lines = d.text.split('\n').map((l) => l.trim()).filter(Boolean)
  const chars = lines.join('\n').length
  const album = albumOf(d.album)
  // ono što ide u pregled — isti oblik kao pravi stih
  const preview = useMemo<Verse>(
    () => ({
      id: initial?.id ?? 'pregled',
      text: d.text.trim() || 'Ovdje se vidi stih…',
      song: d.song.trim() || 'Pjesma',
      album: d.album.trim(),
      ...(d.description.trim() ? { description: d.description.trim() } : {}),
      year: Number(d.year) || new Date().getFullYear(),
      mood: d.mood,
      ...(d.youtube.trim() ? { youtube: d.youtube.trim() } : {}),
      ...(d.font ? { font: d.font } : {}),
    }),
    [d, initial?.id],
  )
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setD({ ...d, [k]: e.target.value }, k)
  // više stihova je iz iste pjesme: poznata pjesma popuni link, album i godinu
  const knownSongs = useMemo(() => {
    const m = new Map<string, AdminVerse>()
    for (const v of verses) if (v.youtube && !m.has(audioSlug(v.song))) m.set(audioSlug(v.song), v)
    return m
  }, [verses])
  const setSong = (song: string) => {
    const known = knownSongs.get(audioSlug(song))
    setD({
      ...d,
      song,
      ...(known && !d.youtube.trim() ? { youtube: known.youtube! } : {}),
      ...(known && !d.album ? { album: known.album, description: known.description ?? d.description, year: String(known.year) } : {}),
    }, 'song')
  }
  // link nove pjesme stigne sa dinomerlin.com poslije izbora — samo ako je pjesma
  // i dalje ta, a polje prazno
  const latest = useRef(d)
  useEffect(() => {
    latest.current = d
  })
  const setLink = (song: string, youtube: string) => {
    const cur = latest.current
    if (audioSlug(cur.song) === audioSlug(song) && !cur.youtube.trim()) setD({ ...cur, youtube }, 'song')
  }
  const song = d.song.trim() ? songOf(d.song) : null
  // uredi pjesmu iz liste: naziv i ime fajla
  const [editSong, setEditSong] = useState<KnownSong | null>(null)
  const saveSong = async (s: KnownSong, to: string, file: string): Promise<string | null> => {
    if (inDeck()) return 'U prezentaciji se pjesme ne mijenjaju.'
    const r = await fetch('/api/admin/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: s.song, to, file }),
    }).catch(() => null)
    const body = (await r?.json().catch(() => null)) as (Snapshot & { note?: string | null; error?: string }) | null
    if (!r?.ok || !body) return body?.error ?? 'Pjesma nije sačuvana.'
    // pjesma u formi je baš ova — i ona dobije novi naziv
    if (audioSlug(d.song) === audioSlug(s.song)) setD({ ...d, song: to })
    onSongSaved(body, body.note ?? null)
    setEditSong(null)
    return null
  }
  // telefon: forma široka, telefon skroz desno (kolona tačno njegove širine);
  // računar: pregledu treba prostora, forma se suzi
  const previewH = wide && formH ? Math.min(formH, viewH || formH) : 460
  const cols = device === 'phone' ? `minmax(0,1fr) ${Math.max(300, phoneWidth(previewH))}px` : 'minmax(0,0.85fr) minmax(0,1.15fr)'
  const field =
    'h-12 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 text-[14px] normal-case tracking-normal text-white outline-none placeholder:text-white/25 focus:border-[#BFA87F]/60'
  const labelCls = 'block text-[11px] uppercase tracking-[0.16em] text-white/45'

  return (
    <Sheet
      wide
      onClose={onClose}
      title={initial ? 'Uredi stih' : 'Novi stih'}
      icon={initial ? <path d="M4 20h4L19 9l-4-4L4 16z" /> : <path d="M12 5v14M5 12h14" />}
      // nazad / naprijed: u zaglavlju, uz desnu ivicu forme
      lead={
        <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.04] p-0.5">
          {(
            [
              ['undo', 'Nazad (⌘Z)', history.canUndo, history.undo, 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
              ['redo', 'Naprijed (⇧⌘Z)', history.canRedo, history.redo, 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13'],
            ] as const
          ).map(([k, label, on, run, path]) => (
            <button
              key={k}
              type="button"
              onClick={run}
              disabled={!on}
              title={label}
              aria-label={label}
              {...{ [`data-${k}`]: '' }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={path} />
              </svg>
            </button>
          ))}
        </span>
      }
      // iznad pregleda: uređaj lijevo, puni pregled i zatvaranje desno
      aside={<DeviceSwitch device={device} onDevice={setDevice} />}
      cols={cols}
      actions={
        <button
          type="button"
          onClick={() => setFull(true)}
          title="Puni pregled"
          aria-label="Puni pregled"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/75 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
      }
    >
      <div
        className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[var(--cols)] md:items-start"
        style={{ '--cols': cols } as React.CSSProperties}
      >
      {/* Pregled: pravi ekran aplikacije u istom okviru kao u prezentaciji
          (iPhone, ili prozor preglednika). Na telefonu iznad forme; na
          računaru desno, bez okvira oko njega — uređaj je sam svoj okvir. */}
      <div className="min-w-0 md:sticky md:top-0 md:order-2">
        <div className="flex flex-col items-center justify-center rounded-3xl bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.045),transparent_70%)]">
          <DevicePreview verse={preview} maxHeight={previewH} full={full} onFull={setFull} device={device} />
        </div>
      </div>
      <form
        ref={formRef}
        className="flex min-w-0 flex-col gap-6 md:gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          onSave(d)
        }}
      >
        {/* stih — veliko polje u slovima stiha, s brojačima ispod */}
        <label className="block">
          <span className={labelCls}>
            Stih <span className="normal-case tracking-normal text-white/30">— novi red kako se pjeva</span>
          </span>
          <textarea
            name="text"
            value={d.text}
            onChange={set('text')}
            rows={3}
            required
            placeholder={'Kako da ti kažem\nkoliko mi značiš'}
            className="mt-2 min-h-[150px] w-full resize-none md:min-h-0 rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-[21px] leading-snug text-white outline-none placeholder:text-white/20 focus:border-[#BFA87F]/60"
            style={{ fontFamily: 'var(--font-serif), serif' }}
          />
          <span className="mt-2 flex items-center justify-between text-[11px] tabular-nums">
            <span style={{ color: lines.length > 4 ? '#fda4af' : 'rgba(255,255,255,0.4)' }}>
              {lines.length}/4 reda
            </span>
            <span style={{ color: chars > 110 ? '#fda4af' : 'rgba(255,255,255,0.4)' }}>{chars}/110 znakova</span>
          </span>
        </label>

        {/* dizajn — fontovi, veličina, naglasak, riječ po riječ ili cijeli stih */}
        {/* dizajn tek kad ima šta da se dizajnira — bar 6 slova stiha */}
        <AnimatePresence initial={false}>
          {d.text.replace(/\s+/g, '').length >= 6 && (
            <motion.div key="designer" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <VerseDesigner value={d.font} text={d.text} mood={d.mood} cover={album?.cover} onChange={(font) => setD({ ...d, font }, 'font')} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* pjesma */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <label className="col-span-2 block md:col-span-1">
            <span className={labelCls}>Pjesma</span>
            <SongPicker
              value={d.song}
              songs={[...knownSongs.values()]}
              ready={(s) => songOf(s)?.state === 'ready'}
              onType={setSong}
              // izbor s liste: link, album i godina te pjesme
              onPick={(s) =>
                setD({
                  ...d,
                  song: s.song,
                  // nova pjesma bez linka: link prethodne pjesme ne ostaje (stiže sa sajta — onLink)
                  youtube: s.youtube ?? (audioSlug(s.song) === audioSlug(d.song) ? d.youtube : ''),
                  album: s.album,
                  description: s.description ?? '',
                  year: s.year ? String(s.year) : d.year,
                })
              }
              onLink={setLink}
              onEdit={setEditSong}
              className={field}
            />
          </label>
          <label className="col-span-2 block md:col-span-1">
            <span className={labelCls}>Album</span>
            {/* zakucana lista albuma — naziv uvijek tačan, a godina se popuni sama */}
            <span className="relative mt-2 flex items-center">
              {album && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={album.cover} alt="" className="pointer-events-none absolute left-2 h-8 w-8 rounded-md object-cover" />
              )}
              <select
                name="album"
                value={album?.title ?? d.album}
                onChange={(e) => {
                  const a = ALBUMS.find((x) => x.title === e.target.value)
                  setD({ ...d, album: e.target.value, year: a ? String(a.year) : d.year })
                }}
                className={`${field} appearance-none [color-scheme:dark] ${album ? 'pl-12' : ''}`}
              >
                {/* bez albuma — pozadina je Dinin portret, a ispod pjesme opis */}
                <option value="">Bez albuma</option>
                {ALBUMS.map((a) => (
                  <option key={a.id} value={a.title}>
                    {a.title} · {a.year}
                  </option>
                ))}
                {/* stari zapis koji nije na listi — da se ne izgubi pri uređivanju */}
                {d.album && !album && <option value={d.album}>{d.album}</option>}
              </select>
            </span>
          </label>
          <label className="col-span-2 block">
            <span className={labelCls}>
              Opis <span className="normal-case tracking-normal text-white/30">— piše se poslije albuma</span>
            </span>
            <input
              name="description"
              value={d.description}
              onChange={set('description')}
              maxLength={60}
              placeholder={album ? 'neobavezno' : 'npr. singl, uživo'}
              className={`mt-2 ${field}`}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Godina</span>
            <input name="year" value={d.year} onChange={set('year')} inputMode="numeric" required className={`mt-2 ${field}`} />
          </label>
          <label className="block">
            <span className={labelCls}>
              YouTube <span className="normal-case tracking-normal text-white/30">— pjesma</span>
            </span>
            <input name="youtube" value={d.youtube} onChange={set('youtube')} required placeholder="link pjesme" className={`mt-2 ${field}`} />
          </label>
          {/* svaki stih ima pjesmu koja se pušta odmah — postojeća se može pustiti ovdje */}
          {song?.state === 'ready' ? (
            <SongPlayer key={audioSlug(d.song)} song={d.song} />
          ) : (
            // bez linka nema pjesme — ni napomene o preuzimanju
            d.song.trim() && youtubeId(d.youtube) && (
              <p className="col-span-2 -mt-1 flex items-center gap-2 text-[11px] text-white/45" data-song-hint>
                <svg width="12" height="12" viewBox="0 0 24 24" fill={BRAND.gold} aria-hidden>
                  <path d="M9 18.5a3 3 0 1 1-2-2.83V5l12-2v12.5a3 3 0 1 1-2-2.83V7.3L9 8.6z" />
                </svg>
                <span className="min-w-0 flex-1">
                  {song?.state === 'loading'
                    ? 'Pjesma se upravo preuzima.'
                    : song?.state === 'error'
                      ? <span className="text-rose-200/85">Pjesma nije preuzeta.</span>
                      : initial?.id
                        ? 'Pjesma još nije preuzeta — dok ne stigne, stih se ne izvlači.'
                        : 'Ove pjesme još nema — preuzeće se jednom, kad sačuvaš stih, i ostaje za sve njene stihove.'}
                </span>
                {/* ponovni pokušaj odmah, bez čuvanja stiha (lokalno preuzme, na produkciji pokrene GitHub posao) */}
                {song?.state !== 'loading' && songsMode !== 'off' && youtubeId(d.youtube) && (
                  <button
                    type="button"
                    onClick={() => fetchSong(d.song, d.youtube)}
                    data-song-retry
                    className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-2.5 text-[11px] text-white/60 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
                    </svg>
                    {song?.state === 'error' ? 'Pokušaj ponovo' : 'Preuzmi sada'}
                  </button>
                )}
              </p>
            )
          )}
          {/* tekst pjesme — pregled kad je spremljen, inače napomena i preuzimanje, kao za pjesmu */}
          {d.song.trim() && youtubeId(d.youtube) && (
            <LyricsRow
              key={`tekst-${audioSlug(d.song)}`}
              song={d.song}
              info={song}
              canFetch={songsMode !== 'off'}
              onFetch={() => fetchLyrics(d.song)}
              onOffset={async (offset) => {
                if (inDeck()) return 'U prezentaciji se tekst ne mijenja.'
                const r = await fetch('/api/admin/lyrics', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ song: d.song, offset }),
                }).catch(() => null)
                const body = (await r?.json().catch(() => null)) as { error?: string; note?: string } | null
                if (!r?.ok) return body?.error ?? 'Pomak nije sačuvan.'
                if (body?.note) toast({ id: 'admin', title: body.note, color: TOAST_OK, icon: <Icon.ok /> }, 3200)
                return null
              }}
            />
          )}
        </div>

        {/* raspoloženje — pločice u bojama ekrana koji će stih dobiti */}
        <div>
          <p className={labelCls}>Raspoloženje</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {MOOD_KEYS.map((k) => {
              const m = MOODS[k]
              const on = d.mood === k
              return (
                <button
                  type="button"
                  key={k}
                  data-edit-mood={k}
                  onClick={() => setD({ ...d, mood: k })}
                  className="relative flex h-14 items-center gap-2.5 md:h-10 overflow-hidden rounded-2xl border px-3.5 text-left text-[13px] transition-colors"
                  style={{
                    borderColor: on ? m.accent : 'rgba(255,255,255,0.08)',
                    background: `radial-gradient(circle at 15% 20%, ${m.gradient[2]} 0%, transparent 70%), radial-gradient(circle at 90% 90%, ${m.gradient[1]} 0%, transparent 70%), ${m.gradient[0]}`,
                    boxShadow: on ? `0 0 0 1px ${m.accent}66, 0 8px 24px ${m.gradient[1]}88` : undefined,
                    color: on ? '#fff' : 'rgba(255,255,255,0.65)',
                  }}
                >
                  <i className="block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.accent, boxShadow: `0 0 10px ${m.accent}` }} />
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-auto h-12 rounded-2xl text-[14px] font-semibold text-black disabled:opacity-50"
          style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
        >
          {busy ? 'Čuvam…' : initial ? 'Sačuvaj izmjene' : 'Dodaj stih'}
        </button>
      </form>
      <AnimatePresence>
        {editSong && (
          <SongEdit
            key="song-edit"
            song={editSong}
            file={audioFile(editSong.song)}
            count={verses.filter((v) => audioSlug(v.song) === audioSlug(editSong.song)).length}
            onClose={() => setEditSong(null)}
            onSave={(to, file) => saveSong(editSong, to, file)}
          />
        )}
      </AnimatePresence>
      </div>
    </Sheet>
  )
}

/**
 * Stanje s historijom za nazad / naprijed. Izmjene istog polja u kratkom
 * razmaku (kucanje, povlačenje klizača) su jedan korak, ne slovo po slovo.
 */
function useHistory<T>(initial: T) {
  const [h, setH] = useState({ past: [] as T[], now: initial, future: [] as T[], key: '', at: 0 })
  return useMemo(
    () => ({
      now: h.now,
      canUndo: h.past.length > 0,
      canRedo: h.future.length > 0,
      set: (next: T, key = '') =>
        setH((s) => {
          const t = Date.now()
          const merge = Boolean(key) && s.key === key && t - s.at < 700
          return { past: merge ? s.past : [...s.past.slice(-99), s.now], now: next, future: [], key, at: t }
        }),
      undo: () =>
        setH((s) => (s.past.length ? { past: s.past.slice(0, -1), now: s.past[s.past.length - 1], future: [s.now, ...s.future], key: '', at: 0 } : s)),
      redo: () =>
        setH((s) => (s.future.length ? { past: [...s.past, s.now], now: s.future[0], future: s.future.slice(1), key: '', at: 0 } : s)),
    }),
    [h],
  )
}

/** Potvrda u stilu aplikacije — umjesto sistemskog `confirm()`. */
function Confirm({
  title,
  children,
  confirmLabel,
  tone = 'default',
  busy,
  onCancel,
  onConfirm,
}: {
  title: string
  children: React.ReactNode
  confirmLabel: string
  tone?: 'default' | 'danger'
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onCancel])
  return (
    <motion.div
      className="fixed inset-0 z-[130] flex items-center justify-center px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button aria-label="Odustani" className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onCancel} />
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-sm overflow-hidden rounded-[26px] border border-white/10 p-6 shadow-2xl"
        style={{ background: `radial-gradient(120% 60% at 50% 0%, ${BRAND.gold}14, transparent 60%), #0f0e0d` }}
        initial={{ scale: 0.94, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      >
        {/* ikonica i naslov u istom redu */}
        <div className="mb-4 flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
            style={{
              borderColor: tone === 'danger' ? 'rgba(253,164,175,0.35)' : `${BRAND.gold}55`,
              color: tone === 'danger' ? '#fda4af' : BRAND.gold,
              background: tone === 'danger' ? 'rgba(253,164,175,0.08)' : `${BRAND.gold}14`,
            }}
            aria-hidden
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16v3H4zM6 10v9h12v-9M10 14h4" />
            </svg>
          </span>
          <p className="text-[1.2rem] text-white/95" style={{ fontFamily: 'var(--font-serif), serif' }}>
            {title}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">{children}</div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            className="h-11 rounded-2xl border border-white/10 text-[13px] text-white/75 transition-colors hover:bg-white/5"
          >
            Odustani
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="h-11 rounded-2xl text-[13px] font-semibold disabled:opacity-50"
            style={
              tone === 'danger'
                ? { background: '#e4475f', color: '#fff' }
                : { background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})`, color: '#14100A' }
            }
          >
            {busy ? 'Čekaj…' : confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Skeleton() {
  // isti oblik kao lista — ekran ne skače kad stihovi stignu
  return (
    <div aria-busy="true" aria-label="Učitavam stihove">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-5 w-32 animate-pulse rounded-md bg-white/[0.06]" />
          <div className="h-3 w-64 animate-pulse rounded-md bg-white/[0.04]" />
        </div>
        <div className="h-11 w-32 animate-pulse rounded-full bg-white/[0.06]" />
      </div>
      <div className="mb-3 h-11 animate-pulse rounded-full bg-white/[0.04]" />
      <div className="mb-4 h-10 animate-pulse rounded-full bg-white/[0.03]" />
      <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.035]">
        <LoadBar />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5" style={{ borderTop: i ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
            <i className="block h-9 w-1 shrink-0 rounded-full bg-white/10" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 animate-pulse rounded bg-white/[0.07]" style={{ width: `${72 - ((i * 13) % 30)}%`, animationDelay: `${i * 90}ms` }} />
              <div className="h-2.5 w-40 animate-pulse rounded bg-white/[0.04]" style={{ animationDelay: `${i * 90}ms` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-[12px] text-white/35">Učitavam stihove…</p>
    </div>
  )
}
