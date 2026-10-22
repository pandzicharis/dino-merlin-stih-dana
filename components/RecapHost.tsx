'use client'

import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import type { Verse } from '@/data/verses'
import { BRAND } from '@/lib/brand'
import { whenCalm } from '@/lib/calm'
import { addDays, getActiveDate, monthBs, shownDay } from '@/lib/date'
import { haptic } from '@/lib/haptic'
import { dismissToast, toast } from './Toast'

/*
 * Mjesečni pregled ("Tvoj oktobar") — otvara se:
 *   · sam se ponudi jednom, prvih 7 dana novog mjeseca (poruka "Pogledaj"),
 *     kad stih sleti — pregled prošlog mjeseca
 *   · iz postavki ("Tvoj …") i dugmetom "Moj mjesec" u zaglavlju početne —
 *     do 7. prošli mjesec, poslije tekući
 * Kod pregleda se učita tek kad se otvori.
 */

const MonthRecap = lazy(() => import('./MonthRecap'))

const EVENT = 'stihdana:pregled'
/** mjesec čiji je pregled već ponuđen ("2026-10") */
const OFFERED = 'stihdana:pregled-ponuden'

/** Koji mjesec pregled pokazuje na dan `today`: prvih 7 dana prošli, poslije tekući. */
export function recapDate(today: string): string {
  return Number(today.slice(8, 10)) <= 7 ? addDays(`${today.slice(0, 7)}-01`, -1) : today
}

/** Otvori pregled mjeseca u kojem je `date`. */
export function openRecap(date: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: date }))
}

/** Je li u mjesecu `ym` bio bar jedan stih na ovom telefonu. */
function hadDays(ym: string): boolean {
  try {
    const days = JSON.parse(localStorage.getItem('stihdana:draw') ?? '{}')?.days ?? {}
    return Object.keys(days).some((d) => d.startsWith(ym))
  } catch {
    return false
  }
}

export function CalendarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <circle cx="12" cy="15" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** "Moj mjesec" — dugme u zaglavlju početne, desno od plejera. */
export function MonthButton() {
  return (
    <button
      onClick={() => {
        haptic(8)
        openRecap(recapDate(shownDay(getActiveDate())))
      }}
      aria-label="Moj mjesec"
      title="Moj mjesec"
      className="hdr-btn w-[34px]"
    >
      <CalendarIcon size={16} />
    </button>
  )
}

export function RecapHost({ verses, date }: { verses: Verse[]; date: string }) {
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    const on = (e: Event) => setOpen((e as CustomEvent<string>).detail)
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])

  // novi mjesec — jednom ponudi pregled prošlog, kad stih sleti i ništa nije otvoreno
  useEffect(() => {
    if (Number(date.slice(8, 10)) > 7) return
    const prev = addDays(`${date.slice(0, 7)}-01`, -1)
    const ym = prev.slice(0, 7)
    try {
      if (localStorage.getItem(OFFERED) === ym) return
    } catch {
      return
    }
    if (!hadDays(ym)) return
    return whenCalm(
      () => {
        try {
          localStorage.setItem(OFFERED, ym)
        } catch {
          /* ignore */
        }
        toast(
          {
            id: 'recap',
            title: `Tvoj ${monthBs(prev)}`,
            sub: 'Mjesec u brojevima',
            color: BRAND.gold,
            icon: <CalendarIcon />,
            action: {
              label: 'Pogledaj',
              onClick: () => {
                dismissToast('recap')
                openRecap(prev)
              },
            },
          },
          9000,
        )
      },
      2500,
      () => !document.querySelector('[role="dialog"][aria-modal="true"]'),
    )
  }, [date])

  return (
    <Suspense fallback={null}>
      <AnimatePresence>{open && <MonthRecap key={open} verses={verses} date={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </Suspense>
  )
}
