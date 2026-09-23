'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { MOODS, type Mood } from '@/data/moods'
import { BRAND } from '@/lib/brand'
import { MoodBackground } from './MoodBackground'
import { useMounted } from '@/lib/client-store'
import {
  ensurePermission,
  isIOS,
  isStandalone,
  permissionSnapshot,
  pushSupported,
  subscribePermission,
  subscribeToPush,
} from '@/lib/push-client'
import { SEND_HOUR, SEND_TIME } from '@/lib/date'
import { setNotifyIntent } from '@/lib/storage'
import { BrandLockup } from './BrandLockup'

type Platform = 'ios' | 'android' | 'desktop'

/** Kapija ima dvoja vrata: prvo instalacija, pa dozvola za obavijesti. */
type Stage = 'install' | 'permission' | null

/** Chrome/Edge daju hook na svoj vlastiti install dijalog. */
type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function detect(): Platform {
  if (typeof navigator === 'undefined') return 'desktop'
  if (isIOS()) return 'ios'
  if (/Android/i.test(navigator.userAgent)) return 'android'
  return 'desktop'
}

/**
 * Je li aplikacija instalirana — vanjski store, ne useEffect.
 * Korisnik može instalirati pa se vratiti u ovaj isti tab, i kapija se
 * tad mora sama maknuti.
 */
function subscribeInstalled(cb: () => void) {
  const mq = window.matchMedia('(display-mode: standalone)')
  mq.addEventListener('change', cb)
  window.addEventListener('appinstalled', cb)
  return () => {
    mq.removeEventListener('change', cb)
    window.removeEventListener('appinstalled', cb)
  }
}

/**
 * Kapija ispred aplikacije — stoji dok stih nije na početnom ekranu.
 *
 * Ovo nije splash koji se sam ugasi: Web Push na iPhoneu radi ISKLJUČIVO iz
 * instaliranog PWA-a, pa aplikacija u tabu ne može ispuniti ono zbog čega
 * postoji. Zato se dalje ide tek kad je dodana na početni ekran.
 *
 * Pozadina je ista kao na ekranu sa stihom — isti mood, ISTI `seed`, i obje
 * se montiraju u istom trenutku. Mrlje, portret i note stoje na istim
 * mjestima s obje strane, pa se pri prelazu ne mijenja ništa osim sadržaja:
 * prelaz se osjeti, ali se ne vidi.
 */
