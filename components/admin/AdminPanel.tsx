'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import type { Verse } from '@/data/verses'
import { MOODS, MOOD_KEYS, type Mood } from '@/data/moods'
import { ALBUMS, albumOf } from '@/data/albums'
import { BRAND } from '@/lib/brand'
import { albumLine, audioSlug, paperText, sameVerse, youtubeId } from '@/lib/text'
import { inDeck } from '@/lib/deck'
import { useWide } from '@/lib/client-store'
import { verseDayInTz } from '@/lib/date'
import { PageShell } from '../PageShell'
import { DevicePreview, DeviceSwitch, phoneWidth, useWarmPreview, type Device } from './DevicePreview'
import { PrintSlips } from './PrintSlips'
import { VerseDesigner } from './VerseDesigner'
import { SongEdit, SongPicker, SongPlayer, type KnownSong } from './SongPicker'
import { LyricsBadge, LyricsRow } from './LyricsPreview'
import { SyncModule } from './SyncModule'
import { StatsModule } from './StatsModule'
import { VerseCard } from './VerseCard'
import { audioFile } from '@/lib/audio-name'
// vlastite pjesme (preuzimanje, ♪, "bez pjesme") samo uz prekidač — inače pjesme idu preko YouTubea, a admin sređuje tekst
import { OWN_AUDIO } from '@/lib/flags'
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
/** karata po stranici (2, 3 ili 4 u redu) */
const CARDS_PAGE = 12
/** lista ili karte — pamti se na ovom uređaju */
const VIEW_KEY = 'stihdana:admin-view'
type View = 'list' | 'cards'
/** visina telefona desno od liste (računar) */
const SIDE_H = 560
/** printer — dugme u zaglavlju i znak modala za štampu */
const SYNC_ICON = <path d="M20 11a8 8 0 0 0-14.9-3.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.9 3.9L20 16M20 20v-4h-4" />

/** stupci — statistika */
const STATS_ICON = <path d="M5 20V11M10 20V5M15 20v-7M20 20v-4M3.5 20h17" />

/** oko — pregled stiha iz liste */
const EYE_ICON = (
  <>
    <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </>
)

/** prikaz liste: redovi ili karte (stih kako izgleda u aplikaciji) */
const VIEWS: [View, string, React.ReactNode][] = [
  ['list', 'Lista', <path key="list" d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />],
  [
    'cards',
    'Karte',
    <g key="cards">
      <rect x="3.5" y="3.5" width="7.5" height="17" rx="2" />
      <rect x="13" y="3.5" width="7.5" height="17" rx="2" />
    </g>,
  ],
]

const PRINT_ICON = (
  <>
    <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" />
    <rect x="6" y="14" width="12" height="7" rx="1" />
  </>
)


/**
 * Dugme u zaglavlju admina. Na uskom ekranu (telefon, uski pregled) samo znak
 * u krugu — natpisi bi istisnuli naslov i izašli preko ivice; natpis od sm naviše.
 */
