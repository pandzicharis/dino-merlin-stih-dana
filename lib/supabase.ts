import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase se koristi ISKLJUČIVO za push subscriptions.
 * Stihovi nikad ne idu kroz bazu — vidi lib/pickVerse.ts.
 */
let client: SupabaseClient | null = null

export function supabase(): SupabaseClient | null {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  client = createClient(url, key, { auth: { persistSession: false } })
  return client
}

export type PushRow = {
  endpoint: string
  p256dh: string
  auth: string
  send_hour: number
  tz: string
  /** Datum stiha koji je ovom uređaju zadnji put poslan (YYYY-MM-DD). */
  last_sent_on: string | null
}
