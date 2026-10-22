'use client'

import { useEffect, useMemo, useState } from 'react'
import { MAGAZA_BESIDE, MAGAZA_DROP_CSS, MAGAZA_RATIO } from '@/lib/brand'
import { motion, useIsPresent } from 'motion/react'
import { MOODS } from '@/data/moods'
import { albumOf, ALBUMS, blurOf, glowOf, thumbOf } from '@/data/albums'
import { SEND_TIME } from '@/lib/date'
import { playable } from '@/lib/player'
import { DECK_VERSE } from '@/lib/deck'
import { useDeck } from './context'
import { TIPS_ON } from '../Tips'
import { Grafike, LANSIRANJE, LaunchPlan, Ostalo, PwaNative, Video } from './launch'
import { QrCode } from './QrCode'
import {
  Dot,
  ActionChip,
  Acts,
  Bullets,
  FeatureSlide,
  Ico,
  R,
  Text,
} from './ui'
import type { Verse } from '@/data/verses'
import type { DeckData, FeatureDef, SlideDef } from './types'

/**
 * Redoslijed i sadržaj prezentacije. Tekst je ovdje, na jednom mjestu —
 * slajd se mijenja ili premješta bez diranja mehanike u Deck.tsx.
 *
 * Aplikacija je mala, pa je i slajdova malo: funkcionalnosti su lista
 * unutar tri "živa" slajda, svaka sa svojim opisom.
 */

/* ── funkcionalnosti — telefon ─────────────────────────────── */

const STIH: FeatureDef[] = [
  {
    id: 'instalacija',
    title: 'PWA app — bez storea',
    enter: (_, frame) => (frame === 'galaxy' ? '/?uvod=android' : '/?uvod=ios'),
    script: 'install',
    body: () => <Instalacija />,
  },
  {
    id: 'dozvola',
    title: 'Dozvola za obavijesti',
    enter: '/?uvod=dozvola',
    script: 'permission',
    body: () => <Dozvola />,
  },
  // savjeti su za sada isključeni u aplikaciji (Tips.tsx) — korak se vraća s njima
  ...(TIPS_ON
    ? [
        {
          id: 'savjeti',
          title: 'Savjeti pri prvom otvaranju',
          enter: '/',
          body: () => <Savjeti />,
        },
      ]
    : []),
  {
    // podne: obavijest → dodir → aplikacija → vrtlog papirića; telefon se ne
    // učitava ponovo, izvlačenje pokrene poruka (prelaz između koraka ne zastaje)
    id: 'obavijest',
    title: 'Vrijeme je za stih dana',
    body: (d) => <Obavijest d={d} />,
  },
  {
    id: 'albumi',
    title: 'Podržano svih 12 albuma',
    // /pregled mijenja stih porukom, bez ponovnog učitavanja — pozadina se pretapa
    enter: '/pregled',
    body: (d) => <Albumi d={d} />,
  },
  {
    id: 'atmosfera',
    title: 'Atmosfera po raspoloženju',
    enter: '/pregled',
    body: (d) => <Atmosfera d={d} />,
  },
  {
    id: 'sacuvano',
    title: 'Sačuvaj stih',
    body: () => <Sacuvano />,
  },
  {
    id: 'slusanje',
    title: 'Poslušaj pjesmu',
    enter: '/',
    body: () => <Slusanje />,
  },
  {
    // sačuvani kao plejer na početnoj: svaka pjesma donese svoj stih
    id: 'plejer',
    title: 'Player pjesama',
    enter: '/',
    body: () => <Plejer />,
  },
  {
    id: 'dijeljenje',
    title: 'Podijeli kao sliku',
    body: () => <Dijeljenje />,
  },
]

const UZ_STIH: FeatureDef[] = [
  {
    id: 'azuriranje',
    title: 'Nova verzija stiže sama',
    enter: '/',
    body: () => <Azuriranje />,
  },
  {
    // postavke → "Podijeli aplikaciju": QR kod aplikacije, skenira se kamerom
    id: 'qr',
    title: 'Podijeli aplikaciju',
    enter: '/',
    body: () => <PodijeliApp />,
  },
  {
    id: 'link',
    title: 'Link koji izgleda kao poster',
    // bez svoje adrese: chat prekriva ekran, pa se naprijed/nazad ništa ne
    // učitava iznova — stih s linka se otvori tek na dodir kartice
    body: () => <LinkPreview />,
  },
]

/* ── funkcionalnosti — računar ─────────────────────────────── */

const UREDNIK: FeatureDef[] = [
  {
    id: 'pristup',
    title: 'Pristup jednom šifrom',
    // ?prijava: ekran za prijavu i kad je prezenter već prijavljen
    enter: '/admin?prijava',
    body: () => <Pristup />,
  },
  {
    id: 'biblioteka',
    title: 'Lista stihova',
    // poslije prijave admin je na /admin — ne vraćati na ekran za prijavu
    enter: '/admin',
    body: () => <Biblioteka />,
  },
  {
    id: 'novi',
    title: 'Novi stih uz živi pregled',
    // poslije prijave admin je na /admin — ne vraćati na ekran za prijavu
    enter: '/admin',
    body: () => <NoviStih />,
  },
  {
    id: 'dizajn',
    title: 'Dizajn stiha, red po red',
    enter: '/admin',
    body: () => <Dizajn />,
  },
  {
    id: 'stampa',
    title: 'Papirići za pult',
    enter: '/admin',
    body: () => <Stampa />,
  },
]

/* ── priča: zašto Stih dana ─────────────────────────────────── */

/**
 * Stih s ovog slajda (Individualizam) nije u katalogu — telefon ga prikaže kroz /pregled,
 * pravi ekran aplikacije koji stih prima porukom (isto kao pregled u adminu).
 */
const STIH_PRICE: Verse = {
  id: 'ptica-u-letu',
  text: 'U jednom sigurno možeš\nbiti najbolji na svijetu\nbudi to što jesi',
  song: 'Individualizam',
  album: 'Ispočetka',
  year: 2008,
  mood: 'sloboda',
  youtube: 'https://www.youtube.com/watch?v=aO3fvcqI4vE',
}

/** Priča — sve rečenice se vide odmah, ulaze jedna za drugom. */
const PRICA: FeatureDef[] = [
  { id: 'magaza', title: 'Kad god prođem pored Magaze, uzmem stih dana.', body: () => null },
  { id: 'inspiracija', title: 'Ti stihovi su me pratili od studentskih dana do posla kojim se danas bavim.', body: () => null },
  { id: 'snaga', title: 'Mnogo puta su mi bili motiv da izguram najteže dane i najteže zadatke.', body: () => null },
  { id: 'kod', title: 'Zato sam s njima uradio ono što najbolje znam — pretočio ih u kod.', body: () => null },
  {
    id: 'autenticnost',
    title: 'Jer danas, kad je oko nas sve više vještačkog, upravo nas autentičnost drži budnim.',
    body: () => null,
  },
]

export const SLIDES: SlideDef[] = [
  { id: 'uvod', section: 'Uvod', title: 'Stih dana', backdrop: 'nostalgija', body: () => <Intro /> },
  { id: 'o-meni', section: 'Uvod', title: 'O meni', mode: 'site', body: () => <OMeni /> },
  {
    id: 'ideja',
    section: 'Uvod',
    title: 'Zašto Stih dana?',
    mode: 'phone',
    enter: '/pregled',
    preview: STIH_PRICE,
    body: () => <Ideja />,
  },
  {
    id: 'stih',
    section: 'Aplikacija',
    title: 'Stih dana',
    mode: 'phone',
    // dolaskom na slajd telefon mirno stoji na aplikaciji; demo kreće na strelicu
    intro: true,
    enter: '/',
    features: STIH,
    body: (d) => (
      <FeatureSlide
        d={d}
        features={STIH}
        eyebrow={<>Aplikacija</>}
        title={
          <>
            Jedan stih, <em>preko cijelog ekrana</em>
          </>
        }
      />
    ),
  },
  {
    id: 'uz-stih',
    section: 'Aplikacija',
    title: 'Uz stih',
    mode: 'phone',
    // kao "Stih dana": prvo pregled koraka, nova verzija tek na strelicu
    intro: true,
    enter: '/',
    features: UZ_STIH,
    body: (d) => (
      <FeatureSlide
        d={d}
        features={UZ_STIH}
        eyebrow={<>Aplikacija</>}
        title={
          <>
            Dijeli se lako, <em>verzija sama stiže</em>
          </>
        }
      />
    ),
  },
  {
    id: 'urednik',
    section: 'Aplikacija',
    title: 'Urednički panel',
    mode: 'desktop',
    // prvo pregled i miran ekran za prijavu; na strelicu sve krene odmah
    intro: true,
    enter: '/admin?prijava',
    features: UREDNIK,
    body: (d) => (
      <FeatureSlide
        d={d}
        features={UREDNIK}
        eyebrow={<>Urednički panel</>}
        title={
          <>
            Magaza <em>ima kontrolu</em>
          </>
        }
      />
    ),
  },
  { id: 'pwa', section: 'Plan za launch', title: 'PWA ili prava mobilna aplikacija', body: () => <PwaNative /> },
  {
    id: 'launch',
    section: 'Plan za launch',
    title: 'Plan za launch',
    // koraci (izlog → objava → kapacitet) idu strelicom; slika desno prati korak
    features: LANSIRANJE,
    center: true,
    body: (d) => <LaunchPlan d={d} />,
  },
  { id: 'ostalo', section: 'Plan za launch', title: 'Šta je ostalo?', body: (d) => <Ostalo d={d} /> },
  { id: 'grafike', section: 'Plan za launch', title: 'Grafike', body: (d) => <Grafike d={d} /> },
  { id: 'video', section: 'Plan za launch', title: 'Video za mreže', body: () => <Video /> },
  { id: 'pitanja', section: 'Pitanja', title: 'Pitanja', backdrop: 'nada', body: (d) => <Pitanja d={d} /> },
]

