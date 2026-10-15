#!/usr/bin/env node
// Treba Node 22+ (ugrađen WebSocket).
// Video za mreže (story 9:16 i objava 4:5) — iz pokrenutog dev servera, kroz
// Chrome bez prozora: snima se /prezentacija/video kadar po kadar, pa ffmpeg
// složi MP4 i doda zvuk obavijesti i pjesmu tačno kad se pojave u videu.
//   node scripts/export-video.mjs [http://localhost:3111] [story|objava]
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] ?? 'http://localhost:3111'
const ONLY = process.argv[3]
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/promo')
const PORT = 9333
const FORMATS = { story: { w: 1080, h: 1920 }, objava: { w: 1080, h: 1350 } }
const FPS = 30

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Najmanji CDP klijent — Node 22 ima WebSocket. */
async function connect(url) {
  const ws = new WebSocket(url)
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
  let id = 0
  const pending = new Map()
  const handlers = new Map()
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data)
    if (msg.id && pending.has(msg.id)) {
      const { r, j } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) j(new Error(msg.error.message))
      else r(msg.result)
    } else if (msg.method) handlers.get(msg.method)?.(msg.params)
  }
  return {
    send: (method, params = {}) =>
      new Promise((r, j) => {
        pending.set(++id, { r, j })
        ws.send(JSON.stringify({ id, method, params }))
      }),
    on: (method, fn) => handlers.set(method, fn),
    close: () => ws.close(),
  }
}

async function evaluate(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  return res.result?.value
}

/** Zvuk obavijesti — ista dva tona kao u prezentaciji (Stages.tsx). */
function chime(file) {
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'sine=frequency=1318.5:duration=0.6',
    '-f', 'lavfi', '-i', 'sine=frequency=1760:duration=0.6',
    '-filter_complex',
    '[0]afade=t=in:d=0.01,afade=t=out:st=0.05:d=0.5,volume=1.3[a];[1]adelay=130,afade=t=in:st=0.13:d=0.01,afade=t=out:st=0.18:d=0.5,volume=1.3[b];[a][b]amix=inputs=2:normalize=0,aformat=channel_layouts=stereo[c]',
    '-map', '[c]', '-ar', '48000', file,
  ])
}

async function record(name, { w, h }) {
  const tmp = mkdtempSync(join(tmpdir(), `video-${name}-`))
  const frames = join(tmp, 'f')
  mkdirSync(frames)
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
  const target = await res.json()
  const cdp = await connect(target.webSocketDebuggerUrl)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: `${BASE}/prezentacija/video?format=${name}&rec=1` })

  // čeka da je aplikacija u telefonu spremna
  for (let i = 0; i < 120 && !(await evaluate(cdp, 'Boolean(window.__video?.ready)')); i++) await sleep(250)
  await sleep(1500) // fontovi, slike, prvi kadar

  const shots = []
  let n = 0
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = join(frames, `${String(n++).padStart(5, '0')}.jpg`)
    writeFileSync(file, Buffer.from(data, 'base64'))
    shots.push({ file, t: metadata.timestamp })
    void cdp.send('Page.screencastFrameAck', { sessionId })
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: w, maxHeight: h, everyNthFrame: 1 })
  await sleep(400)
  const t0 = (await evaluate(cdp, 'window.__video.start()')) / 1000
  for (let i = 0; i < 240 && !(await evaluate(cdp, 'Boolean(window.__video?.done)')); i++) await sleep(250)
  const t1 = Date.now() / 1000
  const marks = await evaluate(cdp, 'JSON.parse(JSON.stringify(window.__video.marks))')
  const audio = await evaluate(cdp, 'window.__video.audio')
  await cdp.send('Page.stopScreencast')
  cdp.close()

  // kadrovi s trajanjima po vremenu snimanja (ekran šalje kadar samo kad se nešto promijeni)
  const used = shots.filter((s, i) => s.t >= t0 || shots[i + 1]?.t > t0)
  if (!used.length) throw new Error('nema kadrova')
  let list = ''
  used.forEach((s, i) => {
    const from = Math.max(s.t, t0)
    const to = i + 1 < used.length ? used[i + 1].t : t1
    list += `file '${s.file}'\nduration ${Math.max(0.001, to - from).toFixed(4)}\n`
  })
  list += `file '${used[used.length - 1].file}'\n`
  writeFileSync(join(tmp, 'list.txt'), list)
  const total = t1 - t0

  const ch = join(tmp, 'chime.wav')
  chime(ch)
  const song = join(ROOT, 'public', audio ?? '')
  const hasSong = Boolean(audio) && existsSync(song) && marks.play != null
  const ms = (s) => Math.round(s * 1000)
  const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'), '-i', ch]
  let filter = `[1:a]adelay=${ms(marks.notify ?? 2)}:all=1[c]`
  let mix = '[c]'
  if (hasSong) {
    const d = Math.max(1, total - marks.play)
    args.push('-i', song)
    filter += `;[2:a]atrim=0:${d.toFixed(2)},afade=t=in:d=0.25,afade=t=out:st=${Math.max(0, d - 2.2).toFixed(2)}:d=2.2,volume=0.9,adelay=${ms(marks.play)}:all=1[s]`
    mix += '[s]'
  }
  filter += `;${mix}amix=inputs=${hasSong ? 2 : 1}:normalize=0:duration=longest,apad[a]`
  const out = join(OUT, `stih-dana-video-${name}.mp4`)
  args.push(
    '-filter_complex', filter,
    '-map', '0:v', '-map', '[a]',
    '-vf', `fps=${FPS},scale=${w}:${h}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-t', total.toFixed(2), '-movflags', '+faststart', out,
  )
  execFileSync('ffmpeg', args)
  rmSync(tmp, { recursive: true, force: true })
  console.log(`✓ ${out.replace(ROOT + '/', '')} — ${total.toFixed(1)} s, ${used.length} kadrova${hasSong ? '' : ' (bez pjesme)'}`)
}

const profile = mkdtempSync(join(tmpdir(), 'video-chrome-'))
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--hide-scrollbars',
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1080,1920',
    'about:blank',
  ],
  { stdio: 'ignore' },
)
try {
  for (let i = 0; i < 40; i++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/json/version`)
      break
    } catch {
      await sleep(250)
    }
  }
  for (const [name, size] of Object.entries(FORMATS)) if (!ONLY || ONLY === name) await record(name, size)
} finally {
  chrome.kill()
  await new Promise((r) => (chrome.exitCode != null ? r() : chrome.once('exit', r)))
  try {
    rmSync(profile, { recursive: true, force: true })
  } catch {
    /* Chrome još drži profil — ostaje u tmp-u */
  }
}
