# Deploy na Vercel

Redoslijed je bitan: ključevi prije deploya, baza prije prvog uključivanja obavijesti.

---

## 1. Ključevi

### VAPID (Web Push)

```bash
npx web-push generate-vapid-keys
```

Ispiše par — javni ide u `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, privatni u `VAPID_PRIVATE_KEY`.
**Generiši ih jednom.** Ako ih kasnije promijeniš, sve postojeće pretplate prestanu raditi.

### Tajna za cron

```bash
openssl rand -hex 32
```

To je `CRON_SECRET` — bez nje ruta za slanje vraća 401.

---

## 2. Supabase

1. Novi projekat na [supabase.com](https://supabase.com) (free tier je dovoljan).
2. **SQL Editor** → zalijepi i pokreni [`supabase/schema.sql`](supabase/schema.sql).
3. **Project Settings → API** → uzmi:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` ključ → `SUPABASE_SERVICE_ROLE_KEY`

Shema je idempotentna i nema zasebnih migracija: na svaku izmjenu pokreni
**cijeli fajl ponovo**. Ako je propustiš, ruta za slanje javi da
`claim_due_subscriptions` ne postoji.

Da provjeriš je li prošlo, pokreni u istom SQL Editoru
[`supabase/verify.sql`](supabase/verify.sql). Ništa ne mijenja — ispiše 15
redova i svaki mora pisati PROLAZ.

> **Redoslijed kod nadogradnje:** prvo pusti deploy koda, pa onda `schema.sql`.
> Obrnuto ide takođe, ali kratko ostaviš staru rutu nad novom shemom — a ona
> ne zna upisati oznaku dana, pa bi se u tom prozoru mogla poslati jedna
> obavijest viška.

> `service_role` zaobilazi RLS. Nikad ga ne stavljaj u `NEXT_PUBLIC_*` i nikad u klijentski kod — ovdje se koristi samo u API rutama.

---

## 3. Vercel

```bash
git init && git add -A && git commit -m "Stih dana"
gh repo create stih-dana --private --source=. --push
```

