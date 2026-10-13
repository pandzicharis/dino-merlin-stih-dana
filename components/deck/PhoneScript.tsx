'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AndroidDialog, InstallDemo } from './InstallDemo'
import { AppIcon, HomeScreen, IOS_BLUE, ROBOTO, SF, Sym, Tap, homeSlot, type Platform } from './phoneUi'

/**
 * Režija preko prave aplikacije u telefonu prezentacije.
 *
 * - `install`: uvod s uputstvom → dodir na "Pogledaj kako" → animacija
 *   instalacije preko cijelog telefona → nazad na uvod. Na Androidu kao u
 *   Chromeu: "Dodaj na početni ekran" → Chromeov dijalog → Install →
 *   aplikacija javi da je instalirana → početni ekran s novom ikonicom.
 * - `permission`: početni ekran → dodir na Stih dana → aplikacija se otvori
 *   → "Uključi obavijesti" → sistemski prozor → Allow → stih.
 *
 * Dugmad u aplikaciji se zaista pritisnu (isti dokument, isto porijeklo), a
 * dodir se nacrta tačno iznad njih. Kad scena završi, javi `onDone`.
 *
 * `manual`: ništa se ne pritiska samo — prezenter klikne ikonicu, dugme u
 * aplikaciji, korake instalacije i Allow, kao da drži telefon u ruci.
 */

export type Script = 'install' | 'permission'

/** jedan krug animacije instalacije (~9,4 s) i predah na novoj ikonici */
const DEMO_MS = 10800

type Frame = RefObject<HTMLIFrameElement | null>

function at(frame: HTMLIFrameElement | null): string | null {
  try {
    const l = frame?.contentWindow?.location
    return l ? l.pathname + l.search : null
  } catch {
    return null
  }
}

/** Element u aplikaciji, ali tek kad je potpuno vidljiv (uvod ulazi kroz opacity). */
function visible(frame: HTMLIFrameElement | null, expect: string, sel: string): HTMLElement | null {
  if (at(frame) !== expect) return null
  try {
    const doc = frame!.contentDocument!
    const el = doc.querySelector<HTMLElement>(sel)
    if (!el || doc.readyState !== 'complete') return null
    const win = frame!.contentWindow!
    let o = 1
    for (let n: HTMLElement | null = el; n; n = n.parentElement) o *= Number(win.getComputedStyle(n).opacity)
    return o > 0.97 ? el : null
  } catch {
    return null
  }
}

