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

-- Dan (po KORISNIKOVOM lokalnom kalendaru) kad mu je zadnji put otišao stih.
-- Ovo je jedina odbrana od duplih obavijesti: cron se ponovi, worker padne na
-- pola, neko klikne "Test run" — bez ovoga svaki od tih slučajeva pošalje opet.
alter table push_subscriptions add column if not exists last_sent_on date;

-- Oznaka konkretnog prolaza slanja. Dispatcher generiše jedan uuid i da ga
-- svim workerima; red koji je u ovom prolazu već uzet ne može biti uzet drugi
-- put. Time i `?force=1` postaje bezopasan — bez ovoga bi force petlja vrtjela
-- iste ljude unedogled.
alter table push_subscriptions add column if not exists last_run uuid;

alter table push_subscriptions add column if not exists last_error text;

create index if not exists push_subscriptions_send_hour_idx
  on push_subscriptions (send_hour);

-- Pokriva vruć upit: "ko još danas nije dobio". Postgres prvo odbaci sve
-- kojima je već poslano, pa tek na ostatku računa lokalni sat.
create index if not exists push_subscriptions_due_idx
  on push_subscriptions (last_sent_on, send_hour);

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
-- drugo nego u petlji ažurira `last_sent_on`, `last_run` i `last_ok`. Provjera
-- zone bi se tako plaćala na svaku poslanu obavijest, u poslu u kojem su
-- upravo ta ažuriranja vruća putanja.
create trigger push_subscriptions_sanitize_trg
  before insert or update of tz, send_hour on push_subscriptions
  for each row execute function push_subscriptions_sanitize();


-- ─────────────────────────────────────────────────────────────────────
--  Uslov "kome je vrijeme"
--
--  `>=` a ne `=`: ako slanje u 12:05 padne, sljedeći prolaz u 13:05 ga
--  pokupi. Uz `last_sent_on` to ne može značiti dvije obavijesti — znači
--  samo da propušten sat nije izgubljen dan.
-- ─────────────────────────────────────────────────────────────────────

create or replace function push_subscription_is_due(
  p_tz           text,
  p_send_hour    smallint,
  p_last_sent_on date
)
returns boolean
language sql
stable
as $$
  select (now() at time zone p_tz)::date is distinct from p_last_sent_on
     and extract(hour from (now() at time zone p_tz)) >= p_send_hour;
$$;


-- ─────────────────────────────────────────────────────────────────────
--  Atomsko preuzimanje porcije
--
--  `for update skip locked` je ovdje cijela poenta: više workera može zvati
--  ovu funkciju istovremeno i svaki dobije SVOJ, tuđem disjunktan skup.
--  Red se označi kao poslan u istoj transakciji u kojoj je i uzet, pa ni
--  preklapanje dva cron prolaza ne može proizvesti duplu obavijest.
-- ─────────────────────────────────────────────────────────────────────

create or replace function claim_due_subscriptions(
  p_run   uuid,
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
       and (p_force or push_subscription_is_due(s.tz, s.send_hour, s.last_sent_on))
     order by s.endpoint
     limit p_limit
       for update skip locked
  )
  update push_subscriptions s
     set last_sent_on = (now() at time zone s.tz)::date,
         last_run     = p_run
    from due
   where s.endpoint = due.endpoint
  returning s.endpoint, s.p256dh, s.auth;
$$;


create or replace function count_due_subscriptions(
  p_run   uuid,
  p_force boolean default false
)
returns bigint
language sql
stable
as $$
  select count(*)
    from push_subscriptions s
   where s.last_run is distinct from p_run
     and (p_force or push_subscription_is_due(s.tz, s.send_hour, s.last_sent_on));
$$;


-- ─────────────────────────────────────────────────────────────────────
--  Zatvaranje porcije — jedan poziv umjesto tri
--
--  Endpointi putuju u TIJELU zahtjeva, ne u URL-u. `.in('endpoint', [...])`
--  iz supabase-js ih lijepi u query string; na par hiljada pretplatnika to
--  je URL od nekoliko megabajta i odgovor 414.
-- ─────────────────────────────────────────────────────────────────────

create or replace function finish_push_batch(
  p_ok    text[] default '{}',
  p_dead  text[] default '{}',
  p_retry text[] default '{}',
  p_error text    default null
)
returns void
language plpgsql
as $$
begin
  if array_length(p_ok, 1) is not null then
    update push_subscriptions
       set last_ok = now(), last_error = null
     where endpoint = any(p_ok);
  end if;

  -- Uređaj je odjavljen ili obrisan (404/410). Briše se odmah — lista koja
  -- truli znači da svaki sljedeći prolaz plaća slanje na mrtve adrese.
  if array_length(p_dead, 1) is not null then
    delete from push_subscriptions where endpoint = any(p_dead);
  end if;

  -- Prolazna greška (mreža, 5xx kod push servisa). Oznaka DANA se povuče
  -- nazad da ga sljedeći prolaz pokupi — zato `>=` u uslovu iznad.
  --
  -- `last_run` se NE dira, i to je bitno. Njega je claim postavio na tekući
  -- prolaz, pa ovako isti worker ovaj red više ne može uzeti — a sljedeći
  -- prolaz, s drugim uuid-om, može. Da se ovdje brisao i `last_run`, red bi
  -- odmah opet bio na redu istom workeru: push servis koji uporno vraća 503
  -- značio bi vrtnju u prazno dok ne istekne cijeli budžet funkcije.
  if array_length(p_retry, 1) is not null then
    update push_subscriptions
       set last_sent_on = null, last_error = p_error
     where endpoint = any(p_retry);
  end if;
end;
$$;


-- ─────────────────────────────────────────────────────────────────────
--  Dozvole: sve ide preko service-role ključa sa servera.
-- ─────────────────────────────────────────────────────────────────────

revoke all on function claim_due_subscriptions(uuid, int, boolean) from public, anon, authenticated;
revoke all on function count_due_subscriptions(uuid, boolean)      from public, anon, authenticated;
revoke all on function finish_push_batch(text[], text[], text[], text) from public, anon, authenticated;

grant execute on function claim_due_subscriptions(uuid, int, boolean) to service_role;
grant execute on function count_due_subscriptions(uuid, boolean)      to service_role;
grant execute on function finish_push_batch(text[], text[], text[], text) to service_role;
