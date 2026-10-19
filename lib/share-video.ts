/**
 * Story kao video: ista slika kao "Story", ali se slaže pred očima — svaki
 * element svojim pokretom, redom: pozadina iz tame, potpis odozgo, dan,
 * pjesma, album i znak na dnu, pa se stih ispiše riječ po riječ (kao da se
 * piše, s malim sjajem). Slika se cijelo vrijeme jedva primjetno približava.
 * Bez zvuka.
 *
 * Telefon ga snima sam, u stvarnom vremenu (canvas → MediaRecorder), tek na
 * dodir — ništa se ne učitava unaprijed i ništa ne usporava ostatak
 * aplikacije. Snima se u pregled u panelu, pa se video vidi dok nastaje.
 * 720 × 1280: Instagram ga tako i prikazuje, a koder telefona ima pola posla.
 */

import { storyLayers, type Mark, type ShareInput, type WordBox } from './share-image'

const W = 720
const H = 1280
const FPS = 30

function pickType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return
  // mp4 prvo — Instagram i WhatsApp webm ne primaju
  return ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) =>
    MediaRecorder.isTypeSupported(t),
  )
}

export function videoSupported(): boolean {
  return typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype && Boolean(pickType())
}

type Part = { x: number; y: number; w: number; h: number; start: number; dur: number; style: 'word' | 'drop' | 'rise' | 'spread' | 'grow' }

const clamp = (v: number) => Math.max(0, Math.min(1, v))
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

/** Riječi stiha: dio slike do pola razmaka prema susjedima, red po red. */
function wordParts(words: WordBox[], start: number): { parts: Part[]; end: number } {
  const last = Math.max(...words.map((w) => w.line))
  const step = Math.min(0.26, Math.max(0.14, 2.8 / Math.max(1, words.length)))
  let t = start
  const parts = words.map((b, i) => {
    const prev = words[i - 1]?.line === b.line ? words[i - 1] : null
    const next = words[i + 1]?.line === b.line ? words[i + 1] : null
    // novi red — kratak predah, kao u pjesmi
    if (i > 0 && !prev) t += 0.22
    const left = prev ? (prev.x + prev.w + b.x) / 2 : b.x - b.h
    const right = next ? (b.x + b.w + next.x) / 2 : b.x + b.w + b.h
    // prvi i zadnji red uzmu i sjaj iznad/ispod sebe
    const top = b.y - (b.line === 0 ? b.h * 0.5 : 0)
    const bottom = b.y + b.h + (b.line === last ? b.h * 0.5 : 0)
    const part: Part = { x: left, y: top, w: right - left, h: bottom - top, start: t, dur: 0.75, style: 'word' }
    t += step
    return part
  })
  return { parts, end: t - step + 0.75 }
}

/** Ostali elementi: malo zraka oko svakog (sjena, sjaj), pa svoj pokret i svoje vrijeme. */
function markPart(m: Mark, start: number, dur: number, style: Part['style']): Part {
  const px = m.h * 0.6
  const py = m.h * 0.45
  return { x: m.x - px, y: m.y - py, w: m.w + px * 2, h: m.h + py * 2, start, dur, style }
}

/**
 * Jedan element u trenutku `t`: dio cijele slike preko pozadine, sa svojim
 * pokretom. Riječ se ispiše slijeva nadesno (kao rukom), uz blagi uspon i
 * kratak sjaj dok se pojavljuje.
 */
