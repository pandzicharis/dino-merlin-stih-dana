import type { ReactNode } from 'react'
import type { Mood } from '@/data/moods'
import type { Verse } from '@/data/verses'
import type { DeviceKind } from './Devices'
import type { PosterData } from './Poster'
import type { Script } from './PhoneScript'

export type DeckData = {
  url: string
  host: string
  today: string
  todayVerse: Verse
  /** stihova u rasporedu */
  count: number
  /** stihovi u rasporedu — za papiriće na slajdu "Zašto Stih dana?" */
  verses: Verse[]
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
  enter?: string | ((d: DeckData, frame: DeviceKind) => string)
  frame?: DeviceKind
  /** režirana scena na telefonu — igra se za iPhone, pa sama za Android */
  script?: Script
  body: (d: DeckData) => ReactNode
}

export type SlideDef = {
  /** ide u adresu (#atmosfera), pa link na slajd preživi preslagivanje */
  id: string
  section: Section
  /** naslov u pregledu svih slajdova */
  title: string
  /** živi uređaj desno od teksta */
  mode?: 'phone' | 'desktop' | 'site'
  /** adresa na koju se uređaj postavi kad se uđe na slajd */
  enter?: string | ((d: DeckData, frame: DeviceKind) => string)
  /** okvir telefona na ovom slajdu */
  frame?: DeviceKind
  /** živa atmosfera aplikacije preko cijelog slajda */
  backdrop?: Mood
  /** funkcionalnosti koje se otvaraju jedna po jedna (strelica naprijed) */
  features?: FeatureDef[]
  /** stih koji telefon prikaže kroz /pregled (kad nije u katalogu) */
  preview?: Verse
  /** slajd sa koracima ipak centriran po visini (ne raste dok se otvara) */
  center?: boolean
  /** prvo zaustavljanje je sam slajd (koraci zatvoreni) — prvi korak kreće tek na strelicu */
  intro?: boolean
  body: (d: DeckData) => ReactNode
}

export type Simulation = 'notify' | 'welcome' | 'update' | 'lock' | 'chat'

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
  /** iPhone ili Android u režiranoj sceni (instalacija, dozvola) */
  os: 'ios' | 'android'
  setOs: (os: 'ios' | 'android') => void
  /** režirane scene (instalacija, dozvola): same ili klikom prezentera */
  manual: boolean
  /** iframe telefona — za korake koji nešto pritisnu u aplikaciji */
  phone: () => HTMLIFrameElement | null
  /** iframe računara (admin) */
  desk: () => HTMLIFrameElement | null
  /** krug dodira na telefonu, u pikselima aplikacije (kao getBoundingClientRect u njoj) */
  tapAt: (x: number, y: number) => void
  setManual: (manual: boolean) => void
}
