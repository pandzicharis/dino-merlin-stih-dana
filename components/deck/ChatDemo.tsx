'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { oneLine, withPeriod } from '@/lib/text'
import { AndroidStatus, Island, IosStatus, PunchHole } from './Devices'
import { ROBOTO, SF, Tap } from './phoneUi'

/**
 * WhatsApp (dark) na telefonu: "Hej, znaš šta je Magaza izbacila? 😍" →
 * "Šta? 👀" → zalijepi se link (iskoči pregled), pošalje se — i u chatu
 * stoji kartica sa slikom stiha. Leila pročita i odgovori.
 * iOS i Android imaju svoje zaglavlje i polje za kucanje, kao u originalu.
 * Dodir na karticu otvara stih (stranica ispod je baš ta adresa).
 *
 * Sve je u `em`: 1em = 1 piksel ekrana telefona.
 */

const C = {
  bg: '#0B141A',
  bar: '#1F2C34',
  out: '#005C4B',
  in: '#202C33',
  text: '#E9EDEF',
  sub: '#8696A0',
  link: '#53BDEB',
  green: '#21C063',
  iosBar: 'rgba(22,22,24,0.94)',
  iosBlue: '#0A84FF',
}

/** razgovor: pitanje → "Šta?" → link → oduševljenje */
type Line = { me: boolean; text?: string; link?: true; time: string }
const SCRIPT: Line[] = [
  { me: true, text: 'Hej, znaš šta je Magaza izbacila? 😍', time: '12:01' },
  { me: false, text: 'Šta? 👀', time: '12:01' },
  { me: true, link: true, time: '12:02' },
  { me: false, text: 'Joj, kako je lijepo 😍 Instaliram odmah!', time: '12:02' },
]

// pozadina chata — WhatsAppove sitne šare, jedva vidljive
const DOODLE = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" fill="none" stroke="#fff" stroke-opacity=".045" stroke-width="1.4" stroke-linecap="round"><circle cx="20" cy="22" r="7"/><path d="M60 14l6 10h-12z"/><path d="M96 20c4-6 12-6 14 0s-6 10-14 14c-8-4-16-8-14-14s10-6 14 0z"/><path d="M14 70h16M22 62v16"/><rect x="52" y="60" width="18" height="14" rx="3"/><path d="M92 66l8 8M100 66l-8 8"/><circle cx="30" cy="104" r="4"/><path d="M62 98q8-8 16 0t16 0"/><path d="M104 96v14l6-4"/></svg>',
)}")`

