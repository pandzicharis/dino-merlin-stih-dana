'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { BRAND } from '@/lib/brand'
import { haptic } from '@/lib/haptic'

/** Stih iz QR koda poklona (`…/stih/<id>?poklon`, i sa druge adrese aplikacije); inače null. */
export function giftFromQr(text: string): string | null {
  try {
    const u = new URL(text.trim())
    const m = u.pathname.match(/^\/stih\/([^/]+)\/?$/)
    return m && u.searchParams.has('poklon') ? decodeURIComponent(m[1]) : null
  } catch {
    return null
  }
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }

/**
 * Kamera za QR kod poklona — u aplikaciji, jer na iPhoneu kamera telefona
 * link otvori u Safariju (ne u instaliranoj aplikaciji). Čita sistemski
 * (BarcodeDetector, Android) ili jsQR (iPhone), nekoliko puta u sekundi.
 * `onCode`: pročitan tekst; vrati true kad je to ono što se traži (kamera se gasi).
 */
export function QrScanner({ onCode, onClose }: { onCode: (text: string) => boolean; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [wrong, setWrong] = useState(false)
  const done = useRef(onCode)
  useEffect(() => {
    done.current = onCode
  })

  useEffect(() => {
    let dead = false
    let stream: MediaStream | null = null
    let timer = 0
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      } catch (e) {
        if (!dead) setError((e as Error).name === 'NotAllowedError' ? 'Kamera nije dozvoljena' : 'Kamera nije dostupna')
        return
      }
      if (dead) return stream.getTracks().forEach((t) => t.stop())
      const v = video.current!
      v.srcObject = stream
      await v.play().catch(() => {})

      // sistemski čitač gdje ga ima, inače jsQR (učita se tek sad)
      const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
      const native = Native ? new Native({ formats: ['qr_code'] }) : null
      const jsQR = native ? null : (await import('jsqr')).default

      const read = async (): Promise<string | null> => {
        if (!v.videoWidth) return null
        if (native) return (await native.detect(v).catch(() => []))[0]?.rawValue ?? null
        // umanjen kadar — brže, a QR je ionako velik u kadru
        const k = Math.min(1, 480 / Math.max(v.videoWidth, v.videoHeight))
        canvas.width = Math.round(v.videoWidth * k)
        canvas.height = Math.round(v.videoHeight * k)
        ctx!.drawImage(v, 0, 0, canvas.width, canvas.height)
        const img = ctx!.getImageData(0, 0, canvas.width, canvas.height)
        return jsQR!(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null
      }
      const tick = async () => {
        if (dead) return
        const text = await read()
        if (dead) return
        if (text && done.current(text)) return
        // pročitan, ali nije poklon — kratko se javi, pa čita dalje
        if (text) setWrong(true)
        timer = window.setTimeout(tick, 160)
      }
      void tick()
    }
    void start()
    return () => {
      dead = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    if (!wrong) return
    haptic(12)
    const t = setTimeout(() => setWrong(false), 1800)
    return () => clearTimeout(t)
  }, [wrong])

  // Escape zatvara
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const corner = 'absolute h-9 w-9 border-[3px]'
  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Skeniraj poklon"
      data-qr-scanner
      className="fixed inset-0 z-[130] flex flex-col items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      {/* zatamnjeno oko okvira */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 46%, transparent 34%, rgba(0,0,0,0.62) 35%)' }} aria-hidden />

      <button
        type="button"
        onClick={onClose}
        aria-label="Zatvori"
        className="hdr-btn absolute right-5 w-[34px]"
        style={{ top: 'max(1.25rem, calc(var(--sat, 0px) + 0.75rem))' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      {/* okvir: zlatni uglovi, diše dok traži */}
      <motion.div
        className="relative -mt-[8vh] h-[min(64vw,260px)] w-[min(64vw,260px)]"
        animate={{ scale: wrong ? [1, 1.04, 1] : [1, 1.02, 1] }}
        transition={{ duration: wrong ? 0.4 : 2.4, repeat: wrong ? 0 : Infinity, ease: 'easeInOut' }}
        aria-hidden
      >
        {(['left-0 top-0 rounded-tl-[18px] border-b-0 border-r-0', 'right-0 top-0 rounded-tr-[18px] border-b-0 border-l-0', 'bottom-0 left-0 rounded-bl-[18px] border-r-0 border-t-0', 'bottom-0 right-0 rounded-br-[18px] border-l-0 border-t-0'] as const).map((c) => (
          <span key={c} className={`${corner} ${c}`} style={{ borderColor: wrong ? '#D08C8C' : BRAND.gold }} />
        ))}
      </motion.div>

      <p className="relative mt-8 px-8 text-center text-[13px] font-medium uppercase tracking-[0.2em]" style={{ color: error || wrong ? '#E6A4A4' : BRAND.gold }}>
        {error ?? (wrong ? 'To nije poklon' : 'Skeniraj poklon')}
      </p>
      {error && <p className="relative mt-2 px-10 text-center text-[13px] text-white/55">Dozvoli kameru u postavkama telefona, pa probaj ponovo.</p>}
    </motion.div>,
    document.body,
  )
}