function HeadButton({ label, children, ...rest }: { label: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className="flex h-9 w-9 items-center justify-center gap-2 rounded-full border border-white/10 text-[11px] uppercase tracking-[0.16em] text-white/50 transition-colors hover:text-white disabled:opacity-40 sm:h-auto sm:w-auto sm:px-3.5 sm:py-2"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
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
  // novi stih — lista iznova (bez filtera, prva strana: novi je na vrhu)
  const [libKey, setLibKey] = useState(0)
  const [archiving, setArchiving] = useState<AdminVerse | null>(null)
  // pregled stiha iz liste (oko na kartici) — s listom iz koje je, za ‹ ›
  const [previewing, setPreviewing] = useState<{ verse: AdminVerse; list: AdminVerse[] } | null>(null)
  // papirići za štampu (modal)
  const [printing, setPrinting] = useState(false)
  // Sinhronizacija — modal s pjesmama: zvuk i tekst koji fale, u jednom potezu
  const [syncing, setSyncing] = useState(false)
  // statistika: otvaranja, čuvanja, dijeljenja (bez ličnih podataka)
  const [stats, setStats] = useState(false)
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
        <div className="flex shrink-0 items-center gap-2">
          {/* tekstovi (i pjesme) koji fale — izabrane, u jednom potezu */}
          <HeadButton label="Sinhronizacija" onClick={() => setSyncing(true)} disabled={!data || !songs.mode || songs.mode === 'off'} data-sync>
            {SYNC_ICON}
          </HeadButton>
          <HeadButton label="Statistika" onClick={() => setStats(true)} disabled={!data} data-stats-open>
            {STATS_ICON}
          </HeadButton>
          {/* papirići za pult — A4 za štampu na papir u boji */}
          <HeadButton label="Štampa" onClick={() => setPrinting(true)} disabled={!data} data-print>
            {PRINT_ICON}
          </HeadButton>
          <HeadButton label="Odjava" onClick={logout}>
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
            <path d="M10 8l-4 4 4 4M6 12h10" />
          </HeadButton>
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

          <Library
            key={libKey}
            data={data}
            busy={busy}
            songs={songs}
            onEdit={(v) => setEditor({ verse: v })}
            onPreview={(verse, list) => setPreviewing({ verse, list })}
            onArchive={setArchiving}
            onRestore={(v) => send({ op: 'restore', id: v.id }, 'Stih je vraćen u izvlačenje')}
          />

          {/* pregled stiha iz liste — kako izgleda na telefonu, bez otvaranja forme */}
          <AnimatePresence>
            {previewing && (
              <Sheet
                key="preview"
                wide
                eyebrow="Pregled"
                title={paperText(previewing.verse.text)}
                icon={EYE_ICON}
                onClose={() => setPreviewing(null)}
                actions={
                  data.writable && previewing.verse.active ? (
                    <button
                      type="button"
                      data-preview-edit
                      onClick={() => {
                        setEditor({ verse: previewing.verse })
                        setPreviewing(null)
                      }}
                      className="flex h-9 items-center gap-2 rounded-full px-4 text-[12px] font-semibold text-black"
                      style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
                    >
                      Uredi
                    </button>
                  ) : undefined
                }
              >
                <QuickPreview
                  verse={previewing.verse}
                  list={previewing.list}
                  onPick={(verse) => setPreviewing({ verse, list: previewing.list })}
                />
              </Sheet>
            )}
          </AnimatePresence>

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
            {stats && (
              <Sheet key="stats" wide eyebrow="Stihovi" title="Statistika" icon={STATS_ICON} onClose={() => setStats(false)}>
                <StatsModule />
              </Sheet>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {syncing && (
              <Sheet key="sync" wide eyebrow={OWN_AUDIO ? 'Pjesme i tekstovi' : 'Tekstovi pjesama'} title="Sinhronizacija" icon={SYNC_ICON} onClose={() => setSyncing(false)}>
                <SyncModule verses={data.verses} info={songs.of} onDone={songs.reload} flash={flash} />
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
                reloadSongs={songs.reload}
                onSongSaved={(snap, note) => {
                  setData(snap)
                  songs.reload()
                  flash(note ?? 'Pjesma je sačuvana', Boolean(note))
                }}
                busy={busy}
                onClose={() => setEditor(null)}
                onSave={async (draft, found) => {
                  if (data.verses.some((v) => v.id !== editor.verse?.id && sameVerse(v, draft)))
                    return flash('Ovaj stih već postoji', true)
                  const ok = editor.verse
                    ? await send({ op: 'update', id: editor.verse.id, verse: draft }, 'Stih je sačuvan')
                    : await send({ op: 'add', verse: draft }, 'Stih je dodan · ulazi u izvlačenje od sutra')
                  if (!ok) return
                  setEditor(null)
                  if (!editor.verse) setLibKey((k) => k + 1)
                  songs.reload()
                  if (!draft.youtube.trim()) return
                  // pjesma se sprema odmah — dok stih uđe u izvlačenje, pušta se bez čekanja;
                  // preko YouTubea samo tekst nove pjesme
                  const info = songs.of(draft.song)
                  if (OWN_AUDIO) {
                    if (info?.state !== 'ready') songs.fetch(draft.song, draft.youtube)
                    // tekst nađen u formi (produkcija ga ne može spremiti sama) ili ga još nema — spremi GitHub
                  } else if (found || !info?.lyrics || info.lyrics === 'missing') songs.fetchLyrics(draft.song)
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
                  {paperText(archiving.text)}
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
  /** preuzmi tekst pjesme sada (i kad postoji, a ne prati pjesmu — LRCLIB iznova) */
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
      const lyrics = pendingLyrics[k] && Date.now() - pendingLyrics[k] < 90_000 && s?.lyrics !== 'synced' ? 'loading' : s?.lyrics
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
      setPendingLyrics((p) => Object.fromEntries(Object.entries(p).filter(([k, at]) => Date.now() - at < 90_000 && snap?.songs[k]?.lyrics !== 'synced')))
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
/** Pregled YouTube videa u formi stiha — pravi plejer odmah (da se vidi da je link prava pjesma). */
function YouTubePreview({ id }: { id: string }) {
  // plejer se učitava — pulsira dok ne stigne
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="col-span-2 -mt-1 overflow-hidden rounded-xl border border-white/[0.08] bg-black/40" data-yt-preview>
      <div className="relative aspect-video w-full">
        {!loaded && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/[0.04]" aria-hidden>
            <span className="absolute inset-0 animate-pulse bg-white/[0.03]" />
            <span className="block h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: BRAND.gold, borderTopColor: 'transparent' }} />
          </span>
        )}
        {/* YouTube traži referrer za ugrađen plejer */}
        <iframe
          src={`https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`}
          title="YouTube video pjesme"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      {/* neki video se ne da ugraditi (vlasnik ili zemlja) — tad bar link */}
      <a
        href={`https://www.youtube.com/watch?v=${id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-end gap-1 px-3 py-1.5 text-[11px] text-white/45 transition-colors hover:text-white"
      >
        Otvori na YouTubeu
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      </a>
    </div>
  )
}

/* ── tekst pjesme se traži sam (forma stiha) ─────────────────── */

type FindStep = { key: 'video' | 'site' | 'verse' | 'lrclib' | 'captions'; state: 'run' | 'ok' | 'none' | 'skip' | 'fail' }
type FindResult = { title: string; lines: number; synced: number }
type Find = { key: string; status: 'idle' | 'run' | 'done' | 'fail'; steps: FindStep[]; result: FindResult | null; stored: boolean }

/**
 * Tekst pjesme se traži sam, čim je pjesma izabrana i link nađen — koraci
 * stižu redom s /api/admin/lyrics/find i forma ih pokazuje. `on`: treba li
 * tražiti (nova pjesma, ili tekst još nije spremljen). `onStored`: tekst je
 * spremljen (lokalno) — stanje pjesama iznova.
 */
function useLyricsFind(song: string, youtube: string, verse: string, on: boolean, onStored: () => void) {
  const [again, setAgain] = useState(0)
  const key = on || again ? `${audioSlug(song)}|${youtubeId(youtube) ?? ''}|${again}` : ''
  const [find, setFind] = useState<Find>({ key: '', status: 'idle', steps: [], result: null, stored: false })
  const latest = useRef({ song, youtube, verse, onStored })
  useEffect(() => {
    latest.current = { song, youtube, verse, onStored }
  })
  useEffect(() => {
    if (!key) return
    const ctrl = new AbortController()
    // kratko čekanje: dok se naziv kuca, ne traži se za svako slovo
    const t = window.setTimeout(async () => {
      const set = (fn: (f: Find) => Find) => !ctrl.signal.aborted && setFind((f) => (f.key === key ? fn(f) : f))
      setFind({ key, status: 'run', steps: [], result: null, stored: false })
      try {
        const { song: s, youtube: y, verse: v } = latest.current
        const r = await fetch('/api/admin/lyrics/find', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song: s, youtube: y, verse: v }),
          signal: ctrl.signal,
        })
        if (!r.ok || !r.body) throw new Error(String(r.status))
        const reader = r.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
            const line = buf.slice(0, i).trim()
            buf = buf.slice(i + 1)
            if (!line) continue
            const e = JSON.parse(line) as { type: string; key?: FindStep['key']; state?: FindStep['state']; result?: FindResult | null; stored?: boolean }
            if (e.type === 'step' && e.key && e.state) {
              const step = { key: e.key, state: e.state }
              set((f) => ({ ...f, steps: f.steps.some((x) => x.key === step.key) ? f.steps.map((x) => (x.key === step.key ? step : x)) : [...f.steps, step] }))
            } else if (e.type === 'done') {
              set((f) => ({ ...f, status: 'done', result: e.result ?? null, stored: Boolean(e.stored) }))
              if (e.stored) latest.current.onStored()
            } else if (e.type === 'error') set((f) => ({ ...f, status: 'fail' }))
          }
        }
        set((f) => (f.status === 'run' ? { ...f, status: 'fail' } : f))
      } catch {
        set((f) => ({ ...f, status: 'fail' }))
      }
    }, 600)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [key])
  // traženje je zakazano (čeka da se kucanje smiri) — računa se kao da traje
  const now: Find = !key ? { key: '', status: 'idle', steps: [], result: null, stored: false } : find.key === key ? find : { key, status: 'run', steps: [], result: null, stored: false }
  return { ...now, retry: () => setAgain((n) => n + 1) }
}

/** 1 red, 2–4 reda, 5+ redova (i 11–14 redova) */
function rowsWord(n: number) {
  const d = n % 10
  const h = n % 100
  return d === 1 && h !== 11 ? 'red' : d >= 2 && d <= 4 && (h < 12 || h > 14) ? 'reda' : 'redova'
}

const FIND_LABEL: Record<FindStep['key'], string> = {
  video: 'Trajanje videa',
  site: 'Tekst na dinomerlin.com',
  verse: 'Pjesma po stihu',
  lrclib: 'Vremena na LRCLIB-u',
  captions: 'Titlovi na YouTubeu',
}
const FIND_NOTE: Record<FindStep['state'], string> = { run: '', ok: 'nađeno', none: 'nema', skip: 'GitHub, poslije čuvanja', fail: 'ne odgovara' }

/** Napredak traženja teksta u formi: šta se upravo radi, svaki korak, pa rezultat. */
function LyricsFind({ find, onRetry }: { find: Find; onRetry: () => void }) {
  const run = find.status === 'run'
  const r = find.result
  const current = [...find.steps].reverse().find((s) => s.state === 'run')
  const head = run
    ? current
      ? `${FIND_LABEL[current.key]}…`
      : 'Tražim tekst…'
    : find.status === 'fail'
      ? 'Traženje nije uspjelo'
      : !r
        ? 'Tekst nije nađen'
        : r.synced
          ? `Tekst prati pjesmu · ${r.synced} ${rowsWord(r.synced)}`
          : `Tekst bez vremena · ${r.lines} ${rowsWord(r.lines)}`
  const tone = run ? BRAND.gold : find.status === 'done' && r?.synced ? '#9BCB8E' : find.status === 'done' && r ? 'rgba(255,255,255,0.75)' : '#E6A4A4'
  return (
    <div className="col-span-2 -mt-1 rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-3" data-lyrics-find={find.status}>
      <p className="flex items-center gap-2 text-[12px] font-medium" style={{ color: tone }}>
        {run ? (
          <span className="block h-3 w-3 shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" aria-hidden />
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {find.status === 'done' && r ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <path d="M12 8v5M12 16.5v.5M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />}
          </svg>
        )}
        <span className="min-w-0 flex-1 truncate">{head}</span>
        {!run && (
          <button type="button" onClick={onRetry} className="shrink-0 text-[11px] font-normal text-white/45 transition-colors hover:text-white" data-lyrics-again>
            Traži ponovo
          </button>
        )}
      </p>
      {find.steps.length > 0 && (
        <ul className="mt-2 space-y-1 pl-5">
          {find.steps.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-[11px] text-white/50" data-find-step={s.key}>
              <span className="flex w-3 shrink-0 justify-center" style={{ color: s.state === 'ok' ? '#9BCB8E' : s.state === 'fail' ? '#E6A4A4' : s.state === 'run' ? BRAND.gold : 'rgba(255,255,255,0.3)' }}>
                {s.state === 'run' ? (
                  <span className="block h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" aria-hidden />
                ) : s.state === 'ok' ? (
                  '✓'
                ) : (
                  '–'
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">{FIND_LABEL[s.key]}</span>
              <span className="shrink-0 text-white/35">{FIND_NOTE[s.state]}</span>
            </li>
          ))}
        </ul>
      )}
      {find.status === 'done' && r && !find.stored && <p className="mt-2 pl-5 text-[10.5px] text-white/35">Tekst se spremi kad sačuvaš stih.</p>}
    </div>
  )
}

/** Mali omot albuma (public/albumi/sm); bez albuma — ikonica aplikacije. `ring`: obrub izbora. */
function AlbumIcon({ id, size, round }: { id: string; size: number; round?: boolean }) {
  return (
    <span
      className="block shrink-0 bg-white/[0.06] bg-cover bg-center"
      style={{
        width: size,
        height: size,
        borderRadius: round ? '50%' : Math.round(size * 0.26),
        backgroundImage: `url(${id ? `/albumi/sm/${id}.webp` : '/icons/icon-192.png'})`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
      }}
      aria-hidden
    />
  )
}

/** Pregled stiha iz liste: telefon (ili računar) s pravim ekranom — samo za pogled. */
function QuickPreview({ verse, list, onPick }: { verse: AdminVerse; list: AdminVerse[]; onPick: (v: AdminVerse) => void }) {
  const [full, setFull] = useState(false)
  const [device, setDevice] = useState<Device>('phone')
  const at = Math.max(0, list.findIndex((v) => v.id === verse.id))
  return (
    <div className="flex flex-col items-center gap-3 pb-2" data-quick-preview>
      <DeviceSwitch device={device} onDevice={setDevice} />
      <DevicePreview verse={verse} maxHeight={520} full={full} onFull={setFull} device={device} />
      {list.length > 1 && <PreviewNav verse={verse} at={at} total={list.length} onStep={(d) => list[at + d] && onPick(list[at + d])} />}
    </div>
  )
}

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
  onPreview,
  onArchive,
  onRestore,
}: {
  data: Snapshot
  busy: boolean
  songs: Songs
  onEdit: (v: AdminVerse) => void
  /** pregled u modalu (telefon, tablet) — s listom, da se može listati */
  onPreview: (v: AdminVerse, list: AdminVerse[]) => void
  onArchive: (v: AdminVerse) => void
  onRestore: (v: AdminVerse) => void
}) {
  const [q, setQ] = useState('')

  // album (id iz data/albums.ts); '' = bez albuma (singl, uživo), null = svi
  const [album, setAlbum] = useState<string | null>(null)
  const albumId = (v: AdminVerse) => albumOf(v.album)?.id ?? ''
  const [archived, setArchived] = useState(false)
  const [page, setPage] = useState(0)
  const writable = Boolean(data.writable)
  // računar: telefon desno od liste, lista se lista dugmadima ispod njega
  // (u prezentaciji ne — admin tamo izgleda kao i dosad)
  const wide = useWide() && !inDeck()
  // lista ili karte (stih kako izgleda u aplikaciji) — u prezentaciji uvijek lista
  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'list'
    } catch {
      return 'list'
    }
  })
  const cards = view === 'cards' && !inDeck()
  // telefon desno samo uz listu — karte već pokazuju kako stih izgleda
  const side = wide && !cards
  const pickView = (v: View) => {
    setView(v)
    setPage(0)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {}
  }
  // stih u telefonu desno (računar)
  const [focusId, setFocusId] = useState<string | null>(null)

  const list = data.verses
    .filter(
      (v) =>
        v.active !== archived &&
        (album === null || albumId(v) === album) &&
        (!q || `${v.text} ${v.song} ${v.album}`.toLowerCase().includes(q.toLowerCase())),
    )
    // najnoviji prvi — to je ono što urednik najčešće traži
    .reverse()
  const per = cards ? CARDS_PAGE : PAGE
  const pages = Math.max(1, Math.ceil(list.length / per))
  const p = Math.min(page, pages - 1)
  const shown = list.slice(p * per, p * per + per)
  // nova stranica počinje od vrha liste
  const listRef = useRef<HTMLDivElement>(null)
  const go = (n: number) => {
    setPage(n)
    // vrh liste iza zaglavlja — nova stranica počinje od vrha liste
    const top = listRef.current?.getBoundingClientRect().top ?? 0
    if (top < 96) listRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    // telefon desno prati stranicu — prvi stih na njoj
    if (side && list[n * per]) setFocusId(list[n * per].id)
  }
  // telefon desno: izabrani stih, ili prvi u listi (i kad filter izbaci izabrani)
  const focusAt = Math.max(0, list.findIndex((v) => v.id === focusId))
  const focus = side ? (list[focusAt] ?? null) : null
  const step = (d: number) => {
    const n = focusAt + d
    if (!list[n]) return
    setFocusId(list[n].id)
    // stranica liste ide za njim — izabrani red je uvijek vidljiv
    const pg = Math.floor(n / per)
    if (pg !== p) setPage(pg)
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-row="${list[n].id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }
  const archivedCount = data.verses.filter((v) => !v.active).length
  // tabovi albuma: najnoviji prvi, s brojem pjesama (ne stihova) u aktivnim ili arhivi
  const scope = data.verses.filter((v) => v.active !== archived)
  const songsIn = (id: string) => new Set(scope.filter((v) => albumId(v) === id).map((v) => audioSlug(v.song))).size
  const albumTabs = [
    ...[...ALBUMS].reverse().map((a) => ({ id: a.id, title: a.title, songs: songsIn(a.id) })),
    { id: '', title: 'Ostalo', songs: songsIn('') },
  ].filter((t) => t.songs > 0)
  // traka tabova albuma: točkić i miš je listaju vodoravno
  const tabsRef = useRef<HTMLDivElement>(null)
  useStripScroll(tabsRef)
  // datum na kartama (kao na karti u sačuvanima) — današnji
  const today = verseDayInTz()
  // "Svi": broj pjesama u aktivnim (ili arhivi)
  const allSongs = new Set(scope.map((v) => audioSlug(v.song))).size
  return (
    // `wide:` je isti uslov kao useWide (u pikselima) — `lg:` je u rem, pa bi uz
    // veći font preglednika telefon pao ispod liste
    <div className="wide:flex wide:items-start wide:gap-8">
      <div className="min-w-0 wide:flex-1">
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

      {/* pretraga i prikaz (lista / karte) */}
      <div className="mb-3 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(0)
          }}
          placeholder="Traži stih, pjesmu ili album…"
          data-search
          className="h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/30 px-4 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[#BFA87F]/50"
        />
        {/* lista / karte (stih kako izgleda) */}
        {!inDeck() && (
          <div className="flex h-11 shrink-0 items-center rounded-full border border-white/10 bg-black/30 p-1" role="group" aria-label="Prikaz">
            {VIEWS.map(([k, label, icon]) => (
              <button
                key={k}
                type="button"
                data-view={k}
                aria-pressed={view === k}
                aria-label={label}
                title={label}
                onClick={() => pickView(k)}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
                style={view === k ? { background: `${BRAND.gold}24`, color: BRAND.gold } : { color: 'rgba(255,255,255,0.5)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {icon}
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* albumi kao tabovi: omot, naziv i broj pjesama — listaju se vodoravno (do ivica,
          koje se pretope); na računaru i točkićem i povlačenjem mišem */}
      <div
        ref={tabsRef}
        className="-mx-5 mb-4 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: TABS_FADE, WebkitMaskImage: TABS_FADE }}
        data-album-tabs
      >
        <div className="flex w-max gap-1.5">
          {[{ id: null, title: 'Svi', songs: allSongs }, ...albumTabs].map((t) => {
            const on = album === t.id
            return (
              <button
                key={t.id ?? 'svi'}
                type="button"
                data-album={t.id ?? 'svi'}
                aria-pressed={on}
                onClick={() => {
                  setAlbum(t.id)
                  setPage(0)
                }}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-full border pr-1.5 text-[12.5px] transition-colors ${t.id === null ? 'pl-3.5' : 'pl-1'}`}
                style={
                  on
                    ? { borderColor: `${BRAND.gold}8c`, background: `${BRAND.gold}1a`, color: '#fff' }
                    : { borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.72)' }
                }
              >
                {t.id !== null && <AlbumIcon id={t.id} size={30} round />}
                <span className="whitespace-nowrap">{t.title}</span>
                <span
                  className="tabular flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
                  style={on ? { background: BRAND.gold, color: '#14100A' } : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                >
                  {t.songs}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* lista teče sa stranicom (jedan skrol); stranice je drže kratkom */}
      <div ref={listRef} className="relative scroll-mt-24">
        {/* izmjena ide na server — tanka zlatna traka dok traje */}
        {busy && <LoadBar />}
        <motion.div
          key={`${p}-${archived}-${album}-${cards}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className={cards ? 'grid grid-cols-2 gap-x-3 gap-y-4 pb-1 sm:grid-cols-3 lg:grid-cols-4' : 'space-y-1.5'}
          data-cards={cards || undefined}
        >
        {cards && shown.map((v) => {
          const m = MOODS[v.mood]
          const editable = writable && !archived && !busy
          // dodir na kartu: uređivanje; u arhivi (ili dok traje izmjena) — pregled
          const open = () => (editable ? onEdit(v) : onPreview(v, list))
          return (
            <div key={v.id} data-row={v.id} className="min-w-0 scroll-mt-24">
              <div
                role="button"
                tabIndex={0}
                aria-label={`${editable ? 'Uredi' : 'Pregled'}: ${paperText(v.text)}`}
                onClick={open}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    open()
                  }
                }}
                className="cursor-pointer rounded-[26px] outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#BFA87F]/60"
              >
                <VerseCard verse={v} day={today} />
              </div>
              <div className="mt-1.5 flex items-center gap-0.5 pl-1">
                <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[9.5px] uppercase tracking-[0.14em] text-white/45">
                  <i className="block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.accent, boxShadow: `0 0 6px ${m.accent}` }} />
                  <span className="truncate">{m.label}</span>
                </p>
                {writable &&
                  (archived ? (
                    <IconBtn label="Vrati" disabled={busy} onClick={() => onRestore(v)}>
                      <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5" />
                    </IconBtn>
                  ) : (
                    <IconBtn label="Arhiviraj" disabled={busy} onClick={() => onArchive(v)}>
                      <path d="M4 7h16v3H4zM6 10v9h12v-9M10 14h4" />
                    </IconBtn>
                  ))}
              </div>
            </div>
          )
        })}
        {!cards && shown.map((v) => {
          const m = MOODS[v.mood]
          // klik na stih (bilo gdje na kartici) otvara uređivanje — dugmad unutra rade svoje;
          // na računaru (telefon desno) klik izabere stih za telefon, a uređuje se olovkom ili dvoklikom
          const editable = writable && !archived && !busy
          const inPhone = focus?.id === v.id
          const pick = () => (side ? setFocusId(v.id) : editable && onEdit(v))
          return (
            <div
              key={v.id}
              data-row={v.id}
              data-in-phone={inPhone || undefined}
              role={side || editable ? 'button' : undefined}
              tabIndex={side || editable ? 0 : undefined}
              aria-label={side ? `Na telefonu: ${paperText(v.text)}` : editable ? `Uredi: ${paperText(v.text)}` : undefined}
              aria-pressed={side ? inPhone : undefined}
              onClick={(e) => {
                if (!(e.target as Element).closest('button, a, input, label')) pick()
              }}
              onDoubleClick={(e) => {
                if (side && editable && !(e.target as Element).closest('button, a, input, label')) onEdit(v)
              }}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  pick()
                }
              }}
              className={`flex scroll-mt-24 items-center gap-3 rounded-2xl py-2.5 pl-2.5 pr-2 transition-colors sm:gap-4 ${inPhone ? 'bg-white/[0.075]' : 'bg-white/[0.035] hover:bg-white/[0.07]'} ${side || editable ? 'cursor-pointer' : ''}`}
              style={inPhone ? { boxShadow: `inset 0 0 0 1px ${BRAND.gold}59` } : undefined}
            >
              <AlbumIcon id={albumId(v)} size={46} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
                  {paperText(v.text)}
                </p>
                <p className="mt-1 flex min-w-0 items-center gap-2 text-[10px] uppercase tracking-[0.14em]">
                  {/* raspoloženje — tačkica u njegovoj boji */}
                  <i className="block h-1.5 w-1.5 shrink-0 rounded-full" title={m.label} style={{ background: m.accent, boxShadow: `0 0 6px ${m.accent}` }} />
                  <span className="shrink-0" style={{ color: BRAND.gold }}>{v.song}</span>
                  {OWN_AUDIO && songs.of(v.song)?.state === 'ready' && <SongBadge info={songs.of(v.song)} mode={songs.mode} onFetch={() => {}} />}
                  {/* tekst: spremljen (prati pjesmu / bez vremena), preuzima se, ili nije */}
                  {(!OWN_AUDIO || songs.of(v.song)?.state === 'ready') && <LyricsBadge info={songs.of(v.song)} />}
                  <span className="truncate">
                  <span className="text-white/30">
                    {albumLine(v)}
                  </span>
                  </span>
                </p>
              </div>
              {/* pjesma koja nije preuzeta: natpis i diskretno dugme, pored ikonica (samo vlastite pjesme) */}
              {v.youtube ? (
                OWN_AUDIO && <SongIssue info={songs.of(v.song)} mode={songs.mode} onRetry={() => songs.fetch(v.song, v.youtube)} />
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
              <div className="flex shrink-0 gap-1">
                  {writable && !archived && (
                    <IconBtn label="Uredi" disabled={busy} onClick={() => onEdit(v)}>
                      <path d="M4 20h4L19 9l-4-4L4 16z" />
                    </IconBtn>
                  )}
                  {!writable ? null : archived ? (
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
            {p * per + 1}–{Math.min(list.length, p * per + per)} od {list.length}
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
      </div>

      {/* računar: telefon desno — stih kako izgleda, ‹ › kroz listu */}
      {focus && <SidePhone verse={focus} at={focusAt} total={list.length} onStep={step} />}
    </div>
  )
}

/** Telefon desno od liste (računar): stih na pravom ekranu aplikacije, ‹ › i strelice na tastaturi kroz listu. */
function SidePhone({ verse, at, total, onStep }: { verse: AdminVerse; at: number; total: number; onStep: (d: number) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      // ne dok se kuca, ni dok je otvoren modal (uređivanje, štampa…)
      const t = e.target instanceof Element ? e.target : null
      if (e.altKey || e.metaKey || e.ctrlKey || t?.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('[aria-modal="true"]')) return
      e.preventDefault()
      onStep(e.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onStep])
  return (
    <aside className="sticky top-[84px] flex shrink-0 flex-col items-center" style={{ width: Math.max(phoneWidth(SIDE_H), 240) }} data-side-phone>
      <DevicePreview verse={verse} maxHeight={SIDE_H} full={false} onFull={noop} device="phone" />
      <PreviewNav verse={verse} at={at} total={total} onStep={onStep} />
    </aside>
  )
}

const noop = () => {}

/** ‹ pjesma · 3 / 27 › — listanje kroz stihove u pregledu */
function PreviewNav({ verse, at, total, onStep }: { verse: AdminVerse; at: number; total: number; onStep: (d: number) => void }) {
  return (
    <div className="mt-4 flex w-full max-w-[320px] items-center gap-2" data-preview-nav>
      <NavArrow dir="l" disabled={at <= 0} onClick={() => onStep(-1)} />
      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-[10px] uppercase tracking-[0.16em]" style={{ color: BRAND.gold }}>
          {verse.song}
        </p>
        <p className="tabular mt-0.5 text-[11px] text-white/40">
          {at + 1} / {total}
        </p>
      </div>
      <NavArrow dir="r" disabled={at >= total - 1} onClick={() => onStep(1)} />
    </div>
  )
}

function NavArrow({ dir, disabled, onClick }: { dir: 'l' | 'r'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'l' ? 'Prethodni stih' : 'Sljedeći stih'}
      title={dir === 'l' ? 'Prethodni stih' : 'Sljedeći stih'}
      data-step={dir === 'l' ? 'prev' : 'next'}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition-colors hover:bg-white/10 disabled:opacity-25"
    >
      <Chevron dir={dir} />
    </button>
  )
}

/** ivice trake tabova se pretope — vidi se da ih ima još */
const TABS_FADE = 'linear-gradient(90deg, transparent 0, #000 20px, #000 calc(100% - 20px), transparent 100%)'

/**
 * Vodoravna traka (tabovi albuma) na računaru: točkić je lista vodoravno dok
 * ima kuda (na kraju trake skrola se stranica), a miš je može i povući —
 * povlačenje nije klik na tab. Prst i trackpad je listaju sami.
 */
function useStripScroll(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const max = el.scrollWidth - el.clientWidth
      if ((e.deltaY > 0 && el.scrollLeft >= max - 1) || (e.deltaY < 0 && el.scrollLeft <= 0)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    let s: { x: number; left: number; id: number; moved: boolean } | null = null
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button === 0) s = { x: e.clientX, left: el.scrollLeft, id: e.pointerId, moved: false }
    }
    const move = (e: PointerEvent) => {
      if (!s || e.pointerId !== s.id) return
      const dx = e.clientX - s.x
      if (!s.moved) {
        if (Math.abs(dx) < 6) return
        s.moved = true
        try {
          el.setPointerCapture(s.id)
        } catch {}
      }
      el.scrollLeft = s.left - dx
    }
    const up = () => {
      const moved = s?.moved
      s = null
      if (!moved) return
      const stop = (c: MouseEvent) => {
        c.stopPropagation()
        c.preventDefault()
      }
      el.addEventListener('click', stop, { capture: true, once: true })
      window.setTimeout(() => el.removeEventListener('click', stop, { capture: true }), 0)
    }
    const noDrag = (e: DragEvent) => e.preventDefault()
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('dragstart', noDrag)
    return () => {
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('dragstart', noDrag)
    }
  }, [ref])
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
  reloadSongs,
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
  /** stanje pjesama iznova (tekst je upravo spremljen) */
  reloadSongs: () => void
  busy: boolean
  onClose: () => void
  /** `found`: tekst nađen u formi, a još nije spremljen (produkcija — spremi ga GitHub) */
  onSave: (d: Draft, found: FindResult | null) => void
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
  // pjesma bez linka (upisana, izabrana, ili stih koji se uređuje) — link sa njene
  // stranice na dinomerlin.com (tamo gdje je i tekst), pa pregled videa ispod
  const [linkLook, setLinkLook] = useState<'idle' | 'look' | 'found' | 'none'>('idle')
  const linkTo = useRef(setLink)
  useEffect(() => {
    linkTo.current = setLink
  })
  useEffect(() => {
    const name = d.song.trim()
    if (!name || youtubeId(d.youtube)) return
    let on = true
    const t = window.setTimeout(() => {
      setLinkLook('look')
      fetch(`/api/admin/songs?song=${encodeURIComponent(name)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((b: { youtube?: string | null } | null) => {
          if (!on) return
          if (b?.youtube) linkTo.current(name, `https://www.youtube.com/watch?v=${b.youtube}`)
          setLinkLook(b?.youtube ? 'found' : 'none')
        })
        .catch(() => on && setLinkLook('none'))
    }, 450)
    return () => {
      on = false
      clearTimeout(t)
    }
  }, [d.song, d.youtube])
  // "nađen" kratko ostane uz polje
  useEffect(() => {
    if (linkLook !== 'found') return
    const t = window.setTimeout(() => setLinkLook('idle'), 3500)
    return () => clearTimeout(t)
  }, [linkLook])
  const song = d.song.trim() ? songOf(d.song) : null
  // tekst pjesme se traži sam (pjesme preko YouTubea), čim su pjesma i link tu:
  // nova pjesma, ili tekst još nije spremljen (ili ne prati, a pjesma je promijenjena)
  const songMoved = !initial || audioSlug(initial.song) !== audioSlug(d.song) || youtubeId(initial.youtube) !== youtubeId(d.youtube)
  const wantLyrics =
    !OWN_AUDIO &&
    Boolean(d.song.trim() && youtubeId(d.youtube)) &&
    linkLook !== 'look' &&
    (!song?.lyrics || song.lyrics === 'missing' || (songMoved && song.lyrics !== 'synced'))
  const lyrics = useLyricsFind(d.song, d.youtube, d.text, wantLyrics, reloadSongs)
  const searching = linkLook === 'look' || lyrics.status === 'run'
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
          if (searching) return
          onSave(d, lyrics.status === 'done' && !lyrics.stored ? lyrics.result : null)
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
              ready={(s) => OWN_AUDIO && songOf(s)?.state === 'ready'}
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
            <span className="relative mt-2 block">
              <input name="youtube" value={d.youtube} onChange={set('youtube')} required placeholder={linkLook === 'look' ? 'tražim link…' : 'link pjesme'} className={`${field} pr-10`} />
              {/* traži se link — vrti se u polju; nađen — kvačica */}
              {linkLook === 'look' && !youtubeId(d.youtube) && (
                <span className="absolute right-3.5 top-1/2 block h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: `${BRAND.gold}`, borderTopColor: 'transparent' }} aria-hidden />
              )}
              {linkLook === 'found' && youtubeId(d.youtube) && (
                <svg className="absolute right-3.5 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9BCB8E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              )}
            </span>
            {d.song.trim() && (linkLook === 'look' || linkLook === 'none') && !youtubeId(d.youtube) && (
              <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/50" data-link-look>
                {linkLook === 'look' ? 'Tražim link na dinomerlin.com…' : 'Link nije nađen — upiši ga'}
              </span>
            )}
            {linkLook === 'found' && youtubeId(d.youtube) && (
              <span className="mt-1.5 block text-[11px]" style={{ color: '#9BCB8E' }} data-link-look>
                Link nađen na dinomerlin.com
              </span>
            )}
          </label>
          {/* pregled videa — da se vidi da je link prava pjesma */}
          {youtubeId(d.youtube) && <YouTubePreview key={youtubeId(d.youtube)!} id={youtubeId(d.youtube)!} />}
          {/* svaki stih ima pjesmu koja se pušta odmah — postojeća se može pustiti ovdje (samo vlastite pjesme) */}
          {!OWN_AUDIO ? null : song?.state === 'ready' ? (
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
          {/* tekst pjesme: traži se sam (napredak korak po korak), a spremljen se vidi i podešava ovdje */}
          {lyrics.status !== 'idle' && <LyricsFind find={lyrics} onRetry={lyrics.retry} />}
          {d.song.trim() && youtubeId(d.youtube) && (OWN_AUDIO || lyrics.status === 'idle') && (
            <LyricsRow
              key={`tekst-${audioSlug(d.song)}`}
              song={d.song}
              info={song}
              canFetch={OWN_AUDIO && songsMode !== 'off'}
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
          <p className={labelCls}>Stil</p>
          {/* kratki nazivi (Velvet, Sepia…) — tri u redu, i sa sedamnaest stilova izbor ostaje pregledan */}
          <div className="mt-2 grid grid-cols-3 gap-2">
            {MOOD_KEYS.map((k) => {
              const m = MOODS[k]
              const on = d.mood === k
              return (
                <button
                  type="button"
                  key={k}
                  data-edit-mood={k}
                  onClick={() => setD({ ...d, mood: k })}
                  className="relative flex h-12 min-w-0 items-center gap-2 overflow-hidden rounded-2xl border px-3 text-left text-[12.5px] transition-colors md:h-10"
                  style={{
                    borderColor: on ? m.accent : 'rgba(255,255,255,0.08)',
                    background: `radial-gradient(circle at 15% 20%, ${m.gradient[2]} 0%, transparent 70%), radial-gradient(circle at 90% 90%, ${m.gradient[1]} 0%, transparent 70%), ${m.gradient[0]}`,
                    boxShadow: on ? `0 0 0 1px ${m.accent}66, 0 8px 24px ${m.gradient[1]}88` : undefined,
                    color: on ? '#fff' : 'rgba(255,255,255,0.65)',
                  }}
                >
                  <i className="block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.accent, boxShadow: `0 0 10px ${m.accent}` }} />
                  <span className="min-w-0 truncate">{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* dok se traži link ili tekst pjesme, stih čeka — da ne ode bez teksta */}
        <button
          type="submit"
          disabled={busy || searching}
          data-save
          className="mt-auto flex h-12 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-black disabled:opacity-50"
          style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
        >
          {searching && !busy && <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" aria-hidden />}
          {busy ? 'Čuvam…' : searching ? (linkLook === 'look' ? 'Tražim link…' : 'Tražim tekst…') : initial ? 'Sačuvaj izmjene' : 'Dodaj stih'}
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
      <div className="relative space-y-1.5 overflow-hidden">
        <LoadBar />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-white/[0.035] py-2.5 pl-2.5 pr-2">
            <i className="block h-[46px] w-[46px] shrink-0 animate-pulse rounded-xl bg-white/[0.06]" />
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
