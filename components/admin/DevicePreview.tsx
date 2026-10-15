'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
import { PUBLIC_URL } from '@/lib/site'
import { IPHONE, IPhone, IosStatus, Island, Glass, deviceOuter } from '../deck/Devices'

const DESK = { w: 1280, h: 800, bar: 38 } as const
const LABELS = { phone: 'Telefon', desktop: 'Računar' } as const
type Device = keyof typeof LABELS

/** Statusna traka — aplikacija ide ispod nje do vrha, a sadržaj se spusti kao za "safe area". */
const STATUS_BAR = 50
const HOST = PUBLIC_URL.replace(/^https?:\/\//, '')

/** Koliko mjesta uređaj zauzme za datu širinu i visinu — omjer se nikad ne mijenja. */
function fit(device: Device, maxW: number, maxH: number) {
  if (device === 'phone') {
    const o = deviceOuter('iphone')
    const w = Math.max(0, Math.min(maxW, (maxH * o.w) / o.h))
    return { w, h: (w * o.h) / o.w }
  }
  const k = Math.max(0, Math.min(maxW / DESK.w, (maxH - DESK.bar) / DESK.h))
  return { w: DESK.w * k, h: DESK.h * k + DESK.bar }
}

/**
 * Uređaj s pravim ekranom aplikacije — iste mjere i isti okvir kao u
 * prezentaciji: iPhone 16 Pro sa statusnom trakom i ostrvom, ili prozor
 * preglednika s adresom. Unutra je iframe na `/pregled`.
 */
function PreviewFrame({ device, width, frameRef }: { device: Device; width: number; frameRef: RefObject<HTMLIFrameElement | null> }) {
  if (device === 'phone') {
    const o = deviceOuter('iphone')
    const k = width / o.w
    const inset = (IPHONE.rim + IPHONE.bezel) * k
    return (
      <div style={{ position: 'relative', width, height: o.h * k }}>
        <IPhone width={`${width}px`} time={null}>
          {null}
        </IPhone>
        <div
          style={{
            position: 'absolute',
            left: inset,
            top: inset,
            width: IPHONE.w * k,
            height: IPHONE.h * k,
            borderRadius: IPHONE.radius * k,
            overflow: 'hidden',
            isolation: 'isolate',
            transform: 'translateZ(0)',
            background: '#000',
            // 1em = 1 piksel ekrana — statusna traka i ostrvo se crtaju u em
            fontSize: `${k}px`,
          }}
        >
          <iframe
            ref={frameRef}
            src={`/pregled?top=${STATUS_BAR}`}
            title="Pregled — telefon"
            tabIndex={-1}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: IPHONE.w,
              height: IPHONE.h,
              border: 0,
              transform: `scale(${k})`,
              transformOrigin: '0 0',
              pointerEvents: 'none',
              background: '#000',
            }}
          />
          <IosStatus time="12:00" />
          <Island />
          <Glass />
        </div>
      </div>
    )
  }
  const k = width / DESK.w
  return (
    <div
      style={{
        width,
        height: DESK.h * k + DESK.bar,
        borderRadius: 12,
        overflow: 'hidden',
        background: '#141414',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 30px 70px rgba(0,0,0,0.55)',
      }}
    >
      {/* prozor preglednika — isti kao u prezentaciji */}
      <div style={{ height: DESK.bar }} className="flex items-center gap-3 border-b border-white/[0.07] bg-[#1c1c1e] px-3.5">
        <span className="flex gap-[7px]" aria-hidden>
          <i className="block h-3 w-3 rounded-full bg-[#ff5f57]" />
          <i className="block h-3 w-3 rounded-full bg-[#febc2e]" />
          <i className="block h-3 w-3 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-auto flex h-[24px] min-w-0 max-w-[60%] flex-1 items-center justify-center gap-2 rounded-md bg-white/[0.06] px-3 text-[12px] text-white/55">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
            <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
          </svg>
          <span className="truncate">{HOST}</span>
        </span>
        <span className="w-[54px]" aria-hidden />
      </div>
      <div style={{ position: 'relative', width, height: DESK.h * k, overflow: 'hidden' }}>
        <iframe
          ref={frameRef}
          src="/pregled"
          title="Pregled — računar"
          tabIndex={-1}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: DESK.w,
            height: DESK.h,
            border: 0,
            transform: `scale(${k})`,
            transformOrigin: '0 0',
            pointerEvents: 'none',
            background: '#0c0c0d',
          }}
        />
      </div>
    </div>
  )
}

/** Šalje stih u pregled — odmah, i kad god `/pregled` javi da je spreman. */
function usePreviewFeed(frame: RefObject<HTMLIFrameElement | null>, verse: Verse, date: string | undefined, on = true) {
  useEffect(() => {
    if (!on) return
    const send = () => frame.current?.contentWindow?.postMessage({ type: 'stihdana:preview', verse, date }, location.origin)
    send()
    const onMessage = (e: MessageEvent) => {
      if (e.origin === location.origin && e.data?.type === 'stihdana:preview-ready') send()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [frame, verse, date, on])
}

/**
 * Pregled stiha na PRAVOM ekranu aplikacije, u istom okviru kao u
 * prezentaciji. Stih se šalje porukom pri svakoj izmjeni, pa se pregled
 * mijenja dok urednik kuca, bez ponovnog učitavanja.
 */
export function DevicePreview({
  verse,
  date,
  maxHeight = 460,
  full,
  onFull,
}: {
  verse: Verse
  date?: string
  maxHeight?: number
  /** puni pregled — dugme za njega je u zaglavlju modala */
  full: boolean
  onFull: (open: boolean) => void
}) {
  const [device, setDevice] = useState<Device>('phone')
  const frame = useRef<HTMLIFrameElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)

  usePreviewFeed(frame, verse, date)

  useEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])

  const size = fit(device, width, maxHeight)

  return (
    <div ref={box} className="flex w-full flex-col items-center">
      <div className="mb-4 grid w-full max-w-[240px] grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
        {(Object.keys(LABELS) as Device[]).map((d) => (
          <button
            key={d}
            type="button"
            data-device={d}
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
            <span className="relative">{LABELS[d]}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center" style={{ height: size.h }}>
        <PreviewFrame key={device} device={device} width={size.w} frameRef={frame} />
      </div>

      <FullPreview open={full} device={device} verse={verse} date={date} onClose={() => onFull(false)} />
    </div>
  )
}

/**
 * Pregled preko cijelog ekrana. Na telefonu je to bukvalno ekran aplikacije;
 * inače uređaj u istom okviru, koliko god stane.
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
  usePreviewFeed(frame, verse, date, open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    // capture: Escape zatvara pregled, a ne i editor ispod njega
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  const [vp, setVp] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!open) return
    const measure = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  if (typeof document === 'undefined') return null
  // telefon na telefonu: bukvalno ekran aplikacije, preko cijelog ekrana
  const bleed = device === 'phone' && vp.w > 0 && vp.w < 500
  const size = fit(device, vp.w - 48, vp.h - 120)

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md"
          style={{ paddingBottom: bleed ? 0 : 48 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {bleed ? (
            <iframe ref={frame} src="/pregled" title="Puni pregled" className="absolute inset-0 h-full w-full border-0" />
          ) : (
            vp.w > 0 && <PreviewFrame device={device} width={size.w} frameRef={frame} />
          )}
          <button
            onClick={onClose}
            aria-label="Zatvori pregled"
            className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 flex h-10 -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/70 px-4 text-[12px] text-white/85 shadow-lg backdrop-blur-md transition-colors hover:text-white"
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
