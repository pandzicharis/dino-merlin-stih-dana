'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { albumOf } from '@/data/albums'
import { BRAND } from '@/lib/brand'
import { audioSlug } from '@/lib/text'

export type KnownSong = { song: string; album: string; year: number; youtube?: string }

const NOTE = 'M9 18.5a3 3 0 1 1-2-2.83V5l12-2v12.5a3 3 0 1 1-2-2.83V7.3L9 8.6z'

/**
 * Pjesma stiha: kucaš, a ispod je lista pjesama koje već imaju stih (s
 * omotom i albumom) — izbor popuni link, album i godinu. Pjesma koje nema
 * ostaje upisana kao nova i preuzme se kad se stih sačuva.
 */
export function SongPicker({
  value,
  songs,
  ready,
  onType,
  onPick,
  className,
}: {
  value: string
  songs: KnownSong[]
  /** je li pjesma već u aplikaciji (♪) */
  ready: (song: string) => boolean
  onType: (song: string) => void
  onPick: (s: KnownSong) => void
  className: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const listId = useId()

  // zatvori na klik van liste (ne na blur — prezentacija kuca pa skloni fokus)
  useEffect(() => {
    if (!open) return
    const off = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [open])

  const q = audioSlug(value)
  const exact = songs.find((s) => audioSlug(s.song) === q)
  // izabrana pjesma — cijela lista, da se lako promijeni; inače po onome što je otkucano
  const list = (exact || !q ? [...songs] : songs.filter((s) => audioSlug(`${s.song} ${s.album}`).includes(q))).sort(
    (a, b) => Number(audioSlug(b.song).startsWith(q)) - Number(audioSlug(a.song).startsWith(q)) || a.song.localeCompare(b.song, 'bs'),
  )
  const pick = (s: KnownSong) => {
    onPick(s)
    setOpen(false)
  }

  return (
    <div ref={box} className="relative mt-2">
      <input
        name="song"
        value={value}
        onChange={(e) => {
          onType(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(a + 1, list.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && open) {
            e.preventDefault()
            // s liste ako ima pogodaka, inače ostaje upisana nova pjesma
            if (list[active] && !exact) pick(list[active])
            else setOpen(false)
          }
        }}
        required
        placeholder="Izaberi ili upiši pjesmu"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className={`${className} pr-9`}
      />
      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/35" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="m6 9 6 6 6-6" />
      </svg>

      {open && (list.length > 0 || q) && (
        <motion.div
          role="listbox"
          id={listId}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-[#15130f] p-1 shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
        >
          {q && !exact && (
            // nova pjesma: klik (ili Enter) potvrdi upisani naziv i zatvori listu
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-white/55 transition-colors hover:bg-white/[0.05]"
              data-song-new
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-white/20 text-white/40">+</span>
              <span className="min-w-0">
                Nova pjesma <b className="font-medium text-white/85">„{value.trim()}“</b>
                <span className="block text-[11px] text-white/35">preuzeće se kad sačuvaš stih</span>
              </span>
            </button>
          )}
          {list.map((s, i) => {
            const cover = albumOf(s.album)?.cover
            const on = exact ? audioSlug(s.song) === q : i === active
            return (
              <button
                type="button"
                key={s.song}
                role="option"
                aria-selected={on}
                data-song-option={audioSlug(s.song)}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => !exact && setActive(i)}
                onClick={() => pick(s)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors"
                style={{ background: on ? `${BRAND.gold}1f` : 'transparent' }}
              >
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded-md bg-white/5" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-white/90">{s.song}</span>
                  <span className="block truncate text-[10px] uppercase tracking-[0.12em] text-white/35">
                    {s.album} · {s.year}
                  </span>
                </span>
                {ready(s.song) && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill={BRAND.gold} className="shrink-0 opacity-75" aria-label="Pjesma je u aplikaciji">
                    <path d={NOTE} />
                  </svg>
                )}
              </button>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** Pjesma koja je već u aplikaciji — pusti je u formi, da se čuje prije čuvanja. */
export function SongPlayer({ song }: { song: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  // druga pjesma = novi plejer (key u formi) — kreće ispočetka, ne svira sama
  const src = `/audio/${audioSlug(song)}.m4a`

  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) void a.play().catch(() => setPlaying(false))
    else a.pause()
  }

  return (
    <div className="col-span-2 -mt-1 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/30 px-2.5 py-2" data-song-player>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pauza' : 'Pusti pjesmu'}
        data-song-play
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black"
        style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="translate-x-px" aria-hidden>
            <path d="M7 4.5v15l12-7.5z" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="flex items-center justify-between gap-2 text-[11px]">
          <span className="truncate text-white/75">Pjesma je u aplikaciji — pusti je</span>
          <span className="shrink-0 tabular-nums text-white/40">
            {time(t)} / {dur ? time(dur) : '–:––'}
          </span>
        </p>
        {/* premotavanje: klik na traku */}
        <div
          className="relative mt-1.5 h-1 cursor-pointer rounded-full bg-white/10"
          onClick={(e) => {
            const a = audio.current
            if (!a || !dur) return
            const r = e.currentTarget.getBoundingClientRect()
            a.currentTime = ((e.clientX - r.left) / r.width) * dur
          }}
        >
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${dur ? (t / dur) * 100 : 0}%`, background: BRAND.gold }} />
        </div>
      </div>
    </div>
  )
}
