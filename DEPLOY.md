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

**Pokreće se svaki sat, ne jednom dnevno.** Ruta sama gleda kome je trenutno
20:00 po njegovoj vremenskoj zoni. Zato preživljava ljetno/zimsko vrijeme i
podržava da kasnije svako bira svoje vrijeme.

### cron-job.org

1. **Create cronjob**
2. URL: `https://tvoja-adresa.vercel.app/api/cron/send-daily`
3. Schedule: **Every hour**, minuta `5` (da se ne poklopi s vršnim opterećenjem)
4. **Advanced → Headers**:
   ```
   x-cron-secret: <CRON_SECRET>
   ```
5. Request method: `GET` ili `POST` — oba rade.

Ako baš hoćeš jednom dnevno umjesto satno, mora biti **17:00 UTC zimi i
16:00 UTC ljeti** da pogodi 18:00 u Sarajevu — zato je satno pametnije.

### Vercel Cron (alternativa)

Vercel Hobby dopušta cron **samo jednom dnevno**, što ne pokriva vremenske zone.
Na Pro planu dodaj `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/send-daily", "schedule": "5 * * * *" }] }
```

Vercel šalje `Authorization: Bearer $CRON_SECRET` — ruta i to prihvata.

### GitHub Actions (već u repou)

[`.github/workflows/daily-push.yml`](.github/workflows/daily-push.yml) radi isto,
besplatno. Treba mu dva secreta u repou: `APP_URL` i `CRON_SECRET`.
Koristi jedno od troje, ne sve — inače šalješ duplo.

---

## 5. Testiranje

Ruta ima dva pomoćna režima:

```bash
# ko bi dobio obavijest, bez slanja
curl -s "https://tvoja-adresa.vercel.app/api/cron/send-daily?dry=1" \
  -H "x-cron-secret: $CRON_SECRET" | jq

# pošalji ODMAH svima, bez obzira na sat
curl -s -X POST "https://tvoja-adresa.vercel.app/api/cron/send-daily?force=1" \
  -H "x-cron-secret: $CRON_SECRET" | jq
```

`dry=1` vrati broj pretplatnika, koji je stih na redu i koliko je sati u
vremenskoj zoni svakog pretplatnika — po tome odmah vidiš zašto nekome nije otišlo.

### Redoslijed prve provjere

1. Otvori aplikaciju, dodirni **zvono** → prihvati dozvolu
2. `?dry=1` → mora pisati `subscribers: 1`
3. `?force=1` → obavijest stiže za par sekundi
4. Ostavi satni cron da radi i sutra u 20:00 provjeri bez `force`

### Bez čekanja do 20:00

U Supabaseu promijeni sebi sat na sljedeći puni:

```sql
update push_subscriptions set send_hour = 14;   -- pa čekaj 14:05
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
