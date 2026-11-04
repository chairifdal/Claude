-- =====================================================================
-- 003 — biaya transfer + transaksi berulang otomatis
-- Aman dijalankan ulang.
-- =====================================================================

-- 1. Biaya transfer (mis. BI-FAST Rp 2.500, antarbank Rp 6.500), menempel di baris transfer.
--    Saldo akun asal berkurang sebesar jumlah + biaya; biaya dihitung sebagai pengeluaran.
alter table public.transactions add column if not exists fee numeric(16,2) not null default 0;
do $$ begin
  alter table public.transactions add constraint tx_fee_chk check (fee >= 0 and (fee = 0 or type = 'transfer'));
exception when duplicate_object then null; end $$;

-- 2. Transaksi berulang (gaji tiap tgl 25, uang belanja bulanan, iuran, dll.)
create table if not exists public.recurring (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references public.accounts(id) on delete cascade,
  to_account_id  uuid references public.accounts(id) on delete cascade,
  type           text not null check (type in ('income','expense','transfer')),
  amount         numeric(16,2) not null check (amount > 0),
  fee            numeric(16,2) not null default 0 check (fee >= 0),
  category_id    uuid references public.categories(id) on delete set null,
  note           text,
  day_of_month   int not null check (day_of_month between 1 and 31),
  start_date     date not null default current_date,
  end_date       date,
  active         boolean not null default true,
  last_run       date,
  created_by     uuid not null references public.profiles(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  constraint recurring_transfer_chk check (
    (type = 'transfer' and to_account_id is not null and to_account_id <> account_id)
    or (type <> 'transfer' and to_account_id is null and fee = 0)
  )
);
create index if not exists recurring_account_idx on public.recurring(account_id);

alter table public.transactions add column if not exists recurring_id uuid references public.recurring(id) on delete set null;
alter table public.transactions add column if not exists recurring_period date;
create unique index if not exists tx_recurring_once
  on public.transactions(recurring_id, recurring_period) where recurring_id is not null;

-- Cek izin untuk user tertentu (dipakai saat menjalankan jadwal atas nama pembuatnya)
create or replace function public.can_read_account_as(aid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from accounts where id = aid and owner_id = uid)
      or exists (select 1 from account_members where account_id = aid and user_id = uid);
$$;
create or replace function public.can_write_account_as(aid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from accounts where id = aid and owner_id = uid)
      or exists (select 1 from account_members where account_id = aid and user_id = uid and role = 'editor');
$$;
revoke execute on function public.can_read_account_as(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.can_write_account_as(uuid, uuid) from public, anon, authenticated;

alter table public.recurring enable row level security;
drop policy if exists recurring_select on public.recurring;
create policy recurring_select on public.recurring for select to authenticated
  using (public.can_read_account(account_id)
         or (to_account_id is not null and public.can_read_account(to_account_id)));
drop policy if exists recurring_write on public.recurring;
create policy recurring_write on public.recurring for all to authenticated
  using (public.can_write_account(account_id)
         or (type = 'transfer' and created_by = auth.uid() and public.can_read_account(account_id)))
  with check (
    created_by = auth.uid()
    and (public.can_write_account(account_id) or (type = 'transfer' and public.can_read_account(account_id)))
    and (to_account_id is null or public.can_read_account(to_account_id))
  );

-- Menjalankan jadwal yang sudah jatuh tempo (termasuk bulan yang terlewat). Idempoten.
-- Transaksi dicatat atas nama pembuat jadwal, hanya jika izinnya masih berlaku.
create or replace function public.run_recurring(for_user uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  r recurring;
  m date;
  due date;
  n int := 0;
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  for r in
    select * from recurring
    where active
      and (for_user is null or created_by = for_user
           or can_read_account_as(account_id, for_user)
           or (to_account_id is not null and can_read_account_as(to_account_id, for_user)))
    for update skip locked
  loop
    continue when not (
      (can_write_account_as(r.account_id, r.created_by)
       or (r.type = 'transfer' and can_read_account_as(r.account_id, r.created_by)))
      and (r.to_account_id is null or can_read_account_as(r.to_account_id, r.created_by))
    );
    for m in
      select generate_series(
        date_trunc('month', coalesce(r.last_run + 1, r.start_date))::date,
        date_trunc('month', today)::date,
        interval '1 month')::date
    loop
      due := m + (least(r.day_of_month, extract(day from (m + interval '1 month' - interval '1 day'))::int) - 1);
      continue when due < r.start_date or due > today
        or (r.end_date is not null and due > r.end_date)
        or (r.last_run is not null and due <= r.last_run);
      insert into transactions (account_id, to_account_id, type, amount, fee, category_id, note,
                                occurred_at, created_by, recurring_id, recurring_period)
      values (r.account_id, r.to_account_id, r.type, r.amount,
              case when r.type = 'transfer' then r.fee else 0 end,
              case when r.type = 'transfer' then null else r.category_id end,
              r.note, (due + time '07:00') at time zone 'Asia/Jakarta',
              r.created_by, r.id, due)
      on conflict (recurring_id, recurring_period) where recurring_id is not null do nothing;
      if found then n := n + 1; end if;
      update recurring set last_run = due where id = r.id;
      r.last_run := due;
    end loop;
  end loop;
  return n;
end $$;
revoke execute on function public.run_recurring(uuid) from public, anon, authenticated;

-- Dipanggil aplikasi saat dibuka (cadangan bila jadwal harian belum jalan)
create or replace function public.run_my_recurring()
returns int language sql security definer set search_path = public as $$
  select public.run_recurring(auth.uid());
$$;
revoke execute on function public.run_my_recurring() from public, anon;
grant execute on function public.run_my_recurring() to authenticated;

-- 3. Saldo: transfer keluar mengurangi jumlah + biaya
drop view if exists public.account_balances;
create view public.account_balances
with (security_invoker = true) as
select
  a.*,
  a.initial_balance
    + coalesce((select sum(case when t.type = 'income' then t.amount else -(t.amount + t.fee) end)
                from public.transactions t where t.account_id = a.id), 0)
    + coalesce((select sum(t.amount) from public.transactions t
                where t.to_account_id = a.id and t.type = 'transfer'), 0)
    as balance,
  case when a.owner_id = auth.uid() then 'owner'
       else (select m.role from public.account_members m
             where m.account_id = a.id and m.user_id = auth.uid())
  end as my_role,
  (select count(*) from public.account_members m where m.account_id = a.id) as member_count
from public.accounts a;
grant select on public.account_balances to authenticated;

-- 4. Realtime + jadwal harian 00:05 WIB (17:05 UTC) bila pg_cron tersedia
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recurring') then
    alter publication supabase_realtime add table public.recurring;
  end if;
end $$;

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'kantong-kita-recurring';
    perform cron.schedule('kantong-kita-recurring', '5 17 * * *', 'select public.run_recurring()');
  else
    raise notice 'pg_cron tidak tersedia: transaksi berulang dijalankan saat aplikasi dibuka.';
  end if;
end $$;
