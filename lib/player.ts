'use client'

/**
 * Zvuk pjesama — jedan plejer za sve: gramofon ispod stiha, karte sačuvanih
 * i plejer sačuvanih u panelu.
 *
 * Sačuvani dijele zvuk po pjesmi (mala i raširena karta su isti plejer), pa
 * pjesma ne staje kad se karta skupi ili prevuče. Sviraju redom kao lista:
 * kad jedna završi, krene sljedeća sačuvana (karte klize za njom); natrag i
 * naprijed rade i sa zaključanog ekrana. Zatvaranjem sačuvanih sve se utiša.
 */

import { useSyncExternalStore } from 'react'
import type { Verse } from '@/data/verses'
import AUDIO from '@/data/audio.json'
import { albumOf } from '@/data/albums'
import { audioFile } from './audio-name'
import { BRAND } from './brand'
import { youtubeId } from './text'
import { cancelFade, dropNeedle, fadeOut, isRouted, stopCrackle, unlockVinyl } from './vinyl'

/** Svira jedna pjesma u isto vrijeme: kad krene nova, ostale stanu. */
export const SOLO = 'stihdana:solo'
/** Nastao je (ili zamijenjen) zajednički zvuk pjesme — karte iste pjesme ga prate. */
export const SHARED = 'stihdana:shared-audio'
/** Plejer sačuvanih prešao na stih (`detail`: id) — špil klizi do njega. */
export const SAVED_TRACK = 'stihdana:saved-track'
/** pilula na početnoj (ili bilo ko) traži da se sačuvani ponovo otvore */
export const OPEN_SAVED = 'stihdana:open-saved'

/** trajanja pjesama iz public/audio — lib/audio-files.ts (admin, `npm run audio`) */
const DURATIONS: Record<string, number> = AUDIO

export const sourceOf = (verse: Verse, id: string) => ({
  src: `/audio/${audioFile(verse.song)}.m4a`,
  fallback: `/api/audio/${id}?s=${audioFile(verse.song)}`,
  dur: DURATIONS[audioFile(verse.song)],
})

/** Trajanje pjesme iz public/audio (prije nego se učita), ili 0. */
export const knownDuration = (verse: Verse) => DURATIONS[audioFile(verse.song)] ?? 0

/**
 * Ima li pjesma zvuk. Na produkciji samo ako je fajl u public/audio — inače
 * odmah YouTube znak, bez zahtjeva prema /api/audio koji na Vercelu ionako
 * pada (nema yt-dlp-a). Lokalno server zvuk izvuče sam.
 */
export function playable(verse: Verse): boolean {
  return audioFile(verse.song) in DURATIONS || process.env.NODE_ENV === 'development'
}

export type Player = HTMLAudioElement & { fails?: Set<() => void> }

/** Zvuk pjesme: statični fajl, pa server ako fajla nema. `data-want`: treba svirati. */
export function createPlayer(src: string, fallback: string): Player {
  const a: Player = new Audio(src)
  a.preload = 'none'
  a.fails = new Set()
  a.addEventListener('error', () => {
    // statičnog fajla nema (nova pjesma iz admina) → pokušaj preko servera
    if (a.src.endsWith(src)) {
      a.src = fallback
      if (a.dataset.want) a.play().catch(() => {})
      return
    }
    a.fails?.forEach((f) => f())
  })
  a.addEventListener('ended', () => {
    a.currentTime = 0
  })
  return a
}

/**
 * Zaključan ekran i kontrolni centar — kao muzička aplikacija: omot albuma,
 * naziv, traka napretka, pauza i premotavanje; za sačuvane i natrag/naprijed.
 * Za pjesmu koja upravo svira (zadnja pokrenuta preuzme kontrole).
 */
/** Zvuk koji je trenutno na zaključanom ekranu — samo on javlja svira li. */
let owner: HTMLAudioElement | null = null