/* ═══════════════════════════════════════════════════════════════
   UVOD I IDEJA
   ═══════════════════════════════════════════════════════════════ */

/** Ime, logo i web — na prvom i zadnjem slajdu. */
const SOCIALS: { label: string; href: string; handle: string; icon: React.ReactNode }[] = [
  {
    label: 'LinkedIn',
    handle: 'Haris Pandžić',
    href: 'https://www.linkedin.com/in/haris-pand%C5%BEi%C4%87-3680951ab/',
    icon: (
      <path d="M4.5 3A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 19.5 3zM8 18H5.5v-8H8zM6.8 8.9a1.4 1.4 0 1 1 0-2.9 1.4 1.4 0 0 1 0 2.9zM18.5 18H16v-3.9c0-1-.1-2.2-1.4-2.2s-1.6 1-1.6 2.1v4H10.5v-8h2.4v1.1c.4-.7 1.2-1.3 2.4-1.3 2.6 0 3.2 1.7 3.2 3.9z" />
    ),
  },
  {
    label: 'Instagram',
    handle: '@_harispandzic',
    href: 'https://www.instagram.com/_harispandzic/',
    icon: (
      <path
        fillRule="evenodd"
        d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.3-3.3a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"
      />
    ),
  },
]

/** Ime, web i dvije mreže — na naslovnoj i na zadnjem slajdu. */
function Presenter() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
    <div className="flex items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/haris-logo.png"
        alt="Haris Pandžić"
        className="h-[clamp(40px,5.2vh,56px)] w-auto rounded-[8px] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      />
      <div>
        <p className="dk-h3">Haris Pandžić</p>
        <a
          href="https://harispandzic.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="dk-small mt-0.5 block text-[#BFA87F] underline-offset-4 hover:underline"
        >
          harispandzic.dev
        </a>
      </div>
    </div>
      {/* LinkedIn, Instagram */}
      <div className="flex flex-wrap items-center gap-2">
        {SOCIALS.map((x) => (
          <a
            key={x.label}
            href={x.href}
            target="_blank"
            rel="noopener noreferrer"
            title={`${x.label} · ${x.handle}`}
            className="dk-chip !h-[2.3em] !gap-[0.5em] !px-[0.9em]"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden>
              {x.icon}
            </svg>
            {x.label === 'Instagram' ? x.handle : x.label}
          </a>
        ))}
      </div>
    </div>
  )
}

/** Potpis | Magaza, krupno — naslovna i zadnji slajd, isto. */
function Lockup() {
  return (
    <div className="flex items-center gap-[clamp(18px,2.2vw,40px)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/signature.webp?v=2" alt="Dino Merlin" style={{ height: 'clamp(64px, 12vh, 140px)', width: 'auto' }} />
      <span className="block w-px bg-white/25" style={{ height: 'clamp(40px, 7vh, 84px)' }} />
      <span
        role="img"
        aria-label="Magaza"
        className="block"
        style={{
          // isti odnos prema potpisu kao svugdje (lib/brand.ts)
          height: `clamp(${64 * MAGAZA_BESIDE}px, ${12 * MAGAZA_BESIDE}vh, ${140 * MAGAZA_BESIDE}px)`,
          aspectRatio: MAGAZA_RATIO,
          transform: MAGAZA_DROP_CSS,
          background: 'rgba(255,255,255,0.92)',
          mask: 'url(/brand/magaza.svg?v=2) left center / contain no-repeat',
          WebkitMask: 'url(/brand/magaza.svg?v=2) left center / contain no-repeat',
        }}
      />
    </div>
  )
}

function Intro() {
  return (
    <div className="max-w-[min(64vw,980px)]">
      {/* potpis i Magaza jedan do drugog, ulaze kao i sve ostalo — u donjoj
          traci ih na naslovnoj nema */}
      <R i={1}>
        <Lockup />
      </R>
      <R i={3}>
        <h1 className="dk-h1 mt-[5.5vh]">
          Stih <em>dana</em>
        </h1>
      </R>
      <R i={4}>
        <p className="dk-lead mt-[2.6vh]">Jedan stih Dine Merlina, svaki dan u {SEND_TIME}.</p>
      </R>
      <R i={5}>
        <div className="mt-[5.5vh]">
          <Presenter />
        </div>
      </R>
      <R i={6}>
        <ol className="mt-[5.5vh] flex flex-wrap gap-x-7 gap-y-2">
          {['Uvod', 'Ideja', 'Aplikacija', 'Plan za launch', 'Pitanja'].map((t, k) => (
            <li key={t} className="dk-small flex items-center gap-2.5 text-white/60">
              <span className="dk-num">{k + 1}</span>
              {t}
            </li>
          ))}
        </ol>
      </R>
    </div>
  )
}

/**
 * Ko sam i čime se bavim — kratko, kao na harispandzic.dev.
 * Desno je portfolio uživo — stalni okvir u Deck.tsx (mode: 'site').
 */
