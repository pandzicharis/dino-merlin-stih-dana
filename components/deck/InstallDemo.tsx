'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { HOST, HomeScreen, IOS_BLUE, IOS_GRAY, IOS_SEP, ROBOTO, SF, Sym, SysIcon, Tap, AppIcon, IosAppIcon, type Platform } from './phoneUi'

/**
 * Instalacija bez storea, odigrana na telefonu: preglednik s otvorenim
 * linkom → meni → "Add to Home Screen" → potvrda → početni ekran na kojem
 * iskoči ikona Stih dana. Tu staje.
 *
 * Sistemski ekrani prate originale — iOS 18 (Safari, share sheet,
 * tastatura, dark mode) i Chrome na Androidu (Material You, dark). Crta se
 * preko prave aplikacije, u `em`: 1em = 1 piksel ekrana telefona.
 */

const PHASES = ['page', 'tapMenu', 'menu', 'scroll', 'tapAdd', 'dialog', 'tapConfirm', 'home'] as const
export type InstallPhase = (typeof PHASES)[number]
/** kad koja faza počinje, u sekundama */
const AT = [0, 2.0, 2.5, 3.5, 4.7, 5.3, 7.6, 8.2]

/** u ručnom prolazu demo čeka dodir samo na ovim fazama; ostale (dodir, skrol) odigra sam */
const WAIT: InstallPhase[] = ['page', 'menu', 'dialog', 'home']

