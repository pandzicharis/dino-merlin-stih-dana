'use client'

import { createContext, useContext } from 'react'
import type { DeckApi } from './types'

export const DeckContext = createContext<DeckApi | null>(null)

/** Slajd upravlja živim uređajem kroz ovo — ne dira iframe direktno. */
export function useDeck(): DeckApi {
  const api = useContext(DeckContext)
  if (!api) throw new Error('useDeck van <Deck>')
  return api
}
