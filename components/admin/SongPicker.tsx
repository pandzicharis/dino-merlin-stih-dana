'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { albumOf } from '@/data/albums'
import { BRAND } from '@/lib/brand'
import { audioSlug, albumLine } from '@/lib/text'
import { audioFile } from '@/lib/audio-name'

export type KnownSong = { song: string; album: string; description?: string; year: number; youtube?: string }

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
  onEdit,
  className,
}: {
  value: string
  songs: KnownSong[]
  /** je li pjesma već u aplikaciji (♪) */
  ready: (song: string) => boolean
  onType: (song: string) => void
  onPick: (s: KnownSong) => void
  /** olovka uz pjesmu — uredi njen naziv i ime fajla */
  onEdit?: (s: KnownSong) => void
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
              <div key={s.song} className="group flex items-center rounded-lg transition-colors" style={{ background: on ? `${BRAND.gold}1f` : 'transparent' }}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                data-song-option={audioSlug(s.song)}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => !exact && setActive(i)}
                onClick={() => pick(s)}
                className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-1.5 text-left"
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
                    {albumLine(s)}
                  </span>
                </span>
                {ready(s.song) && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill={BRAND.gold} className="shrink-0 opacity-75" aria-label="Pjesma je u aplikaciji">
                    <path d={NOTE} />
                  </svg>
                )}
              </button>
              {onEdit && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setOpen(false)
                    onEdit(s)
                  }}
                  title="Uredi pjesmu (naziv i fajl)"
                  aria-label={`Uredi pjesmu ${s.song}`}
                  data-song-edit={audioSlug(s.song)}
                  className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/35 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 20h4L19 9l-4-4L4 16z" />
                  </svg>
                </button>
              )}
              </div>
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
  const src = `/audio/${audioFile(song)}.m4a`

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

/**
 * Uredi pjesmu: naziv (mijenja se u svim njenim stihovima) i ime fajla u
 * public/audio. Ime fajla prati naziv dok ga urednik sam ne promijeni.
 */
export function SongEdit({
  song,
  file,
  count,
  onClose,
  onSave,
}: {
  song: KnownSong
  /** sadašnje ime fajla (bez .m4a) */
  file: string
  /** koliko stihova ima ova pjesma */
  count: number
  onClose: () => void
  /** null = sačuvano, inače poruka greške */
  onSave: (to: string, file: string) => Promise<string | null>
}) {
  const [name, setName] = useState(song.song)
  const [fileName, setFileName] = useState(file)
  // ime fajla ide za nazivom, dok ga urednik ne dirne
  const [ownFile, setOwnFile] = useState(file !== audioSlug(song.song))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = name.trim() && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(fileName)
  const same = name.trim() === song.song && fileName === file
  const field =
    'h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 text-[14px] text-white outline-none placeholder:text-white/25 focus:border-[#BFA87F]/60'

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  return (
    <motion.div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Uredi pjesmu"
    >
      <motion.form
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-[24px] border border-white/10 bg-[#141210] p-5 shadow-2xl"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!valid || same || busy) return
          setBusy(true)
          setError(await onSave(name.trim(), fileName))
          setBusy(false)
        }}
      >
        <div className="mb-4 flex items-center gap-3">
          {albumOf(song.album)?.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={albumOf(song.album)!.cover} alt="" className="h-11 w-11 rounded-lg object-cover" />
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.24em]" style={{ color: BRAND.gold }}>
              Uredi pjesmu
            </p>
            <p className="truncate text-[1.05rem] text-white/90" style={{ fontFamily: 'var(--font-serif), serif' }}>
              {song.song}
            </p>
          </div>
        </div>

        <label className="block">
          <span className="block text-[11px] uppercase tracking-[0.16em] text-white/45">Naziv pjesme</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (!ownFile) setFileName(audioSlug(e.target.value))
            }}
            autoFocus
            className={`mt-2 ${field}`}
            data-song-edit-name
          />
        </label>
        <label className="mt-4 block">
          <span className="block text-[11px] uppercase tracking-[0.16em] text-white/45">
            Fajl <span className="normal-case tracking-normal text-white/30">— u public/audio</span>
          </span>
          <span className="relative mt-2 flex items-center">
            <input
              value={fileName}
              onChange={(e) => {
                setOwnFile(true)
                setFileName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
              }}
              className={`${field} pr-14 font-mono text-[13px]`}
              spellCheck={false}
              data-song-edit-file
            />
            <span className="pointer-events-none absolute right-3.5 font-mono text-[13px] text-white/35">.m4a</span>
          </span>
        </label>

        <p className="mt-3 text-[12px] leading-relaxed text-white/45">
          Mijenja se u {count === 1 ? 'jednom stihu' : `${count} stiha`} ove pjesme.
          {fileName !== file && <> Fajl <code className="text-white/65">{file}.m4a</code> postaje <code className="text-white/65">{fileName}.m4a</code>.</>}
        </p>
        {error && <p className="mt-2 text-[12px] text-rose-200/90">{error}</p>}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-white/10 text-[13px] text-white/70 transition-colors hover:bg-white/5">
            Odustani
          </button>
          <button
            type="submit"
            disabled={!valid || same || busy}
            className="h-11 rounded-xl text-[13px] font-semibold text-black disabled:opacity-40"
            style={{ background: `linear-gradient(180deg, #E2CFA6, ${BRAND.gold})` }}
          >
            {busy ? 'Čuvam…' : 'Sačuvaj'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}
