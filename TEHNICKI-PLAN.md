# TEHNIČKI PLAN — Stih dana

Implementacioni plan za MVP iz [KONCEPT.md](KONCEPT.md). Redoslijed je namjeran: svaki korak je samostalno deployabilan.

---

## 0. Stack (zaključano)

| | |
|---|---|
| Framework | Next.js 15+ (App Router), TypeScript, React 19 |
| Stil | Tailwind v4 |
| Animacije | `motion` (Framer Motion 12) |
| Podaci | statični TS modul (`data/verses.ts`) — bez baze |
| Baza | Supabase Postgres (**samo** push subscriptions) |
| Push | Web Push API + VAPID (`web-push`), vlastiti Service Worker |
| Cron | GitHub Actions (besplatno, satno) → kasnije Vercel Cron |
| Hosting | Vercel |
| Share slika | `next/og` (ImageResponse) na Edge runtime |

**Bez:** Firebase, bez auth biblioteke, bez state managera, bez CMS-a. Sve troje dolazi tek kad brojke to traže.

---

## 1. Scaffolding

Folder već ima `KONCEPT.md` i `data/`, pa `create-next-app` ide preko privremenog foldera:

```bash
npx create-next-app@latest .next-init --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*" --yes
rsync -a --exclude node_modules --exclude .git .next-init/ . && rm -rf .next-init
npm i motion web-push @supabase/supabase-js
npm i -D @types/web-push tsx
git init && git add -A && git commit -m "init"
```

### Struktura

```
app/
  layout.tsx              root layout, fontovi, manifest, theme-color
  page.tsx                glavni ekran (client, statički prerender)
  favoriti/page.tsx       lokalno spašeni stihovi
  dev/moods/page.tsx      ⬅ svi moodovi odjednom (samo dev)
  og/[id]/route.tsx       share slika 1080×1920 i 1080×1080
  api/
    push/subscribe/route.ts
    push/unsubscribe/route.ts
    cron/send-daily/route.ts
components/
  VerseScreen.tsx         kompozicija ekrana
  VerseText.tsx           animacija riječ-po-riječ
  MoodBackground.tsx      animirani gradijent + grain
  BehindTheVerse.tsx      swipe-up sloj
  ShareSheet.tsx          share / download slike
  NotifyPrompt.tsx        onboarding za PWA + notifikacije
  DevDateBar.tsx          ⬅ ručno pomjeranje datuma
data/
  verses.ts               ⬅ TVOJ FAJL
  moods.ts                palete
lib/
  date.ts                 vrijeme, timezone, dev override
  pickVerse.ts            deterministički izbor stiha
  storage.ts              favoriti + postavke (localStorage)
  push-client.ts          subscribe/unsubscribe iz browsera
  supabase.ts
scripts/
  check-verses.ts         validator data fajla
public/
  sw.js                   service worker (push + minimalni cache)
  manifest.webmanifest
  icons/
```

---

## 2. Srce sistema — izbor stiha

**Pravilo:** stih se **ne bira u bazi, računa se iz datuma.** Zato je stranica statična, CDN-cache-ana i identična za sve — 500 i 500.000 korisnika koštaju isto.

**Timezone je fiksan na `Europe/Sarajevo`**, ne na uređaj korisnika. Razlog: svi moraju vidjeti isti stih istog dana, inače share i razgovor o stihu nemaju smisla.

### `lib/date.ts`

```ts
export const TZ = 'Europe/Sarajevo'
export const EPOCH = '2026-01-01'

/** Današnji datum u Sarajevu, format YYYY-MM-DD. */
export function todayInTz(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now)
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function daysSinceEpoch(iso: string): number {
  // podne u UTC izbjegava svaki DST edge-case
  const a = new Date(`${iso}T12:00:00Z`).getTime()
  const b = new Date(`${EPOCH}T12:00:00Z`).getTime()
  return Math.round((a - b) / 86_400_000)
}
```

### `lib/pickVerse.ts`

Naivni `daysSince % length` bi značio da stihovi uvijek idu istim redoslijedom iz fajla. Zato se svaki ciklus deterministički promiješa:

