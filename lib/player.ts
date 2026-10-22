'use client'

/**
 * Zvuk pjesama — jedan plejer za sve: gramofon ispod stiha, karte sačuvanih
 * i plejer sačuvanih u panelu.
 *
 * Sačuvani sviraju kroz jedan stalni zvuk (mala i raširena karta, početna —
 * isti plejer), pa pjesma ne staje kad se karta skupi ili prevuče. Sviraju
 * redom kao lista: kad jedna završi, krene sljedeća (i sa zaključanog ekrana);
 * natrag i naprijed rade i odande. Zatvaranjem sačuvanih sve se utiša.
 */

import { useSyncExternalStore } from 'react'
import type { Verse } from '@/data/verses'
import AUDIO from '@/data/audio.json'
import { albumOf, lockArtOf } from '@/data/albums'
import { audioFile } from './audio-name'
import { BRAND } from './brand'
import { youtubeId } from './text'
import { dropNeedle, startCrackle, stopCrackle, unlockVinyl } from './vinyl'
import { countPlay } from './storage'
import { warmAudio } from './sw-cache'
import { AUDIO_BASE } from './site'

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

export const sourceOf = (verse: Verse, id: string) => {
  const file = audioFile(verse.song)
  const dur = DURATIONS[file]
  return {
    // `?v=<trajanje>`: ključ u kešu service workera — nova pjesma pod istim
    // imenom (admin) je novi ključ, ne stara iz keša
    src: `${AUDIO_BASE}/audio/${file}.m4a${dur ? `?v=${dur}` : ''}`,
    fallback: `/api/audio/${id}?s=${file}`,
    dur,
  }
}

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
/** stih otvoren — njegova pjesma krene sama (detail: id stiha; components/SongCredit.tsx) */
export const AUTOPLAY = 'stihdana:autoplay'

