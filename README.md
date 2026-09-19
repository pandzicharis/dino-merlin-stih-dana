# Stih dana

Jedan stih Dine Merlina, svaki dan u isto vrijeme. PWA, Next.js 16.

Koncept i vizija: [KONCEPT.md](KONCEPT.md) · Tehnički plan: [TEHNICKI-PLAN.md](TEHNICKI-PLAN.md)

---

## Pokretanje

Projekat traži Node 20+ (`.nvmrc` → 22.21.0).

```bash
nvm use && npm install && npm run dev
```

→ http://localhost:3111

## Dodavanje stihova

Sve ide u [`data/verses.ts`](data/verses.ts) — jedini fajl koji se dira.
Palete po raspoloženju su u [`data/moods.ts`](data/moods.ts).

```bash
npm run verses:check
```

Validator provjerava duplikate, dužinu, popunjenost i pokrivenost moodova.
Vrti se i automatski prije svakog builda, u strogom modu — build **neće proći**
dok ijedan `TODO:` ostane u podacima.

## Ručno pomjeranje datuma (dev)

Stih se računa iz datuma, pa se svaki dan može reproducirati:

| | |
|---|---|
| `/?d=2026-12-31` | tačan dan |
| `/?offset=-3` | tri dana unazad |
| `/?verse=moja-svila` | forsiran stih |
| `/?mood=nostalgija` | forsirana paleta |
| `/dev/moods` | sve palete na jednom ekranu |

Tipke: `[` dan nazad · `]` dan naprijed · `\` reset na danas · `m` sljedeći mood · `0` ukloni override.

Sve je aktivno samo u dev modu, ili uz `NEXT_PUBLIC_DATE_OVERRIDE=1` na stagingu.

## Notifikacije

Trebaju VAPID ključevi i Supabase (vidi `.env.example`):

```bash
npx web-push generate-vapid-keys
```

Šemu baze primijeni iz [`supabase/schema.sql`](supabase/schema.sql).
Slanje pokreće [`.github/workflows/daily-push.yml`](.github/workflows/daily-push.yml)
svaki sat; ruta `/api/cron/send-daily` sama odlučuje kome je vrijeme.

> **iOS:** Web Push radi isključivo iz PWA-a dodanog na početni ekran (iOS 16.4+),
> nikad iz Safari taba. Onboarding to vodi korak po korak.

## Brend

Vizuelni identitet preuzet je s dinomerlin.com: crna pozadina, **Rubik**,
šampanj zlatna `#BFA87F` (`lib/brand.ts`). Mood palete iz `data/moods.ts`
boje **sam stih**; brand boje drže hrom — logotip, datum, dugmad.

Asseti u [`public/brand/`](public/brand/README.md) (logotip i portret) su
**placeholderi preuzeti s njegovog sajta**, tu samo za prototip. Moraju biti
odobreni ili zamijenjeni prije bilo kakvog javnog launcha — pročitaj taj README.

Uvodni ekran (`components/Splash.tsx`) pojavljuje se jednom po sesiji.
Gasi se brisanjem `<Splash />` iz `components/DailyVerse.tsx`.

## Atmosfera po moodu

`data/moods.ts` ne drži samo boje nego i ponašanje pozadine. Sedam slojeva,
odozdo prema gore (`components/MoodBackground.tsx`):

| Sloj | Podešava se sa |
|---|---|
| osnovna boja + tri plutajuće mrlje | `gradient`, `speed`, `drift` |
| portret, utopljen kroz `mix-blend: screen` | `figure` (0.07–0.22), `focus` |
| sjaj iza stiha u boji naglaska | `bloom` |
| spori dijagonalni prelaz svjetla | `sweep` |
| zrnatost, preko 0.5 i filmsko podrhtavanje | `grain` |
| vinjeta | `vignette` |

| note koje plutaju uvis | `notes` |

Tako je `nostalgija` spora, zrnata i zatvorena vinjetom, a `sloboda` brza,
svijetla, s prelazom svjetla i osam nota — ista mehanika, drugi osjećaj.

Animira se isključivo `transform` i `opacity`; `prefers-reduced-motion`
zaustavlja sve. Portret se gasi postavljanjem `figure: 0`.

## Potpis u zaglavlju

Zaglavlje nosi rukom pisani potpis. Original spasi kao
`public/brand/signature-src.png` pa pokreni:

```bash
npm run brand:signature
```

Skripta prepoznaje i sliku koja već ima providnu podlogu i onu gdje je potez
taman na svijetlom, izrezuje na stvarni potez i sprema bijeli `signature.webp`.
Dok fajla nema, zaglavlje prikazuje tipografski logotip — ništa se ne lomi.

Potpis nosi i ikone aplikacije:

```bash
npm run brand:icons
```

U zaglavlju stoji kao lockup (`components/BrandLockup.tsx`): potpis, zlatna
vlas, pa „STIH DANA" — linija se rasteže na širinu šireg elementa da dvije
stvari čitaju kao jedan znak.

## Slušanje pjesme

Uz svaki stih ide `youtube` link. Pored naziva pjesme stoji YouTube znak
koji otvara pjesmu **u novoj kartici** — namjerno nije ugrađeni plejer,
da ekran ostane stih, a ne media player.

Time otpada i problem autoplaya: browseri ionako blokiraju zvuk bez geste
korisnika, a odlazak na YouTube je i licencno najčistiji put.

## Obavijesti

Zvono u podnožju (`components/NotifyToggle.tsx`) uključuje i isključuje
dnevnu obavijest jednim dodirom, i pokazuje stvarno stanje pretplate.

Da bi uključivanje radilo, trebaju `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY` i Supabase ključevi — bez njih zvono javi da nije
uspjelo. Na iPhoneu zvono ne može ništa dok aplikacija nije na početnom
ekranu, pa se tamo umjesto njega pokaže uputa (`NotifyPrompt`).

## Arhitektura ukratko

Stih se **ne bira u bazi — računa se iz datuma** (`lib/pickVerse.ts`).
Stranica je zato statična i servira se s CDN-a: 500 i 500.000 korisnika
koštaju isto. Baza postoji samo za push subscriptions.

## Prije javnog launcha

Tekstovi pjesama su autorsko djelo. Aplikacija je `noindex` i ostaje privatna
dok ne stigne dozvola — detalji u [KONCEPT.md](KONCEPT.md#8-pravni-dio--pročitaj-ovo-prije-prve-linije-koda).