```ts
import { VERSES, VERSE_BY_ID, type Verse } from '@/data/verses'
import { daysSinceEpoch } from './date'

/** mali determinističi PRNG (mulberry32) */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher–Yates sa sjemenom = broj ciklusa. */
function orderForCycle(cycle: number, n: number): number[] {
  const idx = [...Array(n).keys()]
  const rand = rng(cycle * 2654435761)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx
}

export function pickVerse(dateISO: string, pool: Verse[] = VERSES): Verse {
  const d = daysSinceEpoch(dateISO)
  const n = pool.length
  const cycle = Math.floor(d / n)
  const pos = ((d % n) + n) % n
  return pool[orderForCycle(cycle, n)[pos]]
}
```

**Posljedica:** isti datum → uvijek isti stih (idempotentno, share link radi zauvijek), ali svaki krug kroz bazu ima drugi redoslijed.

**Upozorenje koje moraš zapamtiti:** dodavanje stihova mijenja `n`, a time i raspored **unaprijed**. Prije launcha je svejedno; nakon njega treba zamrznuti parove `datum → verseId` u `data/history.json` da share linkovi i favoriti ne odlutaju.

---

## 3. Ručno pomjeranje datuma na localhostu

Tri načina, svi rade zajedno. Aktivni su kad je `NODE_ENV=development` **ili** `NEXT_PUBLIC_DATE_OVERRIDE=1` (za staging).

| Način | Primjer | Kad koristiš |
|---|---|---|
| URL apsolutno | `/?d=2026-12-31` | provjera konkretnog dana |
| URL relativno | `/?offset=-3` | brzo unazad/naprijed |
| Dev traka + tipke | `[` `]` `\` | klikanje kroz 30 dana zaredom |
| Forsiran stih | `/?verse=moja-svila` | testiranje jednog stiha |
| Forsiran mood | `/?mood=nostalgija` | testiranje palete |

### `lib/date.ts` (dodatak)

```ts
export const OVERRIDE_ON =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_DATE_OVERRIDE === '1'

const KEY = 'stihdana:devDate'

/** Datum koji aplikacija smatra "danas". Jedini izvor istine u UI-ju. */
export function getActiveDate(): string {
  const real = todayInTz()
  if (!OVERRIDE_ON || typeof window === 'undefined') return real

  const q = new URLSearchParams(window.location.search)
  const d = q.get('d')
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d

  const off = q.get('offset')
  if (off && !Number.isNaN(Number(off))) return addDays(real, Number(off))

  return localStorage.getItem(KEY) ?? real
}

export function setDevDate(iso: string | null) {
  if (!OVERRIDE_ON) return
  iso ? localStorage.setItem(KEY, iso) : localStorage.removeItem(KEY)
  window.dispatchEvent(new Event('devdatechange'))
}
```

> **Bitno:** `getActiveDate()` čita `window`, pa se stih bira **na klijentu**. To je namjerno — stranica ostaje potpuno statična (čist HTML na CDN-u), a override radi bez ijednog servera. Server-side se datum koristi samo u `/og/[id]` i u cron jobu.

### `components/DevDateBar.tsx`

Renderuje se samo ako `OVERRIDE_ON`. Fiksna traka na dnu:

```
◀   2026-12-31  (dan 364 · ciklus 52)   ▶     danas     nostalgija-01
```

Tipke: `[` dan nazad, `]` dan naprijed, `\` reset na stvarni danas, `m` ciklus kroz moodove.

```tsx
'use client'
import { useEffect, useState } from 'react'
import { OVERRIDE_ON, getActiveDate, setDevDate, addDays, todayInTz } from '@/lib/date'
import { pickVerse } from '@/lib/pickVerse'

