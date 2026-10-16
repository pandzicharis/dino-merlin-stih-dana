'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import type { Verse } from '@/data/verses'
import { MOODS, MOOD_KEYS, type Mood } from '@/data/moods'
import { ALBUMS, albumOf } from '@/data/albums'
import { BRAND } from '@/lib/brand'
import { withPeriod } from '@/lib/text'
import { inDeck } from '@/lib/deck'
import { PageShell } from '../PageShell'
import { DevicePreview } from './DevicePreview'
import { PrintSlips } from './PrintSlips'
import { VERSE_FONTS, VERSE_FONT_KEYS, parseFont, sameStyle, stringifyFont, styleCss, styleOf, verseWords, type VerseFont, type WordStyle } from '@/lib/fonts'
import { DrawerIcon } from '../DrawerIcon'

type AdminVerse = Verse & { active: boolean }
type Snapshot = {
  verses: AdminVerse[]
  source: 'supabase' | 'file' | 'static'
  writable: 'supabase' | 'file' | null
}
type Draft = { text: string; song: string; album: string; year: string; mood: Mood; youtube: string; font: string }
type Op =
  | { op: 'add'; verse: Draft }
  | { op: 'update'; id: string; verse: Draft }
  | { op: 'archive'; id: string }
  | { op: 'restore'; id: string }

const PAGE = 30
/** printer — dugme u zaglavlju i znak modala za štampu */
const PRINT_ICON = (
  <>
    <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" />
    <rect x="6" y="14" width="12" height="7" rx="1" />
  </>
)
/** Sve u panelu pregleda osim samog uređaja: prekidač 42 + razmak 16. */
const PREVIEW_CHROME = 42 + 16

