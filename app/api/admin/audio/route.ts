import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'
import { readCatalog } from '@/lib/catalog'
import { CAN_FETCH, prepareSong, readDurations, songState, type SongState } from '@/lib/audio-files'
import { audioSlug } from '@/lib/text'
import { GITHUB_TOKEN, dispatchAudio, gh } from '@/lib/github'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Pjesme stihova. Lokalno (dev) se pjesma preuzme ovdje, odmah. Na produkciji
 * Vercel to ne može (nema yt-dlp-a, public/ je zaključan), pa ruta javi
 * GitHubu (lib/github.ts → .github/workflows/audio.yml): on preuzme, commita,
 * Vercel objavi.
 */
const WORKFLOW = 'audio.yml'
/** od uspješnog workflowa do novog builda na Vercelu */
const DEPLOY_MS = 6 * 60_000

const denied = () => NextResponse.json({ error: 'Niste prijavljeni.' }, { status: 401 })

type Job = { status: string; conclusion: string | null; url: string; at: number }

/** zadnje pokretanje workflowa za pjesme */
async function lastJob(): Promise<Job | null> {
  if (!GITHUB_TOKEN) return null
  try {
    const r = await gh(`/actions/workflows/${WORKFLOW}/runs?per_page=1`)
    if (!r.ok) return null
    const run = ((await r.json()) as { workflow_runs?: { status: string; conclusion: string | null; html_url: string; updated_at: string }[] }).workflow_runs?.[0]
    return run ? { status: run.status, conclusion: run.conclusion, url: run.html_url, at: Date.parse(run.updated_at) } : null
  } catch {
    return null
  }
}

/** Pjesma koje nema u ovom buildu — šta se s njom trenutno dešava na GitHubu. */
function remote(job: Job | null): { state: SongState; error?: string } {
  if (!job) return { state: 'missing' }
  if (job.status !== 'completed') return { state: 'loading' }
  if (job.conclusion === 'success') return Date.now() - job.at < DEPLOY_MS ? { state: 'loading' } : { state: 'missing' }
  return {
    state: 'error',
    error: 'Preuzimanje nije uspjelo.',
  }
}

/** Stanje svake pjesme iz kataloga: { slug: stanje }. */
export async function GET() {
  if (!(await isAdmin())) return denied()
  const [cat, durations, job] = await Promise.all([readCatalog(), readDurations(), CAN_FETCH ? null : lastJob()])
  const songs: Record<string, { state: SongState; error?: string }> = {}
  for (const v of cat.verses) {
    const slug = audioSlug(v.song)
    if (slug in songs) continue
    const st = await songState(v.song, durations)
    songs[slug] = st.state === 'ready' || CAN_FETCH ? st : remote(job)
  }
  return NextResponse.json(
    { mode: CAN_FETCH ? 'local' : GITHUB_TOKEN ? 'github' : 'off', job: job?.url ?? null, songs },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/** Pripremi pjesmu odmah — admin zove čim se stih sačuva. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return denied()
  const body = (await req.json().catch(() => null)) as { song?: string; youtube?: string } | null
  const song = String(body?.song ?? '').trim().slice(0, 120)
  const youtube = String(body?.youtube ?? '').trim().slice(0, 200)
  if (!song) return NextResponse.json({ error: 'Nedostaje naziv pjesme.' }, { status: 400 })

  if ((await songState(song)).state === 'ready') return NextResponse.json({ state: 'ready' })

  if (CAN_FETCH) {
    prepareSong(song, youtube).catch(() => {})
    return NextResponse.json({ state: 'loading' })
  }
  const fail = await dispatchAudio('audio', { song, youtube })
  if (fail) return NextResponse.json({ error: fail }, { status: GITHUB_TOKEN ? 502 : 409 })
  return NextResponse.json({ state: 'loading' })
}
