'use client'

import LISTEN from '@/data/listen.json'
import { albumOf } from '@/data/albums'
import type { Verse } from '@/data/verses'
import { haptic } from '@/lib/haptic'
import { audioSlug } from '@/lib/text'
import { pauseTube, watchUrl } from '@/lib/youtube'

/*
 * Gdje se pjesma sluša — linkovi sa dinomerlin.com (Muzika → izdanje →
 * "Poslušaj na", data/listen.json, scripts/listen-links.ts): izdanje na
 * kojem je pjesma na Spotifyju, Apple Musicu, Deezeru i Amazonu, a YouTube je
 * baš ovaj video. Pjesma koje nema u fajlu ide na pretragu platforme.
 *
 * Znakovi su zvanični (Simple Icons, CC0; Deezer iz verzije 9 — novije ga nemaju;
 * Amazon Music je Amazonov znak — znak Amazon Musica je natpis, ne stane u red ikonica).
 */

type Key = 'youtube' | 'spotify' | 'apple' | 'deezer' | 'amazon'
type Release = { t: string; y: number; k: string } & Partial<Record<Key, string>>
const DATA = LISTEN as { releases: Record<string, Release>; songs: Record<string, string[]> }

/** kao lib/dino-site.ts `songKey` — bez kvačica, razmaka i interpunkcije */
const keyOf = (s: string) => audioSlug(s.replace(/[ðÐ]/g, 'đ')).replace(/-/g, '')
const bare = (s: string) => s.replace(/\s*\([^)]*\)/g, ' ')

/** izdanje pjesme: ono s albuma stiha, inače prvo (singl istog naziva, pa album) */
function releaseOf(v: Verse): Release | null {
  const ids = DATA.songs[keyOf(v.song)] ?? DATA.songs[keyOf(bare(v.song))]
  if (!ids?.length) return null
  const album = albumOf(v.album)?.title ?? v.album
  const own = album ? ids.find((id) => keyOf(bare(DATA.releases[id].t)) === keyOf(bare(album))) : undefined
  return DATA.releases[own ?? ids[0]] ?? null
}

const SEARCH: Record<Exclude<Key, 'youtube'>, (q: string) => string> = {
  spotify: (q) => `https://open.spotify.com/search/${q}`,
  apple: (q) => `https://music.apple.com/search?term=${q}`,
  deezer: (q) => `https://www.deezer.com/search/${q}`,
  amazon: (q) => `https://music.amazon.com/search/${q}`,
}

