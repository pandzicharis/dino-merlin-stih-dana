import type { Metadata } from 'next'
import { isAdmin, adminConfigured } from '@/lib/admin-auth'
import { AdminLogin } from '@/components/admin/AdminLogin'
import { AdminPanel } from '@/components/admin/AdminPanel'

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } }

// Svaki zahtjev provjerava kolačić — ova stranica se nikad ne kešira.
export const dynamic = 'force-dynamic'

/**
 * `?prijava` (prezentacija): ekran za prijavu i kad je urednik već prijavljen —
 * da se ulazak pokaže. Ne otvara ništa sam: prijavljenog samo pusti dalje,
 * a neprijavljeni i dalje mora upisati pravu šifru.
 */
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ prijava?: string }> }) {
  const authed = await isAdmin()
  if ('prijava' in (await searchParams)) return <AdminLogin configured={adminConfigured()} signedIn={authed} shown />
  if (!authed) return <AdminLogin configured={adminConfigured()} />
  return <AdminPanel />
}
