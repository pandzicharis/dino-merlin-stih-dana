-- Jedina tabela u sistemu. Stihovi NIKAD ne idu kroz bazu.
--
-- Shema je idempotentna: isti fajl se pokreće i na praznom projektu i preko
-- onog koji već radi. Nakon svake izmjene ovdje — SQL Editor → pokreni cijeli
-- fajl ponovo. Nema zasebnih migracija koje bi se raspale iz koraka.

create table if not exists push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  send_hour  smallint not null default 12,          -- lokalno vrijeme korisnika
  tz         text not null default 'Europe/Sarajevo',
  created_at timestamptz not null default now(),
  last_ok    timestamptz
);

-- Sarajevski datum stiha koji je ovom uređaju STVARNO otišao.
--
-- Upisuje se tek kad push servis primi obavijest (`finish_push_batch`), nikad
-- unaprijed. Ranije je oznaku postavljalo samo preuzimanje porcije, prije
-- slanja — i to je bio tihi gubitak dana: svaki pad između preuzimanja i
-- slanja, svaki `?force=1` test i svaka pogrešna varijabla okoline označili
-- bi ljude kao "dobili su", pa bi pravi prolaz u 12 zatekao prazan red i
-- mirno javio da je sve poslano. Sada dan zatvara jedino uspjeh.
alter table push_subscriptions add column if not exists last_sent_on date;

-- Oznaka konkretnog prolaza slanja. Dispatcher generiše jedan uuid i da ga
-- svim workerima; red koji je u ovom prolazu već uzet ne može biti uzet drugi
-- put. Time i `?force=1` postaje bezopasan — bez ovoga bi force petlja vrtjela
-- iste ljude unedogled.
alter table push_subscriptions add column if not exists last_run uuid;

-- Kad je red zadnji put preuzet. Kratka posudba (vidi CLAIM_LEASE dolje):
-- dok traje, drugi prolaz ovaj red ne dira, pa se dva okidača koja se
-- preklope ne mogu sudariti. Kad istekne, red je opet na redu — zato pad
-- usred slanja više ne znači propušten dan, nego zakašnjelu obavijest.
alter table push_subscriptions add column if not exists claimed_at timestamptz;

alter table push_subscriptions add column if not exists last_error text;

-- Slanje više ne gleda ni sat ni zonu, pa indeks po `send_hour` nema koga
-- posluživati. Stariji oblik `due_idx` je bio (last_sent_on, send_hour) —
-- `create index if not exists` ga ne bi prepisao, zato prvo ispada.
drop index if exists push_subscriptions_send_hour_idx;
drop index if exists push_subscriptions_due_idx;

-- Pokriva cijeli uslov slanja: "ko još nije dobio stih za ovaj dan".
create index if not exists push_subscriptions_due_idx
  on push_subscriptions (last_sent_on);

create index if not exists push_subscriptions_last_run_idx
  on push_subscriptions (last_run);

-- Pristup ide isključivo preko service-role ključa sa servera.
alter table push_subscriptions enable row level security;


-- ─────────────────────────────────────────────────────────────────────
--  Zaštita od neispravne vremenske zone
--
--  `now() at time zone tz` PUKNE ako tz nije poznat Postgresu, i to obori
--  cijeli upit — dakle jedan red s besmislenom zonom zaustavi slanje SVIMA.
--  Zato se nepoznata zona tiho svede na Sarajevo umjesto da se pusti u tabelu.
-- ─────────────────────────────────────────────────────────────────────

create or replace function push_subscriptions_sanitize()
returns trigger
language plpgsql
as $$
begin
  -- Zona se provjerava tako što se jednom upotrijebi, a ne traženjem po
  -- `pg_timezone_names`. Ta lista ima ~600 redova i njeno prolaženje košta
  -- oko 20 ms — po redu. Ovo je obična pretraga u kešu zona, bez mjerljive cijene.
  begin
    perform now() at time zone new.tz;
  exception when others then
    new.tz := 'Europe/Sarajevo';
  end;

  if new.tz is null then
    new.tz := 'Europe/Sarajevo';
  end if;

  if new.send_hour is null or new.send_hour < 0 or new.send_hour > 23 then
    new.send_hour := 12;
  end if;

  return new;
