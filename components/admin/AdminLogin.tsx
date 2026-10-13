'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { BRAND } from '@/lib/brand'
import { PageShell } from '../PageShell'
import { MagazaLogo } from '../MagazaLogo'

export function AdminLogin({ configured }: { configured: boolean }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !password) return
    setBusy(true)
    setError(null)
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).catch(() => null)
    if (res?.ok) {
      router.refresh()
      return
    }
    const body = res ? await res.json().catch(() => ({})) : {}
    setError(body.error ?? 'Prijava nije uspjela.')
    setPassword('')
    setBusy(false)
  }

  return (
    <PageShell eyebrow="Stih dana" title="Postavke" back={null}>
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto mt-10 max-w-sm rounded-[26px] border border-white/10 bg-white/[0.03] p-7 backdrop-blur-sm"
      >
        <span className="mb-6 flex justify-center opacity-80">
          <MagazaLogo height={32} color="#F4F4F4" />
        </span>
        <span
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border"
          style={{ borderColor: `${BRAND.gold}55`, background: `radial-gradient(circle, ${BRAND.gold}22, transparent 70%)` }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={BRAND.gold} strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
            <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
          </svg>
        </span>
        <p className="text-center text-[1.2rem] text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
          Pristup za urednike
        </p>
        <p className="mt-1.5 text-center text-[13px] text-white/40">Stihovi i raspored objave.</p>

        {!configured ? (
          <p className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-[12px] leading-relaxed text-amber-100/80">
            Šifra nije postavljena. Dodaj <code>ADMIN_PASSWORD</code> u varijable okoline.
          </p>
        ) : (
          <>
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Šifra"
              aria-label="Šifra"
              className="mt-6 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-[15px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#BFA87F]/60"
            />
            {error && <p className="mt-2.5 text-center text-[12px] text-rose-300/90">{error}</p>}
            <button
              type="submit"
              disabled={busy || !password}
              className="mt-4 h-12 w-full rounded-2xl text-[14px] font-semibold text-black transition-opacity disabled:opacity-50"
              style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
            >
              {busy ? 'Provjeravam…' : 'Uđi'}
            </button>
          </>
        )}
      </motion.form>
    </PageShell>
  )
}
