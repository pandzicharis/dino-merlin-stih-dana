'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { MOOD_KEYS, type Mood } from '@/data/moods'
import { OVERRIDE_ON, msUntilNextDay, readDevParams, todayInTz } from './date'

/**
 * URL i localStorage su vanjski store-ovi — čitaju se kroz useSyncExternalStore,
 * ne kroz useEffect + setState. Snapshot je uvijek string da referenca ostane
 * stabilna između rendera.
 */

function subscribeTo(events: string[]) {
  return (cb: () => void) => {
    events.forEach((e) => window.addEventListener(e, cb))
    return () => events.forEach((e) => window.removeEventListener(e, cb))
  }
}

/* ── današnji datum ─────────────────────────────────────────── */

/**
 * "Danas" je vanjski store, ne vrijednost sa servera.
 *
 * Stranica je ISR i servira se s CDN-a, pa poslije ponoći HTML zna do sat
 * vremena nositi jučerašnji datum. Uz to aplikacija s početnog ekrana stoji
 * otvorena danima — bez ovoga bi joj stih ostao zamrznut na danu kad je
 * zadnji put učitana.
 *
 * Server i dalje daje prvi datum, pa hidratacija ne treperi; klijent ga
 * ispravi tek kad stvarno treba.
 */
function subscribeToday(cb: () => void) {
  let timer: ReturnType<typeof setTimeout>

  // Jedan tajmer do ponoći umjesto stalnog provjeravanja. Kad je aplikacija
  // u pozadini, tajmere zna prispavati sistem — zato uz njega idu i buđenja.
  const schedule = () => {
    timer = setTimeout(
      () => {
        cb()
        schedule()
      },
      Math.min(msUntilNextDay() + 1000, 2 ** 31 - 1),
    )
  }
  schedule()

  window.addEventListener('focus', cb)
  document.addEventListener('visibilitychange', cb)
  return () => {
    clearTimeout(timer)
    window.removeEventListener('focus', cb)
    document.removeEventListener('visibilitychange', cb)
  }
}

/** Datum koji aplikacija smatra današnjim. Prati stvarnu ponoć u Sarajevu. */
export function useToday(serverDate: string): string {
  return useSyncExternalStore(subscribeToday, todayInTz, () => serverDate)
}

/* ── dev override (datum / stih / mood) ─────────────────────── */

const subscribeDev = subscribeTo(['devdatechange', 'popstate'])

function devSnapshot(): string {
  if (!OVERRIDE_ON) return ''
  const p = readDevParams()
  return `${p.date ?? ''}|${p.verseId ?? ''}|${p.mood ?? ''}`
}

export function useDevParams(serverDate: string): {
  date: string
  verseId: string | null
  mood: Mood | undefined
} {
  const snap = useSyncExternalStore(subscribeDev, devSnapshot, () => '')
  const today = useToday(serverDate)

  return useMemo(() => {
    const [date, verseId, mood] = snap.split('|')
    return {
      // U produkciji je `date` uvijek prazan i ostaje stvarni današnji datum.
      date: date || today,
      verseId: verseId || null,
      mood: mood && (MOOD_KEYS as string[]).includes(mood) ? (mood as Mood) : undefined,
    }
  }, [snap, today])
}

/* ── obavijesti ─────────────────────────────────────────────── */

const NOTIFY = 'stihdana:notify'
const subscribeNotify = subscribeTo(['notifychange', 'storage'])

function notifySnapshot(): string {
  try {
    return localStorage.getItem(NOTIFY) ?? 'true'
  } catch {
    return 'true'
  }
}

/** Korisnikov prekidač za obavijesti. Sinhrono — zvono se ne smije čekati. */
export function useNotifyIntent(): boolean {
  return useSyncExternalStore(subscribeNotify, notifySnapshot, () => 'true') === 'true'
}

/** Je li klijent već hidratiran (za stvari koje ne smiju renderati na serveru). */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}
