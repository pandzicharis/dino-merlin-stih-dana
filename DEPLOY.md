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
[`supabase/verify.sql`](supabase/verify.sql). Ništa ne mijenja — ispiše 14
redova i svaki mora pisati PROLAZ.

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

Poziv koji se ponovi **ne šalje duplo**: porcija se uzima i označava u istoj
transakciji, a `last_sent_on` nosi sarajevski datum stiha. Slobodno pokreni
ručno koliko puta hoćeš — drugi put istog dana nema kome.

Kad baš hoćeš da ode ponovo (test, ili si pomjerio vrijeme usred dana),
`?force=1` zaobilazi i tu oznaku.

> Ako pomjeriš raspored, pomjeri i `SEND_HOUR` u [`lib/date.ts`](lib/date.ts).
> Taj broj ne utiče na slanje — samo je natpis u aplikaciji ("stih stiže u
> 12:00h"), pa bi inače aplikacija govorila jedno a telefon radio drugo.

### cron-job.org

1. **Create cronjob**
2. URL: `https://tvoja-adresa.vercel.app/api/cron/send-daily`
3. Schedule: **jednom dnevno**, u sat koji hoćeš. cron-job.org ume zadati i
   **vremensku zonu** — izaberi `Europe/Sarajevo` i vrijeme ostaje isto i
   ljeti i zimi, bez ijedne izmjene u kodu.
4. **Advanced → Headers**:
   ```
   x-cron-secret: <CRON_SECRET>
   ```
5. Request method: `GET` ili `POST` — oba rade.
6. Timeout podigni na **60 s**; na većem broju pretplatnika odgovor stiže
   tek kad svi workeri završe.

### Vercel Cron (alternativa)

Vercel Hobby dopušta cron jednom dnevno, što je sada tačno ono što treba.
Dodaj `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/send-daily", "schedule": "0 10 * * *" }] }
```

Raspored je u UTC: `0 10` je 12:00 u Sarajevu ljeti, 11:00 zimi.

Vercel šalje `Authorization: Bearer $CRON_SECRET` — ruta i to prihvata.

### GitHub Actions (već u repou)

[`.github/workflows/daily-push.yml`](.github/workflows/daily-push.yml) radi
isto, besplatno. Treba mu dva secreta u repou: `APP_URL` i `CRON_SECRET`.

Podešen je na `0 10 * * *` — 12:00 u Sarajevu ljeti, 11:00 zimi, jer GitHub
prima samo UTC i ne zna za ljetno vrijeme.

Tri stvari koje treba znati o njemu: taj zimski pomak, zakazani workflow zna
kasniti i po desetak minuta kad je GitHub pod opterećenjem, i **sam se ugasi
nakon 60 dana bez ijednog commita** u repo. Za ozbiljan rad je cron-job.org
pouzdaniji — i jedini od troje koji zna za vremensku zonu.

Koristi jedno od troje. Ako pokreneš dva, ništa se neće pokvariti — samo
plaćaš dva puta isti posao.

### Koliko dugo traje

Ruta iznad ~400 pretplatnika na redu sama sebe podigne u više paralelnih
workera (do 8). Desetak hiljada obavijesti tako stane u nekoliko sekundi.
Ako i to ne stigne prije isteka funkcije, odgovor nosi `"truncated": true` —
pozovi rutu ponovo i ona nastavi tamo gdje je stala, bez `?force=1`. Oni koji
su već dobili preskaču se sami.

---

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
koliko bi se workera podiglo.

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

`failed` veći od nule je jedini broj koji traži da odmah pogledaš. Takvi se
namjerno **ne ponavljaju**: da se ponavljaju, jedna pogrešna varijabla okoline
značila bi da ruta u krug gađa sve pretplatnike.

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
