-- =====================================================================
-- 005 — jatuh tempo kartu kredit/paylater + pengaturan widget Beranda
-- Aman dijalankan ulang.
-- =====================================================================

-- Tanggal jatuh tempo tagihan kartu kredit / paylater (1–31). Tagihan kartu muncul di
-- "Tagihan bulan ini" selama masih ada utang; tombol Bayar membuat transfer ke kartu.
alter table public.accounts add column if not exists due_day int;
do $$ begin
  alter table public.accounts add constraint accounts_due_day_chk check (due_day is null or due_day between 1 and 31);
exception when duplicate_object then null; end $$;

-- Widget Beranda yang disembunyikan (per orang), mis. ["goals","recent"]. Kosong = semua tampil.
alter table public.profiles add column if not exists home_hidden text[] not null default '{}';

-- View saldo dibuat ulang supaya kolom baru ikut (a.* dibekukan saat view dibuat)
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
