import { inDeck } from './deck'

/**
 * Statistika stihova — bez ijednog ličnog podatka: samo da je neki stih
 * otvoren, sačuvan ili podijeljen. Isti uređaj isti stih broji jednom dnevno
 * po radnji (oznaka u localStorage), pa ponovno otvaranje ne napuhuje broj.
 * Prezentacija se ne broji. Server: app/api/stats, admin → Statistika.
 */
export type StatKind = 'open' | 'save' | 'share'

const KEY = 'stihdana:stat'

export function trackStat(id: string, kind: StatKind) {
  if (typeof window === 'undefined' || !id || inDeck()) return
  const day = new Date().toISOString().slice(0, 10)
  try {
    const marks = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, string>
    const k = `${kind}:${id}`
    if (marks[k] === day) return
    // oznake od ranije van — ne raste u nedogled
    for (const [x, d] of Object.entries(marks)) if (d !== day) delete marks[x]
    marks[k] = day
    localStorage.setItem(KEY, JSON.stringify(marks))
  } catch {}
  const body = JSON.stringify({ id, kind })
  try {
    // sendBeacon stigne i kad se stranica upravo zatvara (dijeljenje u drugu aplikaciju)
    if (navigator.sendBeacon?.('/api/stats', new Blob([body], { type: 'application/json' }))) return
  } catch {}
  void fetch('/api/stats', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
}