export function DevDateBar() {
  const [date, setDate] = useState(getActiveDate)
  if (!OVERRIDE_ON) return null

  const move = (n: number) => {
    const next = addDays(date, n)
    setDevDate(next); setDate(next)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '[') move(-1)
      if (e.key === ']') move(1)
      if (e.key === '\\') { setDevDate(null); setDate(todayInTz()) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const v = pickVerse(date)
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex items-center gap-3
                    bg-black/80 px-3 py-2 font-mono text-xs text-white backdrop-blur">
      <button onClick={() => move(-1)}>◀</button>
      <span>{date}</span>
      <button onClick={() => move(1)}>▶</button>
      <button onClick={() => { setDevDate(null); setDate(todayInTz()) }}>danas</button>
      <span className="ml-auto opacity-60">{v.id} · {v.mood}</span>
    </div>
  )
}
```

### `/dev/moods` — kontrolni ekran

Grid od 7 kartica, po jedna za svaki mood, svaka renderuje pravi `VerseScreen` u malom. Jedan pogled = vidiš da li ijedna paleta ispada iz sistema. Ruta je `notFound()` van dev moda.

---

## 4. Vizuelni sloj

### `MoodBackground.tsx`
Tri radijalna gradijenta iz `MOODS[mood].gradient`, svaki sa svojim `animate` ciklusom 18–26 s, `filter: blur(80px)`, plus SVG `feTurbulence` grain overlay sa `mix-blend-mode: overlay`. Prelaz između moodova: `AnimatePresence` crossfade 1.2 s.

Performanse: animiraj **samo** `transform` i `opacity`. Nikad `background-position`. Cilj: 60fps na iPhone SE.

### `VerseText.tsx`
Riječ-po-riječ:

```tsx
<motion.span
  initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
  transition={{ delay: i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
/>
```

Metapodaci (pjesma · album · godina) ulaze nakon zadnje riječi + 400 ms.
`prefers-reduced-motion` → sve postaje jedan fade od 300 ms.

### Tipografija
Stih: varijabilni serif (Fraunces ili Playfair Display), `clamp(1.75rem, 7vw, 3.25rem)`, `line-height: 1.25`, `text-wrap: balance`.
Meta: Inter, `0.8rem`, `letter-spacing: 0.08em`, uppercase, `opacity: 0.6`.
Oba preko `next/font` (self-hosted, bez FOUT).

---

## 5. Share slika

`app/og/[id]/route.tsx`, Edge runtime, `ImageResponse`:

- `?f=story` → 1080×1920 · `?f=post` → 1080×1080
- ista paleta iz `MOODS`, isti serif, diskretan potpis dolje
- `Cache-Control: public, immutable, max-age=31536000` — slika za dati `id` se nikad ne mijenja, pa se generiše jednom u životu

Klijent: `navigator.share({ files: [...] })` gdje postoji, fallback na download + copy link.

---

## 6. Notifikacije

### Tok
1. Korisnik vidi stih (bez ikakvog prompta).
2. Nakon ~8 s ili na povratak drugi dan → `NotifyPrompt`: *"Stih svaki dan u 20:00?"*
3. **iOS:** prvo vodič "Podijeli → Dodaj na početni ekran". Web Push na iPhoneu radi **isključivo** iz instaliranog PWA (iOS 16.4+). Detekcija: `!window.matchMedia('(display-mode: standalone)').matches`.
4. **Android/desktop:** odmah `Notification.requestPermission()`.
5. `pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC })` → POST `/api/push/subscribe`.

### Baza (Supabase, jedina tabela)

```sql
create table push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  send_hour  smallint not null default 20,   -- lokalno vrijeme korisnika
  tz         text not null default 'Europe/Sarajevo',
  created_at timestamptz default now(),
  last_ok    timestamptz
);
create index on push_subscriptions (send_hour);
```

RLS uključen, upis ide isključivo preko service-role ključa sa servera.

### Cron — `/api/cron/send-daily`

Radi **svaki sat**, ne jednom dnevno (da podrži različita vremena i DST):

```ts
const hourIn = (tz: string) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date()))

// 1. auth: header x-cron-secret === process.env.CRON_SECRET, inače 401
// 2. select * from push_subscriptions
// 3. filter: hourIn(sub.tz) === sub.send_hour
// 4. verse = pickVerse(todayInTz())
// 5. webpush.sendNotification(...) u batchevima po 100, Promise.allSettled
// 6. statusCode 404 || 410 → obriši endpoint (mrtav uređaj)
```

Payload je namjerno kratak — prvi red stiha, klik otvara `/`:

```json
{ "title": "Stih dana", "body": "Nešto lijepo treba da se desi", "url": "/", "tag": "stih-dana" }
```

Pokretač — GitHub Actions (besplatno, satno):

```yaml
# .github/workflows/daily-push.yml
on:
  schedule: [{ cron: '5 * * * *' }]
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST "$URL/api/cron/send-daily" -H "x-cron-secret: $SECRET"
        env: { URL: '${{ secrets.APP_URL }}', SECRET: '${{ secrets.CRON_SECRET }}' }