export function session(a: HTMLAudioElement, verse: Verse, tracks?: { prev: () => void; next: () => void }) {
  if (!('mediaSession' in navigator)) return
  const ms = navigator.mediaSession
  owner = a
  const cover = albumOf(verse.album)?.cover
  ms.metadata = new MediaMetadata({
    title: verse.song,
    artist: BRAND.name,
    album: verse.album,
    artwork: [
      ...(cover ? [{ src: cover, sizes: '1200x1200', type: 'image/webp' }] : []),
      { src: '/icons/icon-512.png?v=2', sizes: '512x512', type: 'image/png' },
    ],
  })
  const at = (t: number) => {
    a.currentTime = Math.max(0, Math.min(t, Number.isFinite(a.duration) ? a.duration : t))
    position()
  }
  const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
    [
      'play',
      () => {
        a.dataset.want = '1'
        void a.play()
      },
    ],
    [
      'pause',
      () => {
        a.dataset.want = ''
        a.pause()
      },
    ],
    ['seekto', (d) => d.seekTime != null && at(d.seekTime)],
    ['seekbackward', (d) => at(a.currentTime - (d.seekOffset ?? 10))],
    ['seekforward', (d) => at(a.currentTime + (d.seekOffset ?? 10))],
    ['previoustrack', tracks ? () => tracks.prev() : null],
    ['nexttrack', tracks ? () => tracks.next() : null],
  ]
  for (const [k, f] of handlers) {
    try {
      ms.setActionHandler(k, f)
    } catch {
      /* stariji preglednik ne zna za ovu radnju */
    }
  }
  // traka napretka: sistem je sam pomjera — javlja se samo kad se nešto promijeni
  function position() {
    if (!Number.isFinite(a.duration) || !ms.setPositionState) return
    try {
      ms.setPositionState({ duration: a.duration, position: Math.min(a.currentTime, a.duration), playbackRate: a.playbackRate || 1 })
    } catch {}
  }
  if (!a.dataset.session) {
    a.dataset.session = '1'
    // prethodna pjesma koja se upravo utišala ne smije javiti "pauzirano"
    const state = () => {
      if (owner !== a) return
      ms.playbackState = a.paused ? 'paused' : 'playing'
      position()
    }
    for (const e of ['playing', 'pause', 'durationchange', 'seeked', 'ratechange']) a.addEventListener(e, state)
  }
  position()
}

/* ── sačuvani: zajednički zvuk, lista, stanje za plejer u panelu ── */

export const shared = new Map<string, Player>()

/**
 * `shuffle`: nasumičnim redom; `repeat`: ista pjesma ispočetka; `mini`:
 * sačuvani sviraju NA POČETNOJ — ekran pokazuje stih pjesme koja svira, a
 * gramofon ispod njega je plejer (DailyVerse, components/Listening.tsx).
 */
type SavedState = { id: string | null; playing: boolean; shuffle: boolean; repeat: boolean; mini: boolean }
const EMPTY: SavedState = { id: null, playing: false, shuffle: false, repeat: false, mini: false }
let state: SavedState = EMPTY
const subs = new Set<() => void>()
function setState(next: Partial<SavedState>) {
  const s = { ...state, ...next }
  if (s.id === state.id && s.playing === state.playing && s.shuffle === state.shuffle && s.repeat === state.repeat && s.mini === state.mini) return
  state = s
  subs.forEach((f) => f())
}
/** Redoslijed puštenih — "natrag" u nasumičnom redu vraća stvarno prethodnu. */
let history: string[] = []

export function toggleShuffle() {
  setState({ shuffle: !state.shuffle })
}
export function toggleRepeat() {
  setState({ repeat: !state.repeat })
}

/** Spusti panel, muzika ide dalje — na početnoj, sa stihom pjesme koja svira. */
export function minimizeSaved() {
  if (state.id) setState({ mini: true })
}
/** Panel povučen dolje (ili dodir pored) dok pjesma svira — spušta se, ne gasi. */
export function dismissSaved() {
  if (state.playing) minimizeSaved()
}
/** Panel zatvoren: sačuvani na početnoj sviraju dalje; inače sve stane. */
export function closeSaved() {
  if (!state.mini) stopSaved()
}

/**
 * "Player pjesama" s početne: sačuvani redom (najnoviji prvi), prva pjesma
 * odmah — iz istog dodira, bez čekanja (telefon inače ne pusti zvuk).
 */
