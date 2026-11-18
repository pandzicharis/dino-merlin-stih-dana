'use client'

import { useEffect, useState } from 'react'
import { albumOf } from '@/data/albums'
import { MOODS, type Mood } from '@/data/moods'
import { BRAND } from '@/lib/brand'
import { paperText } from '@/lib/text'
import type { StatRow } from '@/app/api/admin/stats/route'

type Totals = { opens: number; saves: number; shares: number }
type Snap =
  | { state: 'ok'; days: number; totals: Totals; rows: StatRow[] }
  | { state: 'off'; days: number }
  | { state: 'setup'; days: number; message?: string }
  | { state: 'error'; days: number; message?: string }

/** SQL za Supabase SQL Editor — isto što je na kraju supabase/schema.sql. */
const SQL = `create table if not exists verse_stats (
  verse_id text not null,
  day      date not null default current_date,
  opens    integer not null default 0,
  saves    integer not null default 0,
  shares   integer not null default 0,
  primary key (verse_id, day)
);

create or replace function bump_verse_stat(vid text, kind text)
returns void
language sql
as $$
  insert into verse_stats (verse_id, day, opens, saves, shares)
  values (vid, current_date, (kind = 'open')::int, (kind = 'save')::int, (kind = 'share')::int)
  on conflict (verse_id, day) do update set
    opens  = verse_stats.opens  + excluded.opens,
    saves  = verse_stats.saves  + excluded.saves,
    shares = verse_stats.shares + excluded.shares;
$$;

alter table verse_stats enable row level security;`

const PERIODS = [7, 30, 90] as const
const TILES: [keyof Totals, string][] = [
  ['opens', 'Otvaranja'],
  ['saves', 'Sačuvano'],
  ['shares', 'Podijeljeno'],
]
const LISTS: [keyof Totals, string][] = [
  ['saves', 'Najviše sačuvani'],
  ['shares', 'Najviše dijeljeni'],
  ['opens', 'Najviše otvarani'],
]

/**
 * Statistika (admin → modal): koliko je stihova otvoreno, sačuvano i
 * podijeljeno u zadnjih 7 / 30 / 90 dana, i koji su najjači. Bez ličnih
 * podataka — samo brojevi po stihu i danu (lib/stats-client.ts).
 */
export function StatsModule() {
  const [days, setDays] = useState<number>(30)
  const [snap, setSnap] = useState<Snap | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let on = true
    fetch(`/api/admin/stats?days=${days}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((b: Snap) => on && setSnap(b))
      .catch(() => on && setSnap({ state: 'error', days, message: 'Nema veze sa serverom.' }))
    return () => {
      on = false
    }
  }, [days])

  // odgovor za izabrani period (dok novi ne stigne — učitava se)
  const cur = snap && snap.days === days ? snap : null

  return (
    <div className="flex min-h-0 flex-col gap-4" data-stats>
      {/* period */}
      <div className="grid w-full max-w-[300px] grid-cols-3 rounded-full border border-white/10 bg-white/[0.04] p-0.5">
        {PERIODS.map((n) => (
          <button
            key={n}
            type="button"
            data-stats-days={n}
            onClick={() => setDays(n)}
            className="h-8 rounded-full text-[12px] font-medium transition-colors"
            style={days === n ? { background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})`, color: '#14100A' } : { color: 'rgba(255,255,255,0.6)' }}
          >
            {n} dana
          </button>
        ))}
      </div>

      {!cur ? (
        <p className="flex items-center gap-2 py-10 text-[13px] text-white/50">
          <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
          Učitavam statistiku…
        </p>
      ) : cur.state === 'off' ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[13px] leading-relaxed text-white/60">
          Statistika se broji u bazi, na produkciji. Lokalno (demo način) je nema.
        </p>
      ) : cur.state === 'setup' ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[13px] leading-relaxed text-white/70">
          <p>
            Statistika još nije uključena — u <b className="text-white/90">Supabase → SQL Editor</b> pokreni ovo (jednom). Brojanje kreće odmah poslije.
          </p>
          <pre className="max-h-56 overflow-auto rounded-xl bg-black/50 p-3 text-[11px] leading-relaxed text-white/75">{SQL}</pre>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(SQL).then(() => setCopied(true))
            }}
            className="h-9 rounded-full border px-4 text-[12px] transition-colors hover:bg-white/5"
            style={{ borderColor: `${BRAND.gold}66`, color: BRAND.gold }}
          >
            {copied ? 'Kopirano' : 'Kopiraj SQL'}
          </button>
        </div>
      ) : cur.state === 'error' ? (
        <p className="rounded-2xl border border-rose-300/20 bg-rose-300/5 p-4 text-[13px] text-rose-100/80">Statistika nije stigla{cur.message ? ` — ${cur.message}` : ''}.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {TILES.map(([k, label]) => (
              <div key={k} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-3 py-3" data-stats-total={k}>
                <p className="tabular text-[22px] leading-none text-white/95" style={{ fontFamily: 'var(--font-serif), serif' }}>
                  {cur.totals[k].toLocaleString('bs')}
                </p>
                <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-white/45">{label}</p>
              </div>
            ))}
          </div>

          {!cur.rows.length ? (
            <p className="py-6 text-center text-[13px] text-white/45">Još nema podataka za ovaj period.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {LISTS.map(([k, label]) => {
                const top = [...cur.rows].filter((r) => r[k] > 0).sort((a, b) => b[k] - a[k]).slice(0, 8)
                return (
                  <section key={k} data-stats-top={k}>
                    <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</p>
                    {!top.length ? (
                      <p className="text-[12px] text-white/35">Ništa još.</p>
                    ) : (
                      <ol className="space-y-1">
                        {top.map((r, i) => (
                          <li key={r.id} className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] py-1.5 pl-1.5 pr-2.5">
                            <span className="tabular w-4 shrink-0 text-center text-[11px] text-white/35">{i + 1}</span>
                            <Cover album={r.album} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
                                {paperText(r.text)}
                              </span>
                              <span className="flex items-center gap-1.5 truncate text-[9.5px] uppercase tracking-[0.14em]" style={{ color: BRAND.gold }}>
                                <i className="block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: MOODS[r.mood as Mood]?.accent ?? BRAND.gold }} />
                                {r.song}
                              </span>
                            </span>
                            <span className="tabular shrink-0 text-[13px] text-white/85">{r[k]}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** mali omot albuma stiha; bez albuma — ikonica aplikacije */
function Cover({ album }: { album: string }) {
  const id = albumOf(album)?.id
  return (
    <span
      className="block h-8 w-8 shrink-0 rounded-[9px] bg-white/[0.06] bg-cover bg-center"
      style={{ backgroundImage: `url(${id ? `/albumi/sm/${id}.webp` : '/icons/icon-192.png'})` }}
      aria-hidden
    />
  )
}
