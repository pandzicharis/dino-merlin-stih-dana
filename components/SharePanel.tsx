'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
import { oneLine, asWritten } from '@/lib/text'
import {
  SHARE_FORMATS,
  canvasToBlob,
  drawShareImage,
  type ShareFormat,
} from '@/lib/share-image'
import { getSharePrefs, setSharePrefs } from '@/lib/storage'
import { recordStory, videoSupported } from '@/lib/share-video'
import { haptic } from '@/lib/haptic'
import { DrawerIcon } from './DrawerIcon'
import { Icon, TOAST_BAD, TOAST_OK, toast } from './Toast'
import { SheetBackdrop, SheetLayer, SheetSlide, useSheetDrag, useSheetOpen } from './Sheet'

type Target = 'share' | 'save'

/** Teški dio dijeljenja — učitava se tek na prvi dodir (vidi ShareSheet.tsx). */
export default function SharePanel({
  open,
  onClose,
  verse,
  date,
}: {
  open: boolean
  onClose: () => void
  verse: Verse
  date: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Zadnji izbor se pamti — ko dijeli za Story, dijeli uvijek za Story.
  // Na serveru je storage prazan, ali panel se ionako crta tek kad se otvori.
  const [format, setFormat] = useState<ShareFormat>(() => {
    const f = getSharePrefs().format
    return f && f in SHARE_FORMATS ? (f as ShareFormat) : 'story'
  })
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState<Target | null>(null)
  // video za Story (lib/share-video.ts) — važi za stih i format za koji je snimljen
  const [canVideo] = useState(videoSupported)
  const vidKey = `${verse.id}|${format}`
  const [vidState, setVid] = useState<{ key: string; p: number; file?: File } | null>(null)
  const vid = vidState?.key === vidKey ? vidState : null
  const recording = Boolean(vid && !vid.file)

  useEffect(() => {
    if (!open || !canvasRef.current) return
    let alive = true
    drawShareImage(canvasRef.current, { verse, date, format }).then(() => {
      if (alive) setReady(true)
    })
    return () => {
      alive = false
    }
  }, [open, verse, date, format])

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

  const choose = (f: ShareFormat) => {
    haptic(5)
    setFormat(f)
    setSharePrefs({ format: f })
  }

  const fileName = `stih-dana-${verse.id}-${format}.jpg`
  const link = typeof location !== 'undefined' ? `${location.origin}/stih/${verse.id}` : ''
  const caption = `„${oneLine(asWritten(verse.text))}“ — ${BRAND.name}, ${verse.song}`

  const imageFile = async () => {
    const blob = canvasRef.current && (await canvasToBlob(canvasRef.current))
    return blob ? new File([blob], fileName, { type: 'image/jpeg' }) : null
  }

  const download = (file: File) => {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  /** Slika kroz sistemski share telefona; `false` ako preglednik to ne zna. */
  const shareImage = async (withText: boolean) => {
    const file = await imageFile()
    if (!file || !navigator.canShare?.({ files: [file] })) return false
    await navigator.share(withText ? { files: [file], text: `${caption}\n${link}` } : { files: [file] })
    return true
  }


  const run = async (t: Target) => {
    if (busy) return
    setBusy(t)
    haptic(6)
    try {
      switch (t) {
        case 'share': {
          // Sistemski share telefona: odatle ide u Instagram Story, WhatsApp,
          // Viber… Na desktopu toga nema, pa se slika preuzme.
          if (await shareImage(true)) break
          const file = await imageFile()
          if (file) {
            download(file)
            toast({ id: 'share', title: 'Slika je preuzeta', sub: 'Dijeljenje nije podržano', icon: <Icon.download /> })
          }
          break
        }
        case 'save': {
          // Na telefonu "Sačuvaj sliku" je u sistemskom shareu; download u
          // PWA-u na iPhoneu bi je zakopao u Fajlove.
          const touch = window.matchMedia('(pointer: coarse)').matches
          if (touch && (await shareImage(false))) break
          const file = await imageFile()
          if (file) {
            download(file)
            toast({ id: 'share', title: 'Slika je sačuvana', color: TOAST_OK, icon: <Icon.ok /> })
          }
          break
        }
      }
    } catch (e) {
      // korisnik je zatvorio sistemski share — to nije greška
      if ((e as Error)?.name !== 'AbortError') toast({ id: 'share', title: 'Nije uspjelo', sub: 'Pokušaj ponovo', color: TOAST_BAD, icon: <Icon.bad /> })
    } finally {
      setBusy(null)
    }
  }

  /**
   * Prvi dodir snimi video (stih se ispiše riječ po riječ) — vidi
   * se u pregledu dok nastaje. Drugi dodir ga sačuva: na telefonu kroz
   * sistemski share ("Sačuvaj video"), kao i slika; na računaru se preuzme.
   * Čuvanje traži svjež dodir, a snimanje traje nekoliko sekundi.
   */
  const video = async () => {
    if (recording || busy) return
    if (vid?.file) {
      haptic(6)
      try {
        const touch = window.matchMedia('(pointer: coarse)').matches
        if (touch && navigator.canShare?.({ files: [vid.file] })) await navigator.share({ files: [vid.file] })
        else {
          download(vid.file)
          toast({ id: 'share', title: 'Video je sačuvan', color: TOAST_OK, icon: <Icon.ok /> })
        }
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') toast({ id: 'share', title: 'Nije uspjelo', sub: 'Pokušaj ponovo', color: TOAST_BAD, icon: <Icon.bad /> })
      }
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    haptic(6)
    const key = vidKey
    setVid({ key, p: 0 })
    let shown = 0
    try {
      const file = await recordStory(canvas, { verse, date, format: 'story' }, (p) => {
        const pct = Math.floor(p * 100)
        if (pct !== shown) setVid({ key, p: (shown = pct) / 100 })
      })
      if (!file) throw new Error('video')
      setVid({ key, p: 1, file })
      haptic([8, 40, 8])
    } catch {
      setVid(null)
      toast({ id: 'share', title: 'Video nije uspio', sub: 'Pokušaj ponovo', color: TOAST_BAD, icon: <Icon.bad /> })
    } finally {
      // pregled se vrati na sliku
      if (canvasRef.current) await drawShareImage(canvasRef.current, { verse, date, format })
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <SheetLayer className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
          <SheetBackdrop onClose={onClose} />

          <SheetSlide>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Podijeli stih"
            className="os-sheet relative flex max-h-[100dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[30px] border border-b-0 border-white/10 sm:border-b px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-20px_80px_rgba(0,0,0,0.7)] sm:rounded-[30px] sm:pb-6"
            {...sheetDrag}
            style={{
              ...sheetDrag.style,
              background: `radial-gradient(120% 60% at 50% 0%, ${BRAND.gold}1a 0%, transparent 60%), linear-gradient(180deg, #121010 0%, #0a0909 100%)`,
            }}
          >
            {/* zlatna nit po vrhu panela */}
            <span
              className="pointer-events-none absolute inset-x-10 top-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${BRAND.gold}80, transparent)` }}
              aria-hidden
            />
            <span className="os-grabber mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 sm:hidden" aria-hidden />

            <div className="mb-3 flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {/* ista ikona kao dugme za dijeljenje */}
                <DrawerIcon>
                  <path d="M12 3v13M12 3 8 7M12 3l4 4" />
                  <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                </DrawerIcon>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.28em]" style={{ color: BRAND.gold }}>
                    Podijeli stih
                  </p>
                  <p className="truncate text-[1.1rem] text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
                    {verse.song}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Zatvori"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:text-white"
              >
                <CloseIcon />
              </button>
            </div>

            {/* pregled — tačno ono što odlazi */}
            <div className="relative flex h-[min(38dvh,380px)] items-center justify-center">
              <canvas
                ref={canvasRef}
                className="rounded-[14px] shadow-[0_24px_60px_rgba(0,0,0,0.65)] ring-1 ring-white/10 transition-opacity duration-300"
                style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%', opacity: ready ? 1 : 0 }}
              />
            </div>

            {/* format: segmentirana kontrola */}
            <div className="mt-4 grid grid-cols-4 rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
              {(Object.keys(SHARE_FORMATS) as ShareFormat[]).map((f) => {
                const F = SHARE_FORMATS[f]
                const on = f === format
                return (
                  <button
                    key={f}
                    onClick={() => choose(f)}
                    disabled={recording}
                    data-format={f}
                    aria-pressed={on}
                    aria-label={`${F.label} ${F.hint}`}
                    className="relative flex h-9 items-center justify-center gap-1.5 rounded-full text-[12px] transition-colors"
                    style={{ color: on ? '#14100A' : 'rgba(255,255,255,0.6)' }}
                  >
                    {on && (
                      <motion.span
                        layoutId="share-format"
                        className="absolute inset-0 rounded-full"
                        style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                    <span className="relative font-medium">{F.label}</span>
                    {F.hint && <span className="relative text-[10px] opacity-60">{F.hint}</span>}
                  </button>
                )
              })}
            </div>

            {/* akcije */}
            <motion.button
              onClick={() => run('share')}
              disabled={!ready || busy !== null || recording}
              whileTap={{ scale: 0.98 }}
              className="mt-5 flex h-12 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold tracking-wide text-black disabled:opacity-60"
              style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
            >
              {busy === 'share' ? <Spinner /> : <ShareIcon />}
              Podijeli sliku
            </motion.button>
            {/* Story: pored "Sačuvaj sliku" i video — isti red, panel ne raste */}
            <div className={`mt-2 grid gap-2 ${canVideo && format === 'story' ? 'grid-cols-2' : ''}`}>
              <button
                onClick={() => run('save')}
                data-tip="download"
                disabled={!ready || busy !== null || recording}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 text-[14px] text-white/80 transition-colors hover:bg-white/5 disabled:opacity-50"
              >
                {busy === 'save' ? <Spinner /> : <DownloadIcon />}
                Sačuvaj sliku
              </button>
              {canVideo && format === 'story' && (
                <button
                  onClick={video}
                  disabled={!ready || busy !== null || recording}
                  className="relative flex h-12 items-center justify-center gap-2 overflow-hidden rounded-2xl border text-[14px] transition-colors hover:bg-white/5 disabled:cursor-default"
                  style={{ borderColor: vid?.file ? `${BRAND.gold}80` : 'rgba(255,255,255,0.1)', color: vid?.file ? BRAND.gold : 'rgba(255,255,255,0.8)' }}
                >
                  {/* napredak snimanja — tiha zlatna traka ispod natpisa */}
                  {recording && (
                    <span
                      className="absolute inset-y-0 left-0 transition-[width] duration-200 ease-linear"
                      style={{ width: `${(vid?.p ?? 0) * 100}%`, background: `${BRAND.gold}26` }}
                      aria-hidden
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    {recording ? <Spinner /> : vid?.file ? <DownloadIcon /> : <VideoIcon />}
                    {recording ? `${Math.round((vid?.p ?? 0) * 100)}%` : vid?.file ? 'Sačuvaj video' : 'Video'}
                  </span>
                </button>
              )}
            </div>

          </motion.div>
          </SheetSlide>
        </SheetLayer>
      )}
    </AnimatePresence>,
    document.body,
  )
}


function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v13M12 3 8 7M12 3l4 4" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}

function VideoIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="13" height="12" rx="2.5" />
      <path d="m16 10.5 5-3v9l-5-3" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v11M12 15l-4-4M12 15l4-4" />
      <path d="M5 19h14" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  )
}
