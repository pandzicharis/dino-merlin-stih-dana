'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { MOOD_KEYS, type Mood } from '@/data/moods'
import { OVERRIDE_ON, readDevParams } from './date'

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

  return useMemo(() => {
    const [date, verseId, mood] = snap.split('|')
    return {
      date: date || serverDate,
      verseId: verseId || null,
      mood: mood && (MOOD_KEYS as string[]).includes(mood) ? (mood as Mood) : undefined,
    }
  }, [snap, serverDate])
}

/* ── favoriti ───────────────────────────────────────────────── */

const FAV = 'stihdana:favorites'
const subscribeFav = subscribeTo(['favoriteschange', 'storage'])

function favSnapshot(): string {
  try {
    return localStorage.getItem(FAV) ?? '[]'
  } catch {
    return '[]'
  }
}

export function useFavorites(): string[] {
  const snap = useSyncExternalStore(subscribeFav, favSnapshot, () => '[]')
  return useMemo(() => {
    try {
      const v = JSON.parse(snap)
      return Array.isArray(v) ? (v as string[]) : []
    } catch {
      return []
    }
  }, [snap])
}

export function useIsFavorite(id: string): boolean {
  return useFavorites().includes(id)
}

/** Je li klijent već hidratiran (za stvari koje ne smiju renderati na serveru). */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}