/** naziv i zvanični znak (24×24) */
const BRANDS: Record<Key, { name: string; path: string }> = {
  youtube: { name: 'YouTube', path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
  spotify: { name: 'Spotify', path: 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z' },
  apple: { name: 'Apple Music', path: 'M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.045-1.773-.6-1.943-1.536a1.88 1.88 0 011.038-2.022c.323-.16.67-.25 1.018-.324.378-.082.758-.153 1.134-.24.274-.063.457-.23.51-.516a.904.904 0 00.02-.193c0-1.815 0-3.63-.002-5.443a.725.725 0 00-.026-.185c-.04-.15-.15-.243-.304-.234-.16.01-.318.035-.475.066-.76.15-1.52.303-2.28.456l-2.325.47-1.374.278c-.016.003-.032.01-.048.013-.277.077-.377.203-.39.49-.002.042 0 .086 0 .13-.002 2.602 0 5.204-.003 7.805 0 .42-.047.836-.215 1.227-.278.64-.77 1.04-1.434 1.233-.35.1-.71.16-1.075.172-.96.036-1.755-.6-1.92-1.544-.14-.812.23-1.685 1.154-2.075.357-.15.73-.232 1.108-.31.287-.06.575-.116.86-.177.383-.083.583-.323.6-.714v-.15c0-2.96 0-5.922.002-8.882 0-.123.013-.25.042-.37.07-.285.273-.448.546-.518.255-.066.515-.112.774-.165.733-.15 1.466-.296 2.2-.444l2.27-.46c.67-.134 1.34-.27 2.01-.403.22-.043.442-.088.663-.106.31-.025.523.17.554.482.008.073.012.148.012.223.002 1.91.002 3.822 0 5.732z' },
  deezer: { name: 'Deezer', path: 'M18.81 4.16v3.03H24V4.16h-5.19zM6.27 8.38v3.027h5.189V8.38h-5.19zm12.54 0v3.027H24V8.38h-5.19zM6.27 12.594v3.027h5.189v-3.027h-5.19zm6.271 0v3.027h5.19v-3.027h-5.19zm6.27 0v3.027H24v-3.027h-5.19zM0 16.81v3.029h5.19v-3.03H0zm6.27 0v3.029h5.189v-3.03h-5.19zm6.271 0v3.029h5.19v-3.03h-5.19zm6.27 0v3.029H24v-3.03h-5.19Z' },
  amazon: { name: 'Amazon Music', path: 'M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.1.293-.13.226-.088.39-.046.525.13.12.174.09.336-.12.48-.256.19-.6.41-1.006.654-1.244.743-2.64 1.316-4.185 1.726a17.617 17.617 0 01-10.951-.577 17.88 17.88 0 01-5.43-3.35c-.1-.074-.151-.15-.151-.22 0-.047.021-.09.051-.13zm6.565-6.218c0-1.005.247-1.863.743-2.577.495-.71 1.17-1.25 2.04-1.615.796-.335 1.756-.575 2.912-.72.39-.046 1.033-.103 1.92-.174v-.37c0-.93-.105-1.558-.3-1.875-.302-.43-.78-.65-1.44-.65h-.182c-.48.046-.896.196-1.246.46-.35.27-.575.63-.675 1.096-.06.3-.206.465-.435.51l-2.52-.315c-.248-.06-.372-.18-.372-.39 0-.046.007-.09.022-.15.247-1.29.855-2.25 1.82-2.88.976-.616 2.1-.975 3.39-1.05h.54c1.65 0 2.957.434 3.888 1.29.135.15.27.3.405.48.12.165.224.314.283.45.075.134.15.33.195.57.06.254.105.42.135.51.03.104.062.3.076.615.01.313.02.493.02.553v5.28c0 .376.06.72.165 1.036.105.313.21.54.315.674l.51.674c.09.136.136.256.136.36 0 .12-.06.226-.18.314-1.2 1.05-1.86 1.62-1.963 1.71-.165.135-.375.15-.63.045a6.062 6.062 0 01-.526-.496l-.31-.347a9.391 9.391 0 01-.317-.42l-.3-.435c-.81.886-1.603 1.44-2.4 1.665-.494.15-1.093.227-1.83.227-1.11 0-2.04-.343-2.76-1.034-.72-.69-1.08-1.665-1.08-2.94l-.05-.076zm3.753-.438c0 .566.14 1.02.425 1.364.285.34.675.512 1.155.512.045 0 .106-.007.195-.02.09-.016.134-.023.166-.023.614-.16 1.08-.553 1.424-1.178.165-.28.285-.58.36-.91.09-.32.12-.59.135-.8.015-.195.015-.54.015-1.005v-.54c-.84 0-1.484.06-1.92.18-1.275.36-1.92 1.17-1.92 2.43l-.035-.02zm9.162 7.027c.03-.06.075-.11.132-.17.362-.243.714-.41 1.05-.5a8.094 8.094 0 011.612-.24c.14-.012.28 0 .41.03.65.06 1.05.168 1.172.33.063.09.099.228.099.39v.15c0 .51-.149 1.11-.424 1.8-.278.69-.664 1.248-1.156 1.68-.073.06-.14.09-.197.09-.03 0-.06 0-.09-.012-.09-.044-.107-.12-.064-.24.54-1.26.806-2.143.806-2.64 0-.15-.03-.27-.087-.344-.145-.166-.55-.257-1.224-.257-.243 0-.533.016-.87.046-.363.045-.7.09-1 .135-.09 0-.148-.014-.18-.044-.03-.03-.036-.047-.02-.077 0-.017.006-.03.02-.063v-.06z' },
}
const ORDER: Key[] = ['youtube', 'spotify', 'apple', 'deezer', 'amazon']

/** Linkovi pjesme, redom; `sub`: gdje vodi (izdanje sa sajta, službeni video ili pretraga). */
export function listenLinks(v: Verse, videoId: string): { key: Key; href: string; sub: string }[] {
  const r = releaseOf(v)
  const q = encodeURIComponent(`Dino Merlin ${bare(v.song).trim()}`)
  const release = r ? `${r.t}${r.y ? ` · ${r.y}` : ''}` : ''
  return ORDER.map((key) => {
    if (key === 'youtube') return { key, href: watchUrl(videoId), sub: 'Službeni video' }
    const own = r?.[key]
    return { key, href: own ?? SEARCH[key](q), sub: own ? release : 'Pretraga' }
  })
}

/**
 * Podnožje ladice pjesme: "Slušaj na" tankim velikim slovima, a ispod
 * zvanični znakovi platformi u nizu, tiho (bijeli), pod prstom puni.
 * Odlaskom pjesma ovdje stane (da ne sviraju obje).
 */
export function ListenFooter({ verse, videoId }: { verse: Verse; videoId: string }) {
  return (
    <nav aria-label="Slušaj na" className="flex flex-col items-center">
      {/* razmak slova i s lijeva — natpis stoji tačno na sredini */}
      <p className="pl-[0.4em] text-[10px] font-light uppercase leading-none tracking-[0.4em] text-white/60" aria-hidden>
        Slušaj na
      </p>
      <div className="mt-1.5 flex items-center justify-center gap-1">
        {listenLinks(verse, videoId).map(({ key, href }) => {
          const b = BRANDS[key]
          return (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                haptic(5)
                pauseTube()
              }}
              aria-label={`${b.name} — ${verse.song}`}
              title={b.name}
              className="flex h-11 w-[52px] items-center justify-center rounded-full text-white/70 transition-[color,transform,background] duration-200 hover:bg-white/[0.06] hover:text-white active:scale-90"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d={b.path} />
              </svg>
            </a>
          )
        })}
      </div>
    </nav>
  )
}
