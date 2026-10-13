'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { MOODS } from '@/data/moods'
import { albumOf } from '@/data/albums'
import { SEND_TIME } from '@/lib/date'
import { useDeck } from './context'
import { Grafike, LANSIRANJE, LaunchPlan, Ostalo, PwaNative } from './launch'
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
  {
    id: 'savjeti',
    title: 'Savjeti pri prvom otvaranju',
    enter: '/',
    body: () => <Savjeti />,
  },
  {
    id: 'atmosfera',
    title: 'Atmosfera po raspoloženju',
    // /pregled mijenja stih porukom, bez ponovnog učitavanja — pozadina se pretapa
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
    id: 'dijeljenje',
    title: 'Podijeli kao sliku',
    body: () => <Dijeljenje />,
  },
  {
    id: 'obavijest',
    title: `Obavijest u ${SEND_TIME}`,
    body: (d) => <Obavijest d={d} />,
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
    id: 'kalendar',
    title: 'Kalendar objave',
    // poslije prijave admin je na /admin — ne vraćati na ekran za prijavu
    enter: '/admin',
    body: () => <Kalendar />,
  },
  {
    id: 'biblioteka',
    title: 'Biblioteka stihova',
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
            Link kao poster, <em>verzija sama stiže</em>
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
    // prvo pregled i miran ekran za prijavu; šifra se kuca tek na strelicu
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
  { id: 'ostalo', section: 'Plan za launch', title: 'Šta je ostalo', body: (d) => <Ostalo d={d} /> },
  { id: 'grafike', section: 'Plan za launch', title: 'Grafike', body: (d) => <Grafike d={d} /> },
  { id: 'pitanja', section: 'Pitanja', title: 'Pitanja', backdrop: 'nada', body: (d) => <Pitanja d={d} /> },
]

/* ═══════════════════════════════════════════════════════════════
   UVOD I IDEJA
   ═══════════════════════════════════════════════════════════════ */

