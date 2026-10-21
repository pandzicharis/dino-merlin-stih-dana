'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { BRAND } from '@/lib/brand'
import { SEND_TIME } from '@/lib/date'
import { unsubscribeFromPush } from '@/lib/push-client'
import { haptic } from '@/lib/haptic'
import { saveAllFavorites } from '@/lib/storage'
import { loadVerses } from '@/lib/verses-client'
import { useNotify, type NotifyState } from './Notify'
import { Icon, TOAST_OK, toast } from './Toast'
import { MagazaLogo } from './MagazaLogo'
import { ARTIST_LINKS } from './ArtistLinks'
import { GearIcon } from './Settings'
import { QrCode } from './deck/QrCode'
import APP_QR from '@/data/app-qr.json'
import { SheetBackdrop, SheetLayer, SheetSlide, useSheetDrag, useSheetOpen } from './Sheet'

/** Verzija iz `public/sw.js` (`stihdana-v1.0`) — 1.0, 1.1… raste s izdanjima. */
const versionOf = (name: string) => /^stihdana-v(\d+\.\d+)$/.exec(name)?.[1]

const NOTIFY_SUB: Record<NotifyState, string> = {
  on: `Stiže svaki dan u ${SEND_TIME}`,
  off: 'Isključeno',
  busy: 'Trenutak…',
  denied: 'Blokirano u postavkama telefona',
  install: 'Dodaj aplikaciju na početni ekran',
  unsupported: 'Ovaj preglednik ih ne podržava',
}

/** Postavke kao donji panel — isti kao sačuvani i dijeljenje. */
export default function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notify = useNotify()
  const [version, setVersion] = useState('')

  useSheetOpen(open)
  const sheetDrag = useSheetDrag(onClose, open)

  // Escape zatvara, a stranica ispod ne skrola dok je panel otvoren
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  // Verzija koju telefon zaista drži (keš service workera); bez njega (prvo
  // otvaranje, lokalno) — ona s mreže, iz samog sw.js.
  useEffect(() => {
    if (!open) return
    let alive = true
    void (async () => {
      let v: string | undefined
      try {
        v = (await caches.keys()).map(versionOf).find(Boolean)
      } catch {}
      if (!v) {
        try {
          const text = await fetch('/sw.js', { cache: 'no-store' }).then((r) => r.text())
          v = /stihdana-v(\d+\.\d+)/.exec(text)?.[1]
        } catch {}
      }
      if (alive && v) setVersion(v)
    })()
    return () => {
      alive = false
    }
  }, [open])

  if (typeof document === 'undefined') return null

  const on = notify.state === 'on'

  return createPortal(
    <AnimatePresence>
      {open && (
        <SheetLayer className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <SheetBackdrop onClose={onClose} />

          <SheetSlide>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Postavke"
              className="os-sheet relative flex max-h-[88dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[30px] border border-b-0 border-white/10 sm:border-b shadow-[0_-20px_80px_rgba(0,0,0,0.7)] sm:rounded-[30px]"
              {...sheetDrag}
              style={{
                ...sheetDrag.style,
                background: `radial-gradient(120% 60% at 50% 0%, ${BRAND.gold}1a 0%, transparent 60%), linear-gradient(180deg, #121010 0%, #0a0909 100%)`,
              }}
            >
              <span
                className="pointer-events-none absolute inset-x-10 top-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${BRAND.gold}80, transparent)` }}
                aria-hidden
              />

              {/* zaglavlje kao na ostalim panelima */}
              <div className="shrink-0 px-5 pt-3">
                <span className="os-grabber mx-auto mb-3 block h-1 w-10 rounded-full bg-white/15 sm:hidden" aria-hidden />
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                      style={{ borderColor: `${BRAND.gold}55`, background: `radial-gradient(circle, ${BRAND.gold}24, transparent 70%)`, color: BRAND.gold }}
                      aria-hidden
                    >
                      <GearIcon />
                    </span>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.28em]" style={{ color: BRAND.gold }}>
                        Stih dana
                      </p>
                      <p className="text-[1.1rem] text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
                        Postavke
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
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
                <Section title="Obavijesti">
                  <Row
                    tile={<Bell />}
                    title={`Stih dana u ${SEND_TIME}`}
                    sub={NOTIFY_SUB[notify.state]}
                    onClick={notify.toggle}
                    right={<Switch on={on} busy={notify.state === 'busy'} disabled={notify.state === 'unsupported'} />}
                    label={on ? 'Isključi obavijesti' : 'Uključi obavijesti'}
                  />
                </Section>

                {/* visoko, da se QR vidi čim se otvori */}
                <Section title="Podijeli">
                  <ShareApp />
                </Section>

                <Section title="Dino Merlin">
                  <Link href="https://magaza.com.ba" tile={<MagazaLogo height={8} color="#FFFFFF" />} title="Magaza" sub="magaza.com.ba" />
                  <Link
                    href="https://dinomerlin.com/live"
                    tile={
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/brand/signature.webp?v=2" alt="" className="h-6 w-auto opacity-90" draggable={false} />
                    }
                    title="Koncerti uživo"
                    sub="dinomerlin.com/live"
                  />
                  {/* mreže — bile su ispod gramofona na početnoj */}
                  {ARTIST_LINKS.filter((l) => l.label !== 'dinomerlin.com').map((l) => (
                    <Link
                      key={l.label}
                      href={l.href}
                      tile={
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={BRAND.gold} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d={l.d} />
                        </svg>
                      }
                      title={l.label}
                      sub={l.handle}
                    />
                  ))}
                </Section>

                <Section title="Aplikacija">
                  {/* PRIVREMENO — test opterećenja plejera, obrisati poslije */}
                  <SaveAll />
                  <Wipe />
                </Section>

                <p className="tabular mb-1 mt-6 h-4 text-center text-[10px] font-medium uppercase tracking-[0.28em] text-white/30">
                  {version && `Verzija ${version}`}
                </p>
              </div>
            </motion.div>
          </SheetSlide>
        </SheetLayer>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-2">
      <p className="mb-2.5 ml-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">{title}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

const ROW =
  'flex w-full items-center gap-3.5 rounded-[20px] border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-left transition-colors hover:bg-white/[0.05] active:bg-white/[0.07]'

function Tile({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.06] bg-white/[0.05]"
      style={{ color: danger ? '#D08C8C' : BRAND.gold }}
      aria-hidden
    >
      {children}
    </span>
  )
}

function Text({ title, sub, danger = false }: { title: string; sub: string; danger?: boolean }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-medium leading-tight" style={{ color: danger ? '#E6A4A4' : 'rgba(255,255,255,0.9)' }}>
        {title}
      </span>
      <span className="mt-1 block text-[12.5px] leading-snug text-white/45">{sub}</span>
    </span>
  )
}