export function ChatDemo({
  ios,
  verse,
  host,
  w,
  h,
  onOpen,
}: {
  ios: boolean
  verse: Verse
  host: string
  w: number
  h: number
  onOpen: () => void
}) {
  const url = `${host}/stih/${verse.id}`
  const [shown, setShown] = useState(0)
  const [draft, setDraft] = useState('')
  const [pasted, setPasted] = useState(false)
  const [tapSend, setTapSend] = useState(false)
  const [read, setRead] = useState(0)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    const ts: number[] = []
    let t = 0
    const at = (ms: number, fn: () => void) => {
      t += ms
      ts.push(window.setTimeout(fn, t))
    }
    const send = (n: number) => {
      at(700, () => setTapSend(true))
      at(250, () => {
        setTapSend(false)
        setDraft('')
        setPasted(false)
        setShown(n)
      })
      at(800, () => setRead(n))
    }
    const answer = (n: number, think: number) => {
      at(500, () => setTyping(true))
      at(think, () => {
        setTyping(false)
        setShown(n)
      })
    }

    // 1. pitanje se ukuca slovo po slovo
    const q = Array.from(SCRIPT[0].text!)
    at(400, () => {})
    q.forEach((_, i) => at(42, () => setDraft(q.slice(0, i + 1).join(''))))
    send(1)
    // 2. "Šta?"
    answer(2, 1300)
    // 3. link se zalijepi — iskoči pregled, pa se pošalje
    at(900, () => {
      setDraft(`https://${url}`)
      setPasted(true)
    })
    at(600, () => {})
    send(3)
    // 4. oduševljenje
    answer(4, 1700)
    return () => ts.forEach(clearTimeout)
  }, [url])

  const top = ios ? 54 : 34
  const head = ios ? 52 : 60
  const foot = ios ? 50 + 34 : 64 + 16
  const text = oneLine(withPeriod(verse.text))

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: C.bg, backgroundImage: DOODLE, backgroundSize: '120em 120em', color: C.text, fontFamily: ios ? SF : ROBOTO }}
    >
      {/* zaglavlje */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${top + head}em`,
          background: ios ? C.iosBar : C.bar,
          backdropFilter: ios ? 'blur(20px)' : undefined,
          borderBottom: ios ? '0.5em solid rgba(255,255,255,0.08)' : undefined,
          display: 'flex',
          alignItems: 'center',
          gap: ios ? '8em' : '6em',
          padding: ios ? `${top}em 14em 0 8em` : `${top}em 8em 0 6em`,
          zIndex: 2,
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke={ios ? C.iosBlue : C.text} strokeWidth={ios ? 2.6 : 2} strokeLinecap="round" strokeLinejoin="round" style={{ width: ios ? '26em' : '24em', height: ios ? '26em' : '24em', flexShrink: 0 }}>
          {ios ? <path d="m15 5-7 7 7 7" /> : <path d="M19 12H5m6-6-6 6 6 6" />}
        </svg>
        {ios && <span style={{ fontSize: '17em', color: C.iosBlue, marginLeft: '-0.35em', marginRight: '0.1em' }}>3</span>}
        <span
          style={{
            width: ios ? '36em' : '40em',
            height: ios ? '36em' : '40em',
            borderRadius: '50%',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #C98B6B, #7A4E8C)',
          }}
        >
          <span style={{ fontSize: ios ? '15em' : '16em', fontWeight: 600, color: '#fff' }}>L</span>
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: ios ? '16.5em' : '17.5em', fontWeight: ios ? 600 : 500 }}>Leila ❤️</span>
          <span style={{ fontSize: '12.5em', color: typing ? (ios ? C.green : C.text) : C.sub }}>
            {typing ? 'piše…' : 'na mreži'}
          </span>
        </span>
        {/* video i poziv (+ meni na Androidu) */}
        <span style={{ display: 'flex', alignItems: 'center', gap: ios ? '22em' : '20em', color: ios ? C.iosBlue : C.text }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" style={{ width: '25em', height: '25em' }}>
            <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
            <path d="m15.5 10.5 6-3.5v10l-6-3.5z" />
          </svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" style={{ width: '22em', height: '22em' }}>
            <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
          </svg>
          {!ios && (
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '22em', height: '22em', marginLeft: '-6em' }}>
              <circle cx="12" cy="5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="19" r="1.8" />
            </svg>
          )}
        </span>
      </div>

      {/* poruke — slažu se odozdo, kao u pravom chatu */}
      <div
        style={{
          position: 'absolute',
          top: `${top + head}em`,
          bottom: `${foot}em`,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          gap: '6em',
          padding: '10em 14em 14em',
        }}
      >
        <AnimatePresence initial={false}>
          {SCRIPT.slice(0, shown).map((line, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: '24em', scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              style={{
                alignSelf: line.me ? 'flex-end' : 'flex-start',
                ...(line.link ? { width: '86%' } : { maxWidth: '80%' }),
                transformOrigin: line.me ? 'bottom right' : 'bottom left',
              }}
            >
              {line.link ? (
                <div
                  role="button"
                  onClick={onOpen}
                  style={{
                    position: 'relative',
                    background: C.out,
                    borderRadius: '8em',
                    borderTopRightRadius: 0,
                    padding: '4em',
                    cursor: 'pointer',
                    boxShadow: '0 1em 1em rgba(0,0,0,0.15)',
                  }}
                >
                  <Tail side="out" />
                  {/* pregled linka — slika stiha preko cijele širine */}
                  <div style={{ borderRadius: '6em', overflow: 'hidden', background: '#025144' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/og/${verse.id}/post`} alt="" style={{ display: 'block', width: '100%', aspectRatio: '1 / 1', objectFit: 'cover' }} />
                    <div style={{ padding: '8em 10em 9em' }}>
                      <p style={{ fontSize: '14.5em', fontWeight: 600, lineHeight: 1.25 }}>{verse.song}</p>
                      <p
                        style={{
                          marginTop: '0.15em',
                          fontSize: '13em',
                          lineHeight: 1.3,
                          color: 'rgba(233,237,239,0.72)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {text}
                      </p>
                      <p style={{ marginTop: '0.3em', fontSize: '12em', color: 'rgba(233,237,239,0.5)' }}>{host}</p>
                    </div>
                  </div>
                  {/* razmak je na omotaču — `em` unutar teksta od 15em bi bio 15× veći */}
                  <div style={{ padding: '6em 6em 5em', display: 'flow-root' }}>
                    <span
                      style={{
                        fontSize: '15em',
                        lineHeight: 1.35,
                        overflowWrap: 'anywhere',
                        color: C.link,
                        textDecoration: 'underline',
                        textUnderlineOffset: '0.15em',
                      }}
                    >
                      https://{url}
                    </span>
                    <Meta time={line.time} read={read >= i + 1} />
                  </div>
                </div>
              ) : (
                <Bubble side={line.me ? 'out' : 'in'} time={line.time} read={read >= i + 1}>
                  {line.text}
                </Bubble>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* pregled linka iznad polja, dok se piše */}
      <AnimatePresence>
        {pasted && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: '12em' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'absolute',
              left: ios ? '8em' : '6em',
              right: ios ? '8em' : '6em',
              bottom: `${foot + 2}em`,
              display: 'flex',
              gap: '10em',
              alignItems: 'center',
              padding: '6em',
              borderRadius: '10em',
              background: C.bar,
              boxShadow: '0 -4em 16em rgba(0,0,0,0.25)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/og/${verse.id}/post`} alt="" style={{ width: '56em', height: '56em', borderRadius: '6em', objectFit: 'cover' }} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: '14em', fontWeight: 600 }}>{verse.song}</span>
              <span
                style={{
                  display: 'block',
                  fontSize: '12.5em',
                  color: C.sub,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {host}
              </span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* polje za kucanje */}
      {ios ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${foot}em`,
            padding: '7em 10em 0',
            background: C.iosBar,
            borderTop: '0.5em solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10em',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke={C.iosBlue} strokeWidth="2" strokeLinecap="round" style={{ width: '26em', height: '26em', marginTop: '5em', flexShrink: 0 }}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <Field draft={draft} ios />
          {draft ? (
            <SendButton ios tapping={tapSend} />
          ) : (
            <span style={{ display: 'flex', gap: '18em', marginTop: '6em', color: C.iosBlue }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" style={{ width: '24em', height: '24em' }}>
                <path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
              </svg>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: '24em', height: '24em' }}>
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            </span>
          )}
          <span style={{ position: 'absolute', bottom: '8em', left: '50%', width: '138em', height: '5em', marginLeft: '-69em', borderRadius: '3em', background: '#fff' }} />
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${foot}em`,
            padding: '6em 6em 0',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6em',
          }}
        >
          <Field draft={draft} ios={false} />
          <SendButton ios={false} tapping={tapSend} empty={!draft} />
        </div>
      )}

      {ios ? <IosStatus time="12:01" /> : <AndroidStatus time="12:01" />}
      {ios ? <Island /> : <PunchHole />}
      {tapSend && <Tap platform={ios ? 'ios' : 'android'} x={w - (ios ? 28 : 31)} y={h - foot + (ios ? 23 : 26)} />}
    </div>
  )
}

