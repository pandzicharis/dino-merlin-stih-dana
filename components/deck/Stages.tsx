'use client'

import { useEffect, useRef, useState, type Ref } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
import { oneLine, withPeriod } from '@/lib/text'
import {
  AndroidStatus,
  GALAXY,
  Galaxy,
  Glass,
  IPHONE,
  IPhone,
  Island,
  IosStatus,
  PunchHole,
  deviceOuter,
  type DeviceKind,
} from './Devices'
import type { Simulation } from './types'

/** Veličina kutije u kojoj uređaj stoji — uređaj se upiše u nju. */
function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

/**
 * Pravi telefon s pravom aplikacijom.
 *
 * Iframe stoji UVIJEK na istom mjestu u stablu, a okvir (iPhone ili Galaxy)
 * se mijenja iza njega — da promjena okvira ne učita aplikaciju ispočetka.
 * Ostrvo, statusna traka i odsjaj crtaju se ponovo IZNAD iframea.
 *
 * Statusna traka je puna, crna — kao aplikacija koja ne crta ispod nje.
 */
export function LivePhone({
  kind,
  src,
  frameRef,
  onLoad,
  sim,
  onSim,
  verse,
}: {
  kind: DeviceKind
  src: string
  frameRef: Ref<HTMLIFrameElement>
  onLoad: () => void
  sim: Simulation | null
  onSim: (action: 'open' | 'dismiss') => void
  verse: Verse
}) {
  const [box, size] = useBox<HTMLDivElement>()
  const outer = deviceOuter(kind)
  const D = kind === 'iphone' ? IPHONE : GALAXY
  const width = Math.max(0, Math.min(size.w, (size.h * outer.w) / outer.h))
  const k = width / outer.w
  const inset = (D.rim + D.bezel) * k
  // Aplikacija počinje ispod statusne trake. U okviru nema "safe area", pa bi
  // se inače njeno zaglavlje (i dugme nazad) podvuklo pod sat i bateriju.
  const bar = kind === 'iphone' ? 50 : 34

  return (
    <div ref={box} className="absolute inset-0 flex items-center justify-center">
      <div style={{ position: 'relative', width, height: outer.h * k, opacity: width ? 1 : 0 }}>
        {kind === 'iphone' ? <IPhone width={`${width}px`} time={null}>{null}</IPhone> : <Galaxy width={`${width}px`} time={null}>{null}</Galaxy>}

        <div
          style={{
            position: 'absolute',
            left: inset,
            top: inset,
            width: D.w * k,
            height: D.h * k,
            borderRadius: D.radius * k,
            overflow: 'hidden',
            isolation: 'isolate',
            transform: 'translateZ(0)',
            background: '#000',
            // 1em = 1 piksel ekrana — za sve što se crta preko aplikacije
            fontSize: `${k}px`,
          }}
        >
          <iframe
            ref={frameRef}
            src={src}
            onLoad={onLoad}
            title="Stih dana — aplikacija uživo"
            allow="web-share; clipboard-write"
            style={{
              position: 'absolute',
              left: 0,
              top: bar * k,
              width: D.w,
              height: D.h - bar,
              border: 0,
              transform: `scale(${k})`,
              transformOrigin: '0 0',
              background: '#000',
            }}
          />
          {kind === 'iphone' ? <IosStatus time="12:00" /> : <AndroidStatus time="12:00" />}
          {kind === 'iphone' ? <Island /> : <PunchHole />}
          <Glass />
          <Simulated kind={kind} sim={sim} verse={verse} onSim={onSim} />
        </div>
      </div>
    </div>
  )
}

/**
 * Ono što se na prezentaciji ne može dočekati uživo — obavijest u podne i
 * ponuda nove verzije — odigra se preko prave aplikacije. Dodir radi isto
 * što bi radio na telefonu.
 */
