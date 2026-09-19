# STIH DANA — Dino Merlin

**Koncept, plan i vizija** · v1.0

---

## 1. Vizija u jednoj rečenici

Jednom dnevno, u isto vrijeme, telefon ti donese jedan stih Dine Merlina — bez feeda, bez scrolla, bez buke. Jedan stih, jedan trenutak, pa se aplikacija skloni do sutra.

To je suprotnost svemu ostalom na telefonu. **To je i jedini razlog zašto bi ovo neko zadržao na home screenu.**

---

## 2. Šta aplikacija JESTE i šta NIJE

| JESTE | NIJE |
|---|---|
| Jedan stih dnevno, cijeli ekran | Baza tekstova / lyrics sajt |
| Ritual (notifikacija u isto vrijeme) | Music player |
| Estetski objekat — tipografija i animacija su proizvod | Fan forum / društvena mreža |
| Favoriti (tiho, u pozadini) | Mjesto gdje se scrolla |

Najveća greška koju možeš napraviti je dodati "još malo funkcionalnosti". Snaga je u ograničenju.

---

## 3. MVP — tačan opseg (faza 1)

1. **Glavni ekran** — stih dana, naziv pjesme, album + godina. Ništa više. Bez menija, bez headera.
2. **Notifikacija** — jedna dnevno, korisnik bira vrijeme (default 20:00).
3. **Share kao slika** — jedan tap → generisana slika stiha (9:16 za IG Story + 1:1 za post), sa diskretnim logom aplikacije. **Ovo je jedini marketinški kanal koji ti treba.** Svaki share je besplatna reklama u publici koja već voli Merlina.
4. **Slušanje** — dodir na naziv pjesme pušta je s YouTubea.
5. **Favoriti** — srce, čuva se lokalno (localStorage), bez logina.
6. **PWA install** — "Dodaj na početni ekran", sa onboardingom koji to objasni.

**Bez logina, bez registracije, bez profila.** Nula friction.

---

## 4. "Vau" faktor — gdje se dobija ili gubi bitka

Ovo je 70% vrijednosti proizvoda. Detalji:

- **Stih se ispisuje riječ po riječ** — staggered fade-up, ~80ms razmak, blagi blur→clear. Osjećaj kao da neko pjeva, a ne kao da si otvorio tekst fajl.
- **Pozadina reaguje na raspoloženje stiha.** Svaki stih ima tag (`ljubav`, `nostalgija`, `nada`, `sloboda`) → svoj animirani gradijent / paletu. Sporo pulsira, ~20s ciklus. Nikad dvije iste večeri isti osjećaj.
- **Tipografija je brend.** Jedan jak serif za stih (npr. Fraunces / Playfair), neutralni sans za metapodatke. Veliko, prozračno, centrirano.
- **Note plutaju kroz pozadinu** i uokviruju stih tankom linijom — stihovi su kratki, par riječi, pa im treba nešto što drži prostor.
- **Haptika** na otkrivanju stiha i na favoritu (iOS/Android web vibration API).
- **Dark by default.** Aplikacija se otvara navečer.
- **Splash u 3 sekunde, bez loadera.** Statički sadržaj, sve je već na CDN-u.

---

## 5. Tehnički stack — najjeftinije + najstabilnije

### Odabir

| Sloj | Izbor | Cijena |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | $0 |
| Hosting | **Vercel** (Hobby → Pro $20/mj kad naraste) | $0–20/mj |
| Stihovi | **Statični JSON u repou** — bez baze | $0 |
| Push notifikacije | **Web Push (VAPID)** — nativni standard, bez Firebase | $0 |
| Baza (samo za push subscriptions) | **Supabase free** ili **Cloudflare D1** | $0 |
| Cron (slanje notifikacija) | **Vercel Cron** ili GitHub Actions | $0 |
| Share slike | `@vercel/og` (runtime) ili pre-generisano u buildu | $0 |
| Analitika | Vercel Analytics ili Plausible | $0–9/mj |
| Domena | `stihdana.ba` / `.com` | ~$15/god |

**Ukupno MVP: $0–20 mjesečno.**

### Ključna arhitektonska odluka (ovo ti rješava skalabilnost)

**Stih dana se ne bira u bazi — računa se iz datuma.**

```ts
const index = daysSince(EPOCH) % verses.length
```

Posljedica: stranica je **100% statična**, cache-ana na CDN-u, ista za svakog korisnika. Nema database query-ja po korisniku, nema server rendera. 10 korisnika i 500.000 korisnika koštaju praktično isto i imaju isti response time. Ovo je razlog zašto ova aplikacija može izdržati da je Merlin podijeli na svom profilu i da ti ne padne.

Jedini dio koji dodiruje bazu je slanje notifikacija — a to je jedan cron job koji čita listu subscriptiona i šalje batch.

### Kritično ograničenje koje moraš znati unaprijed

**Web Push na iPhoneu radi SAMO ako je aplikacija dodana na Home Screen** (iOS 16.4+). U Safari tabu — ne radi.

Zato onboarding mora biti: *stih → "hoćeš ga svaki dan?" → jasan vizuelni vodič za "Dodaj na početni ekran" → tek onda traži dozvolu za notifikacije.* Ako ovo zabrljaš, izgubio si 60% iOS korisnika.