export function PhoneScript({
  script,
  platform,
  frameRef,
  expect,
  w,
  h,
  top,
  onDone,
  manual = false,
}: {
  script: Script
  platform: Platform
  frameRef: Frame
  /** adresa na kojoj aplikacija mora biti */
  expect: string
  w: number
  h: number
  /** visina statusne trake — iframe počinje ispod nje */
  top: number
  onDone?: () => void
  manual?: boolean
}) {
  const [tap, setTap] = useState<{ x: number; y: number; n: number } | null>(null)
  const [home, setHome] = useState(script === 'permission')
  const [tapIcon, setTapIcon] = useState(false)
  const [opening, setOpening] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [tapAllow, setTapAllow] = useState(false)
  // animacija instalacije — broj je ključ, da svaki dodir krene ispočetka
  const [demo, setDemo] = useState<number | null>(null)
  // Android: Chromeov dijalog za instalaciju, pa početni ekran s novom ikonicom
  const [chrome, setChrome] = useState(false)
  const [tapInstall, setTapInstall] = useState(false)
  const [fresh, setFresh] = useState(false)
  const installNow = useRef<() => void>(() => {})
  useEffect(() => {
    if (demo === null || manual) return
    const t = setTimeout(() => setDemo(null), DEMO_MS)
    return () => clearTimeout(t)
  }, [demo, manual])
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  }, [onDone])

  // odgovor na sistemski prozor — i kad prezenter sam klikne
  const answer = useRef<(ok: boolean) => void>(() => {})
  // ručno: dodir na ikonicu na početnom ekranu otvara aplikaciju
  const open = useRef<() => void>(() => {})

  useEffect(() => {
    let alive = true
    const timers: number[] = []
    const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)))
    const until = async <T,>(fn: () => T | null, max = 25000): Promise<T | null> => {
      const t0 = Date.now()
      while (alive && Date.now() - t0 < max) {
        const v = fn()
        if (v) return v
        await wait(120)
      }
      return null
    }
    /** dodir iznad dugmeta u aplikaciji, pa pravi klik */
    const press = async (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      setTap({ x: r.left + r.width / 2, y: top + r.top + r.height / 2, n: Date.now() })
      await wait(260)
      if (!alive) return
      el.click()
      await wait(380)
      setTap(null)
    }
    const frame = () => frameRef.current

    // Allow / Don't Allow — automatski ili rukom
    let allowed: () => void = () => {}
    const allowedP = new Promise<void>((r) => (allowed = r))
    answer.current = (ok) => {
      setTapAllow(false)
      setDialog(false)
      frame()?.contentWindow?.postMessage(
        { type: ok ? 'stihdana:permission-granted' : 'stihdana:permission-denied' },
        window.location.origin,
      )
      if (ok) allowed()
    }
    const afterAllow = async () => {
      await allowedP
      await wait(2600)
    }

    // Android: dijalog iskoči kad aplikacija zatraži instalaciju
    let chromeShown: () => void = () => {}
    const chromeP = new Promise<void>((r) => (chromeShown = r))
    let installed: () => void = () => {}
    const installedP = new Promise<void>((r) => (installed = r))
    let installing = false
    installNow.current = async () => {
      if (installing) return
      installing = true
      setTapInstall(false)
      setChrome(false)
      frame()?.contentWindow?.postMessage({ type: 'stihdana:installed' }, window.location.origin)
      // aplikacija pokaže da je instalirana, pa početni ekran s novom ikonicom
      await wait(1700)
      if (!alive) return
      setFresh(true)
      installed()
    }

    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame()?.contentWindow) return
      if (e.data?.type === 'stihdana:install') {
        setChrome(true)
        chromeShown()
      }
      if (e.data?.type === 'stihdana:permission') setDialog(true)
      if (e.data?.type === 'stihdana:howto') setDemo(Date.now())
    }
    window.addEventListener('message', onMessage)

    // ikonica → aplikacija se raširi i učita ispočetka (njen uvod igra ispred publike)
    let opened = false
    const openApp = async () => {
      if (opened) return
      opened = true
      setTapIcon(true)
      await wait(280)
      const old = frame()?.contentDocument
      try {
        frame()?.contentWindow?.location.replace(expect)
      } catch {
        /* tuđa adresa */
      }
      setOpening(true)
      await wait(650)
      await until(() => {
        const doc = frame()?.contentDocument
        return doc && doc !== old && doc.readyState === 'complete' && at(frame()) === expect ? doc : null
      }, 8000)
      if (alive) setHome(false)
    }
    open.current = () => void openApp()

    if (manual) {
      // instalacija završi kad prezenter dodirne novu ikonicu (InstallDemo onEnd),
      // dozvola — kad pritisne Allow
      if (script === 'permission') afterAllow().then(() => alive && done.current?.())
      if (script === 'install' && platform === 'android')
        installedP.then(() => wait(2800)).then(() => alive && done.current?.())
      return () => {
        alive = false
        timers.forEach(clearTimeout)
        window.removeEventListener('message', onMessage)
      }
    }

    ;(async () => {
      if (script === 'install' && platform === 'android') {
        const btn = await until(() => visible(frame(), expect, '[data-deck="install"]'))
        if (!btn || !alive) return
        await wait(900)
        await press(btn)
        await Promise.race([chromeP, wait(4000)])
        await wait(1400)
        if (!alive) return
        setTapInstall(true)
        await wait(320)
        if (alive) installNow.current()
        await installedP
        await wait(2800)
      } else if (script === 'install') {
        const how = await until(() => visible(frame(), expect, '[data-deck="howto"]'))
        if (!how || !alive) return
        await wait(700)
        await press(how)
        await wait(DEMO_MS + 1500)
      } else {
        await wait(1300)
        if (!alive) return
        await openApp()
        if (!alive) return
        const btn = await until(() => visible(frame(), expect, '[data-deck="allow"]'))
        if (!btn || !alive) return
        await wait(700)
        await press(btn)
        await wait(1500)
        if (!alive) return
        setTapAllow(true)
        await wait(300)
        if (alive) answer.current(true)
        await afterAllow()
      }
      if (alive) done.current?.()
    })()

    return () => {
      alive = false
      timers.forEach(clearTimeout)
      window.removeEventListener('message', onMessage)
    }
    // scena se igra jednom po montaži
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ios = platform === 'ios'
  const s = homeSlot(platform, w, top)

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 20, fontFamily: ios ? SF : ROBOTO }}>
      {/* početni ekran, pa aplikacija koja se iz ikonice raširi preko njega */}
      <AnimatePresence>
        {home && (
          <motion.div
            key="home"
            className="absolute inset-0 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="absolute inset-0"
              animate={opening ? { scale: 1.12, opacity: 0.4 } : { scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.3, 0, 0.1, 1] }}
              style={{ transformOrigin: `${s.x + s.size / 2}em ${s.y + s.size / 2}em` }}
            >
              <HomeScreen platform={platform} w={w} h={h} top={top} tapping={tapIcon && !opening} />
            </motion.div>
            {manual && !opening && (
              <>
                {/* početni ekran je slika — dodir ide samo na ikonicu Stih dana */}
                <span className="pointer-events-auto absolute inset-0" />
                <button
                  type="button"
                  aria-label="Otvori Stih dana"
                  className="pointer-events-auto absolute cursor-pointer"
                  style={{ left: `${s.x}em`, top: `${s.y}em`, width: `${s.size}em`, height: `${s.size}em`, borderRadius: `${s.size * 0.24}em` }}
                  onClick={() => open.current()}
                />
              </>
            )}
            {opening && (
              <motion.div
                className="absolute flex items-center justify-center overflow-hidden"
                style={{ background: '#000' }}
                initial={{
                  left: `${s.x}em`,
                  top: `${s.y}em`,
                  width: `${s.size}em`,
                  height: `${s.size}em`,
                  borderRadius: `${s.size * 0.24}em`,
                }}
                animate={{ left: 0, top: 0, width: `${w}em`, height: `${h}em`, borderRadius: ios ? '54em' : '34em' }}
                transition={{ type: 'spring', stiffness: 210, damping: 27 }}
              >
                {/* iOS: ikonica se utopi u prozor; Android: splash s ikonicom */}
                <motion.span
                  initial={{ opacity: 1, scale: 1 }}
                  animate={ios ? { opacity: 0, scale: 1.6 } : { opacity: 1, scale: 1.7 }}
                  transition={{ duration: 0.35 }}
                >
                  <AppIcon platform={platform} size={s.size} />
                </motion.span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {demo !== null && (
          <motion.div
            key={demo}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <InstallDemo
              platform={platform}
              w={w}
              h={h}
              top={top}
              manual={manual}
              onEnd={() => {
                setDemo(null)
                done.current?.()
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {tap && <Tap key={tap.n} platform={platform} x={tap.x} y={tap.y} />}

      {/* Android: Chromeov "Install app" */}
      <AnimatePresence>
        {chrome && (
          <motion.div
            key="chrome"
            className="pointer-events-auto absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <AndroidDialog tapping={tapInstall} onInstall={() => installNow.current()} onCancel={() => setChrome(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {fresh && (
          <motion.div
            key="fresh"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <HomeScreen platform={platform} w={w} h={h} top={top} fresh />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dialog && (
          <motion.div
            key="perm"
            className="pointer-events-auto absolute inset-0 flex items-center justify-center"
            style={{ background: ios ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.55)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {ios ? (
              <IosAlert tapping={tapAllow} onAnswer={(ok) => answer.current(ok)} />
            ) : (
              <AndroidPermission tapping={tapAllow} onAnswer={(ok) => answer.current(ok)} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── sistemski prozori za dozvolu ──────────────────────────── */

function IosAlert({ tapping, onAnswer }: { tapping: boolean; onAnswer: (ok: boolean) => void }) {
  const sep = 'rgba(255,255,255,0.16)'
  return (
    <motion.div
      initial={{ scale: 1.15, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.9, 0.3, 1] }}
      style={{
        width: '270em',
        borderRadius: '14em',
        overflow: 'hidden',
        background: 'rgba(40,40,42,0.86)',
        backdropFilter: 'blur(40px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
        color: '#fff',
        textAlign: 'center',
      }}
    >
      <div style={{ padding: '19em 16em 18em' }}>
        <p style={{ fontSize: '17em', fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.02em' }}>
          “Stih dana” Would Like to Send You Notifications
        </p>
        <p style={{ fontSize: '13em', lineHeight: 1.35, marginTop: '0.3em' }}>
          Notifications may include alerts, sounds and icon badges. These can be configured in Settings.
        </p>
      </div>
      <div className="flex" style={{ borderTop: `0.5em solid ${sep}`, height: '44em' }}>
        <button type="button" onClick={() => onAnswer(false)} className="flex flex-1 items-center justify-center" style={{ borderRight: `0.5em solid ${sep}` }}>
          <span style={{ fontSize: '17em', color: IOS_BLUE }}>Don’t Allow</span>
        </button>
        <button type="button" onClick={() => onAnswer(true)} className="relative flex flex-1 items-center justify-center">
          <span style={{ fontSize: '17em', color: IOS_BLUE, fontWeight: 600 }}>Allow</span>
          {tapping && <Tap platform="ios" />}
        </button>
      </div>
    </motion.div>
  )
}

/** Android 13+ — POST_NOTIFICATIONS, Material You (dark). */
function AndroidPermission({ tapping, onAnswer }: { tapping: boolean; onAnswer: (ok: boolean) => void }) {
  const btn = (first: boolean) => ({
    height: '56em',
    background: '#33363C',
    borderRadius: first ? '20em 20em 4em 4em' : '4em 4em 20em 20em',
  })
  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 330, damping: 28 }}
      style={{ width: '330em', borderRadius: '28em', background: '#26282C', padding: '24em', color: '#E3E3E3', textAlign: 'center' }}
    >
      <span className="flex justify-center">
        <Sym d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5M13.7 20a2 2 0 0 1-3.4 0" size={30} color="#A8C7FA" weight={1.9} />
      </span>
      <p style={{ fontSize: '22em', lineHeight: 1.3, margin: '0.7em 0 1.1em' }}>
        Allow <b style={{ fontWeight: 600 }}>Stih dana</b> to send you notifications?
      </p>
      <div className="flex flex-col" style={{ gap: '3em' }}>
        <button type="button" onClick={() => onAnswer(true)} className="relative flex items-center justify-center" style={btn(true)}>
          <span style={{ fontSize: '16em', fontWeight: 500 }}>Allow</span>
          {tapping && <Tap platform="android" />}
        </button>
        <button type="button" onClick={() => onAnswer(false)} className="flex items-center justify-center" style={btn(false)}>
          <span style={{ fontSize: '16em', fontWeight: 500 }}>Don’t allow</span>
        </button>
      </div>
    </motion.div>
  )
}
