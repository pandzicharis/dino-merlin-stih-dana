'use client'

import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { MOODS } from '@/data/moods'
import { BRAND } from '@/lib/brand'
import { SEND_TIME } from '@/lib/date'
import { oneLine, withPeriod } from '@/lib/text'
import { useDeck } from './context'
import { Poster, SocialPost, SocialStory } from './Poster'
import { QrCode } from './QrCode'
import {
  ActionChip,
  Acts,
  Bullets,
  FeatureSlide,
  Ico,
  Lead,
  PhoneChip,
  Points,
  R,
  Text,
  Try,
} from './ui'
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
    title: 'Bez App Storea',
    enter: '/?uvod=ios',
    body: () => (
      <>
        <Text>
          Link ili QR kod otvara aplikaciju, a ona prvo vodi do početnog ekrana: na iPhoneu tri jasna koraka, na
          Androidu jedno dugme. Zatim jedna dozvola — obavijest u {SEND_TIME}.
        </Text>
        <Bullets
          items={[
            <>
              Na iPhoneu obavijesti rade <b>samo</b> iz aplikacije na početnom ekranu (iOS 16.4+) — zato ovaj korak
              ide prvi.
            </>,
          ]}
        />
        <Acts>
          <PhoneChip src="/?uvod=ios" frame="iphone">
            {Ico.apple} iPhone
          </PhoneChip>
          <PhoneChip src="/?uvod=android" frame="galaxy">
            {Ico.android} Android
          </PhoneChip>
          <PhoneChip src="/?uvod=dozvola">{Ico.bell} Dozvola</PhoneChip>
        </Acts>
      </>
    ),
  },
  {
    id: 'ispis',
    title: 'Stih se ispiše',
    enter: '/',
    body: () => <Ispis />,
  },
  {
    id: 'atmosfera',
    title: 'Atmosfera po raspoloženju',
    body: (d) => (
      <>
        <Text>
          Raspoloženje stiha boji cijeli ekran: svjetlo koje sporo pluta, portret jedva prisutan, note koje se dižu,
          zrno filma. Nikad dvije večeri isti osjećaj.
        </Text>
        <div className="mt-[1.8vh] grid max-w-[34em] grid-cols-2 gap-2 xl:grid-cols-4">
          {d.moods.map(({ mood, verse }) => (
            <MoodCard key={mood} mood={mood} verseId={verse.id} song={verse.song} />
          ))}
        </div>
      </>
    ),
  },
  {
    id: 'slusanje',
    title: 'Poslušaj pjesmu',
    body: () => (
      <>
        <Text>
          Naziv pjesme i zlatni YouTube znak vode pravo na pjesmu. Namjerno bez ugrađenog plejera: ekran ostaje stih,
          a to je i licencno najčistiji put.
        </Text>
        <Try steps={['Dodirni naziv pjesme ispod stiha']} />
      </>
    ),
  },
  {
    id: 'obavijest',
    title: `Obavijest u ${SEND_TIME}`,
    body: () => <Obavijest />,
  },
]

const UZ_STIH: FeatureDef[] = [
  {
    id: 'sacuvano',
    title: 'Sačuvani stihovi',
    body: () => (
      <>
        <Text>
          „Sačuvaj stih“ ispod stiha, a lista sa brojem sačuvanih u zaglavlju. Bez naloga i prijave — sve ostaje na
          telefonu, bez ikakvog opterećenja servera.
        </Text>
        <Try steps={['„Sačuvaj stih“', 'ikonica gore desno', 'lista']} />
      </>
    ),
  },
  {
    id: 'dijeljenje',
    title: 'Dijeljenje kao slika',
    body: () => (
      <>
        <Text>
          Story 9:16, objava 4:5 ili kvadrat — istim fontovima i bojama kao na ekranu, pravo u Instagram, WhatsApp ili
          Viber. Slika se crta na samom telefonu, odmah.
        </Text>
        <Bullets items={[<>Diskretan potpis aplikacije na slici: <b>svako dijeljenje je preporuka.</b></>]} />
        <Try steps={['ikonica dijeljenja', 'format', 'Podijeli']} />
      </>
    ),
  },
  {
    id: 'link',
    title: 'Link koji izgleda kao poster',
    enter: (d) => `/stih/${d.todayVerse.id}`,
    body: (d) => <LinkPreview d={d} />,
  },
  {
    id: 'niz',
    title: 'Niz dana',
    enter: '/?streak=12',
    body: () => (
      <>
        <Text>
          Ispod potpisa tiho piše koliko dana zaredom je stih otvoren — ne kao igra s bodovima, nego kao podsjetnik da
          je ovo postao ritual. Broji stvarne dane po Sarajevu.
        </Text>
        <Bullets items={['Na ovom koraku niz je postavljen na 12, da se vidi kako izgleda.']} />
      </>
    ),
  },
  {
    id: 'azuriranje',
    title: 'Nova verzija stiže sama',
    body: () => <Azuriranje />,
  },
]

