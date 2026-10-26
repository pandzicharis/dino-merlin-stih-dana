'use client'

import { useId } from 'react'
import { motion } from 'motion/react'
import { BRAND } from '@/lib/brand'
import { haptic } from '@/lib/haptic'
import { COLORS } from './deck/PaperToPhone'

/**
 * Džep uz ivicu ekrana — iz njega viri ono što je na drugom ekranu:
 *   `vinyl`  lijevo na stihu dana: pola gramofonske ploče (etiketa je omot
 *            pjesme koja svira); dok svira, ploča se vrti
 *   `paper`  desno na plejeru: listići stiha u bojama, kao u tomboli
 * Izvuci ga prstom (povlačenje prema sredini otvara drugi ekran) ili ga samo
 * dodirni. Pod mišem viri malo više. Rub džepa stoji uz ivicu — izvlači se
 * samo ono što je u njemu. Ispod kapije za instalaciju, uvoda i
 * tombole (z 59–70) — oni ga prekriju.
 */
export function Pocket({
  side,
  label,
  onOpen,
  kind,
  spinning = false,
  cover,
}: {
  side: 'left' | 'right'
  label: string
  onOpen: () => void
  kind: 'vinyl' | 'paper'
  /** ploča se vrti (pjesma svira) */
  spinning?: boolean
  /** omot albuma — etiketa ploče */
  cover?: string
}) {
  const left = side === 'left'
  const open = () => {
    haptic(8)
    onOpen()
  }
  return (
    // ulazak i izlazak — svoj sloj, da se ne bori s povlačenjem i pomakom pod mišem
    <motion.div
      className={`pointer-events-none fixed z-[50] ${left ? 'left-0' : 'right-0'}`}
      style={{ top: 'calc(46% - 44px)', width: 52, height: 88 }}
      initial={{ x: left ? -56 : 56, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: left ? -56 : 56, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
    >
      <motion.button
        type="button"
        aria-label={label}
        title={label}
        data-pocket={side}
        className="pointer-events-auto relative flex h-full w-full items-center"
        style={{ touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent' }}
        // izvuci prstom: dovoljno prema sredini — drugi ekran; inače se mekano vrati u džep
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={left ? { left: 0, right: 0.6 } : { left: 0.6, right: 0 }}
        dragSnapToOrigin
        dragTransition={{ bounceStiffness: 420, bounceDamping: 32 }}
        onDragEnd={(_, i) => (left ? i.offset.x : -i.offset.x) > 34 && open()}
        onTap={open}
        // pod mišem ploča viri malo više — pomak nosi unutrašnji sloj (varijanta), rub džepa stoji
        initial="rest"
        animate="rest"
        whileHover="peek"
      >
        <motion.span
          className="pointer-events-none absolute inset-0"
          variants={{ rest: { x: 0 }, peek: { x: left ? 8 : -8 } }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
          {kind === 'vinyl' ? <Disc left={left} spinning={spinning} cover={cover} /> : <Slip left={left} />}
        </motion.span>
      </motion.button>
      {/* rub džepa — stoji uz ivicu ekrana (ne ide s prstom ni pod mišem); ploča izlazi ispod njega */}
      <span
        className={`pointer-events-none absolute inset-y-0 w-[13px] ${left ? 'left-0 rounded-r-[14px] border-l-0' : 'right-0 rounded-l-[14px] border-r-0'} border border-white/15`}
        style={{
          background: `linear-gradient(${left ? 90 : 270}deg, rgba(10,9,8,0.94), rgba(30,26,22,0.82))`,
          boxShadow: `${left ? 4 : -4}px 0 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)`,
        }}
        aria-hidden
      />
      {/* zlatna nit po rubu */}
      <span className={`pointer-events-none absolute inset-y-3 w-px ${left ? 'left-[12px]' : 'right-[12px]'}`} style={{ background: `linear-gradient(180deg, transparent, ${BRAND.gold}aa, transparent)` }} aria-hidden />
    </motion.div>
  )
}

/** Pola ploče viri iz džepa: brazde, zlatni rub, etiketa (omot) i rupa. */
function Disc({ left, spinning, cover }: { left: boolean; spinning: boolean; cover?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const D = 76
  return (
    <span
      className="pointer-events-none absolute drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]"
      style={{ width: D, height: D, top: (88 - D) / 2, [left ? 'left' : 'right']: -D / 2 + 10 }}
      aria-hidden
    >
      <svg
        width={D}
        height={D}
        viewBox="0 0 52 52"
        className="block"
        style={{ animation: 'vinyl-spin 3.6s linear infinite', animationPlayState: spinning ? 'running' : 'paused' }}
      >
        <defs>
          <radialGradient id={`${uid}d`} cx="50%" cy="50%" r="50%">
            <stop offset="0.3" stopColor="#36312B" />
            <stop offset="0.7" stopColor="#1B1917" />
            <stop offset="1" stopColor="#0B0A09" />
          </radialGradient>
          <linearGradient id={`${uid}l`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F1E2BF" />
            <stop offset="0.45" stopColor={BRAND.gold} />
            <stop offset="1" stopColor="#8A7148" />
          </linearGradient>
          <clipPath id={`${uid}c`}>
            <circle cx="26" cy="26" r="10.5" />
          </clipPath>
        </defs>
        <circle cx="26" cy="26" r="26" fill={`url(#${uid}d)`} />
        <circle cx="26" cy="26" r="25.4" fill="none" stroke={BRAND.gold} strokeOpacity="0.55" strokeWidth="0.9" />
        {[22.5, 20, 17.5, 15].map((r, i) => (
          <circle key={r} cx="26" cy="26" r={r} fill="none" stroke="#fff" strokeOpacity={i % 2 ? 0.05 : 0.1} strokeWidth="0.5" />
        ))}
        {/* odsjaj na brazdama — vrti se s pločom */}
        <path d="M26 3.5A22.5 22.5 0 0 1 45.5 14.75L26 26z" fill="#fff" fillOpacity="0.12" />
        {cover ? (
          <image href={cover} x="15.5" y="15.5" width="21" height="21" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${uid}c)`} />
        ) : (
          <circle cx="26" cy="26" r="10.5" fill={`url(#${uid}l)`} />
        )}
        <circle cx="26" cy="26" r="10.5" fill="none" stroke={BRAND.gold} strokeOpacity="0.7" strokeWidth="0.6" />
        <circle cx="26" cy="26" r="1.6" fill="#0c0a08" />
      </svg>
    </span>
  )
}

/** Listići stiha u bojama (kao u tomboli) vire iz džepa, lepezasto — na prednjem "redovi". */
function Slip({ left }: { left: boolean }) {
  // tri boje s pulta, prednji listić najbliže sredini
  const slips = [COLORS[2 % COLORS.length], COLORS[4 % COLORS.length], COLORS[0]]
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {slips.map((color, i) => {
        const front = i === slips.length - 1
        return (
          <span
            key={i}
            className="absolute rounded-[2px]"
            style={{
              width: 60,
              height: 20,
              top: 22 + i * 11,
              [left ? 'left' : 'right']: -20 + i * 3,
              transform: `rotate(${(left ? 1 : -1) * (12 - i * 9)}deg)`,
              background: `linear-gradient(170deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 55%), ${color}`,
              boxShadow: '0 6px 12px rgba(0,0,0,0.45)',
            }}
          >
            {front && (
              <>
                <span className="absolute left-[8px] right-[24px] top-[6px] h-[1.5px] rounded-full" style={{ background: 'rgba(29,26,22,0.55)' }} />
                <span className="absolute left-[8px] right-[32px] top-[11px] h-[1.5px] rounded-full" style={{ background: 'rgba(29,26,22,0.4)' }} />
              </>
            )}
          </span>
        )
      })}
    </span>
  )
}