export function listenSaved(list: Verse[], show = true): Verse | null {
  if (!list.length) return null
  setSavedPlaylist(list)
  const first = list.find((v) => sourceFor(v))
  if (!first || !playSaved(first)) return null
  // `show: false` — zvuk kreće odmah (iz dodira), ekran se prebaci kasnije (prelaz)
  if (show) setState({ mini: true })
  return first
}

/** Koja je po redu pjesma koja svira, od koliko sačuvanih. */
export function savedIndex(): { i: number; n: number } {
  return { i: Math.max(0, playlist.findIndex((v) => v.id === state.id)), n: playlist.length }
}
/** Otvori sačuvane (SavedLink sluša). */
export function openSaved() {
  window.dispatchEvent(new Event(OPEN_SAVED))
}

/** Koji sačuvani stih je u plejeru (zadnji pušten), svira li, i kako ide red. */
export function useSavedPlayer(): SavedState {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
    () => EMPTY,
  )
}

/** Sačuvani redom, kako su u špilu — iz njih plejer bira sljedeću. */
let playlist: Verse[] = []
export function setSavedPlaylist(verses: Verse[]) {
  playlist = verses
}

function sourceFor(verse: Verse) {
  const id = youtubeId(verse.youtube)
  return id && playable(verse) ? sourceOf(verse, id) : null
}

/** Sačuvani stih koji je u plejeru (ako ga ima). */
export function savedVerse(): Verse | null {
  return playlist.find((x) => x.id === state.id) ?? null
}

/** Zvuk sačuvanog stiha koji je u plejeru (ako ga ima). */
export function currentSaved(): Player | null {
  const v = playlist.find((x) => x.id === state.id)
  const s = v && sourceFor(v)
  return (s && shared.get(s.src)) || null
}

/** Plejer prati zvuk stiha: stanje za panel, a na kraju pjesme — sljedeća. */
function track(a: Player, verse: Verse) {
  a.addEventListener('playing', () => setState({ id: verse.id, playing: true }))
  a.addEventListener('pause', () => state.id === verse.id && setState({ playing: false }))
  a.addEventListener('ended', () => {
    if (state.id !== verse.id) return
    // ista pjesma ispočetka, ili sljedeća
    if (state.repeat) {
      a.currentTime = 0
      a.play().catch(() => {})
      return
    }
    setState({ playing: false })
    nextSaved()
  })
}

/** Zajednički zvuk sačuvanog stiha — napravi ga ako ga još nema. */
export function sharedFor(verse: Verse): Player | null {
  const s = sourceFor(verse)
  if (!s) return null
  let a = shared.get(s.src)
  if (!a) {
    a = createPlayer(s.src, s.fallback)
    track(a, verse)
    shared.set(s.src, a)
    window.dispatchEvent(new CustomEvent(SHARED, { detail: s.src }))
  }
  return a
}

/**
 * Zvuk koji je prošao kroz Web Audio (utišavanje na iPhoneu) ne svira kad je
 * ekran zaključan — za novo puštanje dođe svjež, s istog mjesta u pjesmi.
 */
function renew(verse: Verse, old: Player): Player {
  const s = sourceFor(verse)!
  const t = old.currentTime
  const fresh = createPlayer(s.src, s.fallback)
  fresh.preload = 'auto'
  fresh.addEventListener(
    'loadedmetadata',
    () => {
      try {
        fresh.currentTime = t
      } catch {}
    },
    { once: true },
  )
  track(fresh, verse)
  shared.set(s.src, fresh)
  // karte iste pjesme pređu na novi zvuk
  window.dispatchEvent(new CustomEvent(SHARED, { detail: s.src }))
  return fresh
}

