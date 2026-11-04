-- =====================================================================
-- 002 — rumah tangga: include in totals, target tabungan, bahasa,
--       tagihan rutin, peran "Lihat & transfer"
-- Aman dijalankan ulang. Untuk database yang sudah menjalankan schema.sql versi awal.
-- =====================================================================

-- 1. Akun: masuk hitungan statistik? + target tabungan
alter table public.accounts add column if not exists include_in_totals boolean not null default true;
alter table public.accounts add column if not exists goal_amount numeric(16,2) check (goal_amount is null or goal_amount > 0);
alter table public.accounts add column if not exists goal_date date;

-- 2. Bahasa per pengguna
alter table public.profiles add column if not exists locale text not null default 'id';
do $$ begin
  alter table public.profiles add constraint profiles_locale_chk check (locale in ('id','en'));
exception when duplicate_object then null; end $$;

-- 3. Tagihan rutin (listrik, internet, cicilan, SPP …) yang menempel pada satu akun
create table if not exists public.bills (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.accounts(id) on delete cascade,
  category_id  uuid references public.categories(id) on delete set null,
  name         text not null,
  amount       numeric(16,2) not null check (amount > 0),
  due_day      int not null check (due_day between 1 and 31),
  active       boolean not null default true,
  created_by   uuid not null references public.profiles(id) default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists bills_account_idx on public.bills(account_id);

alter table public.transactions add column if not exists bill_id uuid references public.bills(id) on delete set null;
create index if not exists tx_bill_idx on public.transactions(bill_id, occurred_at);

alter table public.bills enable row level security;
drop policy if exists bills_select on public.bills;
create policy bills_select on public.bills for select to authenticated
  using (public.can_read_account(account_id));
drop policy if exists bills_write on public.bills;
create policy bills_write on public.bills for all to authenticated
  using (public.can_write_account(account_id)) with check (public.can_write_account(account_id));

-- 4. Peran viewer = "Lihat & transfer": boleh melihat dan memindahkan uang
--    (transfer keluar dari akun ini atau masuk ke akun ini), tidak boleh mencatat
--    pemasukan/pengeluaran, dan hanya boleh mengubah/menghapus transfer buatannya sendiri.
drop policy if exists tx_insert on public.transactions;
create policy tx_insert on public.transactions for insert to authenticated
  with check (
    created_by = auth.uid()
    and (public.can_write_account(account_id)
         or (type = 'transfer' and public.can_read_account(account_id)))
    and (to_account_id is null or public.can_read_account(to_account_id))
  );
drop policy if exists tx_update on public.transactions;
create policy tx_update on public.transactions for update to authenticated
  using (public.can_write_account(account_id)
         or (type = 'transfer' and created_by = auth.uid() and public.can_read_account(account_id)))
  with check (
    (public.can_write_account(account_id)
     or (type = 'transfer' and created_by = auth.uid() and public.can_read_account(account_id)))
    and (to_account_id is null or public.can_read_account(to_account_id))
  );
drop policy if exists tx_delete on public.transactions;
create policy tx_delete on public.transactions for delete to authenticated
  using (public.can_write_account(account_id)
         or (type = 'transfer' and created_by = auth.uid() and public.can_read_account(account_id)));

-- 5. View saldo dibuat ulang supaya kolom baru ikut (a.* dibekukan saat view dibuat)
drop view if exists public.account_balances;
create view public.account_balances
with (security_invoker = true) as
select
  a.*,
  a.initial_balance
    + coalesce((select sum(case when t.type = 'income' then t.amount else -t.amount end)
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

-- 6. Kategori bawaan yang lebih lengkap untuk rumah tangga (hanya untuk user baru)
create or replace function public.seed_default_categories(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p uuid;
begin
  if exists (select 1 from categories where owner_id = uid) then return; end if;

  insert into categories(owner_id, kind, name, icon, color, sort_order)
    values (uid,'expense','Makan & Minum','utensils','#F97316',1) returning id into p;
  insert into categories(owner_id, kind, name, icon, color, parent_id, sort_order) values
    (uid,'expense','Belanja dapur','shopping-basket','#F97316',p,1),
    (uid,'expense','Makan di luar','utensils','#F97316',p,2),
    (uid,'expense','Jajan & kopi','coffee','#F97316',p,3),
    (uid,'expense','Galon & air minum','glass-water','#F97316',p,4);

  insert into categories(owner_id, kind, name, icon, color, sort_order)
    values (uid,'expense','Rumah Tangga','home','#8B5CF6',2) returning id into p;
  insert into categories(owner_id, kind, name, icon, color, parent_id, sort_order) values
    (uid,'expense','Listrik','zap','#8B5CF6',p,1),
    (uid,'expense','Air PDAM','droplet','#8B5CF6',p,2),
    (uid,'expense','Gas LPG','flame','#8B5CF6',p,3),
    (uid,'expense','Internet & TV','wifi','#8B5CF6',p,4),
    (uid,'expense','Asisten rumah tangga','hand-helping','#8B5CF6',p,5),
    (uid,'expense','Iuran RT & kebersihan','trash','#8B5CF6',p,6),
    (uid,'expense','Perabot & perbaikan','wrench','#8B5CF6',p,7),
    (uid,'expense','Sabun & kebutuhan rumah','spray-can','#8B5CF6',p,8),
    (uid,'expense','Sewa / KPR','key','#8B5CF6',p,9);

  insert into categories(owner_id, kind, name, icon, color, sort_order)
    values (uid,'expense','Anak','baby','#EC4899',3) returning id into p;
  insert into categories(owner_id, kind, name, icon, color, parent_id, sort_order) values
    (uid,'expense','Susu & popok','milk','#EC4899',p,1),
    (uid,'expense','Sekolah & SPP','school','#EC4899',p,2),
    (uid,'expense','Les & buku','book','#EC4899',p,3),
    (uid,'expense','Mainan & baju anak','toy-brick','#EC4899',p,4);

  insert into categories(owner_id, kind, name, icon, color, sort_order)
    values (uid,'expense','Transportasi','car','#0EA5E9',4) returning id into p;
  insert into categories(owner_id, kind, name, icon, color, parent_id, sort_order) values
    (uid,'expense','Bensin','fuel','#0EA5E9',p,1),
    (uid,'expense','Ojek online','bike','#0EA5E9',p,2),
    (uid,'expense','Parkir & tol','circle-parking','#0EA5E9',p,3),
    (uid,'expense','Servis kendaraan','wrench','#0EA5E9',p,4);

  insert into categories(owner_id, kind, name, icon, color, sort_order)
    values (uid,'expense','Kesehatan','heart-pulse','#EF4444',5) returning id into p;
  insert into categories(owner_id, kind, name, icon, color, parent_id, sort_order) values
    (uid,'expense','Dokter & RS','stethoscope','#EF4444',p,1),
    (uid,'expense','Obat & vitamin','pill','#EF4444',p,2),
    (uid,'expense','BPJS & asuransi','shield','#EF4444',p,3);

  insert into categories(owner_id, kind, name, icon, color, sort_order)
    values (uid,'expense','Belanja pribadi','shopping-bag','#F59E0B',6) returning id into p;
  insert into categories(owner_id, kind, name, icon, color, parent_id, sort_order) values
    (uid,'expense','Pakaian','shirt','#F59E0B',p,1),
    (uid,'expense','Perawatan & salon','scissors','#F59E0B',p,2),
    (uid,'expense','Elektronik','smartphone','#F59E0B',p,3);

  insert into categories(owner_id, kind, name, icon, color, sort_order) values
    (uid,'expense','Hiburan & liburan','plane','#0D9488',7),
    (uid,'expense','Cicilan & utang','receipt','#64748B',8),
    (uid,'expense','Sedekah & zakat','hand-heart','#10B981',9),
    (uid,'expense','Keluarga & hadiah','gift','#10B981',10),
    (uid,'expense','Hewan peliharaan','paw-print','#B45309',11),
    (uid,'expense','Lainnya','circle-ellipsis','#94A3B8',99);

  insert into categories(owner_id, kind, name, icon, color, sort_order)
    values (uid,'income','Gaji','briefcase','#16A34A',1) returning id into p;
  insert into categories(owner_id, kind, name, icon, color, parent_id, sort_order) values
    (uid,'income','Gaji pokok','briefcase','#16A34A',p,1),
    (uid,'income','Bonus & THR','sparkles','#16A34A',p,2);
  insert into categories(owner_id, kind, name, icon, color, sort_order) values
    (uid,'income','Usaha / Freelance','laptop','#0D9488',2),
    (uid,'income','Investasi & bunga','trending-up','#2563EB',3),
    (uid,'income','Uang belanja dari pasangan','hand-coins','#EC4899',4),
    (uid,'income','Lainnya','circle-ellipsis','#94A3B8',99);
end $$;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

-- 7. Realtime untuk tagihan
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bills') then
    alter publication supabase_realtime add table public.bills;
  end if;
end $$;
