/**
 * Službeni kanali Dine Merlina (adrese preuzete sa dinomerlin.com).
 * Ikone su obrisne i prigušene — diskretno, isto na telefonu i računaru.
 * Prezentacija (deck/Screens) crta iste putanje u `em`.
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

export function ArtistLinks() {
  return (
    <nav
      aria-label="Dino Merlin na mreži"
      // samo ikonice — tanke, prigušene, bez okvira; dodir 40 px; isto na telefonu i računaru
      className="relative z-10 flex flex-nowrap justify-center gap-2 sm:gap-3"
    >
      {ARTIST_LINKS.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${l.label}: ${l.handle}`}
          title={l.handle}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/40 transition-colors duration-300 hover:text-white/80 active:text-white/80"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px] shrink-0" aria-hidden>
            <path d={l.d} />
          </svg>
        </a>
      ))}
    </nav>
  )
}