export function createPlayer(src: string, fallback: string): Player {
  const a: Player = new Audio()
  // pjesma je s druge adrese (Cloudflare) — CORS, da Web Audio (utišavanje) ne bude tih
  a.crossOrigin = 'anonymous'
  a.src = src
  a.preload = 'none'
  a.fails = new Set()
  let retried = false
  a.addEventListener('error', () => {
    // statični fajl zapeo (mreža pukla, aplikacija bila u pozadini) — još
    // jednom isti; tek onda ga nema (nova pjesma iz admina) → preko servera
    if (a.src.endsWith(src)) {
      if (retried) a.src = fallback
      else {
        retried = true
        a.src = src
      }
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
  // omot albuma koji svira — prvo kvadratni JPEG (iPhone ga sigurno pokaže),
  // pune adrese (sistem ih preuzima sam, van stranice)
  const abs = (u: string) => new URL(u, location.href).href
  const lock = lockArtOf(cover)
  ms.metadata = new MediaMetadata({
    title: verse.song,
    artist: BRAND.name,
    album: verse.album || verse.description || '',
    artwork: [
      ...(lock ? [{ src: abs(lock), sizes: '512x512', type: 'image/jpeg' }] : []),
      ...(cover ? [{ src: abs(cover), sizes: '1200x1200', type: 'image/webp' }] : []),
      { src: abs('/icons/icon-512.png?v=2'), sizes: '512x512', type: 'image/png' },
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

/* ── sačuvani: JEDAN zvuk za sve pjesme, lista, stanje ── */

/**
 * Sačuvani sviraju kroz jedan stalni audio element ("ploča u plejeru"):
 * sljedeća pjesma samo zamijeni izvor. Telefon (iPhone) novi element pušta
 * samo iz dodira — jedan isti element, jednom pušten iz dodira, svira dalje i
 * sam: kad pjesma završi, sa zaključanog ekrana, nasumično. Ne ide kroz Web
 * Audio (tad bi zaključan ekran utišao) — utišavanje je preko jačine gdje se
 * može, inače odmah stane.
 *
 * `shared`: izvor pjesme koja je u plejeru → taj element (najviše jedan
 * unos) — karte te pjesme se prikače na njega (SongCredit, `share`).
 */
export const shared = new Map<string, Player>()
/** Pjesma je izašla iz plejera (`detail`: njen izvor) — njene karte se otkače. */
export const SHARED_GONE = 'stihdana:shared-gone'

/**
 * `shuffle`: nasumičnim redom; `repeat`: ista pjesma ispočetka; `mini`:
 * plejer pjesama je spušten — na dnu početne viri "Trenutno" s
 * mini plejerom (components/SavedPlayer.tsx `SavedPeek`).
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

/** Spusti plejer, muzika ide dalje — na dnu početne viri mini plejer. */
export function minimizeSaved() {
  if (state.id) setState({ mini: true })
}
/**
 * Pjesma koju veliki plejer pokazuje (ona koja svira, ili prednja karta) —
 * SavedPlayer je javlja. Ako se spusti, a ništa nije pušteno, ona ostane u
 * mini plejeru (spremna, ne svira).
 */
let shown: Verse | null = null
export function setShownSaved(v: Verse | null) {
  shown = v
}

/**
 * Pjesma u plejeru, a ne svira — mini plejer je pokazuje, "pusti" je pokrene.
 * Zvuk se tad ne učitava (to je posao za mrežu i dekoder baš usred spuštanja
 * panela) — učita ga tek "pusti" (playSaved).
 */
function cueSaved(verse: Verse): boolean {
  if (!sourceFor(verse)) return false
  playing = verse
  setState({ id: verse.id, playing: false })
  return true
}

/**
 * Plejer spušten (strelica, povlačenje, dodir pored): uvijek ostaje mini
 * plejer — i kad ništa nije pušteno (tad s pjesmom koju je plejer
 * pokazivao). Do kraja ga zatvara samo × (stopSaved).
 */
export function dismissSaved() {
  if (!state.id && shown) cueSaved(shown)
  minimizeSaved()
}
/** Spušteni plejer opet otvoren preko cijelog panela. */
export function expandSaved() {
  setState({ mini: false })
}
/** Panel zatvoren: sačuvani na početnoj sviraju dalje; inače sve stane. */
export function closeSaved() {
  if (!state.mini) stopSaved()
}

/** Koja je po redu pjesma koja svira, od koliko sačuvanih. */
export function savedIndex(): { i: number; n: number } {
  return { i: Math.max(0, playlist.findIndex((v) => v.id === state.id)), n: playlist.length }
}
/** Otvori sačuvane (SavedLink sluša). */
export function openSaved() {
  window.dispatchEvent(new Event(OPEN_SAVED))
}

const subscribe = (f: () => void) => {
  subs.add(f)
  return () => void subs.delete(f)
}

/** Koji sačuvani stih je u plejeru (zadnji pušten), svira li, i kako ide red. */
export function useSavedPlayer(): SavedState {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY)
}

/**
 * Samo dio stanja plejera (`sel` vraća primitivu) — komponenta se crta iznova
 * tek kad se baš on promijeni, ne pri svakom spuštanju, podizanju ili pauzi.
 */
export function useSavedPlayerSelect<T extends string | number | boolean | null>(sel: (s: SavedState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(EMPTY))
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
  // i kad pjesma nije u trenutnom redu (npr. otvorene Omiljene, a svira druga)
  return playlist.find((x) => x.id === state.id) ?? (playing?.id === state.id ? playing : null)
}
/** pjesma koja je zadnja puštena — bez obzira na red (Omiljene, album) */
let playing: Verse | null = null

/** Zvuk sačuvanog stiha koji je u plejeru (ako ga ima). */
export function currentSaved(): Player | null {
  // i kad pjesma nije u trenutnom redu (Omiljene, album)
  return loaded ? carrier : null
}

/** Pjesma iz plejera stvarno svira (ne samo dugme) — iOS je zna utišati u pozadini bez javljanja. */
export function savedSounding(): boolean {
  const a = currentSaved()
  return Boolean(a && !a.paused && a.dataset.want)
}

/* ── jedan element ── */

let carrier: Player | null = null
/** izvor (statični) pjesme koja je u plejeru, i njen stih */
let loaded: { src: string; fallback: string; id: string } | null = null
/** zaredom pjesme koje se nisu dale pustiti — da preskakanje ne ide u krug */
let misses = 0
/** statični fajl pjesme u plejeru je već jednom ponovo tražen */
let retried = false

function carrierEl(): Player {
  if (carrier) return carrier
  const a: Player = new Audio()
  // pjesma je s druge adrese (Cloudflare) — CORS, da Web Audio (utišavanje) ne bude tih
  a.crossOrigin = 'anonymous'
  a.preload = 'auto'
  a.fails = new Set()
  a.addEventListener('playing', () => {
    misses = 0
    retried = false
    if (loaded) setState({ id: loaded.id, playing: true })
    // pucketanje ploče dok svira (kontekst je otvoren iz dodira)
    startCrackle(a)
  })
  a.addEventListener('pause', () => {
    stopCrackle(a)
    setState({ playing: false })
  })
  a.addEventListener('ended', () => {
    stopCrackle(a)
    // ista pjesma ispočetka, ili sljedeća — isti element, pa svira i bez dodira
    if (state.repeat) {
      a.currentTime = 0
      a.play().catch(() => {})
      return
    }
    setState({ playing: false })
    nextSaved()
  })
  a.addEventListener('error', () => {
    if (!loaded) return
    // statični fajl zapeo (mreža pukla, aplikacija bila u pozadini) — još jednom isti
    if (!a.src.includes('/api/audio/') && !retried) {
      retried = true
      // nastavi gdje je stala
      const t = a.currentTime
      a.src = loaded.src
      if (t) a.addEventListener('loadedmetadata', () => void (a.currentTime = t), { once: true })
      if (a.dataset.want) a.play().catch(() => {})
      return
    }
    // statičnog fajla nema (nova pjesma iz admina) → pokušaj preko servera
    if (!a.src.includes('/api/audio/')) {
      a.src = loaded.fallback
      if (a.dataset.want) a.play().catch(() => {})
      return
    }
    // ni server ne može — karte pokažu YouTube, plejer pređe na sljedeću
    a.fails?.forEach((f) => f())
    if (a.dataset.want && ++misses < Math.max(2, playlist.length)) nextSaved()
  })
  carrier = a
  return a
}

/** Utišaj pa stani (jačina gdje se može; na iPhoneu se ne može — odmah stane). */
let fading = 0
function cancelSoft(a: Player) {
  if (!fading) return
  clearInterval(fading)
  fading = 0
  try {
    a.volume = 1
  } catch {}
}
function softPause(a: Player, ms: number): Promise<void> {
  cancelSoft(a)
  if (a.paused) return Promise.resolve()
  try {
    a.volume = 0.999
  } catch {}
  if (Math.abs(a.volume - 0.999) > 0.0005) {
    a.pause()
    return Promise.resolve()
  }
  const t0 = performance.now()
  return new Promise((resolve) => {
    fading = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / ms)
      try {
        a.volume = 1 - p
      } catch {}
      if (p < 1) return
      clearInterval(fading)
      fading = 0
      a.pause()
      try {
        a.volume = 1
      } catch {}
      resolve()
    }, 30)
  })
}

/** Stavi pjesmu `verse` u plejer (ako već nije): stare karte se otkače, nove prikače. */
function load(verse: Verse): Player | null {
  const s = sourceFor(verse)
  if (!s) return null
  const a = carrierEl()
  if (loaded?.src === s.src) {
    // drugi stih iste pjesme — isti zvuk, samo se zna koji je stih
    loaded.id = verse.id
    playing = verse
    return a
  }
  if (loaded) {
    shared.delete(loaded.src)
    window.dispatchEvent(new CustomEvent(SHARED_GONE, { detail: loaded.src }))
  }
  cancelSoft(a)
  stopCrackle(a)
  loaded = { src: s.src, fallback: s.fallback, id: verse.id }
  playing = verse
  retried = false
  a.src = s.src
  shared.set(s.src, a)
  window.dispatchEvent(new CustomEvent(SHARED, { detail: s.src }))
  return a
}

/** Zvuk sačuvanog stiha ako je baš on u plejeru (karte se prikače na njega). */
export function sharedFor(verse: Verse): Player | null {
  const s = sourceFor(verse)
  return (s && shared.get(s.src)) || null
}

/** Pusti sačuvani stih — iz dodira (karta, plejer) ili sam, kad prethodni završi. */
export function playSaved(verse: Verse): boolean {
  // druga pjesma = drugi fajl; drugi stih iste pjesme nastavlja gdje je stala
  const s = sourceFor(verse)
  const switching = !loaded || loaded.src !== s?.src
  // pjesma se sluša — service worker je zadrži (javi mu se prije nego zvuk krene)
  if (s) warmAudio([s.src])
  const a = load(verse)
  if (!a) return false
  cancelSoft(a)
  // druga pjesma kreće ispočetka
  // nova pjesma — jedno slušanje više (Omiljene se slažu po tome)
  if (switching) countPlay(audioFile(verse.song))
  // zvuk je zapeo (greška — npr. mreža pukla dok je aplikacija bila u
  // pozadini): pjesma se učita iznova, dodir mora pustiti
  if (a.error && loaded) {
    retried = false
    a.src = loaded.src
  }
  if (switching) {
    try {
      a.currentTime = 0
    } catch {}
  }
  a.dataset.want = '1'
  // zvuk gramofona: kontekst se otvara iz dodira, tup kad igla legne
  unlockVinyl()
  if (a.paused) dropNeedle(0.3)
  window.dispatchEvent(new CustomEvent(SOLO, { detail: a }))
  session(a, verse, { prev: prevSaved, next: nextSaved })
  if (history[history.length - 1] !== verse.id) history = [...history.slice(-30), verse.id]
  setState({ id: verse.id })
  window.dispatchEvent(new CustomEvent(SAVED_TRACK, { detail: verse.id }))
  if (a.paused)
    a.play().catch((e: unknown) => {
      // učitavanje prekinuto (nova adresa usred puštanja) — još jednom, ako se i dalje želi
      if ((e as DOMException)?.name === 'AbortError' && a.dataset.want) return a.play().catch(() => setState({ playing: false }))
      setState({ playing: false })
    })
  // dugme i ploča odmah — zvuk krene čim se učita (ne čeka mrežu, pa nema drugog dodira)
  setState({ playing: true })
  return true
}

/** Pauza — dugme i ploča odmah stanu, zvuk se utiša (gdje se može) pa stane. */
export function pauseSaved() {
  const a = currentSaved()
  // zvuk je već stao, a dugme to ne zna — samo se uskladi
  if (!a || a.paused) return setState({ playing: false })
  a.dataset.want = ''
  setState({ playing: false })
  stopCrackle(a)
  void softPause(a, 450)
}

/** Pređi na stih `v` — isti element, nova pjesma (bez dodira radi i sa zaključanog ekrana). */
function go(v: Verse) {
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

/** Sačuvani zatvoreni — pjesma se utiša, stane i vrati na početak; karte se otkače. */
export function stopSaved() {
  const a = carrier
  if (a) {
    a.dataset.want = ''
    stopCrackle(a)
    // kratko stišavanje — zatvaranje se čuje odmah, ne tek za sekundu
    void softPause(a, 320).then(() => {
      // u međuvremenu je možda pokrenuta nova — ne diraj je
      if (!a.dataset.want) a.currentTime = 0
    })
  }
  if (loaded) window.dispatchEvent(new CustomEvent(SHARED_GONE, { detail: loaded.src }))
  shared.clear()
  loaded = null
  playing = null
  // i pucketanje koje je ostalo
  if (state.id) stopCrackle()
  history = []
  // nasumično i ponavljanje ostaju kako ih je korisnik ostavio
  state = { ...EMPTY, shuffle: state.shuffle, repeat: state.repeat }
  subs.forEach((f) => f())
}

// pjesma s gramofona (ili bilo koja druga) krene — sačuvana se utiša, i kad
// panela nema; prezentacija na odlasku s koraka gasi sve
if (typeof window !== 'undefined') {
  window.addEventListener(SOLO, (e) => {
    const a = (e as CustomEvent).detail
    if (state.playing && a !== carrier) pauseSaved()
  })
  window.addEventListener('stihdana:stop-audio', () => state.id && stopSaved())
  // povratak u aplikaciju: iOS zna zaustaviti zvuk u pozadini bez "pause" —
  // dugme i ploča se usklade sa stvarnim stanjem
  const sync = () => {
    if (!document.hidden && carrier && state.playing && carrier.paused) setState({ playing: false })
  }
  document.addEventListener('visibilitychange', sync)
  window.addEventListener('pageshow', sync)
}