function drawPart(ctx: CanvasRenderingContext2D, full: HTMLCanvasElement, r: Part, t: number) {
  const raw = clamp((t - r.start) / r.dur)
  if (raw <= 0) return
  const p = easeOut(raw)
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  ctx.save()
  switch (r.style) {
    case 'word': {
      // pero: otkriva se slijeva, malo ispred prozirnosti
      const reveal = Math.min(1, easeInOut(raw) * 1.15)
      ctx.beginPath()
      ctx.rect(r.x, r.y - r.h, r.w * reveal, r.h * 3)
      ctx.clip()
      ctx.globalAlpha = Math.min(1, raw * 1.6)
      ctx.translate(0, (1 - p) * r.h * 0.14)
      ctx.drawImage(full, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h)
      // kratak sjaj dok se riječ ispisuje
      const glow = Math.sin(Math.PI * raw) * 0.22
      if (glow > 0.01) {
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = glow
        ctx.drawImage(full, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h)
      }
      break
    }
    case 'drop': // potpis — spusti se odozgo i sjedne
      ctx.globalAlpha = p
      ctx.translate(cx, cy - (1 - p) * r.h * 0.35)
      ctx.scale(0.94 + 0.06 * p, 0.94 + 0.06 * p)
      ctx.drawImage(full, r.x, r.y, r.w, r.h, -r.w / 2, -r.h / 2, r.w, r.h)
      break
    case 'spread': // datum — slova se skupe na svoje mjesto
      ctx.globalAlpha = p
      ctx.translate(cx, cy)
      ctx.scale(1.12 - 0.12 * p, 1)
      ctx.drawImage(full, r.x, r.y, r.w, r.h, -r.w / 2, -r.h / 2, r.w, r.h)
      break
    case 'rise': // pjesma, album — izađu odozdo
      ctx.globalAlpha = p
      ctx.drawImage(full, r.x, r.y, r.w, r.h, r.x, r.y + (1 - p) * r.h * 0.6, r.w, r.h)
      break
    case 'grow': // znak na dnu — naraste iz sredine
      ctx.globalAlpha = p
      ctx.translate(cx, cy)
      ctx.scale(0.86 + 0.14 * p, 0.86 + 0.14 * p)
      ctx.drawImage(full, r.x, r.y, r.w, r.h, -r.w / 2, -r.h / 2, r.w, r.h)
      break
  }
  ctx.restore()
}

/** Snimi video u `canvas` (pregled u panelu). `null` ako preglednik ne zna snimati. */
export async function recordStory(canvas: HTMLCanvasElement, input: ShareInput, onProgress: (p: number) => void): Promise<File | null> {
  const type = pickType()
  if (!type) return null

  const { full, bare, words, marks } = await storyLayers({ ...input, format: 'story' })
  const mark = (k: Mark['kind']) => marks.find((m) => m.kind === k)

  // vremenska linija: prvo svi detalji (potpis, dan, pjesma, album, znak),
  // pa se na kraju stih ispiše — on je glavni, ništa ne kasni iza njega
  const intro = 0.7
  const parts: Part[] = []
  const sig = mark('sig')
  if (sig) parts.push(markPart(sig, 0.35, 0.9, 'drop'))
  const date = mark('date')
  if (date) parts.push(markPart(date, 0.75, 0.8, 'spread'))
  const song = mark('song')
  if (song) parts.push(markPart(song, 1.0, 0.7, 'rise'))
  const album = mark('album')
  if (album) parts.push(markPart(album, 1.2, 0.7, 'rise'))
  const label = mark('label')
  if (label) parts.push(markPart(label, 1.4, 0.8, 'grow'))
  parts.push(...wordParts(words, 2.0).parts)
  const settle = Math.max(...parts.map((r) => r.start + r.dur))
  const total = Math.min(16, settle + 3)

  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const k = W / full.width

  const draw = (t: number) => {
    // približavanje od 3.5 % kroz cijeli video, oko sredine
    const z = 1 + 0.035 * easeInOut(t / total)
    ctx.setTransform(k * z, 0, 0, k * z, (W - W * z) / 2, (H - H * z) / 2)
    ctx.globalAlpha = 1
    ctx.drawImage(bare, 0, 0)
    for (const r of parts) drawPart(ctx, full, r, t)
    // na kraju tačno slika iz "Story" — bez ijednog piksela razlike
    const a = clamp((t - settle) / 0.4)
    if (a > 0) {
      ctx.globalAlpha = a
      ctx.drawImage(full, 0, 0)
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    // iz tame
    if (t < intro) {
      ctx.globalAlpha = 1 - easeOut(t / intro)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
    }
    ctx.globalAlpha = 1
  }
  draw(0)

  const stream = canvas.captureStream(FPS)
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6_000_000 })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()))

  rec.start(250)
  const start = performance.now()
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - start) / 1000
      draw(Math.min(t, total))
      onProgress(Math.min(1, t / total))
      if (t >= total) return resolve()
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  rec.stop()
  await stopped
  stream.getTracks().forEach((tr) => tr.stop())

  const base = type.split(';')[0]
  return new File(chunks, `stih-dana-${input.verse.id}.${base === 'video/mp4' ? 'mp4' : 'webm'}`, { type: base })
}
