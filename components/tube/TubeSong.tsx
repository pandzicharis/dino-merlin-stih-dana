'use client'

import { useEffect } from 'react'
import { preconnect } from 'react-dom'
import type { Verse } from '@/data/verses'
import { albumOf, softOf, thumbOf } from '@/data/albums'
import { MOODS } from '@/data/moods'
import { BRAND } from '@/lib/brand'
import { haptic } from '@/lib/haptic'
import { albumLine } from '@/lib/text'
import { AUTOPLAY } from '@/lib/player'
import { openTube, useTube, videoOf, warmTube } from '@/lib/youtube'
import { FitLines } from '../deck/FitLines'
import { EqBars } from '../EqBars'
import { primeLyrics } from '../Lyrics'
import { YouTubeLogo } from './icons'
import { TubeDrawer } from './TubeDrawer'

/**
 * Pjesma ispod stiha (YouTube — lib/youtube.ts): staklena kartica — omot,
 * naziv i album, a desno YouTube dugme (pusti). Dodir bilo gdje otvori
 * ladicu s pjesmom (TubeDrawer). Dok svira, na omotu trake.
 */
export function TubeSong({ verse, scope = 'home', z = 90 }: { verse: Verse; scope?: string; z?: number }) {
  const tube = useTube()
  // veze prema YouTubeu odmah, a plejer s ovom pjesmom kad se ekran smiri — dodir je onda odmah
  preconnect('https://www.youtube-nocookie.com')
  preconnect('https://i.ytimg.com')
  useEffect(() => {
    if (!videoOf(verse)) return
    const t = window.setTimeout(() => warmTube(verse), 2500)
    return () => clearTimeout(t)
  }, [verse])
  // "Mir svim dobrim ljudima" (prvi stih): kad uvod završi, ladica s pjesmom se
  // otvori i pjesma krene sama (DailyVerse) — iPhone i iPad tiho, dok se ne
  // dodirne video (lib/youtube.ts)
  useEffect(() => {
    if (scope !== 'home') return
    const go = (e: Event) => {
      if ((e as CustomEvent<string>).detail === verse.id) openTube(verse, scope)
    }
    window.addEventListener(AUTOPLAY, go)
    return () => window.removeEventListener(AUTOPLAY, go)
  }, [verse, scope])
  const playing = tube.scope === scope && tube.verseId === verse.id && tube.status === 'playing'
  // bez pjesme: samo naziv i album
  if (!videoOf(verse))
    return (
      <div className="text-center">
        <p className="text-[13px] font-semibold uppercase leading-none tracking-[0.18em]" style={{ color: BRAND.gold }}>
          {verse.song}
        </p>
        <p className="mt-2 text-[10px] uppercase leading-none tracking-[0.22em] text-white/55">{albumLine(verse)}</p>
      </div>
    )
  return (
    <>
      <TubeCapsule
        verse={verse}
        playing={playing}
        tip
        onPlay={() => openTube(verse, scope)}
      />
      <TubeDrawer scope={scope} z={z} />
    </>
  )
}

/**
 * Kartica pjesme — na početnoj i na raširenoj sačuvanoj karti
 * (components/SavedCarousel.tsx): u pozadini zamućen omot albuma, lijevo omot
 * (dok pjesma svira, na njemu trake), naziv i album, desno YouTube dugme. Dodir
 * bilo gdje pusti pjesmu.
 */
export function TubeCapsule({
  verse,
  onPlay,
  playing = false,
  tip = false,
  wide = false,
}: {
  verse: Verse
  onPlay: () => void
  playing?: boolean
  tip?: boolean
  /** širine mjesta u kom je (raširena karta), inače širina reda ispod stiha */
  wide?: boolean
}) {
  const cover = albumOf(verse.album)?.cover
  const thumb = cover ? (thumbOf(cover) ?? cover) : '/icons/icon-192.png?v=2'
  const soft = softOf(cover)
  const accent = MOODS[verse.mood].accent
  const card = (
    <button
      type="button"
      data-tip={tip ? 'song' : undefined}
      data-nodrag
      // tekst i plejer se pripreme čim prst dotakne — ladica se otvori s njima
      onPointerDown={() => {
        primeLyrics(verse.song)
        warmTube()
      }}
      onClick={() => {
        haptic(6)
        onPlay()
      }}
      aria-label={`Pusti "${verse.song}" na YouTubeu`}
      className="group relative isolate flex items-center gap-3 overflow-hidden rounded-[24px] p-2.5 pr-3.5 text-left transition-transform duration-200 active:scale-[0.98]"
      style={{
        width: wide ? '100%' : 'min(calc(100vw - 1.5rem), 400px)',
        // rub u boji stiha, svjetliji gore — kartica se uklopi u ekran stiha
        boxShadow: `0 22px 50px rgba(0,0,0,0.45), inset 0 0 0 1px ${accent}40, inset 0 1px 0 rgba(255,255,255,0.14)`,
      }}
    >
      {/* pozadina: zamućen omot albuma (unaprijed zamućen — bez CSS blura), zatamnjen */}
      {soft && <span className="absolute inset-0 -z-10 scale-110 bg-cover bg-center opacity-70" style={{ backgroundImage: `url(${soft})` }} aria-hidden />}
      <span className="absolute inset-0 -z-10" style={{ background: `linear-gradient(100deg, rgba(12,10,10,0.86) 25%, rgba(12,10,10,0.55) 100%), radial-gradient(120% 140% at 100% 0%, ${accent}26, transparent 60%)` }} aria-hidden />

      {/* omot albuma — dok pjesma svira, na njemu trake */}
      <span
        className="relative block h-[58px] w-[58px] shrink-0 rounded-[11px] bg-cover bg-center shadow-[0_4px_14px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
        style={{ backgroundImage: `url(${thumb})` }}
        aria-hidden
      >
        {playing && (
          <span className="absolute inset-0 flex items-center justify-center rounded-[11px] bg-black/45">
            <EqBars accent="#fff" on h={14} />
          </span>
        )}
      </span>

      <span className="block min-w-0 flex-1">
        {/* dug naziv se smanji i stane cio */}
        <span className="block overflow-hidden whitespace-nowrap text-[13.5px] font-semibold uppercase leading-none tracking-[0.16em]" style={{ color: BRAND.gold }}>
          <FitLines cacheKey={`ts|${verse.song}`}>
            <span>{verse.song}</span>
          </FitLines>
        </span>
        <span className="mt-2 block truncate text-[10.5px] uppercase leading-none tracking-[0.2em] text-white/65">{albumLine(verse)}</span>
      </span>

      {/* pusti — YouTube znak */}
      <span className="flex h-11 w-11 shrink-0 items-center justify-center transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
        <YouTubeLogo width={36} style={{ filter: 'drop-shadow(0 6px 14px rgba(255,0,51,0.4))' }} />
      </span>
    </button>
  )
  return card
}