end;
$$;

drop trigger if exists push_subscriptions_sanitize_trg on push_subscriptions;

-- `update of tz, send_hour` je ovdje bitno, ne kozmetika.
--
-- Bez toga se trigger vrti na SVAKI update reda — a slanje ne radi ništa
-- drugo nego u petlji ažurira `last_sent_on`, `last_run`, `claimed_at` i
-- `last_ok`. Provjera zone bi se tako plaćala na svaku poslanu obavijest, u
-- poslu u kojem su upravo ta ažuriranja vruća putanja.
create trigger push_subscriptions_sanitize_trg
  before insert or update of tz, send_hour on push_subscriptions
  for each row execute function push_subscriptions_sanitize();


-- ─────────────────────────────────────────────────────────────────────
--  Kad se šalje
--
--  Ruta NE odlučuje o vremenu — odlučuje okidač. Kad god se pozove, šalje
--  svima koji još nisu dobili stih za taj dan. Vrijeme se podešava
--  rasporedom crona, na jednom mjestu, umjesto da se krije u uslovu upita.
--
--  Ključ za duplikate je zato SARAJEVSKI datum, ne korisnikov lokalni dan:
--  stih dana je jedan za sve (vidi lib/date.ts), pa je "dobio stih za 25.09."
--  jedina činjenica koja se pamti. Time iz vruće putanje ispada svako
--  računanje s vremenskim zonama.
--
--  Zato okidač smije biti pozvan i deset puta dnevno: prvi uspjeh zatvori
--  dan, ostali prolazi zateknu prazan red. Upravo to i koristi raspored u
--  .github/workflows/daily-push.yml — više pokušaja, da propušten okidač ne
--  znači propušten dan.
--
--  `send_hour` i `tz` ostaju u tabeli — više ne odlučuju ni o čemu, ali su
--  tu ako se ikad uvede da svako bira svoje vrijeme.
-- ─────────────────────────────────────────────────────────────────────

-- Potpisi se mijenjaju, a `create or replace` ne mijenja potpis — staro mora
-- ispasti prvo, inače bi uz nove ostale i stare funkcije. Dvije istoimene
-- funkcije nisu bezazlene: PostgREST tad ne zna koju da zove i vrati grešku.
drop function if exists claim_due_subscriptions(uuid, int, boolean);
drop function if exists count_due_subscriptions(uuid, boolean);
drop function if exists push_subscription_is_due(text, smallint, date);
drop function if exists finish_push_batch(text[], text[], text[], text);


-- ─────────────────────────────────────────────────────────────────────
--  Atomsko preuzimanje porcije
--
--  `for update skip locked` je ovdje cijela poenta: više workera može zvati
--  ovu funkciju istovremeno i svaki dobije SVOJ, tuđem disjunktan skup.
--
--  Preuzimanje NE zatvara dan — samo posuđuje red na dvije minute i pamti
--  koji ga je prolaz uzeo. Dan zatvara tek `finish_push_batch`, i to samo
--  onima kojima je obavijest stvarno otišla. Dvije minute su duže od
--  najduže porcije, a kraće od razmaka između dva okidača: preklopljena
--  prolaza se zato ne mogu sudariti, a red koji ostane visiti nakon pada
--  sam se vrati u posao.
-- ─────────────────────────────────────────────────────────────────────

create or replace function claim_due_subscriptions(
  p_run   uuid,
  p_today date,
  p_limit int default 500,
  p_force boolean default false
)
returns table (endpoint text, p256dh text, auth text)
language sql
as $$
  with due as (
    select s.endpoint
      from push_subscriptions s
     where s.last_run is distinct from p_run
       and (p_force or s.last_sent_on is distinct from p_today)
       and (p_force or s.claimed_at is null or s.claimed_at < now() - interval '2 minutes')
     order by s.endpoint
     limit p_limit
       for update skip locked
  )
  update push_subscriptions s
     set last_run   = p_run,
         claimed_at = now()
    from due
   where s.endpoint = due.endpoint
  returning s.endpoint, s.p256dh, s.auth;