/** Ime, logo i web — na prvom i zadnjem slajdu. */
const SOCIALS: { label: string; href: string; handle: string; icon: React.ReactNode }[] = [
  {
    label: 'GitHub',
    handle: 'pandzicharis',
    href: 'https://github.com/pandzicharis',
    icon: (
      <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 3 .8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c2-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.8V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z" />
    ),
  },
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
      {/* GitHub, LinkedIn, Instagram */}
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
      <img src="/brand/signature.webp" alt="Dino Merlin" style={{ height: 'clamp(64px, 12vh, 140px)', width: 'auto' }} />
      <span className="block w-px bg-white/25" style={{ height: 'clamp(40px, 7vh, 84px)' }} />
      <span
        role="img"
        aria-label="Magaza"
        className="block"
        style={{
          height: 'clamp(30px, 5.2vh, 56px)',
          aspectRatio: '316 / 87',
          background: 'rgba(255,255,255,0.92)',
          mask: 'url(/brand/magaza.svg) left center / contain no-repeat',
          WebkitMask: 'url(/brand/magaza.svg) left center / contain no-repeat',
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

/** Telefon pokaže gdje se dodirne. */
/**
 * Čisto stanje aplikacije u telefonu: bez sačuvanih stihova, bez zapamćenog
 * formata slike, obavijesti uključene. Prezentacija i aplikacija dijele
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

type Scene = {
  wait: (ms: number) => Promise<void>
  /** element u aplikaciji, tek kad je stvarno vidljiv */
  find: (sel: string, max?: number) => Promise<HTMLElement | null>
  /** dodir iznad elementa, pa pravi klik */
  press: (target: string | HTMLElement) => Promise<boolean>
  /** sačekaj da je telefon na početnoj stranici aplikacije, učitan */
  home: () => Promise<boolean>
  alive: () => boolean
}

/**
 * Korak koji sam odigra radnju u aplikaciji na telefonu. Odlaskom s koraka
 * otvoreni prozor (sačuvani, dijeljenje) se zatvori, da sljedeći krene čist.
 */
function useScene(run: (s: Scene) => Promise<void>, always = false) {
  const { phone, tapAt, manual } = useDeck()
  useEffect(() => {
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
    const close = () => {
      if (q('[role="dialog"][aria-modal="true"]')) q('button[aria-label="Zatvori"]')?.click()
    }
    close()
    // Ručno: prezenter sam klikće po telefonu
    if (!manual || always) void run({ wait, find, press, home, alive: () => alive })
    return () => {
      alive = false
      timers.forEach(clearTimeout)
      close()
    }
    // scena se igra jednom po ulasku na korak (i ispočetka kad se promijeni Auto/Ručno)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual])
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
      <Bullets
        items={[
          'Zvono i obavijest u podne',
          'Sačuvaj stih i lista sačuvanih',
          'Dijeljenje kao slika',
          'Pjesma uz stih',
          'Dobrodošlica: „Mir svim dobrim ljudima“',
        ]}
      />
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
  /** prevlačenje: kartica dana se podigne i odnese na drugi dan */
  drag: (from: HTMLElement, to: HTMLElement) => Promise<void>
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
    const click = async (t: string | HTMLElement) => {
      const e = await el(t)
      if (!e || !alive) return false
      e.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      await wait(250)
      const c = center(e)
      await move(c.x, c.y)
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
    const drag = async (from: HTMLElement, to: HTMLElement) => {
      const d = doc()
      const win = d?.defaultView as (Window & typeof globalThis) | undefined
      if (!d || !win || !alive) return
      const a = center(from)
      const b = center(to)
      await move(a.x, a.y)
      ripple(a.x, a.y)
      const dt = new win.DataTransfer()
      const fire = (node: HTMLElement, kind: string) =>
        node.dispatchEvent(new win.DragEvent(kind, { bubbles: true, cancelable: true, dataTransfer: dt }))
      fire(from, 'dragstart')
      // kartica koja se nosi — kopija dana, ide zajedno s kursorom
      const r = from.getBoundingClientRect()
      const ghost = from.cloneNode(true) as HTMLElement
      ghost.style.cssText += `;position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;z-index:2147483640;pointer-events:none;opacity:.95;box-shadow:0 18px 40px rgba(0,0,0,.6);border-color:#BFA87F`
      d.body.appendChild(keep(ghost))
      await wait(220)
      if (!alive) return
      const ms = 1000
      ghost.animate(
        [{ transform: 'translate(0,0) scale(1.05) rotate(-1.5deg)' }, { transform: `translate(${b.x - a.x}px,${b.y - a.y}px) scale(1.05) rotate(1deg)` }],
        { duration: ms, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' },
      )
      const going = move(b.x, b.y, ms)
      await wait(ms * 0.6)
      if (!alive) return
      fire(to, 'dragenter')
      fire(to, 'dragover')
      await going
      if (!alive) return
      fire(to, 'dragover')
      await wait(250)
      if (!alive) return
      fire(to, 'drop')
      fire(from, 'dragend')
      ghost.animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).onfinish = () => ghost.remove()
      await wait(700)
    }

    ;(async () => {
      // admin mora biti otvoren (poslije prijave)
      for (let t = 0; t < 100 && alive && !doc(); t++) await wait(150)
      if (!alive || !doc()) return
      // prozor ostao otvoren s drugog koraka — zatvori ga
      q('[role="dialog"]') && q('button[aria-label="Zatvori"]')?.click()
      await run({ wait, find, all, click, type, clear, choose, drag, alive: () => alive })
    })()
    return () => {
      alive = false
      timers.forEach(clearTimeout)
      added.forEach((e) => e.remove())
      // prekinuto prevlačenje: dan ne smije ostati "podignut"
      try {
        const d = desk()?.contentDocument
        const win = d?.defaultView as (Window & typeof globalThis) | undefined
        d?.querySelectorAll('[data-cal]').forEach((c) => c.dispatchEvent(new win!.DragEvent('dragend', { bubbles: true })))
      } catch {
        /* tuđa adresa */
      }
    }
  }, [desk, manual])
}

/** Kalendar: tri stiha se prevuku na druge dane, uživo. */
function Kalendar() {
  useDeskScene(async ({ wait, find, all, drag, alive }) => {
    // pravi ekran odmah na ulasku — animacija ide preko njega
    const tab = await find('[data-tab="calendar"]')
    if (!tab) return
    tab.click()
    // prvi budući dan (prošli su blijedi, pa se "ne vide")
    if (!(await find('[data-cal]:not([disabled])'))) return
    await wait(700)
    // budući dani (prošli su zaključani, današnji takođe)
    const days = all('[data-cal]').filter((b) => !(b as HTMLButtonElement).disabled && !b.dataset.today)
    const pairs: [number, number][] = [
      [1, 4],
      [7, 2],
      [5, 10],
    ]
    for (const [i, j] of pairs) {
      if (!alive()) return
      const from = days[i]
      const to = days[j]
      if (!from || !to) continue
      await drag(from, to)
      await wait(900)
    }
  })
  return (
    <>
      <Text>Koji stih izlazi kojeg dana, obojen raspoloženjem. Stih se prevuče na drugi dan, ili se za dan bira bilo koji.</Text>
      <Bullets
        items={[
          'Današnji je zaključan — ono što je ljudima stiglo, ne mijenja se.',
          'Upozorenje kad se stih vrati za manje od dvije sedmice.',
        ]}
      />
    </>
  )
}

/** Biblioteka: pretraga, filter po raspoloženju, arhiva. */
function Biblioteka() {
  useDeskScene(async ({ wait, find, click, type, clear, alive }) => {
    // pravi ekran odmah na ulasku: lista stihova, bez starih filtera
    const tab = await find('[data-tab="library"]')
    if (!tab) return
    tab.click()
    const search = await find('[data-search]')
    if (search) clear(search)
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
    // arhiva: stih izvan rasporeda, a linkovi i sačuvani rade
    await click('[data-scope="archive"]')
    await wait(1900)
    await click('[data-scope="active"]')
  })
  return (
    <>
      <Text>Pretraga, filter po raspoloženju, i za svaki stih — kad sljedeći put izlazi.</Text>
      <Bullets items={['Arhiviran stih izlazi iz rasporeda, a linkovi i sačuvani i dalje rade.']} />
    </>
  )
}

/** Novi stih: forma se popuni sama, pregled se mijenja dok se kuca — telefon i računar. */
function NoviStih() {
  useDeskScene(async ({ wait, find, click, type, choose, alive }) => {
    // forma za novi stih otvorena odmah na ulasku
    const add = await find('[data-new]')
    if (!add) return
    add.click()
    await find('textarea[name="text"]')
    await wait(900)
    await type('textarea[name="text"]', 'Kad sve saberem podijelim i oduzmem\nVolim te', 60)
    await wait(500)
    await type('input[name="song"]', 'U kandžama jastreba', 55)
    // album s liste — godina se popuni sama
    await choose('select[name="album"]', 'Kokuzna vremena')
    await wait(700)
    await type('input[name="youtube"]', 'https://www.youtube.com/watch?v=kquGKS-qhn8', 18)
    await wait(400)
    await click('[data-edit-mood="ljubav"]')
    await wait(1400)
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
        Tekst, pjesma, album, godina, raspoloženje i YouTube. Pored je pravi ekran aplikacije, na telefonu ili
        računaru, i mijenja se dok se kuca.
      </Text>
      <Bullets items={[<><b>Izmjena je na sajtu odmah</b>, a posjetioci i dalje dobijaju brzu, gotovu stranicu.</>]} />
    </>
  )
}

/**
 * Prijava u admin: šifra se ukuca slovo po slovo (tačkice), pa "Uđi".
 * Prava šifra nikad nije u prezentaciji — ulaz prolazi samo zato što je
 * prezenter već prijavljen (kolačić važi 12 sati). Ako nije, forma traži
 * pravu šifru i prezenter je upiše sam.
 */
function Pristup() {
  const { desk, manual } = useDeck()
  useEffect(() => {
    if (manual) return
    let alive = true
    const timers: number[] = []
    const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)))
    ;(async () => {
      let form: HTMLFormElement | null = null
      for (let t = 0; t < 80 && alive && !form; t++) {
        try {
          const w = desk()?.contentWindow
          if (w && w.location.pathname === '/admin' && w.document.readyState === 'complete')
            form = w.document.querySelector<HTMLFormElement>('form[data-signed-in]')
        } catch {
          /* tuđa adresa */
        }
        if (!form) await wait(150)
      }
      const input = form?.querySelector<HTMLInputElement>('input[type="password"]')
      const button = form?.querySelector<HTMLButtonElement>('button[type="submit"]')
      if (!form || !input || !button || !alive) return
      await wait(900)
      // React prati vrijednost polja — upis ide kroz izvorni setter + input događaj
      const win = input.ownerDocument.defaultView as Window & typeof globalThis
      const set = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')!.set!
      input.focus()
      const word = 'stihdana12'
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
        Na /admin urednik bira i raspoređuje stihove — bez programera i bez čekanja. Jedna šifra, a prijava traje 12
        sati.
      </Text>
      <Bullets items={[<><b>Preporuka: računar.</b> Radi i na telefonu.</>]} />
    </>
  )
}

/** Stih se sačuva, a broj u zaglavlju otvori listu sačuvanih. */
function Sacuvano() {
  // na ulasku ništa nije sačuvano — i u Ručno. Sačuvano odavde dalje ostaje
  // kroz sve naredne korake; briše se tek kad se krene ispočetka.
  useEffect(() => cleanSlate(), [])
  useScene(async ({ wait, find, press, home, alive }) => {
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
    if (alive()) await press('[data-tip="saved"]')
  })
  return (
    <Text>
      „Sačuvaj stih“ ispod stiha, a gore se pojavi ikonica s brojem sačuvanih — dodir otvara listu. Bez naloga i
      prijave: sve ostaje na telefonu, server ne radi ništa.
    </Text>
  )
}

/** Dijeljenje: formati jedan za drugim, pa dugme za preuzimanje slike. */
function Dijeljenje() {
  const { tapAt } = useDeck()
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
    for (const f of ['post', 'square', 'story']) {
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
        Story 9:16, objava 4:5 ili kvadrat — istim fontovima i bojama kao na ekranu. Slika ide pravo u Instagram,
        WhatsApp ili Viber, ili se preuzme na telefon. Crta se na samom telefonu, odmah.
      </Text>
      <Bullets items={[<>Diskretan potpis aplikacije na slici: <b>svako dijeljenje je preporuka.</b></>]} />
    </>
  )
}

/** Pjesma krene sama — dugme u aplikaciji se zaista pritisne; odlaskom s koraka stane. */
function Slusanje() {
  const { phone, manual } = useDeck()
  useEffect(() => {
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
      // pjesma stane i plejer se sklopi — sljedeći koraci ne vuku je sa sobom
      try {
        const w = phone()?.contentWindow as (Window & typeof globalThis) | null | undefined
        w?.dispatchEvent(new w.Event('stihdana:stop-audio'))
      } catch {
        /* tuđa adresa */
      }
    }
  }, [phone, manual])
  return (
    <Text>
      Dodir na naziv pjesme pušta je odmah, u pozadini — bez videa i bez napuštanja stiha. Pauza, premotavanje i
      kontrole sa zaključanog ekrana, kao u pravom plejeru.
    </Text>
  )
}

/**
 * Zaključan ekran je odmah tu, budan u 11:59 — sat pređe na podne i obavijest
 * stigne sama. Prvo na iPhoneu, a onda isto na Androidu (prekidač ide s njim).
 */
function Obavijest({ d }: { d: DeckData }) {
  const { simulate, os, setOs, manual } = useDeck()
  // sačuvano s ranijih koraka ostaje; ako se skočilo pravo ovamo, sačuva se
  // današnji — kad se aplikacija otvori, gore stoji ikonica s brojem
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('stihdana:favorites') ?? '[]')
      if (!Array.isArray(saved) || saved.length === 0)
        localStorage.setItem('stihdana:favorites', JSON.stringify([d.todayVerse.id]))
    } catch {
      /* privatni prozor */
    }
  }, [d.todayVerse.id])
  // "Ponovi" — obavijest stiže ispočetka na sistemu koji je upravo na telefonu
  const [replay, setReplay] = useState(0)
  useEffect(() => simulate('lock'), [simulate])
  // cijeli tok na iPhoneu (obavijest → otključavanje → bedž → stih) traje
  // ~12 s, pa stih da se ispiše — onda isto na Androidu
  useEffect(() => {
    if (os !== 'ios' || manual) return
    const t = setTimeout(() => {
      setOs('android')
      simulate('lock')
    }, 18500)
    return () => clearTimeout(t)
  }, [os, setOs, manual, replay, simulate])
  return (
    <>
      <Text>
        Svaki dan u podne stih stigne na zaključan ekran. Na početnom ekranu ikonica čeka s bedžom, a otvaranje vodi
        pravo na današnji stih. Zvono u zaglavlju aplikacije obavijesti pali i gasi.
      </Text>
      <Bullets
        items={[
          'Otporno slanje: ako nešto zapne, sljedeći pokušaj šalje samo onima koji stih još nisu dobili — niko ga ne dobije dvaput.',
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
  const { simulate, phone } = useDeck()
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
    if (alive()) simulate('update')
  }, true)
  return (
    <>
      <Text>
        Kad objavimo izmjenu, aplikacija na početnom ekranu ponudi jedno tiho dugme. Bez App Storea i bez čekanja na
        odobrenje — a ništa se ne mijenja pod prstima dok je korisnik ne prihvati.
      </Text>
      <Bullets items={['Bez mreže otvara zadnji viđeni stih; otvorena preko ponoći sama pređe na novi dan.']} />
      <Acts>
        <ActionChip onClick={() => simulate('update')}>{Ico.reload} Ponovi</ActionChip>
      </Acts>
    </>
  )
}

/** WhatsApp na telefonu: poruka s linkom se ukuca i pošalje — u chatu postane kartica sa slikom stiha. */
function LinkPreview() {
  const { simulate } = useDeck()
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
            className="absolute inset-y-0 right-0 aspect-square bg-cover bg-center"
            style={{
              backgroundImage: `url(${cover})`,
              opacity: on ? 0.55 : 0.32,
              transition: 'opacity 0.5s',
              maskImage: 'linear-gradient(to right, transparent, black 70%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 70%)',
            }}
            aria-hidden
          />
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