function Simulated({
  kind,
  sim,
  verse,
  onSim,
}: {
  kind: DeviceKind
  sim: Simulation | null
  verse: Verse
  onSim: (action: 'open' | 'dismiss') => void
}) {
  const ios = kind === 'iphone'
  return (
    <AnimatePresence>
      {sim === 'notify' && (
        <motion.button
          key="notify"
          type="button"
          onClick={() => onSim('open')}
          initial={{ y: '-140em', opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: '-140em', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          style={{
            position: 'absolute',
            top: ios ? '56em' : '44em',
            left: '10em',
            right: '10em',
            zIndex: 50,
            display: 'flex',
            gap: '12em',
            alignItems: 'center',
            padding: ios ? '13em 15em' : '14em 16em',
            borderRadius: ios ? '24em' : '22em',
            background: ios ? 'rgba(38,38,42,0.78)' : 'rgba(30,31,36,0.86)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            border: '1em solid rgba(255,255,255,0.08)',
            boxShadow: '0 10em 40em rgba(0,0,0,0.45)',
            textAlign: 'left',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            style={{ width: '38em', height: '38em', borderRadius: ios ? '9em' : '50%', flexShrink: 0 }}
          />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8em' }}>
              <span style={{ fontSize: '14.5em', fontWeight: 600 }}>Stih dana — Dino Merlin</span>
              <span style={{ fontSize: '12.5em', color: 'rgba(255,255,255,0.5)' }}>sada</span>
            </span>
            <span
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                marginTop: '0.15em',
                fontSize: '14.5em',
                lineHeight: 1.3,
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              {oneLine(withPeriod(verse.text))}
            </span>
          </span>
        </motion.button>
      )}

      {sim === 'update' && (
        <motion.div
          key="update"
          initial={{ opacity: 0, y: '16em' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '16em' }}
          transition={{ type: 'spring', damping: 26, stiffness: 240 }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: '30em',
            zIndex: 50,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {/* isto dugme kao UpdatePrompt u aplikaciji */}
          <button
            type="button"
            onClick={() => onSim('open')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10em',
              padding: '10em 16em',
              borderRadius: '99em',
              border: `1em solid ${BRAND.gold}4D`,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: BRAND.gold,
              cursor: 'pointer',
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: '13em', height: '13em' }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            <span style={{ fontSize: '10em', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Nova verzija — osvježi
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Računar za admin: prozor preglednika s adresom, a u njemu pravi /admin. */
export function LiveDesktop({
  src,
  host,
  path,
  frameRef,
  onLoad,
}: {
  src: string
  host: string
  path: string
  frameRef: Ref<HTMLIFrameElement>
  onLoad: () => void
}) {
  const [box, size] = useBox<HTMLDivElement>()
  const W = 1280
  const H = 800
  const BAR = 38
  const k = Math.max(0, Math.min(size.w / W, (size.h - BAR) / H))

  return (
    <div ref={box} className="absolute inset-0 flex items-center justify-center">
      <div
        style={{
          width: W * k,
          height: H * k + BAR,
          opacity: k ? 1 : 0,
          borderRadius: 14,
          overflow: 'hidden',
          background: '#141414',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.12), 0 40px 100px rgba(0,0,0,0.65)',
        }}
      >
        <div
          style={{ height: BAR }}
          className="flex items-center gap-3 border-b border-white/[0.07] bg-[#1c1c1e] px-3.5"
        >
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
            <span className="truncate">
              {host}
              <span className="text-white/85">{path}</span>
            </span>
          </span>
          <span className="w-[54px]" aria-hidden />
        </div>
        <div style={{ position: 'relative', width: W * k, height: H * k, overflow: 'hidden' }}>
          <iframe
            ref={frameRef}
            src={src}
            onLoad={onLoad}
            title="Stih dana — urednički panel uživo"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: W,
              height: H,
              border: 0,
              transform: `scale(${k})`,
              transformOrigin: '0 0',
              background: '#0c0c0d',
            }}
          />
        </div>
      </div>
    </div>
  )
}
