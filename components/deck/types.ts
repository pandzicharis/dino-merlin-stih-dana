import type { ReactNode } from 'react'
import type { Mood } from '@/data/moods'
import type { Verse } from '@/data/verses'
import type { DeviceKind } from './Devices'
import type { PosterData } from './Poster'

export type DeckData = {
  url: string
  host: string
  today: string
  todayVerse: Verse
  /** stihova u rasporedu */
  count: number
  /** po jedan stih za svako raspoloženje — za birač na slajdu */
  moods: { mood: Mood; verse: Verse }[]
  poster: PosterData
}

export type Section = 'Uvod' | 'Ideja' | 'Aplikacija' | 'Plan za launch' | 'Pitanja'

/**
 * Jedna funkcionalnost unutar slajda. Slajd ih nabraja kao listu, a
 * strelica naprijed otvara sljedeću — i vodi uređaj tamo gdje se ona vidi.
 */
export type FeatureDef = {
  id: string
  title: string
  enter?: string | ((d: DeckData) => string)
  frame?: DeviceKind
  body: (d: DeckData) => ReactNode
}

export type SlideDef = {
  /** ide u adresu (#atmosfera), pa link na slajd preživi preslagivanje */
  id: string
  section: Section
  /** naslov u pregledu svih slajdova */
  title: string
  /** živi uređaj desno od teksta */
  mode?: 'phone' | 'desktop'
  /** adresa na koju se uređaj postavi kad se uđe na slajd */
  enter?: string | ((d: DeckData) => string)
  /** okvir telefona na ovom slajdu */
  frame?: DeviceKind
  /** živa atmosfera aplikacije preko cijelog slajda */
  backdrop?: Mood
  /** funkcionalnosti koje se otvaraju jedna po jedna (strelica naprijed) */
  features?: FeatureDef[]
  body: (d: DeckData) => ReactNode
}

export type Simulation = 'notify' | 'update'

export type DeckApi = {
  data: DeckData
  /** redni broj slajda */
  index: number
  /** otvorena funkcionalnost na slajdu */
  step: number
  setStep: (k: number) => void
  /** trenutna adresa u telefonu (putanja + upit) */
  phoneSrc: string
  frame: DeviceKind
  openPhone: (src: string, frame?: DeviceKind) => void
  reloadPhone: () => void
  openDesktop: (src: string) => void
  simulate: (kind: Simulation) => void
}