Android/Chrome: radi normalno, bez instalacije.

---

## 6. Model podataka

```json
{
  "id": "nesto-lijepo-01",
  "text": "Nešto lijepo treba da se desi\nsvima koji čekaju",
  "song": "Nešto lijepo treba da se desi",
  "album": "Sredinom",
  "year": 2000,
  "mood": "nada",
  "context": "Pjesma napisana kao..."
}
```

Jedan `verses.json` fajl. Dodavanje stihova = commit u repo. Kad ih bude 500+, prelazi se na Sanity/Supabase CMS — ne prije.

**Preporuka: kreni sa 90–120 stihova.** To je 3–4 mjeseca bez ponavljanja, dovoljno da vidiš da li ljudi ostaju.

---

## 7. Roadmap

### Faza 1 — MVP (2–3 sedmice part-time)
Statični sajt + PWA + notifikacije + share slika + favoriti. Deploy na Vercel. **Privatno / neindeksirano.**

### Faza 2 — nakon dozvole, javni launch (2 sedmice)
Domena, SEO/OG kartice, onboarding polish, analitika, izbor vremena notifikacije, streak ("42 dana zaredom").

### Faza 3 — dubina (1–2 mjeseca)
- **30s audio isječak** pjesme u pozadini stiha *(traži posebnu licencu — vidi dole)*
- "Pogodi pjesmu" — mini kviz iz arhive
- Kolekcije: *Stihovi o Sarajevu*, *Stihovi o odlasku*
- Personalizacija teme

### Faza 4 — native, samo ako brojke to opravdaju
**Expo / React Native**, isti podaci, isti backend. Razlozi za prelazak: lockscreen widget, pouzdanije notifikacije, background audio, App Store prisustvo kao legitimitet pred izdavačem. **Ne prije nego što imaš dokaz da ljudi ostaju.**

---

## 8. Pravni dio — pročitaj ovo prije prve linije koda

Tekstovi pjesama su **autorsko djelo**. Javno objavljivanje stihova bez dozvole je povreda autorskih prava, čak i ako je aplikacija besplatna i napravljena iz ljubavi.

**Šta ti treba:**
- Za **tekstove**: dozvola autora / izdavača. U BiH kolektivnu zaštitu vodi **AMUS**.
- Za **muziku u pozadini** (faza 3): dodatno sinhronizacijska i mehanička licenca — znatno skuplje i komplikovanije. Zato je to faza 3, a ne MVP.

**Strategija koja ti daje najveću šansu:**

1. Napravi MVP sa 20–30 stihova, **privatno** (link sa lozinkom, `noindex`).
2. Ne traži dozvolu za ideju — **pokaži gotov proizvod.** Razlika između "imam ideju za aplikaciju" i "evo, otvori ovo na telefonu" je razlika između ignorisanog emaila i sastanka.
3. Kontaktiraj tim preko kontakta na dinomerlin.com / menadžmenta. Pozicioniraj kao **poklon i omaž**, ne kao biznis prijedlog. Bez monetizacije u prvoj verziji — to uklanja najveću prepreku u razgovoru.
4. Ponudi im kontrolu: oni biraju stihove, oni odobravaju, ime i vizuelni identitet ostaju njihovi.
5. Tek nakon blagoslova — javni launch.

Ovo nije pravni savjet; za formalni ugovor ti treba advokat za autorsko pravo. Ali redoslijed koraka je ono što ti povećava šanse.

---

## 9. Metrike uspjeha (prvih 90 dana)

| Metrika | Cilj | Zašto |
|---|---|---|
| Notifikacija opt-in | > 40% | Bez ovoga nema rituala |
| D7 retention | > 35% | Da li se ljudi vraćaju |
| D30 retention | > 20% | Da li je postao navika |
| Share rate | > 5% dnevnih korisnika | Jedini kanal rasta |
| Instalacija PWA | > 25% | Mjeri koliko onboarding radi |

Ako je D30 ispod 10% — problem nije u stihovima, nego u tome što aplikacija ne daje osjećaj. Vrati se na sekciju 4.

---

## 10. Prvi konkretni koraci

1. Skupi **90 stihova** u `verses.json` (ti ovo radiš, ne kod).
2. Odaberi ime i domenu — `stihdana.ba` je snažno i kratko.
3. Next.js skeleton + glavni ekran + animacija stiha. **Samo to.** Prvo mora izgledati savršeno na jednom ekranu.
4. Share slika.
5. Notifikacije.
6. Favoriti.
7. Privatni deploy → pokaži 5 ljudi koji vole Merlina → slušaj šta kažu.
8. Kontakt sa timom.

---

## Zaključak

Tehnički, ovo je mala aplikacija — statična stranica, cron job i jedna tabela. To je i cijela poenta: **sav budžet i trud idu u osjećaj, ne u infrastrukturu.**

Ono što će očarati i publiku i pjevača nije stack, nego trenutak kad se telefon upali u 20:00 i na ekranu se, riječ po riječ, ispiše nešto što su čuli sto puta — a sad izgleda kao da je napisano za njih.