```

> Vercel Hobby plan dopušta cron **samo jednom dnevno** — zato GitHub Actions za MVP. Prelaz na Vercel Cron kad odeš na Pro.

### `public/sw.js`
Minimalan: `push` → `showNotification`, `notificationclick` → `clients.openWindow(url)` uz fokus postojećeg taba, plus offline fallback za `/`. Bez agresivnog cache-a — sadržaj se mijenja svaki dan.

---

## 7. Validator podataka

`scripts/check-verses.ts` (`npm run verses:check`, obavezno u CI i u `prebuild`):

- ✅ `id` jedinstven i kebab-case
- ✅ `mood` postoji u `MOODS`
- ✅ ≤ 4 reda, ≤ 120 znakova
- ✅ `song`, `album`, `year` popunjeni
- ✅ nijedan `TODO:` u tekstu **kad je `NODE_ENV=production`** (u dev-u samo warning)
- ✅ svi moodovi imaju bar jedan stih
- ⚠️ upozori ako je `VERSES.length < 30` (prekratak ciklus)

---

## 8. Env varijable

```bash
# .env.local
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:ti@example.com
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
NEXT_PUBLIC_DATE_OVERRIDE=0   # 1 samo na staging/preview
```

VAPID ključevi: `npx web-push generate-vapid-keys`.

---

## 9. Redoslijed izrade

| # | Korak | Rezultat | Stanje |
|---|---|---|---|
| 1 | Scaffold + `data/` + `lib/date.ts` + `lib/pickVerse.ts` | `pickVerse('2026-05-01')` vraća stih | ✅ |
| 2 | `MoodBackground` + `VerseText` + `VerseScreen` | glavni ekran | ✅ |
| 3 | `DevDateBar` + `/dev/moods` | klikaš kroz dane i sve palete | ✅ |
| 4 | validator + `prebuild` hook | podaci se ne mogu pokvariti | ✅ |
| 5 | `BehindTheVerse` (swipe gore) | dubina | ✅ |
| 6 | `/og/[id]` + `ShareSheet` + `/stih/[id]` | **viralna petlja** | ✅ |
| 7 | manifest + ikone + `sw.js` + install onboarding | PWA | ✅ (ikone su placeholder) |
| 8 | Supabase + subscribe API + `NotifyPrompt` | opt-in radi | ⚙️ kod napisan, čeka VAPID + Supabase ključeve |
| 9 | cron ruta + GitHub Action | **ritual radi** | ⚙️ isto |
| 10 | favoriti (`localStorage`) | zadržavanje | ✅ |
| 11 | 90+ stihova, Vercel deploy, lozinka | privatni MVP za prezentaciju | ⬜ |
| 12 | brend: Rubik + `#BFA87F`, logotip, splash, ikone | prepoznatljivo da je Dino Merlin | ✅ (asseti su placeholderi) |
| 13 | pravi stihovi, note oko stiha, plejer pjesme | proizvod ima sadržaj | ✅ 16 stihova, 4 mooda |

Koraci 1–3 su ~40% ukupne vrijednosti proizvoda. Ne idi dalje dok ekran ne izgleda tako da bi ga sam stavio na home screen.

---

## 10. Definicija gotovog MVP-a

- [ ] Lighthouse ≥ 95 na mobile (Performance i Accessibility)
- [ ] Prvi paint stiha < 1.2 s na 4G
- [ ] Animacija 60 fps na iPhone SE / srednjem Androidu
- [ ] `prefers-reduced-motion` ispoštovan
- [ ] Radi offline (zadnji stih iz cachea)
- [ ] Share slika ispravna i na IG Story i na WhatsApp preview
- [ ] Notifikacija stigla tačno u 20:00 tri dana zaredom, i na iOS PWA i na Androidu
- [ ] `?d=` i dev traka tačno reprodukuju bilo koji dan
- [ ] Nijedan `TODO:` u `verses.ts`, min. 90 stihova
- [ ] `noindex` + zaštita lozinkom dok ne stigne dozvola

---

## 11. Prije javnog launcha — podsjetnik

Tekstovi su autorsko djelo. MVP ostaje privatan i neindeksiran dok ne dobiješ dozvolu (Dino Merlin / izdavač / AMUS). Detalji i strategija pristupa su u [KONCEPT.md](KONCEPT.md#8-pravni-dio--pročitaj-ovo-prije-prve-linije-koda).