function Field({ draft, ios }: { draft: string; ios: boolean }) {
  return (
    <span
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: ios ? '36em' : '48em',
        display: 'flex',
        alignItems: 'center',
        gap: '10em',
        padding: ios ? '7em 12em' : '0 14em',
        borderRadius: ios ? '18em' : '24em',
        background: ios ? '#2C2C2E' : C.bar,
        border: ios ? '0.5em solid rgba(255,255,255,0.1)' : undefined,
      }}
    >
      {!ios && (
        <svg viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="1.8" strokeLinecap="round" style={{ width: '24em', height: '24em', flexShrink: 0 }}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 10h.01M15 10h.01" />
        </svg>
      )}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: ios ? '16em' : '17em',
          lineHeight: 1.3,
          color: draft ? C.text : C.sub,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          wordBreak: 'break-all',
        }}
      >
        {draft || 'Poruka'}
        {draft && <span style={{ display: 'inline-block', width: '0.08em', height: '1em', marginLeft: '0.05em', verticalAlign: '-0.12em', background: ios ? C.iosBlue : C.green }} />}
      </span>
      {!ios && !draft && (
        <span style={{ display: 'flex', gap: '18em', color: C.sub }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: '22em', height: '22em', transform: 'rotate(-45deg)' }}>
            <path d="M16.5 6.5 8 15a2.5 2.5 0 0 0 3.5 3.5l8.5-8.5a4.5 4.5 0 0 0-6.4-6.4L5 12.2a6.5 6.5 0 0 0 9.2 9.2" />
          </svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" style={{ width: '22em', height: '22em' }}>
            <path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
          </svg>
        </span>
      )}
    </span>
  )
}

