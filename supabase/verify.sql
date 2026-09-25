-- Provjera da je schema.sql stvarno primijenjen.
--
-- Zalijepi cijeli fajl u Supabase → SQL Editor i pokreni. Ništa ne mijenja:
-- samo čita katalog baze. Svaki red mora pisati PROLAZ.
--
-- Ako je ijedan PAD — pokreni supabase/schema.sql cijeli, ponovo.

with provjere as (

  select 1 as rb, 'kolona last_sent_on' as sta,
         count(*) = 1 as ok
    from information_schema.columns
   where table_name = 'push_subscriptions' and column_name = 'last_sent_on'

  union all
  select 2, 'kolona last_run',
         count(*) = 1
    from information_schema.columns
   where table_name = 'push_subscriptions' and column_name = 'last_run'

  union all
  select 3, 'kolona last_error',
         count(*) = 1
    from information_schema.columns
   where table_name = 'push_subscriptions' and column_name = 'last_error'

  union all
  -- Imena parametara se provjeravaju namjerno: supabase-js šalje argumente
  -- po imenu, pa preimenovan parametar obara RPC iako funkcija postoji.
  select 4, 'funkcija claim_due_subscriptions(p_run, p_limit, p_force)',
         count(*) = 1
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'claim_due_subscriptions'
     and pg_get_function_identity_arguments(p.oid) = 'p_run uuid, p_limit integer, p_force boolean'

  union all
  select 5, 'funkcija count_due_subscriptions(p_run, p_force)',
         count(*) = 1
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'count_due_subscriptions'
     and pg_get_function_identity_arguments(p.oid) = 'p_run uuid, p_force boolean'

  union all
  select 6, 'funkcija finish_push_batch(p_ok, p_dead, p_retry, p_error)',
         count(*) = 1
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'finish_push_batch'
     and pg_get_function_identity_arguments(p.oid) = 'p_ok text[], p_dead text[], p_retry text[], p_error text'

  union all
  select 7, 'funkcija push_subscription_is_due(p_tz, p_send_hour, p_last_sent_on)',
         count(*) = 1
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'push_subscription_is_due'
     and pg_get_function_identity_arguments(p.oid) = 'p_tz text, p_send_hour smallint, p_last_sent_on date'

  union all
  select 8, 'trigger za čišćenje zone postoji',
         count(*) = 1
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname = 'push_subscriptions'
     and t.tgname = 'push_subscriptions_sanitize_trg'

  union all
  -- Najvažnija pojedinost u cijeloj shemi. Trigger MORA biti ograničen na
  -- `update of tz, send_hour`. Ako nije, vrti se na svaki update reda — a
  -- slanje ne radi ništa drugo nego u petlji ažurira ostale kolone, pa bi se
  -- provjera zone plaćala po svakoj poslanoj obavijesti.
  select 9, 'trigger ograničen na tz i send_hour (bez ovoga je slanje sporo)',
         coalesce(array_length(string_to_array(t.tgattr::text, ' '), 1), 0) = 2
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname = 'push_subscriptions'
     and t.tgname = 'push_subscriptions_sanitize_trg'

  union all
  select 10, 'indeks push_subscriptions_due_idx',
         count(*) = 1
    from pg_indexes
   where tablename = 'push_subscriptions' and indexname = 'push_subscriptions_due_idx'

  union all
  select 11, 'indeks push_subscriptions_last_run_idx',
         count(*) = 1
    from pg_indexes
   where tablename = 'push_subscriptions' and indexname = 'push_subscriptions_last_run_idx'

  union all
  select 12, 'RLS uključen na tabeli',
         bool_and(relrowsecurity)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'push_subscriptions'

  union all
  select 13, 'service_role smije zvati sve tri rutine',
         count(*) = 3
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('claim_due_subscriptions','count_due_subscriptions','finish_push_batch')
     and has_function_privilege('service_role', p.oid, 'execute')

  union all
  -- Zona koju Postgres ne poznaje obara `now() at time zone tz`, a to obori
  -- cijeli upit — dakle jedan takav red zaustavi slanje SVIMA.
  select 14, 'nijedan postojeći red nema nepoznatu vremensku zonu',
         count(*) = 0
    from push_subscriptions s
   where not exists (select 1 from pg_timezone_names z where z.name = s.tz)
)
select rb as "#",
       case when ok then '✔ PROLAZ' else '✘ PAD' end as ishod,
       sta as "provjera"
  from provjere
 order by rb;