export function Onboarding({ mood, seed }: { mood: Mood; seed: string }) {
  // Bez ovoga se kapija na desktopu ne može ni pogledati ni proći. Nikad u produkciji.
  const isLocal = process.env.NODE_ENV !== 'production'
  const reduced = useReducedMotion()
  const mounted = useMounted()
  const installed = useSyncExternalStore(subscribeInstalled, isStandalone, () => false)
  const permission = useSyncExternalStore(
    subscribePermission,
    permissionSnapshot,
    () => 'unsupported',
  )
  const [platform, setPlatform] = useState<Platform>(detect)
  const [devStage, setDevStage] = useState<Stage | 'auto'>('auto')
  const [skipped, setSkipped] = useState(false)
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [asked, setAsked] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPrompt)
    }
    const onInstalled = () => setWaiting(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!prompt) return
    setBusy(true)
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') setWaiting(true)
    } catch {
      /* korisnik je zatvorio dijalog */
    }
    setPrompt(null)
    setBusy(false)
  }, [prompt])

  const allow = useCallback(async () => {
    setBusy(true)
    const p = await ensurePermission()
    setBusy(false)
    setAsked(true)
    if (p !== 'granted') return

    // Kapija se otvara na dozvolu, ne na odgovor servera — prijava pretplate
    // ide u pozadini, a zvono na stihu je tiho popravi ako padne.
    setNotifyIntent(true)
    void subscribeToPush(SEND_HOUR)
  }, [])

  /**
   * Prvo instalacija, pa dozvola. Ako uređaj uopšte ne zna za Web Push
   * (ili nema VAPID ključa), druga vrata ne postoje — nema šta tražiti.
   */
  const real: Stage = !installed
    ? 'install'
    : permission !== 'granted' && pushSupported()
      ? 'permission'
      : null

  // Na localhostu se obje faze moraju moći pogledati bez pravog telefona.
  const stage: Stage = isLocal && devStage !== 'auto' ? devStage : real

  // Kapija postoji već u HTML-u sa servera — inače stih bljesne prije nje.
  // Sadržaj čeka montažu (ovisi o platformi), pa je prvi frejm samo crno:
  // instalirana aplikacija tako ne vidi ništa od uvoda dok se ne makne.
  const show = stage !== null && !skipped

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          // `isolate` drži MoodBackground (z-index -10) iznad vlastite podloge
          className="fixed inset-0 isolate z-[60] overflow-y-auto"
          style={{ backgroundColor: MOODS[mood].gradient[0] }}
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.2 : 0.5, ease: 'easeInOut' }}
        >
          {mounted && (
            <>
              {/* ista pozadina kao na stihu — mrlje, portret, note, vinjeta */}
              <MoodBackground mood={mood} seed={seed} still />

              <div
                className={`relative flex min-h-[100dvh] flex-col items-center px-8 pt-[max(4rem,calc(env(safe-area-inset-top)+2rem))] ${
                  isLocal ? 'pb-20' : 'pb-[max(3rem,env(safe-area-inset-bottom))]'
                }`}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.9, delay: 0.2 }}
                >
                  <BrandLockup height={64} delay={0.35} />
                </motion.div>

                {/* Sadržaj sjedi u sredini preostalog prostora — ne visi
                    zalijepljen za dno kao kad je raspored bio `justify-between`. */}
                <motion.div
                  className="flex w-full max-w-[19rem] flex-1 flex-col items-center justify-center text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 1.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  {stage === 'permission' ? (
                    <PermissionStage
                      denied={permission === 'denied'}
                      asked={asked}
                      busy={busy}
                      platform={platform}
                      onAllow={allow}
                    />
                  ) : waiting ? (
                    <Done />
                  ) : (
                    <>
                      <p
                        className="font-serif text-[1.15rem] leading-[1.35] text-white/85"
                        style={{ fontFamily: 'var(--font-serif), serif' }}
                      >
                        Jedan stih, svaki dan u {SEND_TIME}
                      </p>
                      <span
                        className="my-6 h-px w-14"
                        style={{
                          background: `linear-gradient(to right, transparent, ${BRAND.gold}80, transparent)`,
                        }}
                        aria-hidden
                      />

                      <div className="w-full">
                        {platform === 'ios' && <IosSteps />}
                        {platform === 'android' && (
                          <AndroidSteps canPrompt={Boolean(prompt)} busy={busy} onInstall={install} />
                        )}
                        {platform === 'desktop' && <DesktopSteps />}
                      </div>
                    </>
                  )}
                </motion.div>

              </div>

              {/* Dev komande — ista traka kao DevDateBar, da localhost ima
                  jedan jezik umjesto dva. */}
              {isLocal && (
                <div className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 bg-black/85 px-3 py-2 font-mono text-[11px] text-white/80 backdrop-blur">
                  <span className="text-white/40">uvod</span>
                  {(['ios', 'android', 'desktop'] as Platform[]).map((p) => (
                    <DevChip key={p} on={platform === p} onClick={() => setPlatform(p)}>
                      {p}
                    </DevChip>
                  ))}
                  <span className="text-white/20">·</span>
                  <DevChip on={devStage === 'install'} onClick={() => setDevStage('install')}>
                    instalacija
                  </DevChip>
                  <DevChip on={devStage === 'permission'} onClick={() => setDevStage('permission')}>
                    dozvola
                  </DevChip>
                  <DevChip on={devStage === 'auto'} onClick={() => setDevStage('auto')}>
                    auto
                  </DevChip>
                  <button
                    onClick={() => setSkipped(true)}
                    className="ml-auto px-1.5 text-white/50 hover:text-white"
                  >
                    preskoči ▶
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Dugmad dev trake — postoje samo na localhostu. */
function DevChip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-1.5 transition-colors ${on ? 'text-white' : 'text-white/40 hover:text-white/80'}`}
    >
      {children}
    </button>
  )
}

/**
 * Druga vrata — aplikacija je na početnom ekranu, ostaje dozvola.
 *
 * Bez nje cijela aplikacija nema svrhu, pa se dalje ne ide. Kad je dozvola
 * jednom odbijena, sistem je više ne pita — tad ostaje samo put kroz postavke.
 */
function PermissionStage({
  denied,
  asked,
  busy,
  platform,
  onAllow,
}: {
  denied: boolean
  asked: boolean
  busy: boolean
  platform: Platform
  onAllow: () => void
}) {
  if (denied) {
    return (
      <>
        <p
          className="font-serif text-[1.15rem] leading-[1.35] text-white/85"
          style={{ fontFamily: 'var(--font-serif), serif' }}
        >
          Obavijesti su isključene
        </p>
        <span
          className="my-6 h-px w-14"
          style={{
            background: `linear-gradient(to right, transparent, ${BRAND.gold}80, transparent)`,
          }}
          aria-hidden
        />
        <ol className="mx-auto flex w-full flex-col gap-4 text-left">
          <Step n={1}>
            Otvori <b className="font-medium text-white/90">Postavke</b>
          </Step>
          <Step n={2}>
            {platform === 'ios' ? (
              <>
                Nađi <b className="font-medium text-white/90">Stih dana</b> u listi aplikacija
              </>
            ) : (
              <>
                <b className="font-medium text-white/90">Aplikacije</b> → Stih dana → Obavijesti
              </>
            )}
          </Step>
          <Step n={3}>
            Uključi <b className="font-medium text-white/90">Obavijesti</b> pa se vrati
          </Step>
        </ol>
      </>
    )
  }

  return (
    <>
      <p
        className="font-serif text-[1.15rem] leading-[1.35] text-white/85"
        style={{ fontFamily: 'var(--font-serif), serif' }}
      >
        Dozvoli da ti stih dođe sam
      </p>
      <span
        className="my-6 h-px w-14"
        style={{
          background: `linear-gradient(to right, transparent, ${BRAND.gold}80, transparent)`,
        }}
        aria-hidden
      />
      <button
        onClick={onAllow}
        disabled={busy}
        className="w-full rounded-full px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-black transition-opacity active:opacity-80 disabled:opacity-60"
        style={{ backgroundColor: BRAND.gold }}
      >
        {busy ? 'Trenutak…' : 'Uključi obavijesti'}
      </button>
      <p className="mt-5 text-[11px] leading-relaxed text-white/30">
        {asked ? 'Dozvola nije data — pokušaj ponovo.' : `Jedna obavijest dnevno, u ${SEND_TIME}.`}
      </p>
    </>
  )
}

/** Instalirano, ali smo još u tabu — aplikacija se sad otvara s ikone. */
function Done() {
  return (
    <>
      <motion.span
        className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border"
        style={{ borderColor: `${BRAND.gold}66` }}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 18 }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={BRAND.gold}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12.5 10 17.5 19 7" />
        </svg>
      </motion.span>
      <p
        className="font-serif text-[1.5rem] leading-snug text-white"
        style={{ fontFamily: 'var(--font-serif), serif' }}
      >
        Stih je na tvom ekranu
      </p>
      <p className="mt-4 text-[13px] leading-relaxed text-white/45">
        Zatvori browser i otvori aplikaciju s početnog ekrana.
      </p>
    </>
  )
}

function IosSteps() {
  return (
    <ol className="mx-auto flex flex-col gap-4 text-left">
      <Step n={1}>
        Dodirni <Glyph kind="share" /> na dnu Safarija
      </Step>
      <Step n={2}>
        Skrolaj i odaberi <b className="font-medium text-white/90">Add to Home Screen</b>
      </Step>
      <Step n={3}>
        Potvrdi sa <b className="font-medium text-white/90">Add</b>, pa otvori ikonu
      </Step>
    </ol>
  )
}

function AndroidSteps({
  canPrompt,
  busy,
  onInstall,
}: {
  canPrompt: boolean
  busy: boolean
  onInstall: () => void
}) {
  // Chrome nudi vlastiti dijalog — jedan dodir umjesto tri koraka.
  if (canPrompt) {
    return (
      <button
        onClick={onInstall}
        disabled={busy}
        className="w-full rounded-full px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-black transition-opacity active:opacity-80 disabled:opacity-60"
        style={{ backgroundColor: BRAND.gold }}
      >
        {busy ? 'Trenutak…' : 'Dodaj na početni ekran'}
      </button>
    )
  }

  return (
    <ol className="mx-auto flex flex-col gap-4 text-left">
      <Step n={1}>
        Dodirni <Glyph kind="dots" /> gore desno u Chromeu
      </Step>
      <Step n={2}>
        Odaberi <b className="font-medium text-white/90">Add to Home screen</b>
      </Step>
      <Step n={3}>
        Potvrdi sa <b className="font-medium text-white/90">Install</b>, pa otvori ikonu
      </Step>
    </ol>
  )
}

function DesktopSteps() {
  return <p className="text-[11px] uppercase tracking-[0.2em] text-white/25">Otvori na telefonu</p>
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3.5 text-[13px] leading-[1.5] text-white/55">
      <span
        className="tabular flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
        style={{ borderColor: `${BRAND.gold}40`, color: `${BRAND.gold}D9` }}
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}

function Glyph({ kind }: { kind: 'share' | 'dots' }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-0.5 inline-block align-[-2px] text-white/90"
      aria-hidden
    >
      {kind === 'share' ? (
        <>
          <path d="M12 3v13M12 3 8 7M12 3l4 4" />
          <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
        </>
      ) : (
        <>
          <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  )
}
