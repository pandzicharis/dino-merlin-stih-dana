/**
 * GitHub za pjesme (SAMO SERVER): produkcija sama ne može mijenjati
 * public/audio, pa javi workflowu .github/workflows/audio.yml.
 *
 * GITHUB_AUDIO_TOKEN: fine-grained token samo za ovaj repo, dozvole
 * Contents: read & write (pokretanje) i Actions: read (stanje) — DEPLOY.md.
 */
export const GITHUB_REPO = process.env.GITHUB_REPO || 'pandzicharis/dino-merlin-stih-dana'
export const GITHUB_TOKEN = process.env.GITHUB_AUDIO_TOKEN

export function gh(path: string, init?: RequestInit) {
  return fetch(`https://api.github.com/repos/${GITHUB_REPO}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
}

/** Pokreni workflow za pjesme; null = poslano, inače poruka za admina. */
export async function dispatchAudio(type: 'audio' | 'audio-rename' | 'lyrics-offset', payload: Record<string, string>): Promise<string | null> {
  if (!GITHUB_TOKEN) return 'Pjesme se na produkciji mijenjaju preko GitHuba — dodaj GITHUB_AUDIO_TOKEN u Vercel (DEPLOY.md).'
  const r = await gh('/dispatches', { method: 'POST', body: JSON.stringify({ event_type: type, client_payload: payload }) }).catch(() => null)
  return r?.ok ? null : `GitHub nije primio zahtjev (${r?.status ?? 'nema veze'}) — provjeri GITHUB_AUDIO_TOKEN.`
}
