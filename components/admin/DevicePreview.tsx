'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'

const DEVICES = {
  phone: { label: 'Telefon', w: 390, h: 844 },
  desktop: { label: 'Računar', w: 1280, h: 800 },
} as const
type Device = keyof typeof DEVICES

/**
 * Pregled stiha na PRAVOM ekranu aplikacije — iframe na `/pregled`,
 * umanjen u okvir telefona ili računara. Stih se šalje porukom pri svakoj
 * izmjeni, pa se pregled mijenja dok urednik kuca, bez ponovnog učitavanja.
 */
export function DevicePreview({ verse, date, maxHeight = 460 }: { verse: Verse; date?: string; maxHeight?: number }) {
  const [device, setDevice] = useState<Device>('phone')
  const frame = useRef<HTMLIFrameElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const [full, setFull] = useState(false)

  const send = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: 'stihdana:preview', verse, date }, location.origin)
  }, [verse, date])

  // svaka izmjena ide odmah u pregled
  useEffect(send, [send])

  // iframe javi kad je spreman (i nakon promjene uređaja, koja ga ponovo učita)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin === location.origin && e.data?.type === 'stihdana:preview-ready') send()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [send])

  useEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])

  const D = DEVICES[device]
  const bezel = device === 'phone' ? 10 : 8
  const scale = Math.min((width - bezel * 2) / D.w, (maxHeight - bezel * 2) / D.h)
  const outW = D.w * scale + bezel * 2
  const outH = D.h * scale + bezel * 2

  return (
    <div ref={box} className="flex w-full flex-col items-center">
      <div className="mb-3 grid w-full max-w-[240px] grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
        {(Object.keys(DEVICES) as Device[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDevice(d)}
            className="relative h-8 rounded-full text-[11px] font-medium transition-colors"
            style={{ color: d === device ? '#14100A' : 'rgba(255,255,255,0.6)' }}
          >
            {d === device && (
              <motion.span
                layoutId="preview-device"
                className="absolute inset-0 rounded-full"
                style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
              />
            )}
            <span className="relative">{DEVICES[d].label}</span>
          </button>
        ))}
      </div>

      <div
        className="relative shrink-0 overflow-hidden bg-black shadow-[0_24px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/15"
        style={{
          width: outW,
          height: outH,
          padding: bezel,
          borderRadius: device === 'phone' ? 38 * Math.max(scale, 0.6) + bezel : 12,
        }}
      >
        <div
          className="relative overflow-hidden"
          style={{ width: D.w * scale, height: D.h * scale, borderRadius: device === 'phone' ? 30 * Math.max(scale, 0.6) : 6 }}
        >
          <iframe
            key={device}
            ref={frame}
            src="/pregled"
            title={`Pregled — ${D.label}`}
            className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
            style={{ width: D.w, height: D.h, transform: `scale(${scale})` }}
            tabIndex={-1}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setFull(true)}
        className="mt-3 flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-[12px] text-white/75 transition-colors hover:bg-white/10 hover:text-white"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
        Puni pregled
      </button>

      <FullPreview open={full} device={device} verse={verse} date={date} onClose={() => setFull(false)} />
    </div>
  )
}

/**
 * Pregled preko cijelog ekrana. Na telefonu je to bukvalno ekran aplikacije;
 * na računaru telefon stoji u stvarnoj veličini (ili koliko stane), a
 * "Računar" zauzme cijeli prozor.
 */
function FullPreview({
  open,
  device,
  verse,
  date,
  onClose,
}: {
  open: boolean
  device: Device
  verse: Verse
  date?: string
  onClose: () => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)

  const send = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: 'stihdana:preview', verse, date }, location.origin)
  }, [verse, date])

  useEffect(() => {
    if (!open) return
    const onMessage = (e: MessageEvent) => {
      if (e.origin === location.origin && e.data?.type === 'stihdana:preview-ready') send()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('message', onMessage)
    // capture: Escape zatvara pregled, a ne i editor ispod njega
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open, send, onClose])

  // Stvarna veličina uređaja, umanjena da stane — omjer se nikad ne mijenja.
  const [vp, setVp] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!open) return
    const measure = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  if (typeof document === 'undefined') return null
  const D = DEVICES[device]
  const phone = device === 'phone'
  // telefon na telefonu: preko cijelog ekrana; inače okvir s marginom za dugme
  const edge = phone && vp.w < 500 ? 0 : 24
  const bottom = phone && vp.w < 500 ? 0 : 72
  const scale = vp.w ? Math.min((vp.w - edge * 2) / D.w, (vp.h - edge - bottom) / D.h, 1) : 1
  const fullBleed = edge === 0

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md"
          style={{ paddingBottom: fullBleed ? 0 : bottom - edge }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className={`relative shrink-0 overflow-hidden bg-black ${fullBleed ? '' : 'shadow-[0_30px_80px_rgba(0,0,0,0.7)] ring-1 ring-white/15'}`}
            style={{
              width: fullBleed ? vp.w : D.w * scale,
              height: fullBleed ? vp.h : D.h * scale,
              borderRadius: fullBleed ? 0 : phone ? 36 * scale + 8 : 10,
            }}
          >
            <iframe
              ref={frame}
              src="/pregled"
              title="Puni pregled"
              className="absolute left-0 top-0 origin-top-left border-0"
              style={
                fullBleed
                  ? { width: vp.w, height: vp.h }
                  : { width: D.w, height: D.h, transform: `scale(${scale})` }
              }
            />
          </div>
          <button
            onClick={onClose}
            aria-label="Zatvori pregled"
            className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 flex h-10 -translate-x-1/2 items-center gap-2 shadow-lg rounded-full border border-white/15 bg-black/70 px-4 text-[12px] text-white/85 backdrop-blur-md transition-colors hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
            Zatvori
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