function OMeni() {
  const industries = ['Ljudski resursi', 'Automobilska industrija', 'Fitnes', 'Sport', 'Obrazovanje', 'Platforme za kreatore']
  return (
    <div>
      <div>
        <R i={0}>
          <div className="flex items-center gap-5">
            <span className="relative">
              <span
                className="absolute -inset-6 rounded-full blur-2xl"
                style={{ background: 'radial-gradient(circle, rgba(242,220,80,0.35), transparent 70%)' }}
                aria-hidden
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/haris-logo.png"
                alt="HP"
                className="relative h-[clamp(56px,9vh,96px)] w-auto rounded-[22%] shadow-[0_14px_40px_rgba(0,0,0,0.45)]"
              />
            </span>
            <div>
              <p className="dk-eyebrow">O meni</p>
              <h2 className="dk-h2 mt-1">Haris Pandžić</h2>
            </div>
          </div>
        </R>
        <R i={1}>
          <p className="dk-eyebrow mt-[3.6vh] flex flex-wrap items-center gap-x-3 gap-y-1 text-white/70">
            <span>Sarajevo</span>
            <span className="h-3 w-px bg-white/25" />
            <span>Software engineer</span>
          </p>
        </R>
        <R i={2}>
          <p className="dk-lead mt-[1.6vh] max-w-[26em]">5 godina iskustva u razvoju softverskih proizvoda.</p>
          <p className="dk-small mt-[1vh]">Inženjer informacijskih tehnologija · FIT Mostar</p>
        </R>
        <R i={3}>
          <div className="mt-[3.4vh]">
            <p className="dk-eyebrow mb-2.5 opacity-80">Industrije</p>
            <div className="flex max-w-[34em] flex-wrap gap-2">
              {industries.map((t) => (
                <span key={t} className="dk-chip">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </R>
        <R i={4}>
          <a href="https://harispandzic.dev" target="_blank" rel="noopener noreferrer" className="dk-btn-gold mt-[3.6vh]">
            harispandzic.dev {Ico.external}
          </a>
        </R>
      </div>
    </div>
  )
}

function Ideja() {
  return (
    <div>
      <R i={0}>
        <p className="dk-eyebrow">Ideja</p>
      </R>
      <R i={1}>
        <h2 className="dk-h2 mt-[1.6vh]">
          Zašto <em>Stih dana</em>?
        </h2>
      </R>
      <div className="mt-[4vh] flex max-w-[30em] flex-col gap-[2.2vh]">
        {PRICA.map((b, k) => (
          <R key={b.id} i={2 + k}>
            <p className="dk-lead flex gap-4" style={k === PRICA.length - 1 ? { color: '#FBF6EC' } : undefined}>
              <Dot />
              <span>{b.title}</span>
            </p>
          </R>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   APLIKACIJA — dijelovi opisa koji trebaju aplikaciju
   ═══════════════════════════════════════════════════════════════ */

/** Korak 1: link ili QR → uputstvo → „Pogledaj kako“. Telefon to odigra sam, iPhone pa Android. */
function Instalacija() {
  return (
    <>
      <Text>
        Kad se skenira QR kod ili otvori link, aplikacija se otvori s uputstvom za instalaciju. Na iPhoneu dva koraka
        kroz Safari, uz animaciju „Pogledaj kako“. Na Androidu samo jedno dugme — „Dodaj na početni ekran“ — i
        Chromeova potvrda. Stih dana je zatim na početnom ekranu, kao svaka druga aplikacija.
      </Text>
    </>
  )
}

/** Korak 2: s početnog ekrana → aplikacija traži dozvolu → sistemski prozor. */
function Dozvola() {
  return (
    <>
      <Text>
        Prvo otvaranje s početnog ekrana traži samo jedno: dozvolu za obavijesti. Prozor je sistemski — isti kao kod
        svake aplikacije iz storea, na iPhoneu i na Androidu.
      </Text>
      <Bullets
        items={[
          'Bez dozvole aplikacija ne pušta dalje — stih koji sam dolazi joj je cijela svrha.',
          'Ako se dozvola odbije, aplikacija pokaže put kroz Postavke.',
          'Odmah zatim: gomila papirića kao na pultu Magaze — iz nje se izvuče tvoj prvi stih i postane digitalni.',
        ]}
      />
    </>
  )
}

/**
 * Raspoloženja se smjenjuju na telefonu dok je korak otvoren — kroz /pregled,
 * koji stih prima porukom: nema ponovnog učitavanja, pa nema ni treptaja;
 * pozadina se lagano pretopi, a stih se ispiše iznova. Ručno: bira se karticom.
 */
function Atmosfera({ d }: { d: DeckData }) {
  const { phone, manual } = useDeck()
  useWarmCovers(useMemo(() => d.moods.map((m) => m.verse), [d.moods]))
  const [k, setK] = useState(0)
  const [round, setRound] = useState(0)

  // pošalji stih telefonu — odmah, i kad god /pregled javi da je spreman
  useEffect(() => {
    const send = () =>
      phone()?.contentWindow?.postMessage(
        { type: 'stihdana:preview', verse: d.moods[k].verse, date: d.today },
        window.location.origin,
      )
    send()
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === 'stihdana:preview-ready') send()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [k, d, phone])

  useEffect(() => {
    if (manual) return
    const t = setInterval(() => setK((i) => (i + 1) % d.moods.length), 3000)
    return () => clearInterval(t)
  }, [manual, d.moods.length, round])

  return (
    <>
      <Text>
        Raspoloženje stiha boji cijeli ekran: svjetlo koje pluta, note koje se dižu, zrno filma. Nikad dvije večeri
        isti osjećaj.
      </Text>
      <Bullets
        items={[
          <>
            <b>Svaka pjesma nosi svoj album</b> — omot je u pozadini, utopljen u ton raspoloženja, pa se mijenja zajedno
            s njim.
          </>,
        ]}
      />
      <div className="mt-[1.8vh] grid max-w-[34em] grid-cols-2 gap-2 xl:grid-cols-4">
        {d.moods.map(({ mood, verse }) => (
          <MoodCard
            key={mood}
            mood={mood}
            song={verse.song}
            cover={albumOf(verse.album)?.cover}
            on={d.moods[k]?.mood === mood}
            onPick={() => {
              setK(d.moods.findIndex((x) => x.mood === mood))
              setRound((r) => r + 1)
            }}
          />
        ))}
      </div>
    </>
  )
}

/**
 * Omoti koje telefon na slajdu smjenjuje — preuzmu se i dekodiraju unaprijed,
 * pa smjena ne čeka mrežu ni dekodiranje (isto porijeklo: telefon ih uzme iz keša).
 */
function useWarmCovers(verses: Verse[]) {
  useEffect(() => {
    const urls = new Set<string>()
    for (const v of verses) {
      const cover = albumOf(v.album)?.cover
      if (!cover) continue
      urls.add(cover)
      for (const u of [blurOf(cover, 56 / (844 * 1.3)), glowOf(cover)]) if (u) urls.add(u)
    }
    urls.forEach((src) => {
      const img = new Image()
      img.src = src
      img.decode().catch(() => {})
    })
  }, [verses])
}

/** Svih 12 albuma: telefon ih smjenjuje (isti stih, njegov album u pozadini), ispod nazivi 6 + 6. */
function Albumi({ d }: { d: DeckData }) {
  const { phone, manual } = useDeck()
  useWarmCovers(useMemo(() => d.albums.map((a) => a.verse), [d.albums]))
  const [k, setK] = useState(0)
  const [round, setRound] = useState(0)

  useEffect(() => {
    const send = () =>
      phone()?.contentWindow?.postMessage({ type: 'stihdana:preview', verse: d.albums[k].verse, date: d.today }, window.location.origin)
    send()
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === 'stihdana:preview-ready') send()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [k, d, phone])

  useEffect(() => {
    if (manual) return
    const t = setInterval(() => setK((i) => (i + 1) % d.albums.length), 3000)
    return () => clearInterval(t)
  }, [manual, d.albums.length, round])

  return (
    <>
      <Text>Svaki stih nosi album svoje pjesme — omot je u pozadini ekrana, od Kokuznih vremena do albuma Mi.</Text>
      <div className="mt-[1.8vh] grid max-w-[40em] grid-cols-6 gap-2">
        {d.albums.map(({ album }, i) => {
          const a = albumOf(album)
          const on = i === k
          return (
            <motion.button
              key={album}
              type="button"
              onClick={() => {
                setK(i)
                setRound((r) => r + 1)
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-col items-center gap-1.5 rounded-[12px] border p-1.5 text-center transition-colors"
              style={{ borderColor: on ? 'rgba(241,226,191,0.6)' : 'rgba(255,255,255,0.1)', background: on ? 'rgba(255,255,255,0.06)' : 'transparent' }}
              aria-pressed={on}
            >
              <span
                className="block aspect-square w-full rounded-[8px] bg-cover bg-center"
                style={{ backgroundImage: a ? `url(${thumbOf(a.cover) ?? a.cover})` : undefined, opacity: on ? 1 : 0.7 }}
                aria-hidden
              />
              <span className="line-clamp-2 text-[0.62em] leading-tight text-white/80">{album}</span>
            </motion.button>
          )
        })}
      </div>
    </>
  )
}

/** Telefon pokaže gdje se dodirne. */
/**
 * Čisto stanje aplikacije u telefonu: bez sačuvanih stihova, bez zapamćenog
 * formata slike i prikaza sačuvanih (karte), obavijesti uključene. Prezentacija i aplikacija dijele
 * localStorage (ista adresa), a upis odavde aplikaciji stigne kao `storage`
 * događaj — pa se njen ekran odmah osvježi, bez ponovnog učitavanja.
 */
export function cleanSlate() {
  try {
    localStorage.setItem('stihdana:favorites', '[]')
    localStorage.removeItem('stihdana:share')
    localStorage.setItem('stihdana:notify', 'true')
  } catch {
    /* privatni prozor */
  }
}

/**
 * Poslije koraka "Sačuvaj stih" stih prezentacije ostaje sačuvan na svim
 * narednim koracima — i kad prezenter preskoči čuvanje (Ručno, skok na korak).
 * Telefon dijeli localStorage s prezentacijom, pa se "Sačuvano" i brojač
 * gore odmah pokažu (događaj `storage`).
 */
function useKeepSaved() {
  useEffect(() => {
    try {
      const list: unknown = JSON.parse(localStorage.getItem('stihdana:favorites') || '[]')
      const ids = Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
      if (!ids.includes(DECK_VERSE)) localStorage.setItem('stihdana:favorites', JSON.stringify([DECK_VERSE, ...ids]))
    } catch {
      /* privatni prozor */
    }
  }, [])
}

type Scene = {
  wait: (ms: number) => Promise<void>
  /** element u aplikaciji, tek kad je stvarno vidljiv */
  find: (sel: string, max?: number) => Promise<HTMLElement | null>
  /** dodir iznad elementa, pa pravi klik */
  press: (target: string | HTMLElement) => Promise<boolean>
  /** sačekaj da je telefon na početnoj stranici aplikacije, učitan */
  home: () => Promise<boolean>
  /** prevuci karte sačuvanih za `n` (minus — nazad), kao prstom */
  swipe: (n: number) => Promise<boolean>
  /** ukucaj tekst u polje, slovo po slovo (tastatura se vrati prezentaciji) */
  type: (sel: string, text: string, speed?: number) => Promise<boolean>
  alive: () => boolean
}

/**
 * Korak koji sam odigra radnju u aplikaciji na telefonu. Odlaskom s koraka
 * otvoreni prozor (sačuvani, dijeljenje) se zatvori, da sljedeći krene čist.
 */
function useScene(run: (s: Scene) => Promise<void>, always = false) {
  const { phone, tapAt, manual } = useDeck()
  // korak se gasi (izlazna animacija) — scena staje odmah, ne tek kad nestane,
  // da ne dira ono što je sljedeći korak već pokrenuo
  const present = useIsPresent()
  useEffect(() => {
    if (!present) return
    let alive = true
    const timers: number[] = []
    const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)))
    const q = (sel: string) => {
      try {
        return phone()?.contentDocument?.querySelector<HTMLElement>(sel) ?? null
      } catch {
        return null
      }
    }
    const shown = (el: HTMLElement) => {
      const win = el.ownerDocument.defaultView
      if (!win || !el.getBoundingClientRect().width) return false
      let o = 1
      for (let n: HTMLElement | null = el; n; n = n.parentElement) o *= Number(win.getComputedStyle(n).opacity)
      return o > 0.9
    }
    const find = async (sel: string, max = 8000) => {
      const t0 = Date.now()
      while (alive && Date.now() - t0 < max) {
        const el = q(sel)
        if (el && shown(el)) return el
        await wait(120)
      }
      return null
    }
    const press = async (target: string | HTMLElement) => {
      const el = typeof target === 'string' ? await find(target) : target
      if (!el || !alive) return false
      const r = el.getBoundingClientRect()
      tapAt(r.left + r.width / 2, r.top + r.height / 2)
      await wait(260)
      if (!alive) return false
      el.click()
      await wait(380)
      return true
    }
    const swipe = async (n: number) => {
      const el = await find('[aria-roledescription="carousel"]')
      if (!el || !alive) return false
      const cards = el.querySelectorAll<HTMLElement>('[data-card]')
      const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 0
      if (!step) return false
      // dodir gdje prst kreće, pa traka klizi (pravi skrol sa zaustavljanjem na karti)
      const r = el.getBoundingClientRect()
      tapAt(r.left + r.width * (n > 0 ? 0.72 : 0.28), r.top + r.height * 0.45)
      el.scrollBy({ left: step * n, behavior: 'smooth' })
      await wait(1000)
      return alive
    }
    const type = async (sel: string, text: string, speed = 110) => {
      const e = (await find(sel)) as HTMLInputElement | null
      if (!e || !alive) return false
      const win = e.ownerDocument.defaultView as Window & typeof globalThis
      const set = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')!.set!
      const chars = Array.from(text)
      for (let i = 1; i <= chars.length && alive; i++) {
        set.call(e, chars.slice(0, i).join(''))
        e.dispatchEvent(new win.Event('input', { bubbles: true }))
        await wait(speed + Math.random() * speed * 0.5)
      }
      // tastatura nazad prezentaciji — inače polje pojede strelice
      e.blur()
      window.focus()
      return alive
    }
    // prozor koji je ostao otvoren s prošlog koraka
    const home = async () => {
      for (let t = 0; t < 80 && alive; t++) {
        try {
          const w = phone()?.contentWindow
          if (w && w.location.pathname === '/' && !w.location.search && w.document.readyState === 'complete') return true
        } catch {
          /* tuđa adresa */
        }
        await wait(150)
      }
      return false
    }
    // svaki korak kreće ispočetka: raširena karta se skupi, plejer pjesama se
    // zatvori DO KRAJA (×, ne spusti u mini), ostali paneli dolje, muzika stane
    const close = () => {
      try {
        const w = phone()?.contentWindow as (Window & typeof globalThis) | null | undefined
        if (q('[data-full]')) w?.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }))
        const x = q('[aria-label="Zatvori plejer"]')
        if (x) x.click()
        else if (q('[role="dialog"][aria-modal="true"]')) q('button[aria-label="Zatvori"]')?.click()
        w?.dispatchEvent(new w.Event('stihdana:stop-audio'))
      } catch {
        /* tuđa adresa */
      }
    }
    close()
    // Ručno: prezenter sam klikće po telefonu
    if (!manual || always) void run({ wait, find, press, home, swipe, type, alive: () => alive })
    return () => {
      alive = false
      timers.forEach(clearTimeout)
      close()
    }
    // scena se igra jednom po ulasku na korak (i ispočetka kad se promijeni Auto/Ručno)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual, present])
}

/** Savjeti iz aplikacije: ekran se zatamni, u fokusu je jedno dugme. Auto ih lista sam, Ručno klikom. */
function Savjeti() {
  const { manual } = useDeck()
  // savjeti se pokažu i u ručnom modu — listaš ih ti
  return (
    <>
      <Text>
        Odmah nakon dozvole, kratki savjeti preko pravog ekrana: ostatak se zatamni, a u fokusu je jedno dugme i
        rečenica o njemu. Pokažu se samo jednom — a na kraju stiže prva obavijest, dobrodošlica.
      </Text>
      <SavjetiScene key={manual ? 'ručno' : 'auto'} manual={manual} />
    </>
  )
}

function SavjetiScene({ manual }: { manual: boolean }) {
  const { phone } = useDeck()
  useScene(async ({ wait, find, press, alive }) => {
    // telefon tek dolazi na stih — savjeti kreću kad je zaglavlje na ekranu
    let win: Window | null = null
    for (let t = 0; t < 80 && alive() && !win; t++) {
      try {
        const w = phone()?.contentWindow
        if (w && w.location.pathname === '/' && !w.location.search && w.document.readyState === 'complete') win = w
      } catch {
        /* tuđa adresa */
      }
      if (!win) await wait(150)
    }
    if (!win || !(await find('[data-tip="notify"]')) || !alive()) return
    cleanSlate()
    await wait(600)
    win.dispatchEvent(new (win as Window & typeof globalThis).Event('stihdana:tips'))
    if (manual) return
    for (let i = 0; i < 6 && alive(); i++) {
      const next = await find('[data-deck="tip-next"]', 5000)
      if (!next) return
      await wait(3000)
      if (!alive()) return
      await press(next)
      await wait(400)
    }
  }, true)
  return null
}

/* ── admin na računaru: scene s kursorom ─────────────────────── */

type DeskScene = {
  wait: (ms: number) => Promise<void>
  /** element u adminu, tek kad je vidljiv */
  find: (sel: string, max?: number) => Promise<HTMLElement | null>
  all: (sel: string) => HTMLElement[]
  /** kursor dođe do elementa i klikne */
  click: (target: string | HTMLElement) => Promise<boolean>
  /** klik u polje, pa kucanje slovo po slovo */
  type: (target: string | HTMLElement, text: string, speed?: number) => Promise<boolean>
  /** isprazni polje (kao da je obrisano) */
  clear: (target: string | HTMLElement) => void
  /** izbor s padajuće liste */
  choose: (target: string, value: string) => Promise<boolean>
  alive: () => boolean
}

/**
 * Korak koji sam radi u adminu na računaru. Kursor (strelica miša) je nacrtan
 * u samom adminu, pa prati sve što se tamo dešava. Ručno: ništa se ne radi samo.
 */
function useDeskScene(run: (s: DeskScene) => Promise<void>) {
  const { desk, manual } = useDeck()
  useEffect(() => {
    if (manual) return
    let alive = true
    const timers: number[] = []
    const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)))
    const doc = () => {
      try {
        const w = desk()?.contentWindow
        return w && w.location.pathname === '/admin' && w.document.readyState === 'complete' ? w.document : null
      } catch {
        return null
      }
    }
    const q = (sel: string) => doc()?.querySelector<HTMLElement>(sel) ?? null
    const all = (sel: string) => Array.from(doc()?.querySelectorAll<HTMLElement>(sel) ?? [])
    const shown = (el: HTMLElement) => {
      const win = el.ownerDocument.defaultView
      if (!win || !el.getBoundingClientRect().width) return false
      let o = 1
      for (let n: HTMLElement | null = el; n; n = n.parentElement) o *= Number(win.getComputedStyle(n).opacity)
      return o > 0.9
    }
    const find = async (sel: string, max = 10000) => {
      const t0 = Date.now()
      while (alive && Date.now() - t0 < max) {
        const el = q(sel)
        if (el && shown(el)) return el
        await wait(120)
      }
      return null
    }

    // sve što scena doda u admin — skloni se kad se ode s koraka
    const added = new Set<HTMLElement>()
    const keep = <T extends HTMLElement>(e: T) => {
      added.add(e)
      return e
    }
    // kursor: strelica miša, u adminu
    let cursor: HTMLElement | null = null
    let at = { x: 0, y: 0 }
    const pointer = () => {
      const d = doc()
      if (!d) return null
      if (cursor && cursor.ownerDocument === d && cursor.isConnected) return cursor
      cursor = d.createElement('div')
      cursor.setAttribute('aria-hidden', 'true')
      at = { x: d.documentElement.clientWidth * 0.62, y: d.documentElement.clientHeight * 0.8 }
      cursor.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(${at.x}px,${at.y}px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))`
      cursor.innerHTML =
        '<svg width="20" height="24" viewBox="0 0 20 24"><path d="M2 1.5v18l4.6-4.3 3 6.8 3-1.3-3-6.6H16z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>'
      d.body.appendChild(keep(cursor))
      return cursor
    }
    const move = async (x: number, y: number, ms = 650) => {
      const c = pointer()
      if (!c) return
      c.animate([{ transform: `translate(${at.x}px,${at.y}px)` }, { transform: `translate(${x}px,${y}px)` }], {
        duration: ms,
        easing: 'cubic-bezier(.22,1,.36,1)',
        fill: 'forwards',
      })
      at = { x, y }
      await wait(ms)
    }
    const ripple = (x: number, y: number) => {
      const d = doc()
      if (!d) return
      const r = d.createElement('div')
      r.style.cssText = `position:fixed;left:${x - 14}px;top:${y - 14}px;width:28px;height:28px;border-radius:50%;background:rgba(191,168,127,.45);z-index:2147483646;pointer-events:none`
      d.body.appendChild(keep(r))
      r.animate([{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.4)', opacity: 0 }], { duration: 450, easing: 'ease-out' }).onfinish = () => r.remove()
    }
    const el = async (t: string | HTMLElement) => (typeof t === 'string' ? await find(t) : t)
    const center = (e: HTMLElement) => {
      const r = e.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    // element stoji na mjestu — skrol i animacije su gotovi (najviše ~1 s)
    const settle = async (e: HTMLElement) => {
      let prev = e.getBoundingClientRect()
      for (let i = 0; i < 16 && alive; i++) {
        await wait(60)
        const r = e.getBoundingClientRect()
        if (Math.abs(r.top - prev.top) < 0.5 && Math.abs(r.left - prev.left) < 0.5) return
        prev = r
      }
    }
    const click = async (t: string | HTMLElement) => {
      const e = await el(t)
      if (!e || !alive) return false
      e.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      await wait(120)
      await settle(e)
      const c = center(e)
      await move(c.x, c.y)
      if (!alive) return false
      // pomjerio se dok je kursor putovao — kursor ga dostigne prije dodira
      const c2 = center(e)
      if (Math.hypot(c2.x - c.x, c2.y - c.y) > 3) await move(c2.x, c2.y, 220)
      if (!alive) return false
      ripple(c.x, c.y)
      await wait(90)
      e.click()
      await wait(300)
      return true
    }
    const setValue = (e: HTMLElement, v: string) => {
      const win = e.ownerDocument.defaultView as Window & typeof globalThis
      const proto = e.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(e, v)
      e.dispatchEvent(new win.Event('input', { bubbles: true }))
    }
    const type = async (t: string | HTMLElement, text: string, speed = 55) => {
      const e = await el(t)
      if (!e || !(await click(e))) return false
      e.focus()
      const chars = Array.from(text)
      for (let i = 1; i <= chars.length && alive; i++) {
        setValue(e, chars.slice(0, i).join(''))
        await wait(speed + Math.random() * speed * 0.6)
      }
      // tastatura nazad prezentaciji — inače polje pojede strelice
      e.blur()
      window.focus()
      return alive
    }
    const clear = (t: string | HTMLElement) => {
      const e = typeof t === 'string' ? q(t) : t
      if (e) setValue(e, '')
    }
    const choose = async (t: string, value: string) => {
      const e = await find(t)
      if (!e || !(await click(e))) return false
      const win = e.ownerDocument.defaultView as Window & typeof globalThis
      await wait(350)
      Object.getOwnPropertyDescriptor(win.HTMLSelectElement.prototype, 'value')!.set!.call(e, value)
      e.dispatchEvent(new win.Event('change', { bubbles: true }))
      e.blur()
      window.focus()
      return alive
    }
    ;(async () => {
      // admin mora biti otvoren (poslije prijave)
      for (let t = 0; t < 100 && alive && !doc(); t++) await wait(150)
      if (!alive || !doc()) return
      // svaki korak kreće od čistog admina, ma gdje stao prethodni: bez
      // otvorenog prozora, pretrage, filtera, arhive, na prvoj stranici
      if (q('[role="dialog"]')) {
        q('button[aria-label="Zatvori"]')?.click()
        for (let t = 0; t < 15 && alive && q('[role="dialog"]'); t++) await wait(80)
      }
      const search = q('[data-search]') as HTMLInputElement | null
      if (search?.value) setValue(search, '')
      all('[data-filter][aria-pressed="true"], [data-song-filter][aria-pressed="true"]').forEach((f) => f.click())
      if (q('[data-scope="archive"]')?.style.color.includes('20, 16, 10')) q('[data-scope="active"]')?.click()
      q('[data-page="1"]')?.click()
      if (!alive) return
      await run({ wait, find, all, click, type, clear, choose, alive: () => alive })
    })()
    return () => {
      alive = false
      timers.forEach(clearTimeout)
      added.forEach((e) => e.remove())
    }
  }, [desk, manual])
}

/** Biblioteka: pretraga, filter po raspoloženju, arhiva. */
function Biblioteka() {
  useDeskScene(async ({ wait, find, click, type, clear, alive }) => {
    // pravi ekran odmah na ulasku: lista stihova, bez starih filtera
    const search = await find('[data-search]')
    if (!search) return
    clear(search)
    ;(await find('[data-scope="active"]', 1500))?.click()
    await wait(1100)
    // pretraga po riječi iz stiha ili naziva pjesme
    await type('[data-search]', 'ljubav', 90)
    await wait(1800)
    if (!alive()) return
    clear('[data-search]')
    await wait(500)
    await type('[data-search]', 'Svila', 90)
    await wait(1800)
    if (!alive()) return
    clear('[data-search]')
    await wait(700)
    // filter po raspoloženju
    await click('[data-filter="nostalgija"]')
    await wait(1800)
    await click('[data-filter="nostalgija"]')
    await wait(700)
    if (!alive()) return
    // filter po pjesmi: stihovi čija je pjesma u aplikaciji (♪)
    if (await click('[data-song-filter="with"]')) {
      await wait(1600)
      await click('[data-song-filter="with"]')
      await wait(700)
    }
    // stranice: po 10 stihova
    if (await click('[data-page-next]')) {
      await wait(1600)
      await click('[data-page="1"]')
      await wait(900)
    }
    if (!alive()) return
    // arhiva: stih se više ne izvlači, a linkovi i sačuvani rade
    await click('[data-scope="archive"]')
    await wait(1900)
    await click('[data-scope="active"]')
  })
  return (
    <>
      <Text>
        Svi aktivni stihovi su špil iz kojeg svako izvlači svoj — nema kalendara ni rasporeda za održavanje. Pretraga,
        filter po raspoloženju i po pjesmi (s njom ili bez nje) i stranice po 10.
      </Text>
      <Bullets
        items={[
          'Arhiviran stih se više ne izvlači, a linkovi i sačuvani i dalje rade.',
          <><b>Uz svaku pjesmu ♪</b> — pjesma je u aplikaciji i pušta se odmah; dok se nova preuzima, tu piše.</>,
        ]}
      />
    </>
  )
}

/**
 * Novi stih: forma se popuni sama — poznata pjesma donese link, album i
 * godinu — a pregled se mijenja dok se kuca, telefon i računar.
 */
function NoviStih() {
  useDeskScene(async ({ wait, find, click, type, choose, alive }) => {
    // forma za novi stih otvorena odmah na ulasku
    const add = await find('[data-new]')
    if (!add) return
    add.click()
    await find('textarea[name="text"]')
    await wait(900)
    await type('textarea[name="text"]', VOLIM_TE, 60)
    await wait(500)
    // pjesma s liste postojećih: par slova, pa izbor — link, album i godina se popune sami
    await type('input[name="song"]', 'U kan', 90)
    await wait(700)
    const option = await find('[data-song-option="u-kandzama-jastreba"]', 1500)
    if (option) await click(option)
    else await type('input[name="song"]', 'U kandžama jastreba', 55)
    await wait(1600)
    if (!alive()) return
    const yt = (await find('input[name="youtube"]', 1500)) as HTMLInputElement | null
    if (yt && !yt.value) {
      // pjesme još nema u listi — kuca se kao prvi put
      await choose('select[name="album"]', 'Kokuzna vremena')
      await wait(700)
      await type('input[name="youtube"]', 'https://www.youtube.com/watch?v=kquGKS-qhn8', 18)
    }
    await wait(400)
    await click('[data-edit-mood="ljubav"]')
    await wait(1000)
    if (!alive()) return
    // gotov stil jednim klikom — sve ostalo je na sljedećem koraku
    await click('[data-edit-preset="romantika"]')
    await wait(1600)
    if (!alive()) return
    // pregled: računar, pa nazad telefon
    await click('[data-device="desktop"]')
    await wait(2600)
    await click('[data-device="phone"]')
    await wait(1600)
    if (!alive()) return
    await click('form button[type="submit"]')
  })
  return (
    <>
      <Text>
        Tekst, pjesma, album, godina, raspoloženje, YouTube. Pjesma se bira s liste postojećih — link, album i godina
        se popune sami, pjesma se može odmah pustiti, a olovkom urediti (naziv i fajl). Pored je pravi ekran
        aplikacije, na telefonu ili računaru. Stih stoji tačno kako je upisan.
      </Text>
      <Bullets
        items={[
          <><b>Nova pjesma se preuzme sama</b> — samo ako je još nema, jednom, i ostaje za sve njene stihove.</>,
          <><b>Novi stih je u špilu odmah</b> — izvlači se od sutra, a posjetioci i dalje dobijaju brzu, gotovu stranicu.</>,
        ]}
      />
    </>
  )
}

/** Stih za "Novi stih" i "Dizajn" — u tri reda, kako se pjeva. */
const VOLIM_TE = 'Kad sve saberem\npodijelim i oduzmem\nVolim te'

/**
 * Dizajn: otvori se "Kad sve saberem…" u tri reda, gotovi stilovi, pa red
 * po red — font, velika slova, ukoso, boja koju aplikacija predloži iz
 * pozadine — i prored cijelog stiha. Ništa se ne čuva: prozor ostaje otvoren
 * dok se ne ode s koraka.
 */
function Dizajn() {
  useDeskScene(async ({ wait, find, all, click, clear, alive }) => {
    await find('[data-new]')
    // lista kao na početku — prezenter je možda prošao "Listu stihova" usred
    // filtera; čeka se samo ako je zaista nešto vraćeno
    const search = all('[data-search]')[0] as HTMLInputElement | undefined
    const filters = all('[data-filter][aria-pressed="true"]')
    const archive = all('[data-scope="archive"]').find((b) => b.style.color.includes('20, 16, 10'))
    if (search?.value) clear(search)
    filters.forEach((f) => f.click())
    if (archive) all('[data-scope="active"]')[0]?.click()
    if (search?.value || filters.length || archive) await wait(250)
    // isti stih kao na prošlom koraku (iz iste pjesme, s njenim omotom) —
    // otvara se odmah, bez puta kursora, da pregled bude tu čim se uđe u korak
    const edits = all('button[aria-label="Uredi"]')
    const row = (b: HTMLElement) => b.parentElement?.parentElement?.textContent ?? ''
    const pick = edits.find((b) => row(b).includes('Kad sve saberem')) ?? edits[0]
    if (!pick || !alive()) return
    pick.click()
    const text = (await find('textarea[name="text"]')) as HTMLTextAreaElement | null
    if (!text || !alive()) return
    // tačno tri reda — bez kucanja, korak je o dizajnu
    if (text.value !== VOLIM_TE) {
      const win = text.ownerDocument.defaultView as Window & typeof globalThis
      Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, 'value')!.set!.call(text, VOLIM_TE)
      text.dispatchEvent(new win.Event('input', { bubbles: true }))
    }
    await find('[data-edit-line="2"]')
    await wait(700)
    if (!alive()) return
    // gotovi stilovi
    await click('[data-edit-preset="romantika"]')
    await wait(1400)
    await click('[data-edit-preset="kontrast"]')
    await wait(1400)
    if (!alive()) return
    // korak nazad (Romantika) pa naprijed (Kontrast)
    await click('[data-undo]')
    await wait(1100)
    await click('[data-redo]')
    await wait(1000)
    if (!alive()) return
    // 1. i 2. red zajedno (kvačice — više redova odjednom): Bodoni
    await click('[data-edit-line="1"]')
    await wait(500)
    await click('[data-edit-font="bodoni"]')
    await wait(900)
    if (!alive()) return
    // samo 1. red: velikim slovima
    await click('[data-edit-line="1"]')
    await wait(400)
    await click('[data-edit-upper]')
    await wait(900)
    if (!alive()) return
    // samo 2. red: ukoso
    await click('[data-edit-line="1"]')
    await wait(300)
    await click('[data-edit-line="0"]')
    await wait(400)
    await click('[data-edit-i]')
    await wait(900)
    if (!alive()) return
    // samo 3. red: pisani, u bojama koje aplikacija predloži iz pozadine
    await click('[data-edit-line="2"]')
    await wait(300)
    await click('[data-edit-line="1"]')
    await wait(400)
    await click('[data-edit-font="allura"]')
    await wait(800)
    for (const sw of all('[data-edit-color]').filter((e) => e.dataset.editColor !== 'none').slice(0, 2)) {
      await click(sw)
      await wait(1000)
      if (!alive()) return
    }
    await wait(1400)
    if (!alive()) return
    // isti izgled i na računaru
    await click('[data-device="desktop"]')
    await wait(2600)
    await click('[data-device="phone"]')
  })
  return (
    <>
      <Text>
        Gotovi stilovi slože stih jednim klikom, a onda red po red — ili više redova odjednom: 17 fontova (klasični,
        moderni, pisani), debljina, ukoso, velika slova, veličina i boja.
      </Text>
      <Bullets
        items={[
          <><b>Boju predlaže aplikacija</b> — iz pozadine stiha, raspoloženja i omota albuma, uvijek čitljivu na njoj.</>,
          <><b>Isti izgled svuda</b> — na ekranu stiha, u slikama za dijeljenje i u pregledu linka.</>,
          <><b>Korak nazad i naprijed</b> — svaka izmjena u formi se može poništiti i vratiti (⌘Z / ⇧⌘Z).</>,
        ]}
      />
    </>
  )
}

/**
 * Štampa papirića: modal se otvori, stihovi se biraju jedan po jedan, list se
 * popuni, pa "Štampaj / PDF" (u prezentaciji samo poruka — bez pravog prozora).
 */
function Stampa() {
  useDeskScene(async ({ wait, find, click, all, alive }) => {
    if (!(await find('[data-print]'))) return
    await wait(500)
    await click('[data-print]')
    if (!(await find('[data-print-pick]'))) return
    await wait(900)
    // prvo bez ponavljanja — vidi se kako papirići sjedaju jedan po jedan
    await click('[data-print-fill]')
    await wait(500)
    for (const el of all('[data-print-pick]').slice(0, 5)) {
      if (!alive()) return
      await click(el)
      await wait(450)
    }
    await wait(700)
    // pa "popuni list" — 45 papirića, spremno za rezanje
    await click('[data-print-fill]')
    await wait(2200)
    if (!alive()) return
    await click('[data-print-go]')
  })
  return (
    <>
      <Text>
        Papirići na pultu ispred Magaze, iz iste liste stihova. Izabereš stihove, a admin složi A4 sa 45 papirića od
        5,3 × 1,7 cm — crno na papir u boji, pa se samo izreže po linijama.
      </Text>
      <Bullets
        items={[<><b>PDF ili pravo na printer</b> — bez prepisivanja i bez dizajnera; list se popuni i ponavljanjem.</>]}
      />
    </>
  )
}

/**
 * Prijava u admin: prava šifra se ukuca slovo po slovo (na ekranu samo
 * tačkice), pa "Uđi" — i zaista prijavi, i na live i lokalno.
 */
function Pristup() {
  const { desk, manual } = useDeck()
  useEffect(() => {
    if (manual) return
    let alive = true
    const timers: number[] = []
    const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)))
    ;(async () => {
      // okvir zna promijeniti stranicu (/admin → /admin?prijava) dok se čeka —
      // tad se polje traži ponovo, inače bi se kucalo u dokument kojeg više nema
      let form: HTMLFormElement | null = null
      let input: HTMLInputElement | null | undefined = null
      let button: HTMLButtonElement | null | undefined = null
      for (let attempt = 0; attempt < 4 && alive; attempt++) {
        form = null
        for (let t = 0; t < 80 && alive && !form; t++) {
          try {
            const w = desk()?.contentWindow
            if (w && w.location.pathname === '/admin' && w.document.readyState === 'complete')
              // ekran za prijavu (`?prijava`) — šifra se ukuca i prijava prođe
              form = w.document.querySelector<HTMLFormElement>('form')
          } catch {
            /* tuđa adresa */
          }
          if (!form) await wait(150)
        }
        input = form?.querySelector<HTMLInputElement>('input[type="password"]')
        button = form?.querySelector<HTMLButtonElement>('button[type="submit"]')
        if (!form || !input || !button || !alive) return
        await wait(900)
        if (input.isConnected && input.ownerDocument.defaultView) break
      }
      if (!input?.isConnected || !button || !alive) return
      // React prati vrijednost polja — upis ide kroz izvorni setter + input događaj
      const win = input.ownerDocument.defaultView as Window & typeof globalThis
      const set = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')!.set!
      input.focus()
      const word = 'dinomerlin'
      for (let i = 1; i <= word.length && alive; i++) {
        set.call(input, word.slice(0, i))
        input.dispatchEvent(new win.Event('input', { bubbles: true }))
        await wait(110 + Math.random() * 70)
      }
      await wait(650)
      if (!alive) return
      button.focus()
      await wait(250)
      if (alive) button.click()
      // tastatura nazad prezentaciji — strelice inače pojede polje
      await wait(300)
      ;(input.ownerDocument.activeElement as HTMLElement | null)?.blur?.()
      window.focus()
    })()
    return () => {
      alive = false
      timers.forEach(clearTimeout)
    }
  }, [desk, manual])
  return (
    <>
      <Text>
        Na /admin urednik uređuje listu stihova — bez programera i bez čekanja. Jedna šifra, a prijava traje 30
        dana.
      </Text>
      <Bullets items={[<><b>Preporuka: računar.</b> Radi i na telefonu.</>]} />
    </>
  )
}

/** Stih se sačuva, broj u zaglavlju otvori sačuvane: karte jedna do druge, raširena karta. */
function Sacuvano() {
  const { os, setOs, manual, both } = useDeck()
  return (
    <>
      {/* scena po sistemu: kad iPhone završi, ista ide na Androidu (prekidač ide s njom) */}
      <SacuvanoScene key={os} onDone={() => os === 'ios' && !manual && both && setOs('android')} />
      <Text>
        „Sačuvaj“ ispod stiha, a gore se pojavi ikonica plejera s brojem — dodir otvara Player pjesama: sačuvani
        stihovi kao karte jedna do druge, svaka s danom kad je sačuvana, pjesmom i albumom. Prevuci za sljedeći —
        glatko kao listanje fotografija; raširi kartu i stih je preko cijelog ekrana — povuci je nadolje i vrati se
        među karte. Bez naloga i prijave: sve ostaje na telefonu.
      </Text>
    </>
  )
}

function SacuvanoScene({ onDone }: { onDone: () => void }) {
  // na ulasku (i na drugom sistemu) ništa nije sačuvano — i u Ručno. Sačuvano
  // odavde dalje ostaje kroz sve naredne korake; briše se tek ispočetka.
  useEffect(() => cleanSlate(), [])
  const { phone } = useDeck()
  useScene(async ({ wait, find, press, home, swipe, alive }) => {
    if (!(await home())) return
    await wait(300)
    const save = await find('[data-tip="save"]')
    if (!save || !alive()) return
    await wait(500)
    // prvo se vidi dodir na "Sačuvaj stih"...
    await press(save)
    // ...pa gore iskoči ikonica s brojem, i ona se dodirne
    await find('[data-tip="saved"]', 3000)
    await wait(1300)
    // i par ranije sačuvanih — da se u sačuvanima ima šta listati
    await seedSaved(phone()?.contentWindow, 4)
    await wait(400)
    if (alive()) await press('[data-tip="saved"]')
    // karte jedna do druge: prevuci par naprijed, pa jednu nazad
    await wait(1800)
    if (alive()) await swipe(1)
    await wait(500)
    if (alive()) await swipe(1)
    await wait(500)
    if (alive()) await swipe(-1)
    // "Raširi" — stih preko cijelog ekrana, kao na početnoj; "Skupi" ga
    // vrati među karte — pa isto na drugom sistemu
    await wait(900)
    if (alive()) await press('[aria-label="Raširi"]')
    await wait(3400)
    if (alive()) await press('[data-full] [aria-label="Skupi"]')
    await wait(2000)
    if (alive()) onDone()
  })
  return null
}

/**
 * Player pjesama: sačuvani stihovi su plejer — karte, pjesme, albumi, omiljene;
 * spušten pluta na početnoj kao mini plejer.
 */
function Plejer() {
  const { os, setOs, manual, both, phone } = useDeck()
  useKeepSaved()
  // odlaskom s koraka muzika stane (i sačuvani na početnoj) — odmah, ne tek kad nestane
  const present = useIsPresent()
  useEffect(() => {
    if (!present) return
    return () => {
      try {
        const w = phone()?.contentWindow as (Window & typeof globalThis) | null | undefined
        w?.dispatchEvent(new w.Event('stihdana:stop-audio'))
      } catch {
        /* tuđa adresa */
      }
    }
  }, [phone, present])
  return (
    <>
      <PlejerScene key={os} onDone={() => os === 'ios' && !manual && both && setOs('android')} />
      <Text>
        Sačuvani su plejer: ikonica gore otvara Player pjesama — stihovi kao karte, pjesme sa cijelim stihom,
        albumi i omiljene (zvjezdica, redom koliko se slušaju), a lupa gore traži pjesmu po nazivu ili stihu. Plejer
        je u boji stiha, kontrole kao u Apple Musicu,
        a naprijed i natrag idu kroz album ili omiljene u kojima si. Spusti ga — na početnoj pluta mini plejer,
        muzika ide dalje, a na zaključanom ekranu je omot albuma koji svira.
      </Text>
    </>
  )
}

/** Uz sačuvane doda još `n` s pjesmom — da plejer ima šta listati. */
async function seedSaved(win: Window | null | undefined, n = 4) {
  if (!win) return
  try {
    const all = (await fetch('/api/verses').then((r) => r.json())) as Verse[]
    const have: string[] = JSON.parse(win.localStorage.getItem('stihdana:favorites') || '[]')
    const more = all.filter((v) => v.youtube && playable(v) && !have.includes(v.id)).slice(0, n).map((v) => v.id)
    win.localStorage.setItem('stihdana:favorites', JSON.stringify([...have, ...more]))
    win.dispatchEvent(new Event('favchange'))
  } catch {
    /* bez liste — svira ono što je sačuvano */
  }
}

function PlejerScene({ onDone }: { onDone: () => void }) {
  const { phone } = useDeck()
  useScene(async ({ wait, press, home, swipe, type, find, alive }) => {
    if (!(await home())) return
    await seedSaved(phone()?.contentWindow, 5)
    await wait(900)
    // ikonica plejera gore — otvara se Player pjesama (karte stihova)
    if (alive()) await press('[data-tip="saved"]')
    await wait(1600)
    // prvo se prelista špil — plejer ispod pokazuje pjesmu karte na sredini
    if (alive()) await swipe(1)
    await wait(500)
    if (alive()) await swipe(1)
    await wait(700)
    // pusti pa sljedeća — karte klize za pjesmom
    if (alive()) await press('[data-player] [aria-label="Pusti"]')
    await wait(2600)
    if (alive()) await press('[data-player] [aria-label="Sljedeća"]')
    await wait(2400)
    // pjesme (cijeli stih), zvjezdica — u omiljene, albumi
    if (alive()) await press('[data-view="list"]')
    await wait(1600)
    // zvjezdica u listi (karte je više nemaju)
    if (alive()) await press('[data-pane="list"] [aria-label="Dodaj u omiljene"]')
    await wait(1200)
    if (alive()) await press('[data-view="albums"]')
    await wait(2200)
    if (alive()) await press('[data-view="loved"]')
    await wait(1800)
    // pretraga: lupa gore, par slova naziva pjesme, pusti pogodak, × zatvori
    if (alive()) {
      await press('button[aria-label="Traži pjesmu"]')
      await wait(500)
      // pjesma iz liste koja ne svira — da se vidi da pogodak zasvira
      const rows = [...((await find('[data-pane="list"]', 1500))?.querySelectorAll('li:not([data-now="true"]) [aria-current] > .min-w-0 > span:first-child') ?? [])]
      const song = rows[2]?.textContent?.trim() || rows[0]?.textContent?.trim() || 'Svila'
      await type('input[aria-label="Traži pjesmu"]', song.slice(0, 5).toLocaleLowerCase('bs'))
      await wait(1300)
      if (alive()) await press('[data-pane="list"] li [aria-current]')
      await wait(2400)
      if (alive()) await press('[aria-label="Zatvori pretragu"]')
      await wait(1000)
    }
    if (alive()) await press('[data-view="cards"]')
    await wait(1200)
    // spusti — na početnoj pluta mini plejer, muzika ide dalje
    if (alive()) await press('[aria-label="Spusti"]')
    await wait(2600)
    if (alive()) await press('[aria-label="Otvori plejer pjesama"] [aria-label="Sljedeća"]')
    await wait(2400)
    if (alive()) onDone()
  })
  return null
}

/** Dijeljenje: formati jedan za drugim, pa dugme za preuzimanje slike. */
function Dijeljenje() {
  const { tapAt } = useDeck()
  useKeepSaved()
  useEffect(() => {
    try {
      localStorage.removeItem('stihdana:share')
    } catch {
      /* privatni prozor */
    }
  }, [])
  useScene(async ({ wait, find, press, home, alive }) => {
    if (!(await home())) return
    await wait(300)
    if (!(await press('[data-tip="share"]'))) return
    await wait(1400)
    for (const f of ['post', 'square', 'pozadina', 'story']) {
      if (!alive()) return
      await press(`[data-format="${f}"]`)
      await wait(1300)
    }
    // preuzimanje se samo pokaže — klik bi skinuo sliku na računar prezentera
    const save = await find('[data-tip="download"]')
    if (save && alive()) {
      const r = save.getBoundingClientRect()
      tapAt(r.left + r.width / 2, r.top + r.height / 2)
    }
  })
  return (
    <>
      <Text>
        Story 9:16, objava 4:5, kvadrat ili pozadina za zaključan ekran — istim fontovima i bojama kao na ekranu.
        Slika ide pravo u Instagram, WhatsApp ili Viber, ili se preuzme na telefon. Crta se na samom telefonu, odmah.
      </Text>
      <Bullets
        items={[
          <>Diskretan potpis aplikacije na slici: <b>svako dijeljenje je preporuka.</b></>,
          <><b>Pozadina:</b> stih ostaje na zaključanom ekranu cijeli dan — sat i obavijesti na čistom.</>,
          <><b>Video:</b> story se složi pred očima — potpis, dan i pjesma, pa stih riječ po riječ.</>,
        ]}
      />
    </>
  )
}

/** Pjesma krene sama — dugme u aplikaciji se zaista pritisne; odlaskom s koraka stane. */
function Slusanje() {
  const { phone, manual } = useDeck()
  useKeepSaved()
  const present = useIsPresent()
  useEffect(() => {
    if (!present) return
    let alive = !manual // Ručno: pjesmu pušta prezenter — ali i tad stane na odlasku
    let t = 0
    const btn = () => {
      try {
        return phone()?.contentDocument?.querySelector<HTMLButtonElement>('[data-deck="play"]') ?? null
      } catch {
        return null
      }
    }
    const play = (n: number) => {
      if (!alive) return
      const b = btn()
      if (b && b.dataset.state !== 'playing' && b.dataset.state !== 'loading') b.click()
      else if (!b && n < 40) t = window.setTimeout(() => play(n + 1), 150)
    }
    t = window.setTimeout(() => play(0), 700)
    return () => {
      alive = false
      clearTimeout(t)
      // pjesma stane i vrati se na početak — sljedeći koraci ne vuku je sa sobom
      try {
        const w = phone()?.contentWindow as (Window & typeof globalThis) | null | undefined
        w?.dispatchEvent(new w.Event('stihdana:stop-audio'))
      } catch {
        /* tuđa adresa */
      }
    }
  }, [phone, manual, present])
  return (
    <Text>
      Plejer je gramofon ispod stiha: dodir na ploču spusti iglu, ploča se zavrti i pjesma svira uz tiho pucketanje
      starog vinila — bez videa i bez napuštanja stiha. Igla klizi prema sredini kako pjesma ide; pauza, premotavanje i
      kontrole sa zaključanog ekrana, kao u pravom plejeru.
    </Text>
  )
}

/**
 * Zaključan ekran je odmah tu, budan u 11:59 — sat pređe na podne i obavijest
 * stigne sama. Prvo na iPhoneu, a onda isto na Androidu (prekidač ide s njim).
 */
function Obavijest({ d }: { d: DeckData }) {
  const { simulate, os, setOs, manual, both } = useDeck()
  // stih tek stiže — još ništa nije sačuvano: ispod stiha stoji "Sačuvaj"
  // (čuvanje dolazi na svom koraku, poslije)
  useEffect(() => {
    try {
      localStorage.setItem('stihdana:favorites', '[]')
    } catch {
      /* privatni prozor */
    }
  }, [])
  // "Ponovi" — obavijest stiže ispočetka na sistemu koji je upravo na telefonu
  const [replay, setReplay] = useState(0)
  useEffect(() => simulate('lock'), [simulate])
  // cijeli tok na iPhoneu (obavijest → dodir → izvlačenje →
  // stih) traje ~15 s — odmah zatim isto na Androidu
  useEffect(() => {
    if (os !== 'ios' || manual || !both) return
    const t = setTimeout(() => {
      setOs('android')
      simulate('lock')
    }, 16000)
    return () => clearTimeout(t)
  }, [os, setOs, manual, both, replay, simulate])
  return (
    <>
      <Text>
        U podne stigne obavijest: <b>„Vrijeme je za stih dana! Uzmi svoj!“</b> Dodir otvara aplikaciju — „Tvoj stih te
        čeka“ i tombola puna šarenih listića, kao na pultu ispred Magaze. Držiš — vrti se; pustiš — jedan se izvuče i
        otvori s tvojim stihom.
      </Text>
      <Bullets
        items={[
          'Izvlači se jednom dnevno — svako sljedeće otvaranje tog dana ide pravo na stih.',
        ]}
      />
      <Acts>
        <ActionChip
          onClick={() => {
            setReplay((r) => r + 1)
            simulate('lock')
          }}
        >
          {Ico.reload} Ponovi
        </ActionChip>
      </Acts>
    </>
  )
}

function Azuriranje() {
  const { simulate, phone, tapAt, manual } = useDeck()
  useKeepSaved()
  // svaka ponuda (ulazak, "Ponovi") — u Auto se i prihvati sama
  const [offered, setOffered] = useState(0)
  const offer = () => {
    simulate('update')
    setOffered((n) => n + 1)
  }
  const present = useIsPresent()
  useEffect(() => {
    if (!offered || manual || !present) return
    // dodir na "Osvježi" (nacrtan preko telefona), pa aplikacija učita novu verziju
    let t = window.setTimeout(() => {
      const btn = document.querySelector<HTMLElement>('[data-sim="update"]')
      const f = phone()
      if (!btn || !f) return
      const fr = f.getBoundingClientRect()
      const k = fr.width / (f.offsetWidth || 1)
      const r = btn.getBoundingClientRect()
      tapAt((r.left + r.width / 2 - fr.left) / k, (r.top + r.height / 2 - fr.top) / k)
      t = window.setTimeout(() => btn.click(), 260)
    }, 2600)
    return () => clearTimeout(t)
  }, [offered, manual, present, phone, tapAt])
  // ponuda nove verzije stigne tek kad je aplikacija učitana i na ekranu
  useScene(async ({ wait, find, alive }) => {
    for (let t = 0; t < 80 && alive(); t++) {
      try {
        const w = phone()?.contentWindow
        if (w && w.location.pathname === '/' && !w.location.search && w.document.readyState === 'complete') break
      } catch {
        /* tuđa adresa */
      }
      await wait(150)
    }
    if (!(await find('[data-tip="song"]', 15000)) || !alive()) return
    // na ulasku nema ničega — ponuda iskoči tek za 2 s, kao da je baš stigla
    await wait(2000)
    if (alive()) offer()
  }, true)
  return (
    <>
      <Text>
        Kad objavimo izmjenu, aplikacija na početnom ekranu ponudi jedno tiho dugme. Bez App Storea i bez čekanja na
        odobrenje — a ništa se ne mijenja pod prstima dok je korisnik ne prihvati.
      </Text>
      <Bullets items={['Bez mreže otvara zadnji viđeni stih. Novi stih dolazi u podne, s obaviješću — otvorena aplikacija sama pređe na njega.']} />
      <Acts>
        <ActionChip onClick={offer}>{Ico.reload} Ponovi</ActionChip>
      </Acts>
    </>
  )
}

/** Postavke → "Podijeli aplikaciju": QR kod se rasklopi, drugi ga skenira kamerom. */
function PodijeliApp() {
  useKeepSaved()
  useScene(async ({ wait, press, home, alive }) => {
    if (!(await home())) return
    await wait(900)
    if (alive()) await press('[aria-label="Postavke"]')
    await wait(1400)
    if (alive()) await press('[data-tip="share-app"]')
  })
  return (
    <>
      <Text>
        U postavkama, „Podijeli aplikaciju“ rasklopi QR kod — drugi ga skenira kamerom i aplikacija mu se otvori, s
        uputstvom za instalaciju. Ispod je i link, za poruku.
      </Text>
    </>
  )
}

/** WhatsApp na telefonu: poruka s linkom se ukuca i pošalje — u chatu postane kartica sa slikom stiha. */
function LinkPreview() {
  const { simulate } = useDeck()
  useKeepSaved()
  useEffect(() => simulate('chat'), [simulate])
  return (
    <>
      <Text>
        Kad neko pošalje link na stih, prijatelj u WhatsAppu ili Viberu ne vidi niz slova, nego karticu: sliku sa
        stihom, naziv pjesme i ime aplikacije. Dodir otvara baš taj stih — i sutra, i za godinu dana.
      </Text>
      <Bullets
        items={[
          'Svaki stih ima svoju stalnu adresu, pa link nikad ne zastari.',
          <>Svaki poslani link je mali poster: <b>vodi nove ljude pravo u aplikaciju.</b></>,
        ]}
      />
      <Acts>
        <ActionChip onClick={() => simulate('chat')}>{Ico.reload} Ponovi</ActionChip>
      </Acts>
    </>
  )
}

function MoodCard({
  mood,
  song,
  cover,
  on,
  onPick,
}: {
  mood: keyof typeof MOODS
  song: string
  /** omot albuma pjesme — blijed, u tonu raspoloženja, kao na ekranu */
  cover?: string
  on: boolean
  onPick: () => void
}) {
  const m = MOODS[mood]
  const fill = cover ? ALBUMS.find((a) => a.cover === cover)?.fill : undefined
  return (
    <motion.button
      type="button"
      onClick={onPick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="relative overflow-hidden rounded-[14px] border p-2.5 text-left transition-colors"
      style={{
        borderColor: on ? `${m.accent}99` : 'rgba(255,255,255,0.1)',
        background: `radial-gradient(circle at 20% 15%, ${m.gradient[2]} 0%, transparent 70%), radial-gradient(circle at 85% 90%, ${m.gradient[1]} 0%, transparent 70%), ${m.gradient[0]}`,
        boxShadow: on ? `0 0 0 1px ${m.accent}55, 0 10px 30px ${m.gradient[1]}88` : undefined,
      }}
      aria-pressed={on}
    >
      {cover && (
        <>
          <span
            className="absolute inset-y-0 right-0 aspect-square overflow-hidden"
            style={{
              // omot s punim gornjim rubom (npr. bijeli papir): spušten, a iznad njegova boja
              backgroundColor: fill,
              opacity: on ? 0.55 : 0.32,
              transition: 'opacity 0.5s',
              maskImage: 'linear-gradient(to right, transparent, black 70%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 70%)',
            }}
            aria-hidden
          >
            <span
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${cover})`, transform: fill ? 'translateY(12%)' : undefined }}
            />
          </span>
          <span className="absolute inset-0" style={{ backgroundColor: m.gradient[1], mixBlendMode: 'color', opacity: 0.4 }} aria-hidden />
        </>
      )}
      <span className="relative flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.accent, boxShadow: `0 0 10px ${m.accent}` }} />
        <span className="truncate text-[9.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: m.accent }}>
          {m.label}
        </span>
      </span>
      <span className="relative mt-4 block truncate text-[12px] text-white/75" style={{ fontFamily: 'var(--font-serif), serif' }}>
        {song}
      </span>
    </motion.button>
  )
}


