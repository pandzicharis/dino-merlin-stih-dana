/**
 * Službeni kanali Dine Merlina (adrese preuzete sa dinomerlin.com).
 * Ikone su obrisne, istog poteza kao ostale u zaglavlju — tiho, u boji
 * raspoloženja. Prezentacija (deck/Screens) crta iste putanje u `em`.
 */
export const ARTIST_LINKS = [
  {
    label: 'dinomerlin.com',
    handle: 'dinomerlin.com',
    verified: false,
    href: 'https://dinomerlin.com',
    d: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3 12h18M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9s1.2-6.4 3.6-9z',
  },
  {
    label: 'Instagram',
    handle: '@dinomerlin',
    verified: true,
    href: 'https://www.instagram.com/dinomerlin/',
    d: 'M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3zM12 8.2a3.8 3.8 0 1 0 0 7.6a3.8 3.8 0 1 0 0-7.6zM17.2 6.8h.01',
  },
  {
    label: 'Spotify',
    handle: 'Dino Merlin',
    verified: true,
    href: 'https://open.spotify.com/artist/7BjXGqrW02WB9cnLKKzwrK',
    d: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM7.4 9.5c3.1-1 6.5-.7 9.2.8M7.9 12.5c2.5-.7 5.2-.5 7.4.7M8.5 15.4c2-.5 3.9-.3 5.6.5',
  },
  {
    label: 'YouTube',
    handle: 'Dino Merlin',
    verified: true,
    href: 'https://www.youtube.com/user/DinoMerlinOfficial',
    d: 'M4.7 5.9c2-.4 4.6-.6 7.3-.6s5.3.2 7.3.6c1 .2 1.7 1 1.9 2 .2 1.3.3 2.7.3 4.1s-.1 2.8-.3 4.1c-.2 1-.9 1.8-1.9 2-2 .4-4.6.6-7.3.6s-5.3-.2-7.3-.6c-1-.2-1.7-1-1.9-2-.2-1.3-.3-2.7-.3-4.1s.1-2.8.3-4.1c.2-1 .9-1.8 1.9-2zM10.2 9.3v5.4l4.6-2.7z',
  },
] as const

/** Značka provjerenog profila — nazubljeni krug s kvačicom. */
export const VERIFIED_D =
  'M22.5 12.5c0-1.58-.88-2.95-2.15-3.6.15-.44.24-.9.24-1.4 0-2.21-1.71-4-3.82-4-.47 0-.92.08-1.34.25C14.82 2.42 13.51 1.5 12 1.5s-2.82.92-3.44 2.25c-.41-.17-.87-.25-1.33-.25-2.11 0-3.82 1.79-3.82 4 0 .49.08.96.24 1.4-1.27.65-2.15 2.02-2.15 3.6 0 1.5.78 2.8 1.94 3.49-.02.17-.03.34-.03.51 0 2.21 1.71 4 3.82 4 .47 0 .92-.09 1.33-.25.62 1.33 1.93 2.25 3.44 2.25s2.82-.92 3.44-2.25c.41.16.86.25 1.34.25 2.11 0 3.82-1.79 3.82-4 0-.17-.01-.34-.03-.51 1.16-.69 1.94-1.99 1.94-3.49z'
export const VERIFIED_CHECK = 'M8.3 12.4l2.5 2.5 4.9-5.4'
export const VERIFIED_BLUE = '#3897F0'

/**
 * Red pilula je ~37.7 em plus okviri (ikona · ime · značka, plus razmaci),
 * pa veličina slova prati širinu ekrana: sve stane u jedan red, a na širem
 * ekranu raste do 11 px. Sve mjere su u `em`, pa se skalira cijela pilula.
 */
export const LINKS_FIT = 37.8

export function ArtistLinks({ accent }: { accent: string }) {
  return (
    <nav
      aria-label="Dino Merlin na mreži"
      // telefon: samo ikonice — tanke, prigušene, bez okvira (dodir i dalje 40 px);
      // šire (sm+): pilule s imenom i značkom
      className="relative z-10 flex flex-nowrap justify-center gap-2 font-medium whitespace-nowrap sm:-mx-1 sm:gap-[0.25em]"
      style={{ fontSize: `clamp(7px, calc((100vw - 50px) / ${LINKS_FIT}), 11px)` }}
    >
      {ARTIST_LINKS.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${l.label}: ${l.handle}`}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/40 transition-colors duration-300 hover:text-white/80 active:text-white/80 sm:h-[2.7em] sm:w-auto sm:gap-[0.25em] sm:border sm:border-white/[0.14] sm:bg-white/[0.03] sm:px-[0.5em] sm:text-white/85 sm:backdrop-blur-sm sm:hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[17px] w-[17px] shrink-0 sm:h-[1em] sm:w-[1em] sm:[stroke:var(--accent)]"
            style={{ '--accent': accent } as React.CSSProperties}
            aria-hidden
          >
            <path d={l.d} />
          </svg>
          <span className="hidden sm:inline">{l.handle}</span>
          {l.verified && (
            <svg viewBox="0 0 24 24" className="hidden h-[1em] w-[1em] shrink-0 sm:block" aria-hidden>
              <path d={VERIFIED_D} fill={VERIFIED_BLUE} />
              <path d={VERIFIED_CHECK} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </a>
      ))}
    </nav>
  )
}
