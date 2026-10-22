/**
 * Zvuk gramofona — pucketanje ploče i tup kad igla legne. Sve se sintetiše
 * u pregledniku (Web Audio): nema fajla za preuzeti, a šum se napravi
 * jednom i vrti u petlji.
 *
 * iOS pusti Web Audio tek kad se kontekst otvori iz dodira — zato
 * `unlockVinyl()` ide u onClick, prije `play()`.
 */

/** Jačina pucketanja ispod pjesme — da se osjeti, a ne da smeta. */
const VOLUME = 0.55

let ctx: AudioContext | null = null
let crackle: AudioBuffer | null = null
let live: { owner: object; src: AudioBufferSourceNode; gain: GainNode } | null = null

export function unlockVinyl() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    if (!ctx || ctx.state === 'closed') ctx = new AC()
    // iOS poslije pozadine ostavi kontekst "interrupted" — i njega probudi
    if (ctx.state !== 'running') void ctx.resume().catch(() => {})
  } catch {
    /* bez pucketanja — pjesma svira i dalje */
  }
}

/**
 * Pjesma se utiša pa stane (pauza, druga pjesma, zatvoreni sačuvani).
 * iPhone ne da mijenjati jačinu `<audio>` — zato zvuk za utišavanje prođe
 * kroz Web Audio (isti kontekst kao pucketanje); bez njega se jačina spušta
 * direktno (računar, Android). Vraća `true` ako je zvuk prošao kroz Web Audio:
 * takav ne svira kad je ekran zaključan, pa ga plejer za sljedeće puštanje
 * zamijeni svježim (SongCredit `renew`).
 */
const gains = new WeakMap<HTMLMediaElement, GainNode>()
const fades = new WeakMap<HTMLMediaElement, () => void>()

export function fadeOut(a: HTMLMediaElement, ms = 500): { routed: boolean; done: Promise<void> } {
  fades.get(a)?.()
  if (a.paused) return { routed: gains.has(a), done: Promise.resolve() }
  let g = gains.get(a)
  // iPhone: jačina se ne da mijenjati, a prebacivanje u Web Audio usred
  // pjesme napravi rupu u zvuku (čuje se prekid, pa tišina) — tamo stane odmah
  if (!g && !volumeWorks(a)) {
    a.pause()
    return { routed: false, done: Promise.resolve() }
  }
  if (!g && ctx && ctx.state === 'running') {
    try {
      const src = ctx.createMediaElementSource(a)
      g = ctx.createGain()
      src.connect(g).connect(ctx.destination)
      gains.set(a, g)
    } catch {
      /* već spojen negdje drugo — ide preko jačine */
    }
  }
  const v0 = a.volume
  let timer = 0
  if (g && ctx) {
    const t = ctx.currentTime
    g.gain.cancelScheduledValues(t)
    g.gain.setValueAtTime(g.gain.value, t)
    g.gain.linearRampToValueAtTime(0, t + ms / 1000)
  } else {
    const t0 = performance.now()
    timer = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / ms)
      try {
        a.volume = v0 * (1 - p)
      } catch {}
    }, 30)
  }
  const restore = () => {
    clearInterval(timer)
    if (g) g.gain.value = 1
    else
      try {
        a.volume = v0
      } catch {}
  }
  const done = new Promise<void>((resolve) => {
    const end = window.setTimeout(() => {
      fades.delete(a)
      a.pause()
      restore()
      resolve()
    }, ms)
    // ponovo pušteno usred utišavanja — prekini, jačina nazad
    fades.set(a, () => {
      clearTimeout(end)
      fades.delete(a)
      restore()
      resolve()
    })
  })
  return { routed: Boolean(g), done }
}

/** Može li se `<audio>` utišati jačinom (računar, Android) — iPhone je drži na 1. */
function volumeWorks(a: HTMLMediaElement): boolean {
  const v = a.volume
  try {
    a.volume = v > 0.5 ? v - 0.01 : v + 0.01
    const ok = a.volume !== v
    a.volume = v
    return ok
  } catch {
    return false
  }
}

/** Utišavanje u toku — prekini ga (pjesma svira dalje, punom jačinom). */
export function cancelFade(a: HTMLMediaElement) {
  fades.get(a)?.()
}

/** Je li zvuk prošao kroz Web Audio (pa na zaključanom ekranu ne bi svirao). */
export function isRouted(a: HTMLMediaElement) {
  return gains.has(a)
}

/** Šest sekundi tihog šuma s rijetkim pucketima različite jačine. */
function makeCrackle(c: AudioContext): AudioBuffer {
  const len = c.sampleRate * 6
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.02
  for (let p = 0; p < 6 * 14; p++) {
    const at = Math.floor(Math.random() * (len - 600))
    const amp = 0.08 + Math.random() ** 4 * 0.6
    const decay = 20 + Math.random() * 100
    for (let k = 0; k < 600; k++) d[at + k] += amp * (Math.random() * 2 - 1) * Math.exp(-k / decay)
  }
  return buf
}

/** Pucketanje dok svira pjesma `owner`; nova pjesma preuzme ga od stare. */
export function startCrackle(owner: object) {
  if (!ctx || ctx.state !== 'running' || live?.owner === owner) return
  stopCrackle()
  crackle ??= makeCrackle(ctx)
  const src = ctx.createBufferSource()
  src.buffer = crackle
  src.loop = true
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 500
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.gain.setTargetAtTime(VOLUME, ctx.currentTime, 0.15)
  src.connect(hp).connect(gain).connect(ctx.destination)
  src.start(0, Math.random() * crackle.duration)
  live = { owner, src, gain }
}

/** Utiša pucketanje — samo ako je baš ova pjesma vlasnik (ili bez vlasnika: svako). */
export function stopCrackle(owner?: object) {
  if (!ctx || !live || (owner && live.owner !== owner)) return
  const { src, gain } = live
  gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08)
  src.stop(ctx.currentTime + 0.4)
  live = null
}

/** Igla legne na ploču: mekan, dubok tup i par pucketa — za `delay` sekundi. */
export function dropNeedle(delay: number) {
  if (!ctx) return
  try {
    const c = ctx
    const len = Math.floor(c.sampleRate * 0.3)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const t = i / c.sampleRate
      d[i] = Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 28) * 0.5 + (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.25
    }
    const src = c.createBufferSource()
    src.buffer = buf
    const gain = c.createGain()
    gain.gain.value = 0.6
    src.connect(gain).connect(c.destination)
    src.start(c.currentTime + delay)
  } catch {
    /* tišina */
  }
}
