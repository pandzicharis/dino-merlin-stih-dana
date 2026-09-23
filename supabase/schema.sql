-- Jedina tabela u sistemu. Stihovi NIKAD ne idu kroz bazu.

create table if not exists push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  send_hour  smallint not null default 12,          -- lokalno vrijeme korisnika
  tz         text not null default 'Europe/Sarajevo',
  created_at timestamptz not null default now(),
  last_ok    timestamptz,
  -- datum stiha koji je ovom uređaju zadnji put poslan; sprječava dupli stih
  -- i omogućava da propušteni sat nadoknadi sljedeći
  last_sent_on date
);

-- za tabele napravljene prije nego je kolona uvedena
alter table push_subscriptions add column if not exists last_sent_on date;

create index if not exists push_subscriptions_send_hour_idx
  on push_subscriptions (send_hour);

-- Pristup ide isključivo preko service-role ključa sa servera.
alter table push_subscriptions enable row level security;
