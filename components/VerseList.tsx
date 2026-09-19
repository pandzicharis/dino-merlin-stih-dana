'use client'

import Link from 'next/link'
import { MOODS } from '@/data/moods'
import type { Verse } from '@/data/verses'
import { formatDateBs } from '@/lib/date'

export function VerseList({ items }: { items: { verse: Verse; date?: string }[] }) {
  if (items.length === 0) {
    return <p className="mt-16 text-center text-sm text-white/40">Još ništa ovdje.</p>
  }

  return (
    <ul className="mx-auto flex max-w-xl flex-col gap-3">
      {items.map(({ verse, date }) => {
        const m = MOODS[verse.mood]
        return (
          <li key={(date ?? '') + verse.id}>
            <Link
              href={`/stih/${verse.id}`}
              className="block overflow-hidden rounded-2xl border border-white/5 p-5 transition-transform active:scale-[0.99]"
              style={{
                background: `linear-gradient(135deg, ${m.gradient[1]} 0%, ${m.gradient[0]} 100%)`,
              }}
            >
              {date && (
                <p className="meta mb-3" style={{ color: m.accent }}>
                  {formatDateBs(date)}
                </p>
              )}
              <p
                className="font-serif text-lg leading-snug"
                style={{ color: m.text, fontFamily: 'var(--font-serif), serif' }}
              >
                {verse.text.split('\n').map((l, i) => (
                  <span key={i} className="block">
                    {l}
                  </span>
                ))}
              </p>
              <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-white/35">
                {verse.song} &middot; {verse.year}
              </p>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