/** Pusti sačuvani stih — iz dodira (karta, plejer) ili sam, kad prethodni završi. */
export function playSaved(verse: Verse): boolean {
  let a = sharedFor(verse)
  if (!a) return false
  // utišava se (pauza upravo dodirnuta) — svira dalje punom jačinom
  if (!a.paused && !a.dataset.want) {
    cancelFade(a)
    a.dataset.want = '1'
    setState({ id: verse.id, playing: true })
    return true
  }
  if (!a.paused) return true
  // druga pjesma — kreće ispočetka, a prethodne se vrate na početak
  if (state.id && state.id !== verse.id) {
    for (const o of shared.values()) {
      if (o === a) continue
      o.dataset.want = ''
      if (o.paused) o.currentTime = 0
      else void fadeOut(o, 350).done.then(() => (o.currentTime = 0))
    }
    try {
      a.currentTime = 0
    } catch {}
  }
  if (isRouted(a)) a = renew(verse, a)
  a.dataset.want = '1'
  // zvuk gramofona: kontekst se otvara iz dodira, tup kad igla legne
  unlockVinyl()
  dropNeedle(0.3)
  window.dispatchEvent(new CustomEvent(SOLO, { detail: a }))
  session(a, verse, { prev: prevSaved, next: nextSaved })
  if (history[history.length - 1] !== verse.id) history = [...history.slice(-30), verse.id]
  setState({ id: verse.id })
  window.dispatchEvent(new CustomEvent(SAVED_TRACK, { detail: verse.id }))
  a.play().catch(() => {})
  return true
}

/** Pauza — pjesma se utiša pa stane. */
export function pauseSaved() {
  const a = currentSaved()
  if (!a || a.paused) return
  a.dataset.want = ''
  // dugme odmah pokaže pauzu, pucketanje ploče odmah stane — pjesma se samo još utišava
  setState({ playing: false })
  stopCrackle()
  fadeOut(a, 450)
}

/** Pređi na stih `v`: ono što svira sada se utiša, novo krene. */
function go(v: Verse) {
  const cur = currentSaved()
  if (cur && !cur.paused && v.id !== state.id) {
    cur.dataset.want = ''
    fadeOut(cur, 350)
  }
  playSaved(v)
}

/** Sljedeća/prethodna sačuvana koja ima zvuk (u krug, ili nasumično). */
function step(dir: 1 | -1) {
  const n = playlist.length
  if (!n) return
  const ok = playlist.filter((v) => sourceFor(v))
  if (!ok.length) return
  if (state.shuffle) {
    if (dir === -1 && history.length > 1) {
      history = history.slice(0, -1)
      const back = playlist.find((v) => v.id === history[history.length - 1])
      if (back) return go(back)
    }
    const others = ok.filter((v) => v.id !== state.id)
    return go(others.length ? others[Math.floor(Math.random() * others.length)] : ok[0])
  }
  const i = Math.max(0, playlist.findIndex((x) => x.id === state.id))
  for (let k = 1; k <= n; k++) {
    const v = playlist[(((i + dir * k) % n) + n) % n]
    if (sourceFor(v)) return go(v)
  }
}
export function nextSaved() {
  step(1)
}
/** Natrag: pjesma odmakla — ispočetka; inače prethodna. */
export function prevSaved() {
  const a = currentSaved()
  if (a && a.currentTime > 3) {
    a.currentTime = 0
    return
  }
  step(-1)
}

/** Premotaj pjesmu u plejeru na dio `f` (0…1). */
export function seekSaved(f: number) {
  const a = currentSaved()
  if (a && Number.isFinite(a.duration)) a.currentTime = f * a.duration
}

/** Sačuvani zatvoreni — sve njihove pjesme se utišaju, stanu i vrate na početak. */
export function stopSaved() {
  for (const a of shared.values()) {
    a.dataset.want = ''
    stopCrackle(a)
    if (a.paused) a.currentTime = 0
    else
      void fadeOut(a, 700).done.then(() => {
        a.currentTime = 0
      })
  }
  shared.clear()
  // i pucketanje koje je ostalo od skupljene karte
  if (state.id) stopCrackle()
  history = []
  // nasumično i ponavljanje ostaju kako ih je korisnik ostavio
  state = { ...EMPTY, shuffle: state.shuffle, repeat: state.repeat }
  subs.forEach((f) => f())
}

// pjesma s gramofona (ili bilo koja druga) krene — sačuvana se utiša, i kad
// panela nema (mini plejer); prezentacija na odlasku s koraka gasi sve
if (typeof window !== 'undefined') {
  window.addEventListener(SOLO, (e) => {
    const a = (e as CustomEvent).detail
    if (state.playing && ![...shared.values()].includes(a)) pauseSaved()
  })
  window.addEventListener('stihdana:stop-audio', () => state.id && stopSaved())
}
