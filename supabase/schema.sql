-- Jedina tabela u sistemu. Stihovi NIKAD ne idu kroz bazu.

create table if not exists push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  send_hour  smallint not null default 20,          -- lokalno vrijeme korisnika
  tz         text not null default 'Europe/Sarajevo',
  created_at timestamptz not null default now(),
  last_ok    timestamptz
);

create index if not exists push_subscriptions_send_hour_idx
  on push_subscriptions (send_hour);

-- Pristup ide isključivo preko service-role ključa sa servera.
alter table push_subscriptions enable row level security;