/* ── funkcionalnosti — računar ─────────────────────────────── */

const UREDNIK: FeatureDef[] = [
  {
    id: 'pristup',
    title: 'Pristup jednom šifrom',
    enter: '/admin',
    body: () => (
      <>
        <Text>
          Na /admin urednik bira i raspoređuje stihove — bez programera i bez čekanja. Prijava traje 12 sati.
        </Text>
        <Bullets items={[<><b>Preporuka: računar.</b> Radi i na telefonu.</>]} />
      </>
    ),
  },
  {
    id: 'kalendar',
    title: 'Kalendar objave',
    body: () => (
      <>
        <Text>Koji stih izlazi kojeg dana, obojen raspoloženjem. Stih se prevuče na drugi dan, ili se za dan bira bilo koji.</Text>
        <Bullets
          items={[
            'Današnji je zaključan — ono što je ljudima stiglo, ne mijenja se.',
            'Upozorenje kad se stih vrati za manje od dvije sedmice.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'biblioteka',
    title: 'Biblioteka stihova',
    body: () => (
      <>
        <Text>Pretraga, filter po raspoloženju, i za svaki stih — kad sljedeći put izlazi.</Text>
        <Bullets items={['Arhiviran stih izlazi iz rasporeda, a linkovi i sačuvani i dalje rade.']} />
      </>
    ),
  },
  {
    id: 'novi',
    title: 'Novi stih uz živi pregled',
    body: () => (
      <>
        <Text>
          Tekst, pjesma, album, godina, raspoloženje i YouTube. Pored je pravi ekran aplikacije, na telefonu ili
          računaru, i mijenja se dok se kuca.
        </Text>
        <Bullets items={[<><b>Izmjena je na sajtu odmah</b>, a posjetioci i dalje dobijaju brzu, gotovu stranicu.</>]} />
      </>
    ),
  },
]

export const SLIDES: SlideDef[] = [
  { id: 'uvod', section: 'Uvod', title: 'Stih dana', backdrop: 'nostalgija', body: () => <Intro /> },
  { id: 'o-meni', section: 'Uvod', title: 'O meni', body: () => <OMeni /> },
  { id: 'ideja', section: 'Ideja', title: 'Jedan stih, jedan trenutak', body: () => <Ideja /> },
  {
    id: 'stih',
    section: 'Aplikacija',
    title: 'Stih dana',
    mode: 'phone',
    features: STIH,
    body: (d) => (
      <FeatureSlide
        d={d}
        features={STIH}
        eyebrow={<>Aplikacija · uživo</>}
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
    features: UZ_STIH,
    body: (d) => (
      <FeatureSlide
        d={d}
        features={UZ_STIH}
        eyebrow={<>Aplikacija · uživo</>}
        title={
          <>
            Sačuvaj, podijeli — <em>vrati se sutra</em>
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
    features: UREDNIK,
    body: (d) => (
      <FeatureSlide
        d={d}
        features={UREDNIK}
        eyebrow={<>Urednički panel · uživo</>}
        title={
          <>
            Magaza <em>ima kontrolu</em>
          </>
        }
      />
    ),
  },
  { id: 'performanse', section: 'Plan za launch', title: 'Ispod haube', body: () => <Performanse /> },
  { id: 'pwa', section: 'Plan za launch', title: 'PWA ili prava mobilna aplikacija', body: () => <PwaNative /> },
  { id: 'ostalo', section: 'Plan za launch', title: 'Šta je ostalo', body: (d) => <Ostalo d={d} /> },
  { id: 'qr', section: 'Plan za launch', title: 'QR plakat u Magazi', body: (d) => <Qr d={d} /> },
  { id: 'mreze', section: 'Plan za launch', title: 'Objava za društvene mreže', body: (d) => <Mreze d={d} /> },
  { id: 'pitanja', section: 'Pitanja', title: 'Pitanja', backdrop: 'nada', body: (d) => <Pitanja d={d} /> },
]

/* ═══════════════════════════════════════════════════════════════
   UVOD I IDEJA
   ═══════════════════════════════════════════════════════════════ */

/** Ime, logo i web — na prvom i zadnjem slajdu. */
function Presenter() {
  return (
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
  )
}

function Intro() {
  return (
    <div className="max-w-[min(64vw,980px)]">
      {/* potpis i Magaza jedan do drugog, ulaze kao i sve ostalo — u donjoj
          traci ih na naslovnoj nema */}
      <R i={1}>
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
 * Ko sam i čime se bavim — kratko. Podaci su s harispandzic.dev.
 * Poslodavac namjerno ne stoji: Stih dana je lični projekat.
 */
function OMeni() {
  const stats: [string, string][] = [
    ['~5', 'godina iskustva'],
    ['13', 'proizvoda'],
    ['6', 'industrija'],
  ]
  const daily = ['Stih dana — Dino Merlin', 'My Islamic Reminder', 'Ammar Bašić — misao dana']
  return (
    <div className="grid items-center gap-[5vw] lg:grid-cols-[1.05fr_1fr]">
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
          <p className="dk-lead mt-[3.4vh] max-w-[30em]">
            Software engineer iz Sarajeva. Oko pet godina pravim web i mobilne proizvode — od arhitekture sistema do
            zadnjeg piksela na ekranu.
          </p>
        </R>
        <R i={2}>
          <p className="dk-body mt-[1.6vh] max-w-[34em]">
            HR, automotive, fitness, sport, obrazovanje, kreatorske platforme. Dobar inženjer ne piše samo kod —{' '}
            <span className="italic text-[#E9D9B6]">razumije problem iza njega.</span>
          </p>
        </R>
        <R i={3}>
          <div className="mt-[3.6vh] flex gap-[clamp(20px,3vw,56px)]">
            {stats.map(([n, label]) => (
              <div key={label}>
                <p className="dk-serif tabular text-[clamp(30px,min(3.3vw,6vh),64px)] leading-none text-[#E9D9B6]">{n}</p>
                <p className="dk-small mt-2">{label}</p>
              </div>
            ))}
          </div>
        </R>
        <R i={4}>
          <div className="mt-[3.6vh]">
            <p className="dk-eyebrow mb-2.5 opacity-80">Dnevni PWA rituali — već objavljeni</p>
            <div className="flex flex-wrap gap-2">
              {daily.map((t, k) => (
                <span
                  key={t}
                  className="dk-chip"
                  style={k === 0 ? { borderColor: 'rgba(191,168,127,0.5)', color: '#F1E6CF' } : undefined}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </R>
        <R i={5}>
          <a
            href="https://harispandzic.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="dk-btn-gold mt-[3.6vh]"
          >
            harispandzic.dev {Ico.external}
          </a>
        </R>
      </div>
      <R i={2} className="hidden lg:block">
        <CodeCard />
      </R>
    </div>
  )
}

/* boje koda: ključ, tekst, interpunkcija */
const K = ({ children }: { children: ReactNode }) => <span className="text-[#BFA87F]">{children}</span>
const S = ({ children }: { children: ReactNode }) => <span className="text-[#E9D9B6]">&apos;{children}&apos;</span>
const P = ({ children }: { children: ReactNode }) => <span className="text-white/35">{children}</span>

/** Kartica koja se ispiše red po red — motiv s harispandzic.dev. */
function CodeCard() {
  const lines: ReactNode[] = [
    <>
      <span className="text-[#8DC9A3]">const</span> haris <P>=</P> <P>{'{'}</P>
    </>,
    <>
      {'  '}
      <K>uloga</K>
      <P>:</P> <S>software engineer</S>
      <P>,</P>
    </>,
    <>
      {'  '}
      <K>grad</K>
      <P>:</P> <S>Sarajevo</S>
      <P>,</P>
    </>,
    <>
      {'  '}
      <K>iskustvo</K>
      <P>:</P> <S>~5 godina</S>
      <P>,</P>
    </>,
    <>
      {'  '}
      <K>fokus</K>
      <P>: [</P>
      <S>arhitektura</S>
      <P>, </P>
      <S>brzina</S>
      <P>, </P>
      <S>detalji</S>
      <P>],</P>
    </>,
    <>
      {'  '}
      <K>stack</K>
      <P>: [</P>
      <S>TypeScript</S>
      <P>, </P>
      <S>React</S>
      <P>, </P>
      <S>Node.js</S>
      <P>],</P>
    </>,
    <>
      {'  '}
      <K>sada</K>
      <P>:</P> <S>Stih dana</S>
      <P>,</P>
    </>,
    <P key="zatvori">{'}'}</P>,
    <span key="prazno"> </span>,
    <>
      <span className="text-[#8DC9A3]">while</span> <P>(</P>alive<P>) {'{'}</P> code<P>();</P> repeat<P>();</P> <P>{'}'}</P>
    </>,
  ]
  return (
    <div className="dk-card overflow-hidden" style={{ background: 'rgba(14,13,12,0.72)' }}>
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
        <i className="block h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
        <i className="block h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
        <i className="block h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
        <span className="ml-3 font-mono text-[12px] text-white/40">haris.ts</span>
      </div>
      <pre className="overflow-hidden px-[clamp(16px,1.6vw,28px)] py-[clamp(14px,2.2vh,28px)] font-mono text-[clamp(12px,min(0.95vw,1.75vh),17px)] leading-[1.75] text-white/85">
        {lines.map((l, k) => (
          <motion.span
            key={k}
            className="block whitespace-pre"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + k * 0.12, duration: 0.35, ease: 'easeOut' }}
          >
            <span className="mr-4 inline-block w-5 text-right text-white/20">{k + 1}</span>
            {l}
          </motion.span>
        ))}
        {/* kursor na kraju */}
        <motion.span
          className="ml-9 inline-block h-[1.1em] w-[0.55em] translate-y-[0.2em] bg-[#BFA87F]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ delay: 0.5 + lines.length * 0.12, duration: 1.1, repeat: Infinity, times: [0, 0.1, 0.6, 0.7] }}
        />
      </pre>
    </div>
  )
}

function Ideja() {
  const steps = [
    ['12:00', 'Stigne obavijest', 'Prvi red stiha, na zaključanom ekranu.'],
    ['Dodir', 'Stih se ispiše', 'Riječ po riječ, u boji svog raspoloženja.'],
    ['Srce', 'Sačuva ga', 'Bez naloga i bez prijave.'],
    ['Podijeli', 'Pošalje dalje', 'Kao sliku — Instagram, WhatsApp, Viber.'],
    ['Sutra', 'Novi stih', 'Isti za sve, istog dana.'],
  ]
  return (
    <div>
      <R i={0}>
        <p className="dk-eyebrow">Ideja</p>
      </R>
      <R i={1}>
        <h2 className="dk-h2 mt-[2.2vh] max-w-[17em]">
          Jedan stih. Jedan trenutak. <em>Pa se aplikacija skloni do sutra.</em>
        </h2>
      </R>
      <Lead>
        Telefon je pun feedova i buke. Stih dana je suprotnost: jednom dnevno, u isto vrijeme, na ekranu se riječ po
        riječ ispiše stih koji su ljudi čuli sto puta — a sad izgleda kao da je napisan baš za njih.
      </Lead>
      <div className="relative mt-[5.5vh]">
        {/* zlatna nit kroz cijeli dan */}
        <motion.span
          className="absolute left-0 right-0 top-[19px] hidden h-px origin-left md:block"
          style={{ background: `linear-gradient(90deg, ${BRAND.gold}, ${BRAND.gold}33)` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.4, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
        <ol className="grid gap-6 md:grid-cols-5 md:gap-[2vw]">
          {steps.map(([time, title, text], k) => (
            <R key={title} i={3 + k}>
              <li className="relative">
                <span className="relative z-10 flex h-10 w-fit items-center rounded-full border border-[#BFA87F]/45 bg-[#0b0b0c] px-4 text-[13px] font-medium tracking-wide text-[#BFA87F]">
                  {time}
                </span>
                <p className="dk-h3 mt-[2.2vh]">{title}</p>
                <p className="dk-body mt-1.5">{text}</p>
              </li>
            </R>
          ))}
        </ol>
      </div>
      <R i={9}>
        <p className="dk-body mt-[5vh] max-w-[46em]">
          Nije baza tekstova, ni plejer, ni društvena mreža — <span className="italic text-[#E9D9B6]">snaga je u ograničenju.</span>{' '}
          A svaki podijeljeni stih je reklama u publici koja već voli Merlina.
        </p>
      </R>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   APLIKACIJA — dijelovi opisa koji trebaju aplikaciju
   ═══════════════════════════════════════════════════════════════ */

function Ispis() {
  const { reloadPhone } = useDeck()
  return (
    <>
      <Text>
        Riječ po riječ, s blagim izoštravanjem — kao da ga neko pjeva. Isti stih za sve, istog dana, po sarajevskom
        vremenu. Bez menija i bez ičega što viče.
      </Text>
      <Bullets items={['Fraunces za stih; Rubik, šampanj zlatna i potpis s dinomerlin.com za sve ostalo.']} />
      <Acts>
        <ActionChip onClick={reloadPhone}>{Ico.reload} Ispiši ponovo</ActionChip>
      </Acts>
    </>
  )
}

function Obavijest() {
  const { simulate } = useDeck()
  return (
    <>
      <Text>
        Jedna dnevno, s prvim redom stiha; dodir je otvara pravo na stih. Zvono u zaglavlju je pali i gasi — zeleno
        stiže, crveno ne stiže.
      </Text>
      <Bullets
        items={[
          'Otporno slanje: ako nešto zapne, sljedeći pokušaj šalje samo onima koji stih još nisu dobili — niko ga ne dobije dvaput.',
        ]}
      />
      <Acts>
        <ActionChip onClick={() => simulate('notify')}>{Ico.bell} Stigla je obavijest</ActionChip>
      </Acts>
    </>
  )
}

function Azuriranje() {
  const { simulate } = useDeck()
  return (
    <>
      <Text>
        Kad objavimo izmjenu, aplikacija na početnom ekranu ponudi jedno tiho dugme. Bez App Storea i bez čekanja na
        odobrenje — a ništa se ne mijenja pod prstima dok je korisnik ne prihvati.
      </Text>
      <Bullets items={['Bez mreže otvara zadnji viđeni stih; otvorena preko ponoći sama pređe na novi dan.']} />
      <Acts>
        <ActionChip onClick={() => simulate('update')}>{Ico.reload} Stigla je nova verzija</ActionChip>
      </Acts>
    </>
  )
}

/** Poruka kako je vidi primalac — link na stih postaje kartica sa slikom. */
function LinkPreview({ d }: { d: DeckData }) {
  const v = d.todayVerse
  return (
    <>
      <Text>
        Svaki stih ima stalnu adresu. U WhatsAppu ili Viberu ne izgleda kao gola adresa, nego kao kartica sa slikom
        stiha — i radi zauvijek.
      </Text>
      <div className="mt-[1.8vh] w-[min(100%,250px)] rounded-[16px] rounded-tl-[5px] bg-[#1F2C34] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
        <div className="flex gap-2 overflow-hidden rounded-[11px] bg-[#111B21]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/og/${v.id}/post`} alt="" className="aspect-square w-[78px] shrink-0 object-cover" />
          <div className="min-w-0 py-1.5 pr-2">
            <p className="truncate text-[12px] font-medium text-white/90">{v.song}</p>
            <p className="line-clamp-2 text-[11px] leading-snug text-white/55">{oneLine(withPeriod(v.text))}</p>
            <p className="mt-0.5 truncate text-[10px] text-white/35">{d.host}</p>
          </div>
        </div>
        <p className="truncate px-1.5 pt-1 text-[11px] text-[#53BDEB]">
          {d.host}/stih/{v.id}
        </p>
      </div>
    </>
  )
}

function MoodCard({ mood, verseId, song }: { mood: keyof typeof MOODS; verseId: string; song: string }) {
  const { phoneSrc, openPhone } = useDeck()
  const m = MOODS[mood]
  const src = `/?verse=${verseId}`
  const on = phoneSrc === src
  return (
    <motion.button
      type="button"
      onClick={() => openPhone(src)}
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
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.accent, boxShadow: `0 0 10px ${m.accent}` }} />
        <span className="truncate text-[9.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: m.accent }}>
          {m.label}
        </span>
      </span>
      <span className="mt-4 block truncate text-[12px] text-white/75" style={{ fontFamily: 'var(--font-serif), serif' }}>
        {song}
      </span>
    </motion.button>
  )
}


/* ═══════════════════════════════════════════════════════════════
   PLAN ZA LAUNCH
   ═══════════════════════════════════════════════════════════════ */

function Performanse() {
  const stats: [string, string][] = [
    ['0', 'upita bazi po posjeti'],
    ['500 = 500.000', 'korisnika: isti trošak, ista brzina'],
    ['8 ×', 'paralelnih slanja — desetine hiljada obavijesti za nekoliko sekundi'],
    ['$0–20', 'mjesečno za hosting i bazu'],
  ]
  const flows: [string, string[], string][] = [
    ['Posjeta', ['Telefon', 'CDN · gotova stranica'], 'bez servera i bez baze'],
    ['Obavijest', [`Okidač ${SEND_TIME}`, 'Slanje u porcijama', 'Apple · Google'], 'niko je ne dobije dvaput'],
    ['Urednik', ['/admin', 'Baza', 'Sajt osvježen'], 'odmah, bez deploya'],
  ]
  return (
    <div>
      <R i={0}>
        <p className="dk-eyebrow">Ispod haube</p>
      </R>
      <R i={1}>
        <h2 className="dk-h2 mt-[2.2vh] max-w-[18em]">
          Napravljena da izdrži <em>Merlinovu objavu</em>
        </h2>
      </R>
      <Lead>
        Ako Dino podijeli link, desetine hiljada ljudi otvore aplikaciju u istom satu. Zato stih ne dolazi iz baze —
        računa se iz datuma, a stranica se servira s CDN-a, gotova, kao slika.
      </Lead>
      <div className="mt-[4.5vh] grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([big, small], k) => (
          <R key={big} i={3 + k}>
            <div className="dk-card h-full p-[clamp(14px,1.4vw,24px)]">
              <p className="dk-serif tabular text-[clamp(26px,min(2.8vw,5vh),54px)] leading-none text-[#E9D9B6]">{big}</p>
              <p className="dk-small mt-2.5">{small}</p>
            </div>
          </R>
        ))}
      </div>
      <R i={7}>
        <div className="mt-[3.5vh] flex flex-col gap-2.5">
          {flows.map(([label, nodes, note]) => (
            <div key={label} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="dk-eyebrow w-[7.5em] shrink-0 opacity-80">{label}</span>
              {nodes.map((n, k) => (
                <span key={n} className="flex items-center gap-3">
                  {k > 0 && <span className="text-[#BFA87F]/60">→</span>}
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[clamp(12px,0.85vw,15px)] text-white/80">
                    {n}
                  </span>
                </span>
              ))}
              <span className="dk-small ml-1 italic">{note}</span>
            </div>
          ))}
        </div>
      </R>
    </div>
  )
}

function PwaNative() {
  const pwa = {
    plus: [
      'Gotova — radi danas',
      'QR ili link → početni ekran, za sekunde',
      'Izmjene stižu odmah, bez storea',
      'Jedan kod za iPhone, Android i računar',
      'Trošak $0–20 mjesečno',
    ],
    minus: [
      'iPhone: obavijesti tek s početnog ekrana',
      'Nema widgeta ni stiha na zaključanom ekranu',
      'Nema je u App Storeu i Google Playu',
      'Instalacija na iPhoneu traži par koraka',
    ],
  }
  const native = {
    plus: [
      'Pouzdane obavijesti na svakom uređaju',
      'Widget sa stihom na početnom ekranu',
      'App Store i Google Play — pretraga i legitimitet',
      'Isječak pjesme u pozadini (uz licencu)',
    ],
    minus: [
      'Pregled u storeu prije svake verzije',
      'Apple $99 godišnje, Google $25 jednom',
      'Duži razvoj i održavanje dvije platforme',
      'Preuzimanje iz storea — veći prag za korisnika',
    ],
  }
  return (
    <div>
      <R i={0}>
        <p className="dk-eyebrow">Odluka</p>
      </R>
      <R i={1}>
        <h2 className="dk-h2 mt-[2.2vh]">
          PWA danas — <em>native kad brojke kažu</em>
        </h2>
      </R>
      <div className="mt-[4vh] grid gap-3 md:grid-cols-2">
        <R i={2}>
          <ProsCons title="PWA" sub="ova aplikacija, iz preglednika na početni ekran" {...pwa} highlight />
        </R>
        <R i={3}>
          <ProsCons title="Native" sub="iOS i Android aplikacija iz storea" {...native} />
        </R>
      </div>
      <R i={5}>
        <div
          className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[clamp(16px,1.4vw,28px)] border px-[clamp(16px,1.6vw,28px)] py-[clamp(12px,1.6vh,20px)]"
          style={{ borderColor: `${BRAND.gold}55`, background: `linear-gradient(90deg, ${BRAND.gold}1f, transparent 70%)` }}
        >
          <span className="dk-eyebrow">Preporuka</span>
          <p className="dk-body min-w-0 flex-1 text-white/80">
            Krenuti s PWA-om — gotova je i besplatna za korisnika. Kad brojke pokažu da ljudi ostaju, dodati native
            omotač za widget i store — <b>isti stihovi, isti backend, bez bacanja posla.</b>
          </p>
        </div>
      </R>
    </div>
  )
}

function ProsCons({
  title,
  sub,
  plus,
  minus,
  highlight = false,
}: {
  title: string
  sub: string
  plus: string[]
  minus: string[]
  highlight?: boolean
}) {
  return (
    <div className="dk-card h-full p-[clamp(16px,1.6vw,28px)]" style={highlight ? { borderColor: 'rgba(191,168,127,0.35)' } : undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="dk-h3">{title}</p>
        <p className="dk-small truncate">{sub}</p>
      </div>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <ul className="flex flex-col gap-2">
          {plus.map((t) => (
            <li key={t} className="dk-body flex gap-2.5 text-white/80">
              <span className="mt-[0.1em] text-[#8DC9A3]">+</span>
              {t}
            </li>
          ))}
        </ul>
        <ul className="flex flex-col gap-2">
          {minus.map((t) => (
            <li key={t} className="dk-body flex gap-2.5 text-white/50">
              <span className="mt-[0.1em] text-[#D08C8C]">−</span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Ostalo({ d }: { d: DeckData }) {
  const done = [
    'Aplikacija na početnom ekranu (iPhone i Android)',
    'Stih dana, atmosfera, potpis',
    'Sačuvani stihovi, dijeljenje, trajni link',
    `Obavijest u ${SEND_TIME}`,
    'Urednički panel s kalendarom',
    'Plakat A3 i A4 s QR kodom, objava i story',
  ]
  const magaza: [string, ReactNode][] = [
    [
      'Lista stihova',
      <>
        Sada ih je {d.count}; za launch <b>90–120</b> — tri do četiri mjeseca bez ponavljanja. Magaza bira i
        odobrava.
      </>,
    ],
    [
      'Grafika u visokoj rezoluciji',
      <>
        Potpis, portret i logotipi su sada preuzeti sa sajtova. Trebaju <b>originali</b> — vektor ili PNG visoke
        rezolucije — za oštar ekran, ikone i štampu.
      </>,
    ],
    ['Dozvola za tekstove', <>Dogovor s autorom i izdavačem (AMUS) prije javnog launcha.</>],
  ]
  const me = [
    'Ikone i uvodni ekran s finalnom grafikom',
    `Pouzdan okidač za ${SEND_TIME} i nadzor slanja`,
    'Analitika: instalacije, obavijesti, dijeljenja, povratak',
    'Domena — npr. stihdana.ba',
    'Štampa plakata i dan launcha',
  ]
  return (
    <div>
      <R i={0}>
        <p className="dk-eyebrow">Do launcha</p>
      </R>
      <R i={1}>
        <h2 className="dk-h2 mt-[2.2vh]">
          Šta je <em>ostalo</em>
        </h2>
      </R>
      <div className="mt-[4vh] grid gap-3 lg:grid-cols-[1fr_1.35fr_1fr]">
        <R i={2}>
          <div className="dk-card h-full p-[clamp(16px,1.6vw,28px)]">
            <p className="dk-eyebrow" style={{ color: '#8DC9A3' }}>
              Gotovo
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {done.map((t) => (
                <li key={t} className="dk-body flex gap-2.5 text-white/70">
                  <span className="mt-[0.2em] text-[#8DC9A3]">{Ico.check}</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </R>
        <R i={3}>
          <div className="dk-card h-full p-[clamp(16px,1.6vw,28px)]" style={{ borderColor: `${BRAND.gold}55`, background: `${BRAND.gold}0d` }}>
            <p className="dk-eyebrow">Od Magaze</p>
            <ol className="mt-3 flex flex-col gap-[2vh]">
              {magaza.map(([title, text], k) => (
                <li key={title} className="flex gap-3">
                  <span className="dk-num mt-0.5">{k + 1}</span>
                  <span>
                    <span className="dk-h3 block">{title}</span>
                    <span className="dk-body mt-1 block">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </R>
        <R i={4}>
          <div className="dk-card h-full p-[clamp(16px,1.6vw,28px)]">
            <p className="dk-eyebrow" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Na meni
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {me.map((t) => (
                <li key={t} className="dk-body flex gap-2.5 text-white/70">
                  <span className="mt-[0.72em] block h-px w-3 shrink-0 bg-white/30" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </R>
      </div>
    </div>
  )
}

function Qr({ d }: { d: DeckData }) {
  return (
    <div className="grid h-full items-center gap-[4vw] lg:grid-cols-[1fr_auto]">
      <div>
        <R i={0}>
          <p className="dk-eyebrow">Put do korisnika</p>
        </R>
        <R i={1}>
          <h2 className="dk-h2 mt-[2.2vh] max-w-[14em]">
            Od izloga <em>do početnog ekrana</em>
          </h2>
        </R>
        <Lead>
          Plakat stoji u Magazi. Kupac skenira kod, aplikacija se otvori i sama ga vodi do početnog ekrana — i od
          sutra mu stih stiže svaki dan u podne. Na plakatu: iPhone sa stihom i Samsung s obaviješću.
        </Lead>
        <R i={3}>
          <div className="mt-[4vh] flex items-center gap-5">
            <div className="rounded-[18px] bg-[#F6F1E7] p-2.5 shadow-[0_0_0_2px_#BFA87F,0_20px_50px_rgba(0,0,0,0.5)]">
              <QrCode qr={d.poster.qr} style={{ width: 'clamp(104px, 15vh, 170px)', height: 'auto', display: 'block' }} />
            </div>
            <div>
              <p className="dk-h3">Skenirajte sad</p>
              <p className="dk-small mt-1">Kod je pravi — vodi na {d.host}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href="/prezentacija/plakat" target="_blank" className="dk-btn-gold">
                  Plakat A3 {Ico.external}
                </a>
                <a href="/prezentacija/plakat/a4" target="_blank" className="dk-chip">
                  A4 položeno {Ico.external}
                </a>
              </div>
            </div>
          </div>
        </R>
      </div>
      <R i={2} className="hidden justify-center lg:flex">
        <PosterScene d={d} />
      </R>
    </div>
  )
}

/** Plakat u ramu, pod svjetlom — kako stoji u Magazi. */
function PosterScene({ d }: { d: DeckData }) {
  const h = 'min(74vh, 900px)'
  return (
    <div className="relative" style={{ height: h }}>
      <div
        className="pointer-events-none absolute -inset-x-[40%] -top-[12%] h-[70%]"
        style={{ background: 'radial-gradient(ellipse 50% 60% at 50% 0%, rgba(255,240,210,0.16), transparent 70%)' }}
        aria-hidden
      />
      <div
        className="relative rounded-[6px] p-[0.9vh]"
        style={{
          height: h,
          background: 'linear-gradient(145deg, #3a3835, #1b1a19 40%, #2c2a27)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 40px 90px rgba(0,0,0,0.7), 0 6px 18px rgba(0,0,0,0.5)',
        }}
      >
        <Poster data={d.poster} width={`calc((${h} - 1.8vh) / 1.4142)`} />
      </div>
      <div
        className="pointer-events-none absolute -bottom-[5%] left-[8%] right-[8%] h-[5%] rounded-[50%] bg-black/60 blur-xl"
        aria-hidden
      />
    </div>
  )
}

function Mreze({ d }: { d: DeckData }) {
  return (
    <div className="grid h-full items-center gap-[4vw] lg:grid-cols-[1fr_auto]">
      <div>
        <R i={0}>
          <p className="dk-eyebrow">Launch</p>
        </R>
        <R i={1}>
          <h2 className="dk-h2 mt-[2.2vh] max-w-[13em]">
            Jedna objava — <em>i publika je tu</em>
          </h2>
        </R>
        <Lead>
          Za Merlinov profil i za Magazu: objava 4:5 za feed i story 9:16, istim jezikom kao plakat. Na mreži niko ne
          skenira kod — zato link: u opisu objave, ili kao link naljepnica u storyju.
        </Lead>
        <Points
          items={[
            <>
              <b>Isti stihovi, isti telefoni</b> — plakat u radnji i objava na mreži se prepoznaju kao jedno.
            </>,
            <>
              <b>Story ostavlja rubove prazne</b> — Instagramove kontrole ne pokrivaju ništa bitno.
            </>,
          ]}
        />
        <R i={6}>
          <a href="/prezentacija/objava" target="_blank" className="dk-btn-gold mt-[3.4vh]">
            Objava i story {Ico.external}
          </a>
        </R>
      </div>
      <R i={2} className="hidden items-end gap-[1.6vw] lg:flex">
        <div style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)' }}>
          <SocialPost data={d.poster} width="min(27vw, 56vh)" />
        </div>
        <div style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)' }}>
          <SocialStory data={d.poster} width="min(19.7vw, 41vh)" />
        </div>
      </R>
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════
   PITANJA
   ═══════════════════════════════════════════════════════════════ */

function Pitanja({ d }: { d: DeckData }) {
  return (
    <div className="grid h-full items-center gap-[5vw] lg:grid-cols-[1fr_auto]">
      <div>
        <R i={1}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/signature.webp" alt="Dino Merlin" style={{ height: 'clamp(56px, 10vh, 120px)', width: 'auto' }} />
        </R>
        <R i={2}>
          <h1 className="dk-h1 mt-[4vh]">
            Pitanja<em>?</em>
          </h1>
        </R>
        <R i={3}>
          <p className="dk-lead mt-[2.6vh] max-w-[26em]">
            Hvala. Aplikacija je živa — skenirajte i ponesite stih kući.
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
