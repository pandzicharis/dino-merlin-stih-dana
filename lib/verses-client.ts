'use client'

import type { Verse } from '@/data/verses'

/**
 * Svi stihovi (i arhivirani) s `/api/verses` — isti odgovor za sve, drži ga
 * CDN. Povuče se jednom po otvaranju stranice i dijeli između panela
 * sačuvanih i brojača na ikonici.
 */
let cache: Promise<Verse[]> | null = null

/** Glavna stranica već nosi listu — panel sačuvanih je ne traži ponovo. */
export function primeVerses(list: Verse[]) {
  if (list.length) cache ??= Promise.resolve(list)
}

export function loadVerses(): Promise<Verse[]> {
  cache ??= fetch('/api/verses')
    .then((r) => (r.ok ? (r.json() as Promise<Verse[]>) : Promise.reject(new Error(String(r.status)))))
    .catch(() => {
      cache = null
      return []
    })
  return cache
}