function oneLine(t: string) {
  return withPeriod(t).replace(/\s*\n\s*/g, ' / ')
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
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null)
  const [editor, setEditor] = useState<{ verse?: AdminVerse } | null>(null)
  const [archiving, setArchiving] = useState<AdminVerse | null>(null)
  // papirići za štampu (modal)
  const [printing, setPrinting] = useState(false)
  const [printCount, setPrintCount] = useState(0)

  const flash = useCallback((text: string, bad = false) => {
    setToast({ text, bad })
    setTimeout(() => setToast(null), 3200)
  }, [])

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
              <p className="mt-0.5 text-[12px] leading-snug text-white/40">
                Svako svaki dan izvuče svoj, bez ponavljanja dok ne prođe sve.
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

          <Library data={data} busy={busy} onEdit={(v) => setEditor({ verse: v })} onArchive={setArchiving} onRestore={(v) => send({ op: 'restore', id: v.id }, 'Stih je vraćen u izvlačenje')} />

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
                busy={busy}
                onClose={() => setEditor(null)}
                onSave={async (draft) => {
                  const ok = editor.verse
                    ? await send({ op: 'update', id: editor.verse.id, verse: draft }, 'Stih je sačuvan')
                    : await send({ op: 'add', verse: draft }, 'Stih je dodan · ulazi u izvlačenje od sutra')
                  if (ok) setEditor(null)
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

      <AnimatePresence>
        {toast && (
          <motion.p
            className="fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[120] mx-auto w-fit max-w-[90vw] rounded-full border px-5 py-2.5 text-center text-[13px] shadow-2xl backdrop-blur"
            style={{
              borderColor: toast.bad ? 'rgba(253,164,175,0.3)' : `${BRAND.gold}55`,
              background: 'rgba(10,9,9,0.92)',
              color: toast.bad ? '#fecdd3' : '#f5ecd9',
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
          >
            {toast.text}
          </motion.p>
        )}
      </AnimatePresence>
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

function Library({
  data,
  busy,
  onEdit,
  onArchive,
  onRestore,
}: {
  data: Snapshot
  busy: boolean
  onEdit: (v: AdminVerse) => void
  onArchive: (v: AdminVerse) => void
  onRestore: (v: AdminVerse) => void
}) {
  const [q, setQ] = useState('')
  const [mood, setMood] = useState<Mood | null>(null)
  const [archived, setArchived] = useState(false)
  const [page, setPage] = useState(0)
  const writable = Boolean(data.writable)

  const list = data.verses
    .filter(
      (v) =>
        v.active !== archived &&
        (!mood || v.mood === mood) &&
        (!q || `${v.text} ${v.song} ${v.album}`.toLowerCase().includes(q.toLowerCase())),
    )
    // najnoviji prvi — to je ono što urednik najčešće traži
    .reverse()
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const p = Math.min(page, pages - 1)
  const shown = list.slice(p * PAGE, p * PAGE + PAGE)
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
      </div>

      {/* lista ima svoju visinu i skrola se unutra — filteri i kartice ostaju na mjestu */}
      <div className="max-h-[min(62dvh,640px)] overflow-y-auto overscroll-contain rounded-[20px] border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
        {shown.map((v, i) => {
          const m = MOODS[v.mood]
          return (
            <div
              key={v.id}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] sm:gap-4"
              style={{ borderTop: i ? '1px solid rgba(255,255,255,0.05)' : undefined }}
            >
              <i className="block h-9 w-1 shrink-0 rounded-full" style={{ background: m.accent }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
                  {oneLine(v.text)}
                </p>
                <p className="mt-1 truncate text-[10px] uppercase tracking-[0.14em]">
                  <span style={{ color: BRAND.gold }}>{v.song}</span>
                  <span className="text-white/30">
                    {' '}
                    · {v.album} · {v.year}
                  </span>
                </p>
              </div>
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
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-[12px] text-white/50">
          <span>
            {p * PAGE + 1}–{Math.min(list.length, p * PAGE + PAGE)} od {list.length}
          </span>
          <span className="flex items-center gap-1">
            <button
              onClick={() => setPage(p - 1)}
              disabled={p === 0}
              aria-label="Prethodna strana"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 disabled:opacity-25"
            >
              <Chevron dir="l" />
            </button>
            <span className="tabular px-2">
              {p + 1} / {pages}
            </span>
            <button
              onClick={() => setPage(p + 1)}
              disabled={p >= pages - 1}
              aria-label="Sljedeća strana"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 disabled:opacity-25"
            >
              <Chevron dir="r" />
            </button>
          </span>
        </div>
      )}
    </>
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
          <div className="mb-4 flex items-center justify-between gap-3">
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
            <div className="flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
            {actions}
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
  busy,
  onClose,
  onSave,
}: {
  initial?: AdminVerse
  busy: boolean
  onClose: () => void
  onSave: (d: Draft) => void
}) {
  const [d, setD] = useState<Draft>({
    text: initial?.text ?? '',
    song: initial?.song ?? '',
    album: initial?.album ?? '',
    year: String(initial?.year ?? ''),
    mood: initial?.mood ?? 'nostalgija',
    youtube: initial?.youtube ?? '',
    font: initial?.font ?? '',
  })

  // Na računaru pregled je visok koliko i forma (forma ima svoju visinu,
  // pregled se samo prilagodi — nikad obrnuto, da se ne vrte u krug).
  const [wide, setWide] = useState(false)
  const [full, setFull] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [formH, setFormH] = useState(0)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const sync = () => setWide(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    const ro = new ResizeObserver(([e]) => setFormH(e.contentRect.height))
    if (formRef.current) ro.observe(formRef.current)
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
      album: d.album.trim() || 'Album',
      year: Number(d.year) || new Date().getFullYear(),
      mood: d.mood,
      ...(d.youtube.trim() ? { youtube: d.youtube.trim() } : {}),
      ...(d.font ? { font: d.font } : {}),
    }),
    [d, initial?.id],
  )
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setD({ ...d, [k]: e.target.value })
  const field =
    'h-12 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 text-[14px] normal-case tracking-normal text-white outline-none placeholder:text-white/25 focus:border-[#BFA87F]/60'
  const labelCls = 'block text-[11px] uppercase tracking-[0.16em] text-white/45'

  return (
    <Sheet
      wide
      onClose={onClose}
      title={initial ? 'Uredi stih' : 'Novi stih'}
      icon={initial ? <path d="M4 20h4L19 9l-4-4L4 16z" /> : <path d="M12 5v14M5 12h14" />}
      actions={
        <button
          type="button"
          onClick={() => setFull(true)}
          className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-[12px] text-white/75 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
          Puni pregled
        </button>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-start">
      {/* Pregled: pravi ekran aplikacije u istom okviru kao u prezentaciji
          (iPhone, ili prozor preglednika). Na telefonu iznad forme; na
          računaru desno, bez okvira oko njega — uređaj je sam svoj okvir. */}
      <div className="min-w-0 md:order-2">
        <div className="flex flex-col items-center justify-center rounded-3xl bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.045),transparent_70%)]">
          <DevicePreview verse={preview} maxHeight={wide && formH ? formH - PREVIEW_CHROME : 460} full={full} onFull={setFull} />
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
            <span style={{ color: lines.length > 3 ? '#fda4af' : 'rgba(255,255,255,0.4)' }}>
              {lines.length}/3 reda
            </span>
            <span style={{ color: chars > 110 ? '#fda4af' : 'rgba(255,255,255,0.4)' }}>{chars}/110 znakova</span>
          </span>
        </label>

        {/* font — glavni za cijeli stih, pa po želji riječ po riječ */}
        <FontPicker value={d.font} text={d.text} onChange={(font) => setD({ ...d, font })} labelCls={labelCls} />

        {/* pjesma */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <label className="col-span-2 block md:col-span-1">
            <span className={labelCls}>Pjesma</span>
            <input name="song" value={d.song} onChange={set('song')} required placeholder="Naziv pjesme" className={`mt-2 ${field}`} />
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
                required
                className={`${field} appearance-none [color-scheme:dark] ${album ? 'pl-12' : ''}`}
              >
                <option value="" disabled>
                  Izaberi album
                </option>
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
          <label className="block">
            <span className={labelCls}>Godina</span>
            <input name="year" value={d.year} onChange={set('year')} inputMode="numeric" required className={`mt-2 ${field}`} />
          </label>
          <label className="block">
            <span className={labelCls}>
              YouTube <span className="normal-case tracking-normal text-white/30">(opcija)</span>
            </span>
            <input name="youtube" value={d.youtube} onChange={set('youtube')} placeholder="link" className={`mt-2 ${field}`} />
          </label>
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
      </div>
    </Sheet>
  )
}

/**
 * Fontovi stiha red po red — svaki red svoj font (npr. prvi red klasični,
 * drugi pisani), podebljano (B) i ukoso (I; samo klasični). Podrazumijevano
 * svi redovi imaju današnji font (Fraunces).
 */
function FontPicker({
  value,
  text,
  onChange,
  labelCls,
}: {
  value: string
  text: string
  onChange: (font: string) => void
  labelCls: string
}) {
  const map = parseFont(value)
  const rows = verseWords(text)
  const starts = rows.reduce<number[]>((acc, r, i) => [...acc, i ? acc[i - 1] + rows[i - 1].length : 0], [])
  // stil reda — ako su sve riječi istog stila; inače stil prve riječi
  const styleOfLine = (li: number): WordStyle => styleOf(map, starts[li])
  const uniform = (li: number) => rows[li].every((_, j) => sameStyle(styleOf(map, starts[li] + j), styleOfLine(li)))
  const setLine = (li: number, patch: Partial<WordStyle>) => {
    const cur = styleOfLine(li)
    const next: WordStyle = { ...cur, ...patch }
    if (VERSE_FONTS[next.font].kind === 'pisani') delete next.italic
    if (!next.bold) delete next.bold
    if (!next.italic) delete next.italic
    const words = { ...map.words }
    rows[li].forEach((_, j) => {
      if (sameStyle(next, map.main)) delete words[starts[li] + j]
      else words[starts[li] + j] = next
    })
    onChange(stringifyFont({ main: map.main, words }) ?? '')
  }

  return (
    <div>
      <p className={labelCls}>
        Font <span className="normal-case tracking-normal text-white/30">— red po red (klasični, pa pisani · B podebljano · I ukoso)</span>
      </p>
      <div className="mt-2 space-y-1 rounded-xl border border-white/[0.06] bg-black/25 p-1.5">
        {rows.length === 0 && <p className="px-1 py-1.5 text-[12px] text-white/35">Upiši stih — svaki red dobije svoj izbor fonta.</p>}
        {rows.map((r, li) => {
          const st = styleOfLine(li)
          return (
            <FontRow
              key={li}
              label={`${li + 1}. red`}
              style={uniform(li) ? st : null}
              onPick={(k) => setLine(li, { font: k })}
              onBold={() => setLine(li, { bold: !st.bold })}
              onItalic={() => setLine(li, { italic: !st.italic })}
              data={String(li)}
            >
              {r.map((w, j) => (
                <span key={j} style={{ ...styleCss(styleOf(map, starts[li] + j)), fontSize: undefined, lineHeight: undefined, paddingInline: undefined }}>
                  {w}{' '}
                </span>
              ))}
            </FontRow>
          )
        })}
      </div>
    </div>
  )
}

/** Red u izboru fonta: oznaka, tekst u svom stilu, šest "Aa" dugmića, B i I. */
function FontRow({
  label,
  children,
  style,
  onPick,
  onBold,
  onItalic,
  data,
}: {
  label: React.ReactNode
  children?: React.ReactNode
  /** stil reda; null kad su riječi u redu različite */
  style: WordStyle | null
  onPick: (k: VerseFont) => void
  onBold: () => void
  onItalic: () => void
  data?: string
}) {
  const tile = (on: boolean) => ({
    borderColor: on ? BRAND.gold : 'rgba(255,255,255,0.08)',
    background: on ? `${BRAND.gold}26` : 'rgba(0,0,0,0.3)',
    color: on ? '#fff' : 'rgba(255,255,255,0.65)',
  })
  const script = style ? VERSE_FONTS[style.font].kind === 'pisani' : false
  return (
    <div className="flex items-center gap-2" data-edit-font-row={data}>
      <span className="w-11 shrink-0 text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[15px] text-white/85">{children}</span>
      <div className="flex gap-1">
        {VERSE_FONT_KEYS.map((k) => {
          const f = VERSE_FONTS[k]
          const on = style?.font === k
          return (
            <button
              type="button"
              key={k}
              onClick={() => onPick(k)}
              data-edit-font-pick={`${data}-${k}`}
              title={`${f.label} · ${f.kind === 'pisani' ? 'pisani' : 'klasični'}`}
              aria-pressed={on}
              className="flex h-7 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors"
              style={tile(on)}
            >
              <span style={{ fontFamily: `${f.family}, serif`, fontSize: `${15 * f.scale}px`, lineHeight: 1 }}>Aa</span>
            </button>
          )
        })}
        <span className="mx-0.5 w-px self-stretch bg-white/10" aria-hidden />
        <button
          type="button"
          onClick={onBold}
          data-edit-font-b={data}
          title="Podebljano"
          aria-pressed={Boolean(style?.bold)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[13px] font-bold transition-colors"
          style={tile(Boolean(style?.bold))}
        >
          B
        </button>
        <button
          type="button"
          onClick={onItalic}
          data-edit-font-i={data}
          disabled={script}
          title={script ? 'Pisani font je već ukoso' : 'Ukoso'}
          aria-pressed={Boolean(style?.italic)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-serif text-[14px] italic transition-colors disabled:opacity-30"
          style={tile(Boolean(style?.italic))}
        >
          I
        </button>
      </div>
    </div>
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
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
      ))}
    </div>
  )
}
