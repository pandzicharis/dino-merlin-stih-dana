import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, SESSION_SECONDS, adminConfigured, checkPassword, createSession } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Pogrešna šifra se plaća vremenom: svaki promašaj čeka, a uzastopni
 * promašaji s iste adrese čekaju sve duže. Dovoljno da pogađanje napamet
 * postane besmisleno, bez baze i bez vanjskog servisa.
 */
const misses = new Map<string, { n: number; at: number }>()

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD nije postavljen na serveru.' }, { status: 503 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  const prev = misses.get(ip)
  const recent = prev && Date.now() - prev.at < 15 * 60_000 ? prev.n : 0
  if (recent >= 10) {
    return NextResponse.json({ error: 'Previše pokušaja. Pokušaj za 15 minuta.' }, { status: 429 })
  }

  const { password } = await req.json().catch(() => ({}))
  if (!checkPassword(password)) {
    misses.set(ip, { n: recent + 1, at: Date.now() })
    await new Promise((r) => setTimeout(r, 400 + recent * 300))
    return NextResponse.json({ error: 'Pogrešna šifra.' }, { status: 401 })
  }

  misses.delete(ip)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, createSession()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_SECONDS,
  })
  return res
}
