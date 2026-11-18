import { isAdmin } from '@/lib/admin-auth'
import { CAN_FETCH, readAlias, readDurations } from '@/lib/audio-files'
import { audioFile } from '@/lib/audio-name'
import { fetchLyrics, keepLyrics } from '@/lib/lyrics-store'
import { lyricsDuration } from '@/lib/yt-duration'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// sajt, LRCLIB, po stihu i titlovi — obično par sekundi, rijetko duže
export const maxDuration = 60

/**
 * Traženje teksta za formu stiha (admin), korak po korak: čim se izabere
 * pjesma, forma pita ovdje i pokazuje šta se upravo radi — trajanje videa,
 * dinomerlin.com, po stihu, LRCLIB, titlovi. Odgovor je red JSON-a po
 * događaju (`step`, pa `done` ili `error`).
 *
 * Lokalno se nađen tekst odmah i spremi (data/lyrics.json); na produkciji
 * se spremi kad se stih sačuva (GitHub, /api/admin/lyrics).
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: 'Niste prijavljeni.' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { song?: string; youtube?: string; verse?: string } | null
  const song = String(body?.song ?? '').trim().slice(0, 120)
  const youtube = String(body?.youtube ?? '').trim().slice(0, 200) || undefined
  const verse = String(body?.verse ?? '').trim().slice(0, 400) || undefined
  if (!song) return Response.json({ error: 'Nedostaje naziv pjesme.' }, { status: 400 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      try {
        send({ type: 'step', key: 'video', state: 'run' })
        const [alias, secs] = await Promise.all([readAlias(), readDurations()])
        const file = audioFile(song, alias)
        const duration = await lyricsDuration(file, youtube, secs)
        send({ type: 'step', key: 'video', state: duration ? 'ok' : 'none' })

        const l = await fetchLyrics(song, duration, true, { youtube, verse }, (s) => send({ type: 'step', ...s }))
        if (l && CAN_FETCH) await keepLyrics(file, l)
        send({
          type: 'done',
          result: l ? { title: l.title, lines: l.lines.filter(Boolean).length, synced: l.synced?.length ?? 0 } : null,
          stored: Boolean(l && CAN_FETCH),
        })
      } catch (e) {
        send({ type: 'error', message: (e as Error).message })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}
