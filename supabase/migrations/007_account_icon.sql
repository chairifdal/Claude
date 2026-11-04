-- =====================================================================
-- 007 — ikon akun (badge merek atau gambar unggahan). Aman dijalankan ulang.
-- =====================================================================
alter table public.accounts add column if not exists icon text;

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

-- Bucket ikon unggahan: folder per pengguna (account-icons/<user_id>/...)
insert into storage.buckets (id, name, public)
values ('account-icons', 'account-icons', true)
on conflict (id) do nothing;

drop policy if exists "account_icons_read" on storage.objects;
create policy "account_icons_read" on storage.objects for select using (bucket_id = 'account-icons');
drop policy if exists "account_icons_insert_own" on storage.objects;
create policy "account_icons_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'account-icons' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "account_icons_update_own" on storage.objects;
create policy "account_icons_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'account-icons' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "account_icons_delete_own" on storage.objects;
create policy "account_icons_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'account-icons' and (storage.foldername(name))[1] = auth.uid()::text);