function Row({
  tile,
  title,
  sub,
  right,
  onClick,
  label,
}: {
  tile: ReactNode
  title: string
  sub: string
  right: ReactNode
  onClick: () => void
  label: string
}) {
  return (
    <button onClick={onClick} aria-label={label} className={ROW}>
      <Tile>{tile}</Tile>
      <Text title={title} sub={sub} />
      {right}
    </button>
  )
}

function Link({ href, tile, title, sub }: { href: string; tile: ReactNode; title: string; sub: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => haptic(5)} className={ROW}>
      <Tile>{tile}</Tile>
      <Text title={title} sub={sub} />
      <Chevron />
    </a>
  )
}

/**
 * "Podijeli aplikaciju" — red koji se otvori (harmonika) i pokaže QR kod
 * aplikacije: drugi ga skenira kamerom i otvori Stih dana. Ispod adresa i
 * dugme za slanje linka (sistemsko dijeljenje, ili kopiranje).
 */
function ShareApp() {
  const [open, setOpen] = useState(false)
  // otvoren — panel doskrola da se cio QR vidi
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => box.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 380)
    return () => clearTimeout(t)
  }, [open])
  const url = APP_QR.url
  const send = async () => {
    haptic(6)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Stih dana', text: 'Jedan stih Dine Merlina, svaki dan u 12:00h', url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast({ id: 'app-link', title: 'Link kopiran', sub: url.replace('https://', ''), color: TOAST_OK, icon: <Icon.ok /> })
    } catch {
      /* odustao od dijeljenja */
    }
  }
  return (
    <div ref={box} className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.03]">
      <button
        onClick={() => {
          haptic(5)
          setOpen((o) => !o)
        }}
        aria-expanded={open}
        data-tip="share-app"
        className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.05] active:bg-white/[0.07]"
      >
        <Tile>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3.5" y="3.5" width="6" height="6" rx="1.2" />
            <rect x="14.5" y="3.5" width="6" height="6" rx="1.2" />
            <rect x="3.5" y="14.5" width="6" height="6" rx="1.2" />
            <path d="M14.5 14.5h2.5v2.5M20.5 14.5v.01M14.5 20.5h.01M17.5 20.5h3v-3" />
          </svg>
        </Tile>
        <Text title="Podijeli aplikaciju" sub="QR kod — neka skenira kamerom" />
        <motion.span className="flex text-white/35" animate={{ rotate: open ? 90 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
          <Chevron />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="qr"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-col items-center gap-4 px-4 pb-5 pt-1">
              <motion.div
                className="rounded-[22px] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
                style={{ background: '#F6F1E7' }}
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                <QrCode qr={APP_QR} className="block h-[200px] w-[200px]" title="QR kod — otvori Stih dana" />
              </motion.div>
              <p className="text-[12.5px] text-white/50">{url.replace('https://', '')}</p>
              <button
                onClick={send}
                className="flex h-10 items-center gap-2 rounded-full border px-4 text-[10px] font-medium uppercase tracking-[0.22em] transition-transform active:scale-95"
                style={{ borderColor: `${BRAND.gold}55`, background: `${BRAND.gold}14`, color: BRAND.gold }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3v13M12 3 8 7M12 3l4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                </svg>
                Pošalji link
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Prekidač kao na telefonu — zlatni kad je uključen. */
function Switch({ on, busy, disabled }: { on: boolean; busy: boolean; disabled: boolean }) {
  return (
    <span
      className={`relative h-[30px] w-[52px] shrink-0 rounded-full border transition-colors duration-300 ${disabled ? 'opacity-40' : ''}`}
      style={{
        background: on ? `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` : 'rgba(255,255,255,0.08)',
        borderColor: on ? 'transparent' : 'rgba(255,255,255,0.12)',
      }}
      aria-hidden
    >
      <motion.span
        className="absolute top-[3px] h-[22px] w-[22px] rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
        style={{ background: on ? '#14100A' : 'rgba(255,255,255,0.75)', opacity: busy ? 0.5 : 1 }}
        initial={false}
        animate={{ left: on ? 26 : 3 }}
        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
      />
    </span>
  )
}

/**
 * Obriši aplikaciju s ovog uređaja: sačuvane stihove, postavke, keš i
 * service worker, i odjavi obavijesti — pa se učita ispočetka, kao prvi
 * put. Traži drugi dodir, da se ne desi slučajno.
 */
/** PRIVREMENO — test opterećenja plejera: svi stihovi u sačuvane. Obrisati poslije testa. */
function SaveAll() {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    if (busy) return
    setBusy(true)
    haptic(10)
    try {
      const n = saveAllFavorites((await loadVerses()).map((v) => v.id))
      toast({ id: 'save-all', title: n ? `Dodano ${n} stihova` : 'Svi su već sačuvani', sub: 'Test plejera', color: TOAST_OK, icon: <Icon.ok /> }, 3000)
    } finally {
      setBusy(false)
    }
  }
  return (
    <button onClick={run} className={ROW}>
      <Tile>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={BRAND.gold} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Tile>
      <Text title={busy ? 'Dodajem…' : 'Sačuvaj sve stihove'} sub="Test plejera — privremeno" />
      <Chevron />
    </button>
  )
}

function Wipe() {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  const run = async () => {
    if (busy) return
    if (!armed) {
      haptic(10)
      setArmed(true)
      return
    }
    setBusy(true)
    haptic([10, 40, 10])
    // odjava obavijesti čeka service worker — ne duže od sekunde i po
    await Promise.race([unsubscribeFromPush().catch(() => {}), new Promise((r) => setTimeout(r, 1500))])
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      /* privatni prozor */
    }
    try {
      for (const k of await caches.keys()) await caches.delete(k)
    } catch {}
    try {
      for (const r of (await navigator.serviceWorker?.getRegistrations()) ?? []) await r.unregister()
    } catch {}
    toast({ id: 'wipe', title: 'Obrisano sa uređaja', sub: 'Aplikacija se učitava ispočetka', color: TOAST_OK, icon: <Icon.ok /> }, 4000)
    setTimeout(() => window.location.replace('/'), 1400)
  }

  return (
    <button onClick={run} className={ROW} style={armed ? { borderColor: 'rgba(208,140,140,0.45)', background: 'rgba(208,140,140,0.08)' } : undefined}>
      <Tile danger>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3.5 2.8 19.5h18.4z" />
          <path d="M12 10v4.2M12 17.2v.01" />
        </svg>
      </Tile>
      <Text
        danger
        title={busy ? 'Brišem…' : armed ? 'Dodirni ponovo za brisanje' : 'Obriši sa ovog uređaja'}
        sub="Briše sačuvane stihove, postavke i keš — aplikacija se učita ispočetka"
      />
      <Chevron />
    </button>
  )
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-white/35" aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

function Bell() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  )
}

