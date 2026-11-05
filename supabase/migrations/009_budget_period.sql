-- =====================================================================
-- 009 — periode anggaran: harian / mingguan / bulanan. Aman dijalankan ulang.
-- Satu kategori boleh punya satu anggaran per periode.
-- =====================================================================
alter table public.budgets add column if not exists period text not null default 'monthly';
do $$ begin
  alter table public.budgets add constraint budgets_period_chk check (period in ('daily','weekly','monthly'));
exception when duplicate_object then null; end $$;

alter table public.budgets drop constraint if exists budgets_owner_id_category_id_key;
do $$ begin
  alter table public.budgets add constraint budgets_owner_cat_period_key unique (owner_id, category_id, period);
exception when duplicate_object or duplicate_table then null; end $$;
