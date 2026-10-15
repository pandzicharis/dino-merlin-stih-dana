/**
 * Admin pristup — jedna šifra, bez naloga.
 *
 * Šifra je u varijabli okoline `ADMIN_PASSWORD` i nikad ne ide klijentu.
 * Nakon prijave preglednik dobije potpisan, httpOnly kolačić koji važi
 * 30 dana — urednik ostaje prijavljen na svom računaru. Potpis je HMAC nad
 * rokom važenja, ključ je izveden iz šifre — promjena šifre zato odmah
 * poništi sve postojeće prijave.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const ADMIN_COOKIE = 'sd_admin'
export const SESSION_SECONDS = 30 * 24 * 60 * 60

function key(): string | null {
  const pw = process.env.ADMIN_PASSWORD
  if (!pw) return null
  return createHmac('sha256', 'stih-dana/admin/v1').update(pw).digest('hex')
}

function sign(payload: string, k: string) {
  return createHmac('sha256', k).update(payload).digest('base64url')
}

function same(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD)
}

export function checkPassword(input: unknown): boolean {
  const pw = process.env.ADMIN_PASSWORD
  if (!pw || typeof input !== 'string') return false
  // poređenje preko hasha: iste dužine, pa bez curenja dužine šifre
  const h = (s: string) => createHmac('sha256', 'cmp').update(s).digest('hex')
  return same(h(input), h(pw))
}

export function createSession(): string | null {
  const k = key()
  if (!k) return null
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS)
  return `${exp}.${sign(exp, k)}`
}

export function verifySession(token: string | undefined): boolean {
  const k = key()
  if (!k || !token) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false
  return same(sig, sign(exp, k))
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies()
  return verifySession(store.get(ADMIN_COOKIE)?.value)
}
