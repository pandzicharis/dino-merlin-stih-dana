'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
import { haptic } from '@/lib/haptic'
import type { QrMatrix } from '@/lib/qr'
import { bumpMonth } from '@/lib/storage'
import { albumLine, paperText } from '@/lib/text'
import { QrCode } from './deck/QrCode'
import { giftUrl } from './GiftArrival'
import { Icon, TOAST_OK, toast } from './Toast'

/*
 * Link i QR kod stiha (poklon — components/GiftArrival.tsx), jedan izgled
 * svuda: „Link i QR“ u dijeljenju, ladica s QR kodom na početnoj i QR u
 * plejeru. Ko ga otvori (ili skenira), stih mu doleti u ladici samo s njim.
 */

/** Link poklona, QR kod (biblioteka tek kad je `on`) i radnje: pošalji, kopiraj. */
export function useGiftLink(verse: Verse, on: boolean) {
  const url = giftUrl(verse.id)
  const [made, setMade] = useState<{ url: string; qr: QrMatrix } | null>(null)
  const qr = made?.url === url ? made.qr : null

  useEffect(() => {
    if (!on || qr) return
    let alive = true
    import('@/lib/qr').then((lib) => alive && setMade({ url, qr: lib.qrMatrix(url) }))
    return () => {
      alive = false
    }
  }, [on, url, qr])

  const copy = async () => {
    haptic(6)
    try {
      await navigator.clipboard.writeText(url)
      toast({ id: 'share', title: 'Link kopiran', color: TOAST_OK, icon: <Icon.ok /> })
    } catch {}
  }

  const send = async () => {
    haptic(8)
    if (!navigator.share) return copy()
    try {
      await navigator.share({ url, title: `${verse.song} — Dino Merlin` })
      bumpMonth('shared')
    } catch {}
  }

  return { url, qr, copy, send }
}

/**
 * QR kartica — na papiru, da je čitaju i stariji telefoni: kod, pa stih kao
 * na papiriću (malim slovima, prvo veliko i imena), pjesma i album.
 * `qrClass`: veličina koda (kvadrat).
 */
export function GiftCard({
  verse,
  qr,
  className = '',
  qrClass = 'h-[min(25dvh,240px)]',
}: {
  verse: Verse
  qr: QrMatrix | null
  className?: string
  qrClass?: string
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-[22px] px-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] ${className}`}
      style={{ background: '#F6F1E7' }}
    >
      <div className={`aspect-square ${qrClass}`}>{qr && <QrCode qr={qr} className="h-full w-full" title={`QR kod — ${verse.song}`} />}</div>
      <p className="mt-2 max-w-full truncate text-[15px] text-[#1a1614]" style={{ fontFamily: 'var(--font-serif), serif' }}>
        {paperText(verse.text)}
      </p>
      <p className="mt-1.5 max-w-full truncate text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: '#8C7449' }}>
        {verse.song}
      </p>
      <p className="mt-1 max-w-full truncate text-[9.5px] font-medium uppercase tracking-[0.2em]" style={{ color: '#8C7449b8' }}>
        {albumLine(verse)}
      </p>
    </div>
  )
}

/**
 * Ista kartica, položena — u plejeru stane na mjesto videa (iste mjere kao
 * video, ladica ne skače): kod lijevo, desno gore stih, pjesma i album, a
 * dole desno `onBack` — nazad na pjesmu.
 */
export function GiftCardWide({ verse, qr, onBack }: { verse: Verse; qr: QrMatrix | null; onBack?: () => void }) {
  return (
    <div className="flex aspect-video min-h-[200px] w-full items-stretch gap-4 rounded-[18px] p-4" style={{ background: '#F6F1E7' }}>
      <div className="aspect-square h-full shrink-0 self-center">{qr && <QrCode qr={qr} className="h-full w-full" title={`QR kod — ${verse.song}`} />}</div>
      {/* tekst u ravni s vrhom koda (kod ima svoju tihu zonu) */}
      <div className="flex min-w-0 flex-1 flex-col pt-1.5">
        <p className="line-clamp-3 text-[15px] leading-snug text-[#1a1614]" style={{ fontFamily: 'var(--font-serif), serif' }}>
          {paperText(verse.text)}
        </p>
        <p className="mt-2.5 truncate text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: '#8C7449' }}>
          {verse.song}
        </p>
        {/* uska kolona: album pa godina, svako u svom redu (ne lomi se na tački) */}
        <p className="mt-1 text-[9.5px] font-medium uppercase leading-relaxed tracking-[0.2em]" style={{ color: '#8C7449b8' }}>
          {albumLine({ album: verse.album, description: verse.description })}
          {verse.year ? <span className="block">{verse.year}</span> : null}
        </p>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Nazad na pjesmu"
            className="mt-auto flex h-8 shrink-0 items-center gap-1.5 self-end rounded-full border border-[#1a1614]/15 bg-[#1a1614]/[0.05] pl-2.5 pr-3 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-[#1a1614]/80 transition-[background-color,transform] duration-150 hover:bg-[#1a1614]/10 active:scale-95"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m15 18-6-6 6-6" />
            </svg>
            Pjesma
          </button>
        )}
      </div>
    </div>
  )
}

/** Adresa, „Pošalji link“ i „Kopiraj link“ — kao „Link i QR“ u dijeljenju. */
export function GiftLinkActions({ url, send, copy }: { url: string; send: () => void; copy: () => void }) {
  return (
    <>
      <p className="mt-4 flex h-[46px] items-center justify-center truncate rounded-full border border-white/[0.08] bg-white/[0.03] px-4 text-[12px] text-white/55">
        {url.replace(/^https?:\/\//, '')}
      </p>
      <motion.button
        type="button"
        onClick={send}
        whileTap={{ scale: 0.98 }}
        className="mt-5 flex h-12 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold tracking-wide text-black"
        style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
      >
        <ShareIcon />
        Pošalji link
      </motion.button>
      <button
        type="button"
        onClick={copy}
        className="mt-2 flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 text-[14px] text-white/80 transition-colors hover:bg-white/5"
      >
        <CopyIcon />
        Kopiraj link
      </button>
    </>
  )
}

export function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v13M12 3 8 7M12 3l4 4" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}

export function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
    </svg>
  )
}