function SendButton({ ios, tapping, empty }: { ios: boolean; tapping: boolean; empty?: boolean }) {
  const size = ios ? 34 : 48
  return (
    <motion.span
      animate={{ scale: tapping ? 0.88 : 1 }}
      style={{
        width: `${size}em`,
        height: `${size}em`,
        marginTop: ios ? '1em' : 0,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: C.green,
      }}
    >
      {empty ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="#0B141A" strokeWidth="2" strokeLinecap="round" style={{ width: '24em', height: '24em' }}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      ) : ios ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="#0B141A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18em', height: '18em' }}>
          <path d="M12 19V5M6 11l6-6 6 6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="#0B141A" style={{ width: '22em', height: '22em', marginLeft: '3em' }}>
          <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
        </svg>
      )}
    </motion.span>
  )
}

function Bubble({
  side,
  time,
  read = false,
  children,
}: {
  side: 'in' | 'out'
  time: string
  read?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'relative',
        alignSelf: side === 'in' ? 'flex-start' : 'flex-end',
        maxWidth: '100%',
        background: side === 'in' ? C.in : C.out,
        borderRadius: '8em',
        ...(side === 'in' ? { borderTopLeftRadius: 0 } : { borderTopRightRadius: 0 }),
        padding: '6em 9em 7em',
        boxShadow: '0 1em 1em rgba(0,0,0,0.15)',
        display: 'flow-root',
      }}
    >
      <Tail side={side} />
      <span style={{ fontSize: '15em', lineHeight: 1.35 }}>{children}</span>
      <Meta time={time} read={read} hideTicks={side === 'in'} />
    </div>
  )
}

/**
 * Vrijeme i kvačice dole desno u balonu. Plutaju iza zadnje riječi: stanu li
 * u isti red, ostanu u njemu, a ako ne — spuste se u novi (kao u WhatsAppu).
 */
function Meta({ time, read, hideTicks }: { time: string; read: boolean; hideTicks?: boolean }) {
  return (
    <span
      style={{
        float: 'right',
        position: 'relative',
        top: '5em',
        display: 'flex',
        alignItems: 'center',
        gap: '3em',
        marginLeft: '10em',
        marginTop: '2em',
        height: '14em',
      }}
    >
      <span style={{ fontSize: '11em', color: 'rgba(233,237,239,0.6)' }}>{time}</span>
      {!hideTicks && (
        <svg viewBox="0 0 18 12" fill="none" stroke={read ? C.link : 'rgba(233,237,239,0.6)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16em', height: '11em', transition: 'stroke 0.4s' }}>
          <path d="m1 6.5 3.5 3.5L11 2.5M7.5 10 14 2.5" />
        </svg>
      )}
    </span>
  )
}

/** mali rep balona u gornjem uglu */
function Tail({ side }: { side: 'in' | 'out' }) {
  return (
    <svg
      viewBox="0 0 8 13"
      style={{
        position: 'absolute',
        top: 0,
        width: '8em',
        height: '13em',
        ...(side === 'in' ? { left: '-7em' } : { right: '-7em', transform: 'scaleX(-1)' }),
      }}
    >
      <path d="M8 0H1.5C.4 0-.3 1.2.4 2.1L8 13z" fill={side === 'in' ? C.in : C.out} />
    </svg>
  )
}