/* ═══════════════════════════════════════════════════════════════
   PLAN ZA LAUNCH
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   PITANJA
   ═══════════════════════════════════════════════════════════════ */

function Pitanja({ d }: { d: DeckData }) {
  return (
    <div className="grid h-full items-center gap-[5vw] lg:grid-cols-[1fr_auto]">
      <div>
        {/* isto zaglavlje kao naslovna — prezentacija se zatvara kako je počela */}
        <R i={1}>
          <Lockup />
        </R>
        <R i={2}>
          <h1 className="dk-h1 mt-[5.5vh]">
            Pitanja<em>?</em>
          </h1>
        </R>
        <R i={3}>
          <p className="dk-lead mt-[2.6vh] max-w-[26em]">
            Hvala na pažnji. Skenirajte kod i probajte — od sutra vam stih stiže svaki dan u {SEND_TIME}.
          </p>
        </R>
        <R i={4}>
          <div className="mt-[5.5vh]">
            <Presenter />
          </div>
        </R>
      </div>
      <R i={3}>
        <div className="flex flex-col items-center">
          <div className="rounded-[26px] bg-[#F6F1E7] p-4 shadow-[0_0_0_2px_#BFA87F,0_30px_80px_rgba(0,0,0,0.55)]">
            <QrCode qr={d.poster.qr} style={{ width: 'clamp(170px, 30vh, 330px)', height: 'auto', display: 'block' }} />
          </div>
          <p className="dk-eyebrow mt-5">{d.host}</p>
        </div>
      </R>
    </div>
  )
}