$$;


create or replace function count_due_subscriptions(
  p_run   uuid,
  p_today date,
  p_force boolean default false
)
returns bigint
language sql
stable
as $$
  select count(*)
    from push_subscriptions s
   where s.last_run is distinct from p_run
     and (p_force or s.last_sent_on is distinct from p_today)
     and (p_force or s.claimed_at is null or s.claimed_at < now() - interval '2 minutes');
$$;


-- ─────────────────────────────────────────────────────────────────────
--  Zatvaranje porcije — jedan poziv umjesto tri
--
--  Endpointi putuju u TIJELU zahtjeva, ne u URL-u. `.in('endpoint', [...])`
--  iz supabase-js ih lijepi u query string; na par hiljada pretplatnika to
--  je URL od nekoliko megabajta i odgovor 414.
--
--  `p_today` je datum koji se upisuje uspješnima. Kad je null — a tako ga
--  šalje `?force=1` — obavijest ode, ali dan ostaje otvoren. Tako test ne
--  može pojesti pravo slanje u 12.
-- ─────────────────────────────────────────────────────────────────────

create or replace function finish_push_batch(
  p_ok    text[] default '{}',
  p_dead  text[] default '{}',
  p_retry text[] default '{}',
  p_error text    default null,
  p_today date    default null
)
returns void
language plpgsql
as $$
begin
  -- Jedino mjesto na kojem se dan zatvara, i to tek nakon što je push servis
  -- obavijest primio.
  if array_length(p_ok, 1) is not null then
    update push_subscriptions
       set last_ok      = now(),
           last_error   = null,
           last_sent_on = coalesce(p_today, last_sent_on)
     where endpoint = any(p_ok);
  end if;

  -- Uređaj je odjavljen ili obrisan (404/410). Briše se odmah — lista koja
  -- truli znači da svaki sljedeći prolaz plaća slanje na mrtve adrese.
  if array_length(p_dead, 1) is not null then
    delete from push_subscriptions where endpoint = any(p_dead);
  end if;

  -- Sve što nije prošlo: prolazna greška kod push servisa (429/5xx) i naša
  -- greška (npr. pogrešan VAPID ključ) idu istim putem — dan im ostaje
  -- otvoren, posudba se pušta odmah, pa ih sljedeći okidač pokupi.
  --
  -- `last_run` se NE dira, i to je bitno. Njega je claim postavio na tekući
  -- prolaz, pa ovako isti prolaz ovaj red više ne može uzeti — a sljedeći,
  -- s drugim uuid-om, može. Da se ovdje brisao i `last_run`, red bi odmah
  -- opet bio na redu istom workeru: push servis koji uporno vraća 503
  -- značio bi vrtnju u prazno dok ne istekne cijeli budžet funkcije.
  if array_length(p_retry, 1) is not null then
    update push_subscriptions
       set last_error = p_error,
           claimed_at = null
     where endpoint = any(p_retry);
  end if;
end;
$$;


-- ─────────────────────────────────────────────────────────────────────
--  Dozvole: sve ide preko service-role ključa sa servera.
-- ─────────────────────────────────────────────────────────────────────

revoke all on function claim_due_subscriptions(uuid, date, int, boolean)     from public, anon, authenticated;
revoke all on function count_due_subscriptions(uuid, date, boolean)          from public, anon, authenticated;
revoke all on function finish_push_batch(text[], text[], text[], text, date) from public, anon, authenticated;

grant execute on function claim_due_subscriptions(uuid, date, int, boolean)     to service_role;
grant execute on function count_due_subscriptions(uuid, date, boolean)          to service_role;
grant execute on function finish_push_batch(text[], text[], text[], text, date) to service_role;
