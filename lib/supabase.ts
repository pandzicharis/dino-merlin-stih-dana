import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase se koristi ISKLJUČIVO za push subscriptions.
 * Stihovi nikad ne idu kroz bazu — vidi lib/pickVerse.ts.
 *
 * Klijent se pravi jednom po instanci funkcije i živi između zahtjeva.
 * Nova instanca po zahtjevu značila bi novo TLS rukovanje prema Supabaseu
 * na svaki poziv.
 */
let client: SupabaseClient | null = null

export function supabase(): SupabaseClient | null {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  client = createClient(url, key, {
    // Servisni ključ, bez korisnika: nema šta da se čuva ni osvježava.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Realtime se ne koristi; bez ovoga klijent otvara websocket koji niko ne sluša.
    realtime: { params: { eventsPerSecond: 0 } },
    global: { headers: { 'x-application-name': 'stih-dana' } },
  })
  return client
}

export type PushRow = {
  endpoint: string
  p256dh: string
  auth: string
  send_hour: number
  tz: string
  last_sent_on: string | null
  last_run: string | null
}

/**
 * VAŽNO za svaki budući upit nad ovom tabelom: `select('*')` nikad ne vrati
 * više od `db-max-rows` redova (Supabase default je 1000), i to bez ijedne
 * greške — samo tiho odsiječe ostatak. Sve preko te granice mora ići kroz
 * `.range()` po stranicama, ili, kao kod slanja, kroz `claim_due_subscriptions`.
 */
export const DB_MAX_ROWS = 1000
