'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import type { Verse } from '@/data/verses'
import { MOODS, MOOD_KEYS, type Mood } from '@/data/moods'
import { ALBUMS, albumOf } from '@/data/albums'
import { BRAND } from '@/lib/brand'
import { addDays, formatDayBs } from '@/lib/date'
import { withPeriod } from '@/lib/text'
import { inDeck } from '@/lib/deck'
import { PageShell } from '../PageShell'
import { DevicePreview } from './DevicePreview'

type AdminVerse = Verse & { active: boolean }
type Day = { date: string; verseId: string; manual: boolean; past: boolean; gap: number | null }
type Snapshot = {
  verses: AdminVerse[]
  days: Day[]
  next: Record<string, string | null>
  today: string
  lockedUntil: string | null
  source: 'supabase' | 'file' | 'static'
  writable: 'supabase' | 'file' | null
  placed?: string | null
}
type Draft = { text: string; song: string; album: string; year: string; mood: Mood; youtube: string }
type Op =
  | { op: 'add'; verse: Draft; date?: string }
  | { op: 'update'; id: string; verse: Draft }
  | { op: 'archive'; id: string }
  | { op: 'restore'; id: string }
  | { op: 'assign'; date: string; id: string }
  | { op: 'swap'; a: string; b: string }

const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar']
const WEEK = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']
const PAGE = 30
/** Sve u panelu pregleda osim samog okvira: padding 2×16, prekidač 40+12, dugme 12+36. */
const PREVIEW_CHROME = 32 + 52 + 48

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
/** "21. oktobar" */
function shortDate(iso: string) {
  const [, m, d] = iso.split('-').map(Number)
  return `${d}. ${MONTHS[m - 1]}`
}
/** Raspon koji pokriva mjesečnu mrežu: od ponedjeljka prije 1. do nedjelje poslije zadnjeg. */
function gridRange(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const tail = 6 - ((new Date(Date.UTC(y, m - 1, last)).getUTCDay() + 6) % 7)
  return { from: addDays(`${ym}-01`, -lead), to: addDays(`${ym}-${String(last).padStart(2, '0')}`, tail) }
}
function shiftMonth(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
function oneLine(t: string) {
  return withPeriod(t).replace(/\s*\n\s*/g, ' / ')
}

/**
 * Admin: kalendar objave i biblioteka stihova. Jednostavno namjerno —
 * dodir na dan, dodir na stih, i to je to.
 *
 * Sve izmjene idu kroz `/api/admin/catalog` kao operacije, a odgovor je
 * uvijek novo stanje — ekran nikad ne nagađa šta je server uradio.
 */
export function AdminPanel() {
  const router = useRouter()
  const [data, setData] = useState<Snapshot | null>(null)
  const [month, setMonth] = useState<string | null>(null)
  const [tab, setTab] = useState<'calendar' | 'library'>('calendar')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null)
  const [editor, setEditor] = useState<{ verse?: AdminVerse } | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [picker, setPicker] = useState<string | null>(null)
  const [archiving, setArchiving] = useState<AdminVerse | null>(null)

  const flash = useCallback((text: string, bad = false) => {
    setToast({ text, bad })
    setTimeout(() => setToast(null), 3200)
  }, [])

  // mjesec koji kalendar gleda; prvi poziv ne zna "danas", pa ga pita server
  useEffect(() => {
    const q = month ? gridRange(month) : null
    fetch(`/api/admin/catalog${q ? `?from=${q.from}&to=${q.to}` : ''}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) return router.refresh()
        const s = (await r.json()) as Snapshot
        if (!month) setMonth(s.today.slice(0, 7))
        else setData(s)
      })
      .catch(() => flash('Učitavanje nije uspjelo', true))
  }, [month, router, flash])

  const send = async (op: Op, ok: string | ((s: Snapshot) => string)) => {
    if (busy || !month) return false
    setBusy(true)
    // U prezentaciji se izmjena vidi, ali ne ide na server — pravi raspored
    // i katalog ostaju netaknuti. Ponovno učitavanje sve vrati.
    if (inDeck() && data) {
      await new Promise((r) => setTimeout(r, 350))
      const s = applyLocal(data, op)
      setData(s)
      flash(typeof ok === 'function' ? ok(s) : ok)
      setBusy(false)
      return true
    }
    try {
      const r = await fetch('/api/admin/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...op, ...gridRange(month) }),
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
      flash(typeof ok === 'function' ? ok(body) : ok)
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

  const byId = useMemo(() => new Map(data?.verses.map((v) => [v.id, v]) ?? []), [data])
  const active = data?.verses.filter((v) => v.active).length ?? 0
  const openDay = day ? data?.days.find((x) => x.date === day) : undefined
  const openVerse = openDay && byId.get(openDay.verseId)

  return (
    <PageShell
      wide
      back={null}
      eyebrow="Stih dana"
      title="Postavke"
      right={
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
      }
    >
      {!data || !month ? (
        <Skeleton />
      ) : (
        <>
          <Status data={data} />

          <div className="mb-5 flex items-center gap-3">
            {/* kartice se protežu do dugmeta "Novi stih" */}
            <div className="flex min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.035] p-1 backdrop-blur-xl">
              {(
                [
                  ['calendar', 'Kalendar'],
                  ['library', `Stihovi · ${active}`],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  data-tab={k}
                  className="relative h-9 flex-1 rounded-full px-3 text-[12px] font-medium transition-colors"
                  style={{ color: tab === k ? '#14100A' : 'rgba(255,255,255,0.6)' }}
                >
                  {tab === k && (
                    <motion.span
                      layoutId="admin-tab"
                      className="absolute inset-0 rounded-full"
                      style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
                    />
                  )}
                  <span className="relative">{label}</span>
                </button>
              ))}
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

          {tab === 'calendar' ? (
            <CalendarView
              month={month}
              data={data}
              byId={byId}
              onMonth={(n) => setMonth(shiftMonth(month, n))}
              onToday={() => setMonth(data.today.slice(0, 7))}
              onOpen={setDay}
              onSwap={(a, b) => send({ op: 'swap', a, b }, 'Stihovi su zamijenjeni')}
            />
          ) : (
            <Library
              data={data}
              busy={busy}
              onEdit={(v) => setEditor({ verse: v })}
              onArchive={setArchiving}
              onRestore={(v) =>
                send({ op: 'restore', id: v.id }, (s) =>
                  s.next[v.id] ? `Vraćen · ide ${shortDate(s.next[v.id]!)}` : 'Stih je vraćen',
                )
              }
            />
          )}

          <AnimatePresence>
            {editor && (
              <Editor
                key="editor"
                initial={editor.verse}
                today={data.today}
                busy={busy}
                onClose={() => setEditor(null)}
                onSave={async (draft, date) => {
                  const ok = editor.verse
                    ? await send({ op: 'update', id: editor.verse.id, verse: draft }, 'Stih je sačuvan')
                    : await send({ op: 'add', verse: draft, ...(date ? { date } : {}) }, (s) =>
                        s.placed ? `Stih je dodan · prvi put ${shortDate(s.placed)}` : 'Stih je dodan',
                      )
                  if (ok) {
                    setEditor(null)
                    setDay(null)
                  }
                }}
              />
            )}
            {openDay && openVerse && !picker && !editor && (
              <DaySheet
                key="day"
                day={openDay}
                verse={openVerse}
                locked={openDay.date === data.today}
                writable={Boolean(data.writable)}
                onClose={() => setDay(null)}
                onEdit={() => setEditor({ verse: openVerse })}
                onReplace={() => setPicker(openDay.date)}
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
                  Neće više ulaziti u raspored. Prošli dani, sačuvani stihovi i linkovi ostaju, a iz arhive ga možeš vratiti
                  kad god želiš.
                </p>
              </Confirm>
            )}
            {picker && (
              <Picker
                key="picker"
                date={picker}
                verses={data.verses.filter((v) => v.active)}
                current={data.days.find((d) => d.date === picker)?.verseId}
                onClose={() => setPicker(null)}
                onPick={async (id) => {
                  if (await send({ op: 'assign', date: picker, id }, 'Raspored je ažuriran')) {
                    setPicker(null)
                    setDay(null)
                  }
                }}
              />
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
  const days = s.days.map((d) => ({ ...d }))
  let verses = s.verses
  const next = { ...s.next }
  let placed: string | null = null
  const day = (date: string) => days.find((d) => d.date === date)
  if (op.op === 'swap') {
    const a = day(op.a)
    const b = day(op.b)
    if (a && b) [a.verseId, b.verseId, a.manual, b.manual] = [b.verseId, a.verseId, true, true]
  } else if (op.op === 'assign') {
    const d = day(op.date)
    if (d) [d.verseId, d.manual] = [op.id, true]
  } else if (op.op === 'add') {
    const id = `novi-${Date.now().toString(36)}`
    const { year, youtube, ...rest } = op.verse
    verses = [...verses, { ...rest, id, year: Number(year), ...(youtube ? { youtube } : {}), active: true }]
    const d = op.date ? day(op.date) : undefined
    if (d) [d.verseId, d.manual] = [id, true]
    placed = op.date ?? null
    next[id] = placed
  } else if (op.op === 'update') {
    const { year, youtube, ...rest } = op.verse
    verses = verses.map((v) => (v.id === op.id ? { ...v, ...rest, year: Number(year), youtube: youtube || undefined } : v))
  } else {
    const on = op.op === 'restore'
    verses = verses.map((v) => (v.id === op.id ? { ...v, active: on } : v))
  }
  return { ...s, days, verses, next, placed }
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

/**
 * Raspored kao kalendar, mjesec po mjesec, u bilo koju godinu. Svaki dan
 * nosi boju svog stiha; prošli dani su zatamnjeni. Dodir na dan otvara taj
 * dan; na računaru se dan prevuče na drugi i zamijene stihove.
 */
function CalendarView({
  month,
  data,
  byId,
  onMonth,
  onToday,
  onOpen,
  onSwap,
}: {
  month: string
  data: Snapshot
  byId: Map<string, AdminVerse>
  onMonth: (n: number) => void
  onToday: () => void
  onOpen: (date: string) => void
  onSwap: (a: string, b: string) => void
}) {
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  /*
   * Prevlačenje prstom (telefon). HTML5 drag & drop na dodir ne radi, pa:
   * drži dan ~0.4 s → zavibrira i "podigne" se → vuci preko drugog dana →
   * pusti i zamijene se. Pomak prije toga je obično skrolanje i ništa ne kvari.
   */
  const touch = useRef<{ from: string; timer: ReturnType<typeof setTimeout>; x: number; y: number; on: boolean } | null>(null)
  const justDragged = useRef(false)
  const overRef = useRef<string | null>(null)

  const touchStart = (date: string) => (e: React.TouchEvent) => {
    if (!writable) return
    const t = e.touches[0]
    const state = {
      from: date,
      x: t.clientX,
      y: t.clientY,
      on: false,
      timer: setTimeout(() => {
        state.on = true
        setDrag(date)
        navigator.vibrate?.(15)
      }, 400),
    }
    touch.current = state
  }

  useEffect(() => {
    let scroller: ReturnType<typeof setInterval> | null = null
    let lastY = 0
    const move = (e: TouchEvent) => {
      const st = touch.current
      if (!st) return
      const t = e.touches[0]
      if (!st.on) {
        // prst se pomjerio prije nego je dan "podignut" — to je skrolanje
        if (Math.hypot(t.clientX - st.x, t.clientY - st.y) > 8) {
          clearTimeout(st.timer)
          touch.current = null
        }
        return
      }
      e.preventDefault()
      lastY = t.clientY
      const el = document.elementFromPoint(t.clientX, t.clientY)?.closest<HTMLElement>('[data-date]')
      const d = el?.dataset.date
      overRef.current = d && el?.dataset.past !== '1' ? d : null
      setOver(overRef.current)
      // uz rub ekrana lista sama klizi
      if (!scroller) {
        scroller = setInterval(() => {
          const h = window.innerHeight
          if (lastY < 110) window.scrollBy(0, -12)
          else if (lastY > h - 90) window.scrollBy(0, 12)
        }, 16)
      }
    }
    const end = () => {
      const st = touch.current
      if (scroller) clearInterval(scroller)
      scroller = null
      if (!st) return
      clearTimeout(st.timer)
      touch.current = null
      if (st.on) {
        justDragged.current = true
        setTimeout(() => (justDragged.current = false), 350)
        const target = overRef.current
        overRef.current = null
        setOver(null)
        setDrag(null)
        if (target && target !== st.from) onSwap(st.from, target)
      }
    }
    document.addEventListener('touchmove', move, { passive: false })
    document.addEventListener('touchend', end)
    document.addEventListener('touchcancel', end)
    return () => {
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', end)
      if (scroller) clearInterval(scroller)
    }
  }, [onSwap])
  const [y, m] = month.split('-').map(Number)
  const writable = Boolean(data.writable)
  const isCurrent = month === data.today.slice(0, 7)

  // Telefon: prošli dani su na vrhu liste — skroluj odmah na današnji.
  // Čeka se da se lista iscrta i fontovi učitaju, inače visina još nije
  // konačna i skrol stane prerano.
  // Samo jednom po dolasku na tekući mjesec — izmjena dana ne smije vraćati skrol.
  const scrolled = useRef(false)
  useEffect(() => {
    if (!isCurrent) {
      scrolled.current = false
      return
    }
    if (scrolled.current || window.matchMedia('(min-width: 640px)').matches) return
    let cancelled = false
    const go = () => {
      if (cancelled) return
      const el = document.querySelector<HTMLElement>('[data-today]')
      if (!el) return
      // tek kad se stvarno skrolovalo (StrictMode u razvoju efekat pokrene dvaput)
      scrolled.current = true
      const header = document.querySelector('header')?.getBoundingClientRect().height ?? 0
      const y = el.getBoundingClientRect().top + window.scrollY - header - 16
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
    }
    const raf = requestAnimationFrame(() => {
      ;(document.fonts?.ready ?? Promise.resolve()).then(() => setTimeout(go, 60))
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [isCurrent, data.days])

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2 px-1">
        <button
          onClick={() => onMonth(-1)}
          disabled={month <= '2026-01'}
          aria-label="Prethodni mjesec"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:text-white disabled:opacity-25"
        >
          <Chevron dir="l" />
        </button>
        <div className="flex flex-col items-center">
          <p className="text-[1.25rem] leading-tight text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
            {cap(MONTHS[m - 1])} <span className="text-white/35">{y}</span>
          </p>
          {!isCurrent && (
            <button onClick={onToday} className="text-[10px] uppercase tracking-[0.18em]" style={{ color: BRAND.gold }}>
              danas
            </button>
          )}
        </div>
        <button
          onClick={() => onMonth(1)}
          aria-label="Sljedeći mjesec"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:text-white"
        >
          <Chevron dir="r" />
        </button>
      </div>

      {/* računar: mreža mjeseca */}
      <div className="hidden grid-cols-7 gap-2 sm:grid">
        {WEEK.map((w) => (
          <p key={w} className="pb-1 text-center text-[9px] uppercase tracking-[0.16em] text-white/30">
            {w}
          </p>
        ))}
        {data.days.map((d) => {
          const v = byId.get(d.verseId)
          if (d.date.slice(0, 7) !== month || !v) return <span key={d.date} className="aspect-square sm:aspect-[4/3.4]" />
          const mood = MOODS[v.mood]
          const isToday = d.date === data.today
          const num = Number(d.date.slice(8))
          return (
            <button
              key={d.date}
              // prošli dani se samo vide — ne otvaraju se
              disabled={d.past}
              onClick={() => onOpen(d.date)}
              data-cal={d.date}
              data-today={isToday || undefined}
              draggable={writable && !d.past}
              onDragStart={(e) => {
                setDrag(d.date)
                e.dataTransfer.setData('text/plain', d.date)
              }}
              onDragEnd={() => {
                setDrag(null)
                setOver(null)
              }}
              onDragOver={(e) => {
                if (d.past) return
                e.preventDefault()
                setOver(d.date)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (drag && drag !== d.date && !d.past) onSwap(drag, d.date)
                setDrag(null)
                setOver(null)
              }}
              title={`${v.song} — ${oneLine(v.text)}`}
              className="relative flex aspect-square flex-col overflow-hidden rounded-xl border p-1.5 text-left backdrop-blur-md transition-all enabled:hover:-translate-y-px enabled:hover:bg-white/[0.08] disabled:cursor-default sm:aspect-[4/3.4] sm:p-2"
              style={{
                // staklo, jednobojno; raspoloženje je samo tanka crtica dolje
                background: 'rgba(255,255,255,0.045)',
                borderColor:
                  over === d.date && drag !== d.date ? BRAND.gold : isToday ? `${BRAND.gold}cc` : 'rgba(255,255,255,0.09)',
                // prošlost: vidi se, ali tiho
                opacity: drag === d.date ? 0.4 : d.past ? 0.38 : 1,
                filter: d.past ? 'saturate(0.4)' : undefined,
              }}
            >
              <span className="flex items-center justify-between gap-1">
                <span
                  className="tabular text-[12px] font-semibold leading-none sm:text-[13px]"
                  style={{ color: isToday ? BRAND.gold : 'rgba(255,255,255,0.88)' }}
                >
                  {num}
                </span>
                <span className="flex items-center gap-1">
                </span>
              </span>
              <span
                className="mt-auto hidden truncate text-[9px] font-semibold uppercase leading-tight tracking-[0.1em] sm:block"
                style={{ color: BRAND.gold }}
              >
                {v.song}
              </span>
              <span className="hidden text-[11px] leading-snug text-white/75 sm:line-clamp-2" style={{ fontFamily: 'var(--font-serif), serif' }}>
                {v.text.split('\n')[0]}
              </span>
              <i className="mt-auto block h-[3px] w-4 rounded-full opacity-80 sm:mt-1.5 sm:w-6" style={{ background: mood.accent }} />
            </button>
          )
        })}
      </div>

      {/* telefon: polja mreže su premala za tekst, pa je mjesec lista dana */}
      <ol className="flex flex-col gap-1.5 sm:hidden">
        {data.days
          .filter((d) => d.date.slice(0, 7) === month)
          .map((d) => {
            const v = byId.get(d.verseId)
            if (!v) return null
            const isToday = d.date === data.today
            const [, , da] = d.date.split('-').map(Number)
            return (
              <li key={d.date} data-today={isToday || undefined} data-date={d.date} data-past={d.past ? '1' : undefined}>
                <button
                  disabled={d.past}
                  onTouchStart={d.past ? undefined : touchStart(d.date)}
                  onClick={() => !justDragged.current && onOpen(d.date)}
                  onContextMenu={(e) => e.preventDefault()}
                  className="flex w-full select-none items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all enabled:active:bg-white/[0.08] disabled:cursor-default [-webkit-touch-callout:none]"
                  style={{
                    background: drag === d.date ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.045)',
                    borderColor:
                      over === d.date && drag !== d.date
                        ? BRAND.gold
                        : isToday
                          ? `${BRAND.gold}cc`
                          : 'rgba(255,255,255,0.08)',
                    opacity: d.past ? 0.38 : 1,
                    transform: drag === d.date ? 'scale(1.03)' : over === d.date && drag ? 'scale(0.98)' : undefined,
                    boxShadow: drag === d.date ? '0 12px 30px rgba(0,0,0,0.5)' : undefined,
                  }}
                >
                  <span className="flex w-9 shrink-0 flex-col items-center">
                    <span
                      className="tabular text-[1.15rem] leading-none"
                      style={{ fontFamily: 'var(--font-serif), serif', color: isToday ? BRAND.gold : 'rgba(255,255,255,0.9)' }}
                    >
                      {da}
                    </span>
                    <span className="mt-1 text-[8px] uppercase tracking-[0.14em] text-white/35">
                      {formatDayBs(d.date).slice(0, 3)}
                    </span>
                  </span>
                  <i className="block h-8 w-[3px] shrink-0 rounded-full" style={{ background: MOODS[v.mood].accent }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
                      {oneLine(v.text)}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 truncate text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: BRAND.gold }}>
                      {v.song}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11px] text-white/40">
        {MOOD_KEYS.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <i className="block h-2 w-2 rounded-full" style={{ background: MOODS[k].accent }} />
            {MOODS[k].label}
          </span>
        ))}
      </div>
    </div>
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
    // najprije oni koji uskoro dolaze — to je ono što urednik najčešće traži
    .sort((a, b) => (data.next[a.id] ?? '9999').localeCompare(data.next[b.id] ?? '9999'))
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
            [false, 'U rasporedu', data.verses.length - archivedCount],
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
          const next = data.next[v.id]
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
                  <span className="text-white/40 sm:hidden">
                    {!archived && next ? ` · ${next === data.today ? 'danas' : shortDate(next)}` : ''}
                  </span>
                </p>
              </div>
              {/* u arhivi nema "sljedeći put" — kartica Arhiva već kaže sve */}
              {!archived && (
                <p className="hidden w-28 shrink-0 text-right text-[11px] text-white/45 sm:block">
                  {next ? (
                    <>
                      <span className="block text-[9px] uppercase tracking-[0.16em] text-white/25">sljedeći put</span>
                      {next === data.today ? 'danas' : shortDate(next)}
                    </>
                  ) : (
                    'nije zakazan'
                  )}
                </p>
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
}: {
  onClose: () => void
  children: React.ReactNode
  title: string
  eyebrow?: string
  wide?: boolean
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
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[30px] border border-white/10 shadow-[0_-20px_80px_rgba(0,0,0,0.7)] sm:rounded-[30px] ${wide ? 'max-w-4xl' : 'max-w-[440px]'}`}
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
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.28em]" style={{ color: BRAND.gold }}>
                {eyebrow}
              </p>
              <p className="text-[1.1rem] text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
                {title}
              </p>
            </div>
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
        <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}

function DaySheet({
  day,
  verse,
  locked,
  writable,
  onClose,
  onEdit,
  onReplace,
}: {
  day: Day
  verse: AdminVerse
  locked: boolean
  writable: boolean
  onClose: () => void
  onEdit: () => void
  onReplace: () => void
}) {
  const m = MOODS[verse.mood]
  const [, mo, da] = day.date.split('-').map(Number)
  return (
    <Sheet onClose={onClose} title={`${cap(formatDayBs(day.date))}, ${da}. ${MONTHS[mo - 1]}`}>
      <div
        className="flex min-h-[170px] flex-col items-center justify-center rounded-2xl p-6 text-center"
        style={{
          background: `radial-gradient(circle at 25% 15%, ${m.gradient[2]} 0%, transparent 60%), radial-gradient(circle at 80% 85%, ${m.gradient[1]} 0%, transparent 60%), ${m.gradient[0]}`,
          opacity: day.past ? 0.75 : 1,
        }}
      >
        <p className="text-[1.4rem] leading-tight" style={{ color: m.text, fontFamily: 'var(--font-serif), serif' }}>
          {withPeriod(verse.text)
            .split('\n')
            .map((l, i) => (
              <span key={i} className="block">
                {l}
              </span>
            ))}
        </p>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: BRAND.gold }}>
          {verse.song}
        </p>
        <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/40">
          {verse.album} · {verse.year} · {m.label}
        </p>
      </div>

      <p className="mt-3 text-center text-[12px] text-white/40">
        {day.past
          ? 'Ovaj dan je prošao.'
          : locked
              ? 'Danas.'
              : 'Po redu dodavanja — možeš ga zamijeniti.'}
        {!day.past && day.gap !== null && (
          <span className="text-amber-200/80">
            {' '}
            Isti stih je bio prije {day.gap} {day.gap === 1 ? 'dan' : 'dana'}.
          </span>
        )}
      </p>

      {writable && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={onEdit}
            className={`h-11 rounded-2xl border border-white/10 text-[13px] text-white/80 transition-colors hover:bg-white/5 ${day.past ? 'col-span-2' : ''}`}
          >
            Uredi tekst
          </button>
          {!day.past && (
            <button
              onClick={onReplace}
              className="h-11 rounded-2xl text-[13px] font-semibold text-black"
              style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
            >
              Zamijeni stih
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}

function Editor({
  initial,
  today,
  busy,
  onClose,
  onSave,
}: {
  initial?: AdminVerse
  today: string
  busy: boolean
  onClose: () => void
  onSave: (d: Draft, date?: string) => void
}) {
  const [d, setD] = useState<Draft>({
    text: initial?.text ?? '',
    song: initial?.song ?? '',
    album: initial?.album ?? '',
    year: String(initial?.year ?? ''),
    mood: initial?.mood ?? 'nostalgija',
    youtube: initial?.youtube ?? '',
  })
  const [date, setDate] = useState('')

  // visina forme — desna kolona pregleda se ravna po njoj (samo na računaru)
  const formRef = useRef<HTMLFormElement>(null)
  const [formH, setFormH] = useState(0)
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const sync = () => setWide(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    const el = formRef.current
    const ro = el ? new ResizeObserver(([e]) => setFormH(Math.round(e.contentRect.height))) : null
    if (el && ro) ro.observe(el)
    return () => {
      mq.removeEventListener('change', sync)
      ro?.disconnect()
    }
  }, [])
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
    }),
    [d, initial?.id],
  )
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setD({ ...d, [k]: e.target.value })
  const field =
    'h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 text-[14px] normal-case tracking-normal text-white outline-none placeholder:text-white/25 focus:border-[#BFA87F]/60'

  return (
    <Sheet wide onClose={onClose} title={initial ? 'Uredi stih' : 'Novi stih'}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_340px] md:items-start">
      {/* Pregled: pravi ekran aplikacije. Na telefonu iznad forme; na računaru
          desno, u panelu ISTE visine kao forma — telefon je popuni, a ekran
          računara stoji centriran u njoj. */}
      <div className="min-w-0 md:order-2">
        <div
          className="flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
          // na računaru TAČNO visina forme — ni piksel ispod nje
          style={formH && wide ? { height: formH } : undefined}
        >
          <DevicePreview verse={preview} maxHeight={wide && formH ? Math.max(200, formH - PREVIEW_CHROME) : 430} />
        </div>
      </div>
      <form
        ref={formRef}
        className="flex min-w-0 flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          onSave(d, date || undefined)
        }}
      >
        <label className="text-[11px] uppercase tracking-[0.16em] text-white/40">
          Stih <span className="normal-case tracking-normal text-white/25">— novi red kako se pjeva, najviše 3</span>
          <textarea
            name="text"
            value={d.text}
            onChange={set('text')}
            rows={3}
            required
            className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3.5 py-3 text-[16px] normal-case leading-snug tracking-normal text-white outline-none focus:border-[#BFA87F]/60"
            style={{ fontFamily: 'var(--font-serif), serif' }}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            Pjesma
            <input name="song" value={d.song} onChange={set('song')} required className={`mt-1.5 ${field}`} />
          </label>
          <label className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            Album
            {/* zakucana lista albuma — naziv uvijek tačan, a godina se popuni sama */}
            <select
              name="album"
              value={albumOf(d.album)?.title ?? d.album}
              onChange={(e) => {
                const a = ALBUMS.find((x) => x.title === e.target.value)
                setD({ ...d, album: e.target.value, year: a ? String(a.year) : d.year })
              }}
              required
              className={`mt-1.5 ${field} appearance-none [color-scheme:dark]`}
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
              {d.album && !albumOf(d.album) && <option value={d.album}>{d.album}</option>}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            Godina
            <input name="year" value={d.year} onChange={set('year')} inputMode="numeric" required className={`mt-1.5 ${field}`} />
          </label>
          <label className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            YouTube <span className="normal-case tracking-normal text-white/25">(opcija)</span>
            <input name="youtube" value={d.youtube} onChange={set('youtube')} placeholder="link" className={`mt-1.5 ${field}`} />
          </label>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-white/40">Raspoloženje</p>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {MOOD_KEYS.map((k) => (
              <button
                type="button"
                key={k}
                data-edit-mood={k}
                onClick={() => setD({ ...d, mood: k })}
                className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12px] transition-colors"
                style={{
                  borderColor: d.mood === k ? MOODS[k].accent : 'rgba(255,255,255,0.1)',
                  background: d.mood === k ? `${MOODS[k].accent}1a` : 'transparent',
                  color: d.mood === k ? '#fff' : 'rgba(255,255,255,0.55)',
                }}
              >
                <i className="block h-2 w-2 rounded-full" style={{ background: MOODS[k].accent }} />
                {MOODS[k].label}
              </button>
            ))}
          </div>
        </div>
        {!initial && (
          <label className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            Kada ide <span className="normal-case tracking-normal text-white/25">(opcija)</span>
            <input
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`mt-1.5 ${field} [color-scheme:dark]`}
            />
            <span className="mt-1.5 block normal-case leading-relaxed tracking-normal text-white/30">
              {date
                ? `Ide tačno ${shortDate(date)}, a poslije ulazi u rotaciju.`
                : 'Bez datuma ide u red — dolazi poslije zadnjeg dodanog stiha. Uvijek ga možeš premjestiti.'}
            </span>
          </label>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 h-12 rounded-2xl text-[14px] font-semibold text-black disabled:opacity-50"
          style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
        >
          {busy ? 'Čuvam…' : initial ? 'Sačuvaj izmjene' : 'Dodaj stih'}
        </button>
      </form>
      </div>
    </Sheet>
  )
}

function Picker({
  date,
  verses,
  current,
  onClose,
  onPick,
}: {
  date: string
  verses: AdminVerse[]
  current?: string
  onClose: () => void
  onPick: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const list = verses.filter((v) => !q || `${v.text} ${v.song}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <Sheet onClose={onClose} title={`Stih za ${shortDate(date)}`}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Traži…"
        className="mb-3 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 text-[14px] text-white outline-none focus:border-[#BFA87F]/60"
      />
      <ul className="flex flex-col gap-2">
        {list.map((v) => (
          <li key={v.id}>
            <button
              onClick={() => onPick(v.id)}
              className="w-full rounded-2xl border p-3.5 text-left transition-colors hover:bg-white/[0.05]"
              style={{ borderColor: v.id === current ? BRAND.gold : 'rgba(255,255,255,0.08)' }}
            >
              <p className="text-[15px] leading-snug text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
                {oneLine(v.text)}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.14em]" style={{ color: BRAND.gold }}>
                {v.song} <span className="text-white/30">· {MOODS[v.mood].label}</span>
              </p>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
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
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 35 }, (_, i) => (
        <div key={i} className="aspect-square animate-pulse rounded-xl bg-white/[0.04]" />
      ))}
    </div>
  )
}
