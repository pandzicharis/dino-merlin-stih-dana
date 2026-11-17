'use client'

/**
 * PJESME PREKO YOUTUBEA — zadani način (lib/flags.ts, `OWN_AUDIO` ugašen).
 *
 * Pjesma je video sa službenog kanala u ugrađenom YouTube plejeru: legalno,
 * vlasnik prava je vidi i zarađuje. Pravila plejera
 * (developers.google.com/youtube/terms): vidi se dok svira (najmanje
 * 200×200 px), nema pozadine ni samo zvuka.
 *
 * JEDAN plejer (iframe) za cijelu aplikaciju, bez YouTubeovih kontrola — pusti,
 * pauza, traka, nasumično i ponovi su naši, ispod pjesme (Transport.tsx). Svaka
 * pjesma ima red — kad završi, sljedeća krene sama: lista
 * iz koje je puštena (sačuvani), inače sačuvane pjesme ili sve pjesme (`defaultLine`).
 * Pluta iznad svog mjesta na ekranu (TubeStage); uz video ide tekst koji
 * prati pjesmu (vrijeme se čita iz plejera). `scope`: odakle je
 * pjesma puštena — na početnoj i poklonu se otvori mala ladica
 * (components/tube/TubeDrawer.tsx), u sačuvanim pjesma je drugi nivo iste
 * ladice (components/tube/TubePanel.tsx). Mjesto pokriveno — pjesma stane.
 */

import { useSyncExternalStore } from 'react'
import type { Verse } from '@/data/verses'
import { getFavorites } from './storage'
import { youtubeId } from './text'
import { knownVerses } from './verses-client'

type YTPlayer = {
  loadVideoById(o: { videoId: string; startSeconds?: number }): void
  cueVideoById?(o: { videoId: string }): void
  playVideo(): void
  pauseVideo(): void
  seekTo(s: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlaybackRate?(): number
  getVideoUrl?(): string
  mute?(): void
  unMute?(): void
  isMuted?(): boolean
}
type YTApi = { Player: new (el: HTMLElement, o: Record<string, unknown>) => YTPlayer }

declare global {
  interface Window {
    YT?: YTApi
    onYouTubeIframeAPIReady?: () => void
  }
}

const UNSTARTED = -1
const ENDED = 0
const PLAYING = 1
const PAUSED = 2
const BUFFERING = 3
const CUED = 5

/* ── plejer: jedan iframe ── */

/** gdje stoji iframe — TubeStage ga da čim se pojavi */
let host: HTMLElement | null = null
export function setTubeHost(el: HTMLElement | null) {
  host = el
}

let api: Promise<YTApi> | null = null
function loadApi(): Promise<YTApi> {
  api ??= new Promise((res) => {
    if (window.YT?.Player) return res(window.YT)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      res(window.YT!)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    document.head.appendChild(s)
  })
  return api
}

let yt: YTPlayer | null = null
let made: Promise<YTPlayer> | null = null
/** video koji je u plejeru i njegovo stanje (YouTube) */
let loadedId = ''
/** video pripremljen unaprijed (warmTube) — dodir ga samo pusti, još u dodiru (sa zvukom) */
let cued = ''
let ytState = -1

/** sklonjeno mjesto (nema TubeStage) — plejer nikad ne padne u stranicu ispod sadržaja */
function aside(): HTMLElement {
  const d = document.createElement('div')
  d.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden'
  document.body.appendChild(d)
  return d
}

function engine(): Promise<YTPlayer> {
  made ??= loadApi().then(
    (YT) =>
      new Promise<YTPlayer>((res) => {
        // mjesto plejera (TubeStage) — i kad je ovaj kod osvježen (razvoj), pa
        // `host` ne zna; stari plejer odande ode: uvijek je samo jedan
        const parent = host ?? document.querySelector<HTMLElement>('[data-tube-host]') ?? aside()
        parent.replaceChildren()
        const el = document.createElement('div')
        parent.appendChild(el)
        const p = new YT.Player(el, {
          // bez kolačića za praćenje dok se ne pusti
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          // bez YouTubeovih kontrola (traka, pusti, glasnoća, titlovi, cijeli ekran, tipke) — sve
          // vodi naš plejer ispod videa (components/tube/Transport.tsx). Naziv videa i znak
          // YouTubea ostaju: YouTube ih traži, ne smiju se sakriti ni prekriti
          playerVars: { playsinline: 1, controls: 0, fs: 0, disablekb: 1, rel: 0, iv_load_policy: 3, origin: location.origin },
          events: {
            onReady: () => res((yt = p)),
            onStateChange: (e: { data: number }) => changed(e.data),
            onError: () => failed(),
          },
        })
      }),
  )
  return made
}

/* ── stanje ── */

export type TubeStatus = 'idle' | 'loading' | 'playing' | 'paused'
/**
 * `verseId`/`videoId`: stih i video u plejeru; `scope`: gdje je ladica otvorena;
 * `min`: ladica spuštena — pjesma čeka (stoji: bez videa na ekranu nema zvuka);
 * `list`: pjesma je iz liste (ima red — nazad, pusti, sljedeća);
 * `next`: stih sljedeće pjesme u redu, ili null;
 * `muted`: svira bez zvuka — iPhone ne pušta zvuk dok se jednom ne dodirne video;
 * `shuffle`: nasumično — sljedeća je slučajna pjesma iz reda; `repeat`: pjesma kad
 * završi krene ispočetka (oboje ostaje i kad se pjesma zatvori)
 */
export type TubeSnap = { verseId: string | null; videoId: string | null; scope: string | null; status: TubeStatus; min: boolean; list: boolean; next: string | null; muted: boolean; shuffle: boolean; repeat: boolean }
const IDLE: TubeSnap = { verseId: null, videoId: null, scope: null, status: 'idle', min: false, list: false, next: null, muted: false, shuffle: false, repeat: false }
let snap = IDLE
let current: Verse | null = null
/** red pjesama — lista iz koje je pjesma puštena (sačuvani), samo one s videom */
let queue: Verse[] = []
/** sljedeća iz reda — izabrana unaprijed (nasumično: slučajna), da se pripremi baš ona */
let upcoming: Verse | null = null
/** pjesme koje su svirale prije ove — u nasumičnom "nazad" vraća stvarno prethodnu */
let played: Verse[] = []
const subs = new Set<() => void>()
function set(next: Partial<TubeSnap>) {
  const s = { ...snap, ...next }
  if ((Object.keys(s) as (keyof TubeSnap)[]).every((k) => s[k] === snap[k])) return
  snap = s
  subs.forEach((f) => f())
}
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => void subs.delete(f)
}

