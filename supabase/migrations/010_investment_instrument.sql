-- =====================================================================
-- 010 — instrumen investasi & emas dalam gram. Aman dijalankan ulang.
--   accounts.instrument : gold | mutual_fund | stock | sbn | other (untuk akun Investasi)
--   accounts.unit       : money (default) | gram (khusus emas)
--   accounts.unit_price : harga per gram terkini (diisi sendiri) untuk menilai saldo emas
--   accounts.initial_qty: saldo awal dalam gram
--   transactions.quantity: gram yang masuk/keluar akun bersatuan gram
-- =====================================================================
alter table public.accounts add column if not exists instrument text;
alter table public.accounts add column if not exists unit text not null default 'money';
alter table public.accounts add column if not exists unit_price numeric(16,2);
alter table public.accounts add column if not exists initial_qty numeric(14,4) not null default 0;

do $$ begin
  alter table public.accounts add constraint accounts_instrument_chk
    check (instrument is null or instrument in ('gold','mutual_fund','stock','sbn','other'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.accounts add constraint accounts_unit_chk check (unit in ('money','gram'));
exception when duplicate_object then null; end $$;

alter table public.transactions add column if not exists quantity numeric(14,4);
do $$ begin
  alter table public.transactions add constraint transactions_quantity_chk check (quantity is null or quantity > 0);
exception when duplicate_object then null; end $$;

-- View saldo dibuat ulang (a.* dibekukan saat view dibuat) + saldo gram
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
  a.initial_qty
    + coalesce((select sum(case when t.type = 'income' then t.quantity else -t.quantity end)
                from public.transactions t where t.account_id = a.id and t.quantity is not null), 0)
    + coalesce((select sum(t.quantity) from public.transactions t
                where t.to_account_id = a.id and t.type = 'transfer' and t.quantity is not null), 0)
    as qty_balance,
  case when a.owner_id = auth.uid() then 'owner'
       else (select m.role from public.account_members m
             where m.account_id = a.id and m.user_id = auth.uid())
  end as my_role,
  (select count(*) from public.account_members m where m.account_id = a.id) as member_count
from public.accounts a;
grant select on public.account_balances to authenticated;
