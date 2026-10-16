'use client'

import { useEffect, useRef, useState, type Ref, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
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
import { LockScreenMock, MoodStill } from './Screens'
import { albumOf } from '@/data/albums'
import { AppIcon, HomeScreen, ROBOTO, SF, Tap, homeSlot } from './phoneUi'
import { formatDateBs, formatDayBs } from '@/lib/date'
import { PhoneScript, type Script } from './PhoneScript'
import { ChatDemo } from './ChatDemo'
import { WELCOME } from '../Tips'
import { INVITE } from '@/lib/notify'
import { haptic } from '@/lib/haptic'

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
  lock,
  script,
  onScriptDone,
  manual,
  tap,
  date,
  simKey,
  host,
}: {
  kind: DeviceKind
  src: string
  frameRef: RefObject<HTMLIFrameElement | null>
  onLoad: () => void
  sim: Simulation | null
  onSim: (action: 'open' | 'dismiss' | 'link') => void
  verse: Verse
  /** zaključan ekran preko aplikacije (dok papirić ne sleti) */
  lock?: { verse: Verse; date: string } | null
  /** režirana scena preko aplikacije (instalacija, dozvola) */
  script?: { kind: Script; expect: string } | null
  onScriptDone?: () => void
  /** režirana scena se klikće ručno */
  manual?: boolean
  /** dodir koji prezentacija nacrta preko aplikacije */
  tap?: { x: number; y: number; n: number } | null
  /** datum za zaključan ekran */
  date: string
  /** nova simulacija iste vrste kreće ispočetka */
  simKey?: number
  /** adresa sajta — za link u porukama */
  host: string
}) {
  const [box, size] = useBox<HTMLDivElement>()
  const outer = deviceOuter(kind)
  const D = kind === 'iphone' ? IPHONE : GALAXY
  const width = Math.max(0, Math.min(size.w, (size.h * outer.w) / outer.h))
  const k = width / outer.w
  const inset = (D.rim + D.bezel) * k
  // Statusna traka okvira. Aplikacija ide do vrha (pozadina i oko ostrva), a
  // sadržaj spusti za traku sama — `--sat` u globals.css (html[data-deck]).
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
              top: 0,
              width: D.w,
              height: D.h,
              border: 0,
              transform: `scale(${k})`,
              transformOrigin: '0 0',
              background: '#000',
            }}
          />
          <AnimatePresence>
            {lock && (
              <motion.div
                key="lock"
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 1.04 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                <LockScreenMock verse={lock.verse} date={lock.date} w={D.w} h={D.h} notify={false} />
              </motion.div>
            )}
          </AnimatePresence>
          {script && (
            <PhoneScript
              key={`${script.kind}-${kind}-${manual ? 'm' : 'a'}`}
              script={script.kind}
              platform={kind === 'galaxy' ? 'android' : 'ios'}
              frameRef={frameRef}
              expect={script.expect}
              w={D.w}
              h={D.h}
              top={bar}
              onDone={onScriptDone}
              manual={manual}
            />
          )}
          {tap && (
            <div className="pointer-events-none absolute inset-0" style={{ zIndex: 21 }}>
              <Tap key={tap.n} platform={kind === 'galaxy' ? 'android' : 'ios'} x={tap.x} y={tap.y} />
            </div>
          )}
          {kind === 'iphone' ? <IosStatus time="12:00" /> : <AndroidStatus time="12:00" />}
          {kind === 'iphone' ? <Island /> : <PunchHole />}
          <Glass />
          <Simulated kind={kind} sim={sim} simKey={simKey} verse={verse} date={date} host={host} w={D.w} h={D.h} bar={bar} manual={manual} onSim={onSim} />
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
  simKey,
  verse,
  date,
  host,
  bar,
  manual,
  w,
  h,
  onSim,
}: {
  kind: DeviceKind
  sim: Simulation | null
  simKey?: number
  verse: Verse
  date: string
  host: string
  bar: number
  manual?: boolean
  w: number
  h: number
  onSim: (action: 'open' | 'dismiss' | 'link') => void
}) {
  const ios = kind === 'iphone'
  return (
    <AnimatePresence>
      {/* dnevni poziv (lib/notify.ts), ili dobrodošlica kad savjeti prođu (ona se samo skloni) */}
      {(sim === 'notify' || sim === 'welcome') && (
        <motion.button
          key="notify"
          type="button"
          onClick={() => onSim(sim === 'welcome' ? 'dismiss' : 'open')}
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
              <span style={{ fontSize: '14.5em', fontWeight: 600 }}>{sim === 'welcome' ? WELCOME.title : INVITE.title}</span>
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
              {sim === 'welcome' ? WELCOME.body : INVITE.body}
            </span>
          </span>
        </motion.button>
      )}

      {sim === 'lock' && (
        <motion.div
          key="lock"
          className="absolute inset-0"
          style={{ zIndex: 60 }}
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <LockNotify
            key={`${ios ? 'ios' : 'android'}-${simKey}`}
            ios={ios}
            verse={verse}
            date={date}
            w={w}
            h={h}
            top={bar}
            manual={manual}
            onOpen={() => onSim('open')}
          />
        </motion.div>
      )}

      {sim === 'chat' && (
        <motion.div key="chat" className="absolute inset-0" style={{ zIndex: 60 }} initial={false} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <ChatDemo key={`${ios ? 'ios' : 'android'}-${simKey}`} ios={ios} verse={verse} host={host} w={w} h={h} onOpen={() => onSim('link')} />
        </motion.div>
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
            bottom: 0,
            zIndex: 50,
            display: 'flex',
            justifyContent: 'center',
            padding: '80em 24em 34em',
            background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 45%, transparent 100%)',
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
              padding: '12em 20em',
              borderRadius: '99em',
              border: `1em solid ${BRAND.gold}4D`,
              background: 'rgba(0,0,0,0.55)',
              boxShadow: '0 10em 30em rgba(0,0,0,0.5)',
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
            <span style={{ fontSize: '10.5em', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
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

const SF_DISPLAY = '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", var(--font-sans), sans-serif'

/** Zvuk obavijesti — dva kratka tona (Web Audio, bez datoteke). */
function chime() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    const t = ctx.currentTime
    ;[
      [1318.5, 0],
      [1760, 0.13],
    ].forEach(([f, d]) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0, t + d)
      g.gain.linearRampToValueAtTime(0.25, t + d + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.5)
      o.connect(g).connect(ctx.destination)
      o.start(t + d)
      o.stop(t + d + 0.55)
    })
    window.setTimeout(() => ctx.close(), 1000)
  } catch {
    /* bez zvuka — nije bitno */
  }
}

/**
 * Zaključan ekran — budan, u 11:59. Sat pređe na 12:00 i obavijest sa
 * stihom stigne sama. iOS 18: operater gore, datum i veliki sat, obavijest
 * dole iznad svjetiljke i kamere. Android: sat gore, obavijest ispod njega.
 * Dodir na obavijest otvara aplikaciju.
 */
function LockNotify({
  ios,
  verse,
  date,
  w,
  h,
  top,
  manual = false,
  onOpen,
}: {
  ios: boolean
  verse: Verse
  date: string
  w: number
  h: number
  /** statusna traka — za mrežu ikonica na početnom ekranu */
  top: number
  /** Ručno: prezenter dodirne obavijest, pa ikonicu */
  manual?: boolean
  onOpen: () => void
}) {
  const [noon, setNoon] = useState(false)
  const [arrived, setArrived] = useState(false)
  // cijeli tok: obavijest → otključavanje (prevlačenje nagore) → početni ekran
  // s bedžom na ikonici → dodir → aplikacija se otvori i stih se ispiše
  const [phase, setPhase] = useState<'lock' | 'home' | 'opening'>('lock')
  const [swipe, setSwipe] = useState(false)
  const [tapIcon, setTapIcon] = useState(false)
  const timers = useRef<number[]>([])
  const after = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
  const opened = useRef(false)
  const openApp = () => {
    if (opened.current) return
    opened.current = true
    setTapIcon(true)
    after(380, () => setPhase('opening'))
    after(1300, onOpen)
  }
  // Dodir na obavijest — kao na pravom telefonu: otključa se i odmah
  // otvori aplikacija, bez početnog ekrana.
  const tapNotification = () => {
    if (opened.current) return
    opened.current = true
    setSwipe(true)
    after(300, onOpen)
  }
  useEffect(() => {
    after(1400, () => setNoon(true))
    after(2000, () => {
      setArrived(true)
      haptic([12, 60, 12])
      chime()
    })
    // sam tok: obavijest se dodirne (malo poslije dolaska) i aplikacija se odmah otvori
    if (!manual) after(4200, tapNotification)
    const ts = timers.current
    return () => ts.forEach(clearTimeout)
    // tok se igra jednom po montaži
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const slot = homeSlot(ios ? 'ios' : 'android', w, top)
  const day = formatDayBs(date)
  const [d, mon] = formatDateBs(date).split(' ')
  const when = `${day[0].toUpperCase() + day.slice(1)}, ${d} ${mon}`
  const clock = noon ? '12:00' : '11:59'
  // obavijest je poziv — stih se otkriva tek kad se izvuče u aplikaciji
  const { title, body: text } = INVITE

  const card = ios ? (
    <motion.button
      type="button"
      onClick={tapNotification}
      initial={{ y: '90em', opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      style={{
        position: 'absolute',
        left: '12em',
        right: '12em',
        bottom: '124em',
        display: 'flex',
        gap: '10em',
        alignItems: 'center',
        padding: '14em 14em 14em 12em',
        borderRadius: '23em',
        background: 'rgba(30,30,32,0.55)',
        backdropFilter: 'blur(30px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(30px) saturate(1.8)',
        textAlign: 'left',
        color: '#fff',
        cursor: 'pointer',
        fontFamily: SF,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" style={{ width: '38em', height: '38em', borderRadius: '8.5em', flexShrink: 0 }} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8em' }}>
          <span style={{ fontSize: '15em', fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</span>
          <span style={{ fontSize: '13em', color: 'rgba(255,255,255,0.55)' }}>sada</span>
        </span>
        <span
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            marginTop: '0.1em',
            fontSize: '15em',
            lineHeight: 1.27,
            letterSpacing: '-0.01em',
            color: 'rgba(255,255,255,0.92)',
          }}
        >
          {text}
        </span>
      </span>
    </motion.button>
  ) : (
    <motion.button
      type="button"
      onClick={tapNotification}
      initial={{ y: '-24em', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      style={{
        position: 'absolute',
        left: '14em',
        right: '14em',
        top: '268em',
        display: 'flex',
        gap: '12em',
        alignItems: 'flex-start',
        padding: '15em 16em 16em',
        borderRadius: '26em',
        background: 'rgba(28,28,32,0.72)',
        backdropFilter: 'blur(28px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
        border: '1em solid rgba(255,255,255,0.08)',
        textAlign: 'left',
        color: '#fff',
        cursor: 'pointer',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" style={{ width: '34em', height: '34em', borderRadius: '50%', flexShrink: 0 }} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: '6em', color: 'rgba(255,255,255,0.62)' }}>
          <span style={{ fontSize: '12.5em' }}>Stih dana</span>
          <span style={{ fontSize: '12.5em' }}>· sada</span>
        </span>
        <span style={{ display: 'block', marginTop: '0.3em', fontSize: '15em', fontWeight: 600 }}>{title}</span>
        <span
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            marginTop: '0.15em',
            fontSize: '15em',
            lineHeight: 1.3,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          {text}
        </span>
      </span>
    </motion.button>
  )

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ color: '#fff', fontFamily: ios ? SF : ROBOTO }}>
      {/* početni ekran ispod zaključanog — s bedžom na Stih dana */}
      {phase !== 'lock' && (
        <>
          <HomeScreen platform={ios ? 'ios' : 'android'} w={w} h={h} top={top} badge tapping={tapIcon && phase === 'home'} />
          {ios ? <IosStatus time="12:00" /> : <AndroidStatus time="12:00" />}
          {manual && phase === 'home' && (
            <button
              type="button"
              aria-label="Otvori Stih dana"
              onClick={openApp}
              className="absolute cursor-pointer"
              style={{ left: `${slot.x}em`, top: `${slot.y}em`, width: `${slot.size}em`, height: `${slot.size}em`, borderRadius: `${slot.size * 0.24}em`, zIndex: 5 }}
            />
          )}
        </>
      )}
      {/* aplikacija se raširi iz ikonice */}
      {phase === 'opening' && (
        <motion.div
          className="absolute flex items-center justify-center overflow-hidden"
          style={{ background: '#000', zIndex: 6 }}
          initial={{ left: `${slot.x}em`, top: `${slot.y}em`, width: `${slot.size}em`, height: `${slot.size}em`, borderRadius: `${slot.size * 0.24}em` }}
          animate={{ left: 0, top: 0, width: `${w}em`, height: `${h}em`, borderRadius: ios ? '54em' : '34em' }}
          transition={{ type: 'spring', stiffness: 210, damping: 27 }}
        >
          <motion.span initial={{ opacity: 1, scale: 1 }} animate={ios ? { opacity: 0, scale: 1.6 } : { opacity: 1, scale: 1.7 }} transition={{ duration: 0.35 }}>
            <AppIcon platform={ios ? 'ios' : 'android'} size={slot.size} />
          </motion.span>
        </motion.div>
      )}

      {/* zaključan ekran — otključavanjem klizi nagore */}
      <motion.div
        className="absolute inset-0 overflow-hidden"
        style={{ zIndex: 4 }}
        initial={false}
        animate={{ y: phase === 'lock' ? 0 : '-100%' }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
      >
      <MoodStill mood={verse.mood} w={w} h={h} dim={ios ? 0.1 : 0.18} cover={albumOf(verse.album)?.cover} lift={albumOf(verse.album)?.lift} />
      <div
        className="absolute inset-0"
        style={{
          background: ios
            ? 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.35) 100%)'
            : 'radial-gradient(ellipse at 50% 30%, transparent 30%, rgba(0,0,0,0.45) 100%)',
        }}
      />

      {/* na zaključanom ekranu sat je veliki, pa gore lijevo nema ničega */}
      {ios ? <IosStatus time="" /> : <AndroidStatus time="" />}

      {ios ? (
        <div style={{ position: 'absolute', top: '62em', left: 0, right: 0, textAlign: 'center', fontFamily: SF_DISPLAY }}>
          <p style={{ fontSize: '21em', fontWeight: 600, letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.88)' }}>{when}</p>
          <p
            className="tabular"
            style={{
              fontSize: '110em',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              lineHeight: 1,
              marginTop: '-0.02em',
              color: 'rgba(255,255,255,0.94)',
              textShadow: '0 0.02em 0.2em rgba(0,0,0,0.18)',
            }}
          >
            {clock}
          </p>
        </div>
      ) : (
        <div style={{ position: 'absolute', top: '78em', left: 0, right: 0, textAlign: 'center' }}>
          <p style={{ fontSize: '15em', fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{when}</p>
          <p
            className="tabular"
            style={{ fontSize: '96em', fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1, marginTop: '0.04em' }}
          >
            {clock}
          </p>
        </div>
      )}

      <AnimatePresence>{arrived && card}</AnimatePresence>

      {ios ? (
        <>
          {/* svjetiljka i kamera — iOS 18 */}
          <div style={{ position: 'absolute', bottom: '46em', left: '46em', right: '46em', display: 'flex', justifyContent: 'space-between' }}>
            {[
              'M8.5 2h7l-1.2 5.5h-4.6zM9.7 8.5h4.6v12a1.6 1.6 0 0 1-1.6 1.6h-1.4a1.6 1.6 0 0 1-1.6-1.6zM12 12.5v2.5',
              'M3.5 8.5A1.5 1.5 0 0 1 5 7h2.6l1.6-2.2h5.6L16.4 7H19a1.5 1.5 0 0 1 1.5 1.5v9.5A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18zM12 16.5a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2z',
            ].map((p) => (
              <span
                key={p}
                style={{
                  width: '50em',
                  height: '50em',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.28)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                }}
              >
                <svg viewBox="0 0 24 24" fill="#fff" style={{ width: '22em', height: '22em' }}>
                  <path d={p} />
                </svg>
              </span>
            ))}
          </div>
          <span
            style={{ position: 'absolute', bottom: '8em', left: '50%', width: '138em', height: '5em', marginLeft: '-69em', borderRadius: '3em', background: '#fff' }}
          />
        </>
      ) : (
        <>
          <div style={{ position: 'absolute', bottom: '34em', left: '34em', right: '34em', display: 'flex', justifyContent: 'space-between' }}>
            {['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2', 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'].map((p) => (
              <svg key={p} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" style={{ width: '24em', height: '24em' }}>
                <path d={p} />
              </svg>
            ))}
          </div>
        </>
      )}
      </motion.div>

      {/* prevlačenje nagore — prst ide od dna */}
      {swipe && phase === 'lock' && (
        <motion.span
          className="absolute left-1/2"
          style={{ zIndex: 7, top: 0 }}
          initial={{ y: `${h - 30}em` }}
          animate={{ y: `${h * 0.55}em` }}
          transition={{ duration: 0.55, ease: [0.3, 0, 0.2, 1] }}
        >
          <Tap platform={ios ? 'ios' : 'android'} x={0} y={0} />
        </motion.span>
      )}
      <span style={{ position: 'absolute', inset: 0, zIndex: 8, pointerEvents: 'none' }}>{ios ? <Island /> : <PunchHole />}</span>
    </div>
  )
}