/** Šta je u plejeru, gdje je otvoreno i svira li. */
export function useTube(): TubeSnap {
  return useSyncExternalStore(subscribe, () => snap, () => IDLE)
}
export const tubeSnap = () => snap
/** Stih čija je pjesma u plejeru. */
export const tubeVerse = () => current
/** Sljedeća pjesma u redu (pripremi se unaprijed — tekst, slika), ili null. */
export const tubeNext = () => upcoming

/** video u plejeru je krenuo (ili čeka dodir na YouTubeov "pusti") — tek tad se okvir vidi, do tad slika pjesme */
let started = false
/** redni broj zadnjeg otvaranja — stari odgovori se odbace */
let ask = 0

/** Vidi li se okvir (video je krenuo ili čeka dodir). */
export const tubeShown = () => Boolean(snap.videoId) && loadedId === snap.videoId && started

export const videoOf = (v: Verse) => youtubeId(v.youtube)
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`

/**
 * Pripremi plejer unaprijed — API, iframe i (ako je dat) video stiha `v` u
 * njemu, bez puštanja. Dodir je onda odmah: ne čeka se da se YouTube učita.
 */
export function warmTube(v?: Verse) {
  const id = v ? videoOf(v) : null
  void engine().then((p) => {
    // već nešto svira ili je učitano — ne dira se
    if (!id || snap.videoId || loadedId) return
    p.cueVideoById?.({ videoId: id })
    cued = id
  })
}

/**
 * Pjesma poslije `v` u redu (poslije zadnje — opet prva), ili null.
 * Nasumično: slučajna druga — prvo one koje još nisu svirale.
 */
function after(v: Verse | null, shuffle = snap.shuffle): Verse | null {
  const i = v ? queue.findIndex((x) => x.id === v.id) : -1
  if (i < 0 || queue.length < 2) return null
  if (!shuffle) return queue[(i + 1) % queue.length]
  const others = queue.filter((_, k) => k !== i)
  const fresh = others.filter((x) => !played.some((p) => p.id === x.id))
  const pool = fresh.length ? fresh : others
  return pool[Math.floor(Math.random() * pool.length)]
}

/** ista pjesma (drugi stih iste pjesme je ista pjesma) */
const songKey = (v: Verse) => v.song.trim().toLowerCase()

/**
 * Red za pjesmu puštenu van liste (početna, poklon, raširena karta) — kad
 * završi, svira sljedeća, kao u plejeru: sačuvane pjesme ako je ova među
 * njima, inače sve pjesme (aktivni stihovi s videom). Svaka pjesma jednom, a
 * ova je baš ovaj stih.
 */
function defaultLine(v: Verse): Verse[] {
  const all = knownVerses().filter((x) => (x as { active?: boolean }).active !== false && videoOf(x))
  const byId = new Map(all.map((x) => [x.id, x]))
  const saved = getFavorites().flatMap((id) => byId.get(id) ?? [])
  const pool = saved.some((x) => songKey(x) === songKey(v)) ? saved : all
  const seen = new Set<string>()
  const out: Verse[] = []
  for (const x of pool) {
    const k = songKey(x)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(k === songKey(v) ? v : x)
  }
  if (!seen.has(songKey(v))) out.unshift(v)
  return out
}

/**
 * Otvori pjesmu stiha `v` (ladica u `scope`) i pusti je — iz dodira. `list`:
 * lista iz koje je puštena (red za "sljedeća"); bez nje red su sačuvane ili sve pjesme.
 * `false`: stih nema video.
 */
export function openTube(v: Verse, scope: string, list?: Verse[]): boolean {
  const id = videoOf(v)
  if (!id) return false
  const same = snap.videoId === id
  const was = snap.min
  // druga lista (ili pjesma van liste) — nov red, i "nazad" ne ide u stari
  if (list ? list !== queue : !same) played = []
  if (list) queue = list.filter((x) => videoOf(x))
  else if (!same) queue = defaultLine(v)
  current = v
  // vraćena ista pjesma zadrži već izabranu sljedeću
  if (!same || list || !upcoming) upcoming = after(v)
  set({ verseId: v.id, videoId: id, scope, min: false, list: queue.length > 0, next: upcoming?.id ?? null, status: same ? snap.status : 'loading' })
  if (same && loadedId === id) {
    // spuštena (ili završena) pjesma se vrati i nastavi gdje je stala — iz dodira
    if (was || snap.status !== 'playing') resumeTube()
    return true
  }
  const mine = ++ask
  const start = (p: YTPlayer) => {
    if (mine !== ask) return
    loadedId = id
    started = false
    // zvuk uključen prije pjesme — YouTube pamti utišano (i od prošlog otvaranja, i od
    // tihog pokretanja na iPhoneu), pa bi i ova svirala bez zvuka
    p.unMute?.()
    // pripremljena pjesma (warmTube) samo krene: poruka YouTubeu ide još u dodiru, pa
    // smije sa zvukom — i na iPhoneu. Ostale se učitaju i krenu kad video stigne
    if (cued === id) p.playVideo()
    else p.loadVideoById({ videoId: id })
    cued = ''
    // nije krenuo sam — iPhone ne pušta zvuk bez dodira: krene bez zvuka (to smije), a
    // prvi sljedeći dodir na dugme (ili okrugla ikonica zvuka uz pjesmu) uključi zvuk —
    // i svakoj sljedećoj pjesmi. Drugdje se ništa ne utišava: spor video samo pričeka
    window.setTimeout(() => {
      if (mine !== ask || started || (ytState !== UNSTARTED && ytState !== CUED)) return
      if (IOS) {
        p.mute?.()
        p.playVideo()
      }
      // ni tako nije krenuo — stoji, a naš "pusti" ga pokrene (iz dodira, sa zvukom)
      window.setTimeout(() => {
        if (mine !== ask || started) return
        started = true
        if (ytState !== BUFFERING) set({ status: 'paused' })
      }, IOS ? 1500 : 500)
    }, 1000)
  }
  // plejer spreman — odmah, još u dodiru; inače kad se napravi
  if (yt) start(yt)
  else void engine().then(start)
  return true
}

/** iPhone i iPad (i iPad koji se predstavlja kao Mac) — zvuk tek poslije dodira u videu */
const IOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/** svira bez zvuka — dok se zvuk ne uključi (dodir u videu), pita plejer */
let sound = 0
function watchSound() {
  window.clearInterval(sound)
  sound = window.setInterval(() => {
    if (!yt || !snap.videoId || !yt.isMuted?.()) {
      window.clearInterval(sound)
      set({ muted: false })
    }
  }, 600)
}

/**
 * Svira bez zvuka — prvi sljedeći dodir na bilo koje dugme uključi zvuk (dodir ide
 * YouTubeu s porukom). Samo `click`: povlačenje (listanje teksta) nije dodir, a
 * uključen zvuk bez dodira iPhone bi zaustavio.
 */
let tapArmed = false
function unmuteOnTap() {
  if (tapArmed) return
  tapArmed = true
  const on = () => {
    document.removeEventListener('click', on, true)
    tapArmed = false
    if (snap.muted) unmuteTube()
  }
  document.addEventListener('click', on, true)
}

/** zadnje vrijeme koje je plejer javio i kad (sat stranice) */
let tick = { v: -1, at: 0 }

/**
 * Vrijeme pjesme u plejeru (sekunde) — čita se kad treba (tekst koji prati
 * pjesmu). Plejer ga zna javljati na mahove (par puta u sekundi), pa se dok
 * svira između dva javljanja računa po satu — red teksta ne kasni za pjesmom.
 */
export function tubeTime(): { t: number; d: number } {
  if (!yt || !started || !snap.videoId || loadedId !== snap.videoId) return { t: 0, d: 0 }
  const v = yt.getCurrentTime() || 0
  const now = performance.now()
  if (v !== tick.v) tick = { v, at: now }
  const ahead = ytState === PLAYING ? Math.min(0.6, (now - tick.at) / 1000) * (yt.getPlaybackRate?.() || 1) : 0
  return { t: v + ahead, d: yt.getDuration() || 0 }
}

/** Premotaj na sekundu `t` i pusti — dodir na red teksta. */
export function seekTube(t: number) {
  if (!yt || !snap.videoId || loadedId !== snap.videoId) return
  yt.seekTo(Math.max(0, t), true)
  yt.playVideo()
}

/**
 * Premotaj na sekundu `t` s trake napretka — pauza ostaje pauza. Dok se
 * vuče (`final` false) YouTube ne traži nove dijelove videa, tek na kraju.
 */
export function scrubTube(t: number, final: boolean) {
  if (!yt || !started || !snap.videoId || loadedId !== snap.videoId) return
  yt.seekTo(Math.max(0, t), final)
}

/** Stane (ladica ostaje) — kad se mjesto pokrije ili aplikacija ode u pozadinu. */
export function pauseTube() {
  if (yt && loadedId === snap.videoId) yt.pauseVideo()
}

/**
 * Nastavi gdje je stala — iz dodira. U plejeru nije naša pjesma (nije se
 * stigla učitati) — učita se ona, pa nikad ne krene druga.
 */
export function resumeTube() {
  if (!yt || !snap.videoId || loadedId !== snap.videoId) return
  const inside = youtubeId(yt.getVideoUrl?.() ?? '')
  if (inside && inside !== loadedId) yt.loadVideoById({ videoId: loadedId })
  else yt.playVideo()
}

/**
 * Spusti ladicu: pjesma ostaje u plejeru i čeka (stane — YouTube ne pušta
 * zvuk bez videa na ekranu). `openTube` iste pjesme je vrati i nastavi.
 */
export function minimizeTube() {
  if (!snap.videoId) return
  pauseTube()
  // stoji odmah (traka pokaže "pusti"), ne tek kad YouTube javi
  set({ min: true, status: snap.status === 'idle' ? 'idle' : 'paused' })
}

/** Vrati spuštenu pjesmu (u ladicu `scope`) i nastavi — iz dodira. */
export function restoreTube(scope = snap.scope ?? '') {
  if (current) openTube(current, scope)
}

/** Sljedeća pjesma iz reda (iz dodira, ili sama kad pjesma završi). `false`: nema je. */
export function nextTube(): boolean {
  const n = upcoming
  if (!n) return false
  // ova ide u odsvirane — nasumično "nazad" vraća nju
  if (current) played = [...played, current].slice(-100)
  return openTube(n, snap.scope ?? '', queue)
}

/**
 * Nazad — iz dodira: pjesma je odmakla (više od 3 s) ili prethodne nema —
 * ispočetka; inače prethodna iz reda (nasumično: ona koja je stvarno svirala prije).
 * Spuštena se vrati gore (svira samo dok se vidi).
 */
export function prevTube() {
  if (!yt || !snap.videoId || loadedId !== snap.videoId) return
  const i = current ? queue.findIndex((x) => x.id === current!.id) : -1
  const p = snap.shuffle ? played[played.length - 1] : i > 0 ? queue[i - 1] : undefined
  if (p && (yt.getCurrentTime() || 0) <= 3) {
    if (snap.shuffle) played = played.slice(0, -1)
    return void openTube(p, snap.scope ?? '', queue)
  }
  set({ min: false })
  yt.seekTo(0, true)
  yt.playVideo()
}

/**
 * Uključi zvuk — iz dodira. iPhone pusti pjesmu bez zvuka (bez dodira u videu ne
 * smije sa zvukom); dodir na našem dugmetu ide YouTubeu porukom koja nosi dodir.
 */
export function unmuteTube() {
  if (!yt || !snap.videoId || loadedId !== snap.videoId) return
  yt.unMute?.()
  watchSound()
}

/** Pusti / pauza — iz dodira. Spuštena se vrati gore i nastavi. */
export function toggleTube() {
  if (snap.min) return restoreTube()
  if (snap.status === 'playing' || snap.status === 'loading') pauseTube()
  else resumeTube()
}

/** Nasumično — sljedeća se odmah izabere iznova (da se pripremi baš ona). */
export function toggleTubeShuffle() {
  const shuffle = !snap.shuffle
  upcoming = after(current, shuffle)
  set({ shuffle, next: upcoming?.id ?? null })
}

/** Ponovi pjesmu — kad završi, krene ispočetka. */
export function toggleTubeRepeat() {
  set({ repeat: !snap.repeat })
}

/** Zatvori: pjesma stane i izađe iz plejera. */
export function closeTube() {
  ask++
  if (yt && loadedId === snap.videoId) yt.pauseVideo()
  // isti video se sljedeći put učita iznova, od početka
  loadedId = ''
  current = null
  queue = []
  upcoming = null
  played = []
  // nasumično i ponovi ostaju za sljedeću pjesmu
  set({ ...IDLE, shuffle: snap.shuffle, repeat: snap.repeat })
}

/* ── događaji YouTube plejera ── */

function changed(s: number) {
  ytState = s
  if (!snap.videoId || loadedId !== snap.videoId) return
  if (s === PLAYING) {
    started = true
    // svira bez zvuka (iPhone prije prvog dodira u videu) — natpis uz pjesmu dok se ne uključi
    const muted = Boolean(yt?.isMuted?.())
    set({ status: 'playing', muted })
    if (muted) {
      watchSound()
      unmuteOnTap()
    }
  } else if (s === ENDED) {
    // ponovi: ista ispočetka; inače red (sačuvani): sljedeća krene sama — dok se
    // video vidi (spuštena ionako stoji)
    if (snap.repeat && !snap.min && yt) {
      yt.seekTo(0, true)
      yt.playVideo()
    } else if (snap.min || !nextTube()) set({ status: 'paused' })
  } else if (s === PAUSED) set({ status: 'paused' })
}

function failed() {
  if (!snap.videoId || loadedId !== snap.videoId) return
  // vlasnik ne da ugradnju: YouTube to sam napiše u okviru
  started = true
  set({ status: 'paused' })
}

/* ── mjesta za okvir ── */

type Slot = { el: HTMLElement; id: string }
const slots = new Set<Slot>()
/** Mjesto za okvir videa `id` (TubeScreen) — dok je na ekranu. */
export function addSlot(s: Slot): () => void {
  slots.add(s)
  return () => void slots.delete(s)
}
export function slotsOf(id: string): HTMLElement[] {
  return [...slots].filter((s) => s.id === id).map((s) => s.el)
}
/** Mjesto se upravo sakrilo ili vratilo (QR kod u plejeru) — TubeStage bira odmah, ne za 200 ms. */
export const SLOT_EVENT = 'stihdana:tube-slot'

if (typeof document !== 'undefined') {
  // aplikacija ode u pozadinu — pjesma stane (YouTube ne dozvoljava pozadinu)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseTube()
  })
  // tombola preko cijelog ekrana (novi stih, obavijest — components/IntroSplash.tsx)
  // i prezentacija između koraka: ladica se zatvori
  for (const e of ['stihdana:izvuci', 'stihdana:tombola', 'stihdana:stop-audio']) window.addEventListener(e, () => snap.videoId && closeTube())
}
