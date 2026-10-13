import type { Metadata } from 'next'
import { isAdmin, adminConfigured } from '@/lib/admin-auth'
import { AdminLogin } from '@/components/admin/AdminLogin'
import { AdminPanel } from '@/components/admin/AdminPanel'

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } }

// Svaki zahtjev provjerava kolačić — ova stranica se nikad ne kešira.
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin configured={adminConfigured()} />
  return <AdminPanel />
}