export function InstallDemo({
  platform,
  w,
  h,
  top,
  onPhase,
  manual,
  onEnd,
}: {
  platform: Platform
  w: number
  h: number
  top: number
  /** javlja svaku fazu — da tekst uputstva prati animaciju */
  onPhase?: (phase: InstallPhase) => void
  /** prezenter klikće kroz demo: dodir bilo gdje na telefonu = sljedeći korak */
  manual?: boolean
  /** ručni prolaz: dodir na početnom ekranu s novom ikonicom završava demo */
  onEnd?: () => void
}) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (manual) return
    const ts = AT.slice(1).map((t, k) => setTimeout(() => setI(k + 1), t * 1000))
    return () => ts.forEach(clearTimeout)
  }, [manual])
  const phase = PHASES[i]
  useEffect(() => {
    if (!manual || WAIT.includes(phase) || i >= PHASES.length - 1) return
    const t = setTimeout(() => setI(i + 1), (AT[i + 1] - AT[i]) * 1000)
    return () => clearTimeout(t)
  }, [manual, i, phase])
  const next = () => {
    if (!WAIT.includes(phase)) return
    if (phase === 'home') onEnd?.()
    else setI(i + 1)
  }
  useEffect(() => onPhase?.(phase), [phase, onPhase])
  const past = (p: InstallPhase) => PHASES.indexOf(p) <= i

  return (
    <div
      className="absolute inset-0"
      style={{
        zIndex: 20,
        fontFamily: platform === 'ios' ? SF : ROBOTO,
        ...(manual ? { pointerEvents: 'auto', cursor: 'pointer' } : {}),
      }}
      onClick={manual ? next : undefined}
    >
      {platform === 'ios' ? (
        <>
          {!past('home') && <SafariBar tapping={phase === 'tapMenu'} />}
          <Sheet show={past('menu') && !past('dialog')} top={past('scroll') ? top + 10 : h * 0.46}>
            <IosShareSheet tapping={phase === 'tapAdd'} chosen={past('tapAdd')} />
            {phase === 'scroll' && (
              <motion.span
                className="absolute left-1/2"
                style={{ top: '330em' }}
                initial={{ y: 0 }}
                animate={{ y: '-220em' }}
                transition={{ duration: 0.55, ease: [0.3, 0, 0.2, 1] }}
              >
                <Tap platform="ios" />
              </motion.span>
            )}
          </Sheet>
          <Sheet show={past('dialog') && !past('home')} top={top + 10}>
            <IosAddDialog tapping={phase === 'tapConfirm'} />
          </Sheet>
        </>
      ) : (
        <>
          {!past('home') && <ChromeBar top={top} tapping={phase === 'tapMenu'} />}
          <AnimatePresence>
            {past('menu') && !past('dialog') && (
              <motion.div
                key="menu"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                style={{ position: 'absolute', top: `${top + 6}em`, right: '6em', transformOrigin: 'top right', zIndex: 30 }}
              >
                <ChromeMenu tapping={phase === 'tapAdd'} chosen={past('tapAdd')} />
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {past('dialog') && !past('home') && (
              <motion.div
                key="dlg"
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.55)', zIndex: 30 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <AndroidDialog tapping={phase === 'tapConfirm'} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <AnimatePresence>
        {past('home') && (
          <motion.div
            key="home"
            className="absolute inset-0"
            style={{ zIndex: 40 }}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <HomeScreen platform={platform} w={w} h={h} top={top} fresh />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── iOS 18 ────────────────────────────────────────────────── */

function SafariBar({ tapping }: { tapping: boolean }) {
  return (
    <div
      className="absolute inset-x-0 bottom-0"
      style={{
        background: 'rgba(30,30,32,0.88)',
        backdropFilter: 'blur(30px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(30px) saturate(1.8)',
        boxShadow: `0 -0.5em 0 ${IOS_SEP}`,
        paddingBottom: '30em',
        zIndex: 25,
        color: '#fff',
      }}
    >
      {/* adresno polje */}
      <div
        className="flex items-center"
        style={{ margin: '8em 10em 0', height: '48em', borderRadius: '14em', background: '#3A3A3C', padding: '0 14em', gap: '10em', boxShadow: '0 2em 8em rgba(0,0,0,0.25)' }}
      >
        {/* meni stranice (iOS 18) */}
        <Sym d="M7 3.5h7.5L19 8v12.5H7zM14.5 3.5V8H19M10 12h6M10 15.5h6" size={19} color="#fff" weight={1.8} />
        <span className="flex min-w-0 flex-1 justify-center">
          <span style={{ fontSize: '16.5em', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{HOST}</span>
        </span>
        <Sym d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.5H15" size={17} color="#fff" weight={2} />
      </div>
      {/* traka s alatima */}
      <div className="flex items-center justify-between" style={{ padding: '0 24em', height: '50em' }}>
        <Sym d="m15 19-7-7 7-7" size={23} color="rgba(235,235,245,0.3)" weight={2.2} />
        <Sym d="m9 19 7-7-7-7" size={23} color="rgba(235,235,245,0.3)" weight={2.2} />
        <span className="relative flex">
          <Sym d="M12 3v12.5M8 7l4-4 4 4M8.5 10H6.5a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5h-2" size={25} color={IOS_BLUE} weight={1.9} />
          {tapping && <Tap platform="ios" />}
        </span>
        <Sym d="M12 6.5C10.5 5 8 4.5 3.5 4.5v14c4.5 0 7 .5 8.5 2 1.5-1.5 4-2 8.5-2v-14c-4.5 0-7 .5-8.5 2zM12 6.5v14" size={25} color={IOS_BLUE} weight={1.8} />
        <Sym d="M8.5 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h8.5A1.5 1.5 0 0 1 20 5.5V14a1.5 1.5 0 0 1-1.5 1.5h-2M5.5 8.5H14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 14 20H5.5A1.5 1.5 0 0 1 4 18.5V10a1.5 1.5 0 0 1 1.5-1.5z" size={24} color={IOS_BLUE} weight={1.8} />
      </div>
    </div>
  )
}

function Sheet({ show, top, children }: { show: boolean; top: number; children: ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div key="sheet" className="absolute inset-0" style={{ zIndex: 30 }}>
          <motion.div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.42)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 overflow-hidden"
            style={{ borderRadius: '12em 12em 0 0', background: '#1C1C1E' }}
            initial={{ y: '100%', top: `${top}em` }}
            animate={{ y: 0, top: `${top}em` }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 36 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function IosShareSheet({ tapping, chosen }: { tapping: boolean; chosen: boolean }) {
  const people: [string, string][] = [
    ['AirDrop', ''],
    ['Amra', 'A'],
    ['Tarik', 'T'],
    ['Lejla', 'L'],
  ]
  const apps: [string, string, string][] = [
    ['Messages', 'linear-gradient(180deg,#65F07E,#1DBF3F)', 'M12 4c4.7 0 8.5 3 8.5 6.8S16.7 17.6 12 17.6c-.9 0-1.8-.1-2.6-.3L5 19.5l1.3-3.4C4.5 14.8 3.5 12.9 3.5 10.8 3.5 7 7.3 4 12 4z'],
    ['Mail', 'linear-gradient(180deg,#3EB4FF,#0A6CFF)', 'M3.5 6.5h17v11h-17zM3.5 6.5l8.5 6.5 8.5-6.5'],
    ['Notes', 'linear-gradient(180deg,#FFE680,#FFD20A)', 'M7 4h10v16H7zM9.5 9h5M9.5 12.5h5M9.5 16h3'],
    ['Reminders', 'linear-gradient(180deg,#FFFFFF,#F2F2F7)', 'M6 7h.01M10 7h8M6 12h.01M10 12h8M6 17h.01M10 17h8'],
  ]
  return (
    <div style={{ color: '#fff' }}>
      {/* zaglavlje */}
      <div className="flex items-center" style={{ padding: '18em 16em 14em', gap: '12em', borderBottom: `0.5em solid ${IOS_SEP}` }}>
        <AppIcon platform="ios" size={46} style={{ borderRadius: '9em', WebkitMaskImage: 'none', maskImage: 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '15em', fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Stih dana — Dino Merlin
          </p>
          <p style={{ fontSize: '13em', color: IOS_GRAY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{HOST}</p>
          <p style={{ fontSize: '13em', color: IOS_BLUE, marginTop: '0.1em' }}>Options ›</p>
        </div>
        <span className="flex shrink-0 items-center justify-center self-start" style={{ width: '30em', height: '30em', borderRadius: '50%', background: 'rgba(118,118,128,0.24)' }}>
          <Sym d="M7.5 7.5l9 9M16.5 7.5l-9 9" size={14} color="rgba(235,235,245,0.6)" weight={3} />
        </span>
      </div>
      {/* AirDrop i ljudi */}
      <Row>
        {people.map(([n, ini]) => (
          <Tile key={n} label={n}>
            {ini ? (
              <span
                className="flex items-center justify-center"
                style={{ width: '62em', height: '62em', borderRadius: '50%', background: 'linear-gradient(180deg,#A5ABB8,#858994)' }}
              >
                <span style={{ fontSize: '25em', fontWeight: 500, color: '#fff' }}>{ini}</span>
              </span>
            ) : (
              <span className="flex items-center justify-center" style={{ width: '62em', height: '62em', borderRadius: '50%', background: 'linear-gradient(180deg,#3EB4FF,#0A6CFF)' }}>
                <Sym d="M12 13.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zM8.8 15.6a4.5 4.5 0 1 1 6.4 0M6.2 18.2a8.2 8.2 0 1 1 11.6 0" size={34} color="#fff" weight={1.8} />
              </span>
            )}
          </Tile>
        ))}
      </Row>
      {/* aplikacije */}
      <Row border>
        {apps.map(([n, bg, d]) => (
          <Tile key={n} label={n}>
            {n === 'Messages' ? (
              <IosAppIcon app="messages" size={62} />
            ) : n === 'Reminders' ? (
              <span className="flex items-center justify-center" style={{ width: '62em', height: '62em', background: bg, borderRadius: '14em' }}>
                <Sym d={d} size={30} color="#FF9F0A" weight={2.4} />
              </span>
            ) : (
              <SysIcon platform="ios" size={62} bg={bg} d={d} />
            )}
          </Tile>
        ))}
      </Row>
      {/* radnje — grupe, SF ikonice desno */}
      <div style={{ padding: '0 16em' }}>
        <Group rows={[['Copy', 'M9 9h10.5v11.5H9zM15 9V4.5H4.5V15H9']]} />
        <div style={{ height: '18em' }} />
        <Group
          rows={[
            ['Add to Reading List', 'M3.5 14a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM14.5 14a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM9.5 14h5'],
            ['Add Bookmark', 'M12 6.5C10.5 5 8 4.5 3.5 4.5v14c4.5 0 7 .5 8.5 2 1.5-1.5 4-2 8.5-2v-14c-4.5 0-7 .5-8.5 2zM12 6.5v14'],
            ['Add to Favourites', 'm12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z'],
            ['Add to Quick Note', 'M5 4h14v16H5zM9 4v16M12 9h4M12 13h4'],
            ['Find on Page', 'M6 3.5h8l4 4v13H6zM11 16a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6zM13 15.5l2.2 2.2'],
            ['Add to Home Screen', 'M5.5 3.5h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2zM12 8v8M8 12h8'],
            ['Markup', 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4'],
            ['Print', 'M7 9V3.5h10V9M7 17H4.5V9h15v8H17M7 14h10v6.5H7z'],
          ]}
          active={chosen ? 'Add to Home Screen' : undefined}
          tapping={tapping ? 'Add to Home Screen' : undefined}
        />
      </div>
    </div>
  )
}

function Row({ children, border = false }: { children: ReactNode; border?: boolean }) {
  return (
    <div
      className="flex"
      style={{ gap: '20em', padding: '16em 18em 12em', borderBottom: border ? `0.5em solid ${IOS_SEP}` : undefined, marginBottom: border ? '16em' : 0 }}
    >
      {children}
    </div>
  )
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex flex-col items-center" style={{ width: '66em' }}>
      {children}
      <span style={{ fontSize: '11em', marginTop: '0.65em', color: '#fff', whiteSpace: 'nowrap' }}>{label}</span>
    </span>
  )
}

function Group({ rows, active, tapping }: { rows: [string, string][]; active?: string; tapping?: string }) {
  return (
    <div style={{ borderRadius: '12em', background: '#2C2C2E', overflow: 'hidden' }}>
      {rows.map(([t, d], k) => (
        <div
          key={t}
          className="relative flex items-center justify-between"
          style={{ height: '50em', padding: '0 16em', background: active === t ? '#3A3A3C' : undefined, transition: 'background 0.15s' }}
        >
          {k > 0 && <span className="absolute right-0 top-0" style={{ left: '16em', height: '0.5em', background: IOS_SEP }} />}
          <span style={{ fontSize: '17em', letterSpacing: '-0.02em' }}>{t}</span>
          <Sym d={d} size={22} color="#fff" weight={1.6} />
          {tapping === t && <Tap platform="ios" />}
        </div>
      ))}
    </div>
  )
}

function IosAddDialog({ tapping }: { tapping: boolean }) {
  return (
    <div style={{ color: '#fff' }}>
      <div className="relative flex items-center justify-between" style={{ height: '56em', padding: '6em 16em 0' }}>
        <span style={{ fontSize: '17em', color: IOS_BLUE }}>Cancel</span>
        <span className="absolute left-1/2 -translate-x-1/2" style={{ fontSize: '17em', fontWeight: 600, letterSpacing: '-0.02em' }}>
          Add to Home Screen
        </span>
        <span className="relative flex">
          <span style={{ fontSize: '17em', fontWeight: 600, color: IOS_BLUE }}>Add</span>
          {tapping && <Tap platform="ios" />}
        </span>
      </div>
      <div className="flex items-center" style={{ margin: '22em 16em 0', padding: '12em 0 12em 16em', gap: '14em', borderRadius: '12em', background: '#2C2C2E' }}>
        <AppIcon platform="ios" size={60} style={{ borderRadius: '13em', WebkitMaskImage: 'none', maskImage: 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center" style={{ paddingBottom: '11em', paddingRight: '14em', borderBottom: `0.5em solid ${IOS_SEP}`, gap: '1em' }}>
            <span style={{ fontSize: '17em' }}>Stih dana</span>
            {/* kursor */}
            <motion.span
              style={{ width: '2em', height: '22em', borderRadius: '1em', background: IOS_BLUE }}
              animate={{ opacity: [1, 1, 0, 0] }}
              transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.55, 1] }}
            />
            <span className="flex-1" />
            <span className="flex items-center justify-center" style={{ width: '17em', height: '17em', borderRadius: '50%', background: 'rgba(235,235,245,0.3)' }}>
              <Sym d="M8 8l8 8M16 8l-8 8" size={11} color="#2C2C2E" weight={3.4} />
            </span>
          </div>
          <p style={{ fontSize: '15em', marginTop: '0.6em', paddingRight: '1em', color: IOS_GRAY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            https://{HOST}/
          </p>
        </div>
      </div>
      <p style={{ fontSize: '13em', margin: '0.6em 2.5em 0', color: IOS_GRAY, lineHeight: 1.35 }}>
        An icon will be added to your Home Screen so you can quickly access this website.
      </p>
      <IosKeyboard />
    </div>
  )
}

/** Tastatura (dark) — iskoči s poljem za ime, kao na pravom iPhoneu. */
function IosKeyboard() {
  const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']
  const key = (extra?: object) => ({
    height: '43em',
    borderRadius: '5.5em',
    background: '#6B6B6E',
    boxShadow: '0 1em 0 rgba(0,0,0,0.45)',
    ...extra,
  })
  const fn = { background: '#464649' }
  return (
    <motion.div
      className="absolute inset-x-0 bottom-0"
      style={{ background: 'rgba(43,43,45,0.97)', padding: '8em 3em 0', fontFamily: SF }}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 40, delay: 0.15 }}
    >
      <div className="flex flex-col" style={{ gap: '11em' }}>
        {rows.map((r, k) => (
          <div key={r} className="flex justify-center" style={{ gap: '6em' }}>
            {k === 2 && (
              <span className="flex items-center justify-center" style={{ ...key(fn), width: '44em', marginRight: '8em' }}>
                <Sym d="M12 4 4.5 12H9v7h6v-7h4.5z" size={19} color="#fff" weight={1.7} />
              </span>
            )}
            {r.split('').map((c) => (
              <span key={c} className="flex items-center justify-center" style={{ ...key(), width: '34em' }}>
                <span style={{ fontSize: '22.5em', color: '#fff' }}>{c.toLowerCase()}</span>
              </span>
            ))}
            {k === 2 && (
              <span className="flex items-center justify-center" style={{ ...key(fn), width: '44em', marginLeft: '8em' }}>
                <Sym d="M9 5.5h11v13H9L3.5 12zM12 9.5l5 5M17 9.5l-5 5" size={21} color="#fff" weight={1.6} />
              </span>
            )}
          </div>
        ))}
        <div className="flex" style={{ gap: '6em' }}>
          <span className="flex items-center justify-center" style={{ ...key(fn), width: '92em' }}>
            <span style={{ fontSize: '16em', color: '#fff' }}>123</span>
          </span>
          <span className="flex flex-1 items-center justify-center" style={key()}>
            <span style={{ fontSize: '16em', color: '#fff' }}>space</span>
          </span>
          <span className="flex items-center justify-center" style={{ ...key({ background: IOS_BLUE }), width: '92em' }}>
            <span style={{ fontSize: '16em', color: '#fff' }}>done</span>
          </span>
        </div>
      </div>
      {/* emoji i diktat ispod tipki — iPhone bez dugmeta Home */}
      <div className="flex items-start justify-between" style={{ height: '78em', padding: '14em 22em 0' }}>
        <Sym d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" size={27} color="rgba(235,235,245,0.8)" weight={1.6} />
        <Sym d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3zM6 11.5a6 6 0 0 0 12 0M12 17.5V21" size={27} color="rgba(235,235,245,0.8)" weight={1.6} />
      </div>
    </motion.div>
  )
}

/* ── Chrome na Androidu (Material You, dark) ───────────────── */

const M_SURFACE = '#1F1F1F'
const M_CONTAINER = '#2B2C30'
const M_ON = '#E3E3E3'
const M_VARIANT = '#C4C7C5'
const M_PRIMARY = '#A8C7FA'

function ChromeBar({ top, tapping }: { top: number; tapping: boolean }) {
  return (
    <div
      className="absolute inset-x-0 flex items-center"
      style={{ top: `${top}em`, height: '60em', padding: '0 6em 0 12em', gap: '10em', background: M_SURFACE, color: M_ON, zIndex: 25 }}
    >
      <Sym d="M4.5 11 12 4.5l7.5 6.5M6.5 9.5V19.5h4v-5h3v5h4V9.5" size={22} color={M_ON} weight={1.8} />
      <div className="flex min-w-0 flex-1 items-center" style={{ height: '44em', borderRadius: '22em', background: '#303134', padding: '0 14em', gap: '10em' }}>
        {/* "tune" — podaci o stranici */}
        <Sym d="M4 7.5h9M17 7.5h3M15 5.5v4M4 16.5h3M11 16.5h9M9 14.5v4" size={18} color={M_VARIANT} weight={1.8} />
        <span style={{ fontSize: '15.5em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{HOST}</span>
      </div>
      <span className="flex shrink-0 items-center justify-center" style={{ width: '22em', height: '22em', borderRadius: '5em', border: `2em solid ${M_ON}` }}>
        <span style={{ fontSize: '11.5em', fontWeight: 700 }}>1</span>
      </span>
      <span className="relative flex shrink-0" style={{ padding: '6em' }}>
        <Sym d="M12 5h.01M12 12h.01M12 19h.01" size={24} color={M_ON} weight={3.2} />
        {tapping && <Tap platform="android" />}
      </span>
    </div>
  )
}

function ChromeMenu({ tapping, chosen }: { tapping: boolean; chosen: boolean }) {
  const items: [string, string][] = [
    ['New tab', 'M5 5h14v14H5zM12 9v6M9 12h6'],
    ['New Incognito tab', 'M4 14a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM14 14a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM10 14h4M3 10h18l-2-5H5z'],
    ['History', 'M12 21a9 9 0 1 0-9-9M3 4v5h5M12 7v5l3 2'],
    ['Delete browsing data', 'M6 7h12l-1 13H7zM4 7h16M10 4h4'],
    ['Downloads', 'M12 4v11M7 10l5 5 5-5M5 20h14'],
    ['Bookmarks', 'M6.5 3.5h11v17L12 16.5l-5.5 4z'],
    ['Recent tabs', 'M4 6h16v12H4zM4 10h16'],
    ['Share…', 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4'],
    ['Find in page', 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20'],
    ['Add to Home screen', 'M7 2.5h10a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V4A1.5 1.5 0 0 1 7 2.5zM12 8.5v7M8.5 12h7'],
    ['Desktop site', 'M3.5 5h17v11h-17zM9 20h6M12 16v4'],
    ['Settings', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1'],
  ]
  return (
    <div style={{ width: '250em', borderRadius: '16em', background: M_CONTAINER, padding: '4em 0 8em', color: M_ON, boxShadow: '0 6em 20em rgba(0,0,0,0.5)' }}>
      <div className="flex justify-around" style={{ padding: '10em 6em 12em' }}>
        {['M5 12h14M13 6l6 6-6 6', 'm12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z', 'M12 4v11M7 10l5 5 5-5M5 20h14', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01', 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.5H15'].map((d) => (
          <Sym key={d} d={d} size={21} color={M_ON} weight={1.8} />
        ))}
      </div>
      {items.map(([t, d]) => (
        <div
          key={t}
          className="relative flex items-center"
          style={{ height: '46em', padding: '0 18em', gap: '18em', background: chosen && t === 'Add to Home screen' ? 'rgba(227,227,227,0.12)' : undefined }}
        >
          <Sym d={d} size={21} color={M_VARIANT} weight={1.7} />
          <span style={{ fontSize: '15.5em' }}>{t}</span>
          {tapping && t === 'Add to Home screen' && <Tap platform="android" x={120} y={23} />}
        </div>
      ))}
    </div>
  )
}

/** Chromeov "Install app" — u demu instalacije, i kao pravi dijalog na dugme "Dodaj na početni ekran". */
export function AndroidDialog({
  tapping,
  onInstall,
  onCancel,
}: {
  tapping: boolean
  onInstall?: () => void
  onCancel?: () => void
}) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      style={{ width: '312em', borderRadius: '28em', background: M_CONTAINER, padding: '24em 24em 20em', color: M_ON }}
    >
      <p style={{ fontSize: '24em', lineHeight: 1.33 }}>Install app</p>
      <div className="flex items-center" style={{ gap: '16em', margin: '18em 0 26em' }}>
        <AppIcon platform="android" size={48} />
        <div className="min-w-0">
          <p style={{ fontSize: '16em' }}>Stih dana</p>
          <p style={{ fontSize: '14em', color: M_VARIANT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{HOST}</p>
        </div>
      </div>
      <div className="flex justify-end" style={{ gap: '8em' }}>
        <span role={onCancel ? 'button' : undefined} onClick={onCancel} style={{ padding: '10em 12em', cursor: onCancel ? 'pointer' : undefined }}>
          <span style={{ fontSize: '14.5em', color: M_PRIMARY, fontWeight: 500 }}>Cancel</span>
        </span>
        <span
          role={onInstall ? 'button' : undefined}
          onClick={onInstall}
          className="relative"
          style={{ padding: '10em 12em', cursor: onInstall ? 'pointer' : undefined }}
        >
          <span style={{ fontSize: '14.5em', color: M_PRIMARY, fontWeight: 500 }}>Install</span>
          {tapping && <Tap platform="android" />}
        </span>
      </div>
    </motion.div>
  )
}