Onda na [vercel.com/new](https://vercel.com/new) → import repozitorija. Next.js se prepozna sam.

### Varijable okoline

**Settings → Environment Variables**, sve za *Production*:

| Varijabla | Vrijednost |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | javni VAPID ključ |
| `VAPID_PRIVATE_KEY` | privatni VAPID ključ |
| `VAPID_SUBJECT` | `mailto:tvoj@email.com` |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role ključ |
| `CRON_SECRET` | nasumična tajna iz koraka 1 |
| `NEXT_PUBLIC_SITE_URL` | puna adresa, npr. `https://stih-dana.vercel.app` |

`NEXT_PUBLIC_SITE_URL` je bitan — po njemu se grade OG slike i share linkovi.
**`NEXT_PUBLIC_DATE_OVERRIDE` ne postavljaj** u produkciji; bez nje nema dev trake.

### Prije nego klikneš Deploy

Build pokreće validator u strogom modu. Ako je ijedan stih nepotpun, build pukne
namjerno. Provjeri lokalno:

```bash
npm run verses:check
```

---

## 4. Cron — slanje obavijesti

Ruta je `POST /api/cron/send-daily` (radi i `GET`).

**Ruta ne gleda sat.** Kad god je pozoveš, pošalje svima koji još nisu dobili
stih za taj dan. Kad se to dešava određuje isključivo raspored crona — jedno
mjesto, koje ti mijenjaš.

Zato je i napravljena da se smije zvati **koliko god puta**: pozovi je deset
puta u toku dana i obavijest ode najviše jednom. Na tome počiva cijela
odbrana od propuštenog dana — okidač pokušava više puta, prvi uspjeh zatvori
dan, ostali zateknu prazan red.

**Dan zatvara samo uspjeh.** `last_sent_on` se upisuje tek kad push servis
primi obavijest. Ono što ne prođe — pad usred slanja, istekla funkcija,
pogrešan VAPID ključ — ostaje neoznačeno i čeka sljedeći poziv. (Ranije je
oznaku postavljalo preuzimanje porcije, prije slanja, pa je svaki takav
slučaj tiho pojeo dan: sljedeći prolaz bi zatekao prazan red i mirno javio
da je sve poslano.)

`?force=1` šalje i onima koji su stih za taj dan već dobili — i **ne dira
oznaku dana**. Test u deset ujutro zato ne može pojesti pravo slanje u podne.

> Ako pomjeriš raspored, pomjeri i `SEND_HOUR` u [`lib/date.ts`](lib/date.ts).
> Taj broj ne utiče na slanje — samo je natpis u aplikaciji ("stih stiže u
> 12:00h"), pa bi inače aplikacija govorila jedno a telefon radio drugo.

### GitHub Actions (već u repou)

[`.github/workflows/daily-push.yml`](.github/workflows/daily-push.yml) radi
posao besplatno. Treba mu dva secreta u repou — **Settings → Secrets and
variables → Actions**:

| Secret | Vrijednost |
|---|---|
| `APP_URL` | puna adresa aplikacije, npr. `https://stih-dana.vercel.app` (bez `/` na kraju) |
| `CRON_SECRET` | ista tajna kao u Vercelu |

Fali li ijedan, workflow pada odmah i **kaže koji** — ranije je to izgledalo
kao obična mrežna greška.

Ono što treba znati o njemu:

- **Pokušava šest puta**, od 10:00 do 11:40 UTC. Zakazani workflow na GitHubu
  zna kasniti desetak minuta, a pod opterećenjem zna i biti preskočen; jedan
  preskočen okidač je ranije značio dan bez stiha. Sad prvi koji prođe
  zatvori dan, ostali ne rade ništa.
- **Ljetno vrijeme se rješava samo.** GitHub prima samo UTC, pa je podne u
  Sarajevu ljeti 10:00 UTC a zimi 11:00. Pokušaji pokrivaju oba sata, a
  workflow pusti dalje samo one koji su u Sarajevu stvarno između 12 i 15 —
  tako da dva puta godišnje ne mijenjaš ništa.
- **Sam se ugasi nakon 60 dana bez ijednog commita** u repo. To je GitHubovo
  pravilo za zakazane workflowe i jedini razlog zbog kojeg ovo nije potpuno
  bez održavanja.
- Ručno pokretanje: **Actions → Stih dana — push → Run workflow**. Ide odmah,
  bez obzira na sat, a kvačica `force` šalje i onima koji su danas već dobili.
- Log svakog pokretanja nosi **cijeli odgovor rute**. Zeleno uz `"due": 0`
  znači da je stih već otišao, a ne da se ništa nije desilo.

### cron-job.org (najpouzdanije)

Ako hoćeš da slanje ne ovisi o GitHubovom raspoloženju ni o tome kad si
zadnji put commitao:

1. **Create cronjob**
2. URL: `https://tvoja-adresa.vercel.app/api/cron/send-daily`
3. Schedule: **svaki dan u 12:00**, uz timezone `Europe/Sarajevo` — jedini od
   troje koji zna za vremensku zonu, pa ljeti i zimi stiže u isti sat.
4. **Advanced → Headers**:
   ```
   x-cron-secret: <CRON_SECRET>
   ```
5. Request method: `GET` ili `POST` — oba rade.
6. Timeout podigni na **60 s**; na većem broju pretplatnika odgovor stiže
   tek kad svi workeri završe.

Slobodno ga pusti **uz** GitHub Actions. Ne pokvari ništa — ko je dobio stih,
dobio ga je; drugi okidač samo zatekne prazan red. To je i najjeftinija
polisa: dva nezavisna okidača ne padaju istog dana.

### Vercel Cron (alternativa)

Vercel Hobby dopušta cron jednom dnevno. Dodaj `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/send-daily", "schedule": "0 10 * * *" }] }
```

Raspored je u UTC: `0 10` je 12:00 u Sarajevu ljeti, 11:00 zimi. Vercel šalje
`Authorization: Bearer $CRON_SECRET` — ruta i to prihvata.

### Koliko dugo traje

Ruta iznad ~400 pretplatnika na redu sama sebe podigne u više paralelnih
workera (do 8). Desetak hiljada obavijesti tako stane u nekoliko sekundi.
Ako i to ne stigne prije isteka funkcije, odgovor nosi `"truncated": true` —
pozovi rutu ponovo i ona nastavi tamo gdje je stala, bez `?force=1`. Oni koji
su već dobili preskaču se sami.

## 5. Testiranje

```bash
# ko bi dobio obavijest, bez slanja
curl -s "https://tvoja-adresa.vercel.app/api/cron/send-daily?dry=1" \
  -H "x-cron-secret: $CRON_SECRET" | jq

# pošalji ponovo, i onima koji su stih za ovaj dan već dobili
curl -s -X POST "https://tvoja-adresa.vercel.app/api/cron/send-daily?force=1" \
  -H "x-cron-secret: $CRON_SECRET" | jq
```

`dry=1` vrati ukupan broj pretplatnika, koliko ih je na redu, koji je stih i
koliko bi se workera podiglo. `force=1` pošalje odmah, a dan ostavlja
otvorenim — pravo slanje u podne ide svejedno.

Ako `due` bude 0, odgovor sam kaže zašto — ili je stih za taj dan već otišao
svima, ili u bazi nema nijedne pretplate. To je dvoje se lako pomiješa.

Odgovor pravog slanja izgleda ovako:

```json
{ "due": 9840, "workers": 7, "sent": 9812, "removed": 26, "retry": 2,
  "failed": 0, "batches": 44, "ms": 6431 }
```

| polje | znači |
|---|---|
| `due` | koliko ih je bilo na redu |
| `sent` | koliko je stvarno otišlo |
| `removed` | uređaji koji više ne postoje (404/410) — obrisani iz baze |
| `retry` | prolazna greška kod push servisa; vraćeni u red za sljedeći poziv |
| `failed` | **naša** greška, npr. pogrešan VAPID ključ — vidi `last_error` u bazi |
| `truncated` | posao nije stao u jedan prolaz; pozovi rutu ponovo |

`failed` veći od nule je jedini broj koji traži da odmah pogledaš — zato i
obara GitHub Actions u crveno. Takvima dan ostaje otvoren, pa ih sljedeći
pokušaj pokupi: popraviš varijablu okoline u 12:10 i stih ode u 12:20. U
petlju ne mogu — unutar istog prolaza ih drži `last_run`, a sljedeći okidač
dolazi tek za dvadeset minuta.

### Redoslijed prve provjere

1. Otvori aplikaciju, dodirni **zvono** → prihvati dozvolu
2. `?dry=1` → mora pisati `subscribers: 1`
3. `?force=1` → obavijest stiže za par sekundi
4. Ostavi cron da radi i sutra u zakazano vrijeme provjeri bez `force`

Drugi put istog dana `?force=1` je obavezan — bez njega ruta nema kome, jer
si stih za taj dan već dobio. Isto se postiže i iz Supabasea:

```sql
update push_subscriptions set last_sent_on = null;
```

### Stih nije stigao u podne

Redoslijed je uvijek isti — od okidača prema telefonu, jer je okidač dosad
bio kriv devet puta od deset.

1. **Actions → Stih dana — push.** Ima li uopšte pokretanja u to vrijeme?
   Ako nema — GitHub je preskočio (ili se workflow ugasio nakon 60 dana bez
   commita: otvori ga i klikni *Enable workflow*). Ako ima crveno, log kaže
   šta: fali secret, ruta je vratila 401, ili `failed` nije nula.
2. **Log zelenog pokretanja.** Tu stoji cijeli odgovor rute. `"due": 0` znači
   da je stih taj dan nekome već otišao — pogledaj kome i kad:
   ```sql
   select endpoint, last_sent_on, last_ok, claimed_at, last_error
     from push_subscriptions order by last_ok desc nulls last;
   ```
   `last_sent_on` = danas uz prazan `last_ok` ne bi smio postojati; ako ga
   vidiš, u bazi je stara shema — pokreni `supabase/schema.sql` ponovo.
3. **`last_error`.** Tu piše odgovor push servisa, doslovno. Najčešće je
   `403 VAPID credentials mismatch` — promijenjeni ključevi, pa sve stare
   pretplate treba obrisati i ponovo uključiti zvono.
4. **Tek onda telefon.** Ugašene obavijesti u sistemskim postavkama, Focus
   režim, ili PWA obrisan s početnog ekrana.

---

## 6. iPhone

Web Push na iOS-u radi **isključivo iz aplikacije dodane na početni ekran**
(iOS 16.4+). U Safari tabu zvono ne može ništa — tamo se umjesto njega
pokaže uputa.

Za test na iPhoneu: Safari → Podijeli → *Add to Home Screen* → otvori
aplikaciju s početnog ekrana → pa tek onda zvono.

---

## 7. Prije nego podijeliš link

Aplikacija je već `robots: noindex` — neće završiti u Googleu.

Ali **stihovi, logotip i fotografija su tuđe vlasništvo** (vidi
[`public/brand/README.md`](public/brand/README.md) i
[KONCEPT.md](KONCEPT.md#8-pravni-dio--pročitaj-ovo-prije-prve-linije-koda)).
Dok ne stigne dozvola, link drži za sebe i za prezentaciju timu —
`noindex` sprječava indeksiranje, ne i da neko otvori adresu.

Zaštita lozinkom na Vercelu je plaćena opcija; besplatna alternativa je
da adresu jednostavno ne dijeliš javno.
