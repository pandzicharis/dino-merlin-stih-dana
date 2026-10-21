/**
 * Atmosfera karata u traci (Player pjesama) unaprijed ispečena u jednu sliku
 * po albumu × raspoloženju: public/karte/<album>-<raspoloženje>.webp
 * (i bez-<raspoloženje> za stih bez albuma) + public/karte/index.json.
 *
 * Karta u traci tako crta JEDNU sliku umjesto desetak slojeva s maskama,
 * zrnom i miješanjem boja — iPhone je listanjem crta iznova u trenu.
 * Slika se pravi iz iste komponente (components/CardAtmosphere.tsx) na
 * stranici /dev/karta, u Chromeu, u dvostrukoj rezoluciji.
 *
 *   npm run dev                       (drugi terminal)
 *   npm run brand:cards [http://localhost:3111]
 *
 * Pokreni ponovo kad se promijeni album, raspoloženje ili izgled atmosfere.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { ALBUMS } from '../data/albums'
import { MOODS } from '../data/moods'

const BASE = process.argv[2] ?? 'http://localhost:3111'
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9347
const W = 390
const H = 620
const SCALE = 2
const OUT = join(process.cwd(), 'public', 'karte')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Cdp = { send: (method: string, params?: object) => Promise<any>; close: () => void }
async function connect(url: string): Promise<Cdp> {
  const ws = new WebSocket(url)
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
  let id = 0
  const pending = new Map<number, { r: (v: any) => void; j: (e: Error) => void }>()
  ws.onmessage = (m) => {
    const msg = JSON.parse(String(m.data))
    const p = msg.id && pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.error) p.j(new Error(msg.error.message))
    else p.r(msg.result)
  }
  return {
    send: (method, params = {}) =>
      new Promise((r, j) => {
        pending.set(++id, { r, j })
        ws.send(JSON.stringify({ id, method, params }))
      }),
    close: () => ws.close(),
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const profile = mkdtempSync(join(tmpdir(), 'bake-'))
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
  try {
    let tabs: { type: string; webSocketDebuggerUrl: string }[] = []
    for (let i = 0; i < 40 && !tabs.length; i++) {
      try {
        tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      } catch {
        await sleep(250)
      }
    }
    const c = await connect(tabs.find((t) => t.type === 'page')!.webSocketDebuggerUrl)
    await c.send('Page.enable')
    await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false })
    const keys: string[] = []
    const combos = [...ALBUMS.map((a) => a.id), 'bez'].flatMap((album) => Object.keys(MOODS).map((mood) => ({ album, mood })))
    for (const { album, mood } of combos) {
      await c.send('Page.navigate', { url: `${BASE}/dev/karta?album=${album}&mood=${mood}` })
      let ok = false
      for (let i = 0; i < 80 && !ok; i++) {
        await sleep(150)
        const r = await c.send('Runtime.evaluate', { expression: "document.documentElement.dataset.ready === '1'", returnByValue: true })
        ok = r.result?.value === true
      }
      if (!ok) throw new Error(`${album}-${mood}: stranica se nije učitala (je li dev server na ${BASE}?)`)
      const shot = await c.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } })
      const key = `${album}-${mood}`
      const file = join(OUT, `${key}.webp`)
      await sharp(Buffer.from(shot.data, 'base64')).webp({ quality: 80, effort: 6 }).toFile(file)
      keys.push(key)
      console.log('  ✓', key.padEnd(44), `${(statSync(file).size / 1024).toFixed(1)} KB`)
    }
    writeFileSync(join(OUT, 'index.json'), JSON.stringify(keys, null, 2) + '\n')
    console.log(`  ✓ public/karte/index.json (${keys.length})`)
    c.close()
  } finally {
    chrome.kill()
    await sleep(300)
    try {
      rmSync(profile, { recursive: true, force: true })
    } catch {}
  }
}

main().catch((e) => {
  console.error('\n✖', e instanceof Error ? e.message : e, '\n')
  process.exit(1)
})
