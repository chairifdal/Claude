-- =====================================================================
-- Kantong Kita — skema database (Supabase / Postgres)
-- Jalankan seluruh file ini di Supabase → SQL Editor → New query → Run.
-- Aman dijalankan ulang (idempotent).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. PROFILES
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_hue  int  not null default 220,
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_hue)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    (floor(random() * 360))::int
  )
  on conflict (id) do nothing;
  perform public.seed_default_categories(new.id);
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. ACCOUNTS (bank / pocket / e-wallet / kartu kredit / investasi)
-- ---------------------------------------------------------------------
create table if not exists public.accounts (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  name             text not null,
  kind             text not null default 'bank'
                   check (kind in ('cash','bank','ewallet','credit','investment')),
  color            text not null default '#2563EB',
  initial_balance  numeric(16,2) not null default 0,
  credit_limit     numeric(16,2),
  account_number   text,
  archived         boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists accounts_owner_idx on public.accounts(owner_id);

-- Anggota yang di-invite ke sebuah akun
create table if not exists public.account_members (
  account_id  uuid not null references public.accounts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'viewer' check (role in ('viewer','editor')),
  created_at  timestamptz not null default now(),
  primary key (account_id, user_id)
);
create index if not exists account_members_user_idx on public.account_members(user_id);

-- Undangan (berdasarkan email)
create table if not exists public.account_invites (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.accounts(id) on delete cascade,
  email         text not null,
  role          text not null default 'viewer' check (role in ('viewer','editor')),
  status        text not null default 'pending' check (status in ('pending','accepted','declined')),
  invited_by    uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  account_name  text,
  inviter_name  text,
  created_at    timestamptz not null default now()
);
create unique index if not exists account_invites_pending_uniq
  on public.account_invites(account_id, email) where status = 'pending';

-- ---------------------------------------------------------------------
-- 3. CATEGORIES (dengan sub-kategori via parent_id)
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  kind        text not null check (kind in ('income','expense')),
  name        text not null,
  icon        text not null default 'circle',
  color       text not null default '#64748B',
  parent_id   uuid references public.categories(id) on delete cascade,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists categories_owner_idx on public.categories(owner_id);
create index if not exists categories_parent_idx on public.categories(parent_id);

-- ---------------------------------------------------------------------
-- 4. TRANSACTIONS
--    income   : account_id bertambah
--    expense  : account_id berkurang
--    transfer : account_id → to_account_id (bisa lintas user)
-- ---------------------------------------------------------------------
create table if not exists public.transactions (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references public.accounts(id) on delete cascade,
  to_account_id      uuid references public.accounts(id) on delete cascade,
  type               text not null check (type in ('income','expense','transfer')),
  amount             numeric(16,2) not null check (amount > 0),
  category_id        uuid references public.categories(id) on delete set null,
  note               text,
  occurred_at        timestamptz not null default now(),
  created_by         uuid not null references public.profiles(id) default auth.uid(),
  -- snapshot nama supaya penerima transfer tetap bisa melihat asal dana
  account_name       text,
  to_account_name    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint transfer_needs_target check (
    (type = 'transfer' and to_account_id is not null and to_account_id <> account_id)
    or (type <> 'transfer' and to_account_id is null)
  )
);
create index if not exists tx_account_idx    on public.transactions(account_id, occurred_at desc);
create index if not exists tx_to_account_idx on public.transactions(to_account_id, occurred_at desc);
create index if not exists tx_category_idx   on public.transactions(category_id);

-- ---------------------------------------------------------------------
-- 5. BUDGETS (anggaran bulanan per kategori induk)
-- ---------------------------------------------------------------------
create table if not exists public.budgets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  category_id  uuid not null references public.categories(id) on delete cascade,
  amount       numeric(16,2) not null check (amount > 0),
  created_at   timestamptz not null default now(),
  unique (owner_id, category_id)
);

-- =====================================================================
-- HELPER FUNCTIONS (security definer → menghindari rekursi RLS)
-- =====================================================================
create or replace function public.is_account_owner(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from accounts where id = aid and owner_id = auth.uid());
$$;

create or replace function public.can_read_account(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from accounts where id = aid and owner_id = auth.uid())
      or exists (select 1 from account_members where account_id = aid and user_id = auth.uid());
$$;

create or replace function public.can_write_account(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from accounts where id = aid and owner_id = auth.uid())
      or exists (select 1 from account_members
                 where account_id = aid and user_id = auth.uid() and role = 'editor');
$$;

-- apakah user saat ini "terhubung" (berbagi minimal 1 akun) dengan user lain
create or replace function public.is_connected(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select other = auth.uid() or exists (
    select 1
    from accounts a
    left join account_members m on m.account_id = a.id
    where (a.owner_id = auth.uid() and m.user_id = other)
       or (a.owner_id = other and m.user_id = auth.uid())
       or exists (select 1 from account_members m2
                  where m2.account_id = a.id and m2.user_id = auth.uid()
                    and m.user_id = other)
  );
$$;

-- Kategori default untuk user baru
create or replace function public.seed_default_categories(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p uuid;
begin
  if exists (select 1 from categories where owner_id = uid) then return; end if;

  -- PENGELUARAN
  insert into categories(owner_id, kind, name, icon, color, sort_order)
    values (uid,'expense','Makan & Minum','utensils','#F97316',1) returning id into p;
  insert into categories(owner_id, kind, name, icon, color, parent_id, sort_order) values
    (uid,'expense','Makan di luar','utensils','#F97316',p,1),
    (uid,'expense','Belanja dapur','shopping-basket','#F97316',p,2),
    (uid,'expense','Kopi & jajan','coffee','#F97316',p,3);

  insert into categories(owner_id, kind, name, icon, color, sort_order)
    values (uid,'expense','Transportasi','car','#0EA5E9',2) returning id into p;
  insert into categories(owner_id, kind, name, icon, color, parent_id, sort_order) values
    (uid,'expense','Bensin','fuel','#0EA5E9',p,1),
    (uid,'expense','Ojek online','bike','#0EA5E9',p,2),
    (uid,'expense','Parkir & tol','circle-parking','#0EA5E9',p,3);

  insert into categories(owner_id, kind, name, icon, color, sort_order)
    values (uid,'expense','Rumah Tangga','home','#8B5CF6',3) returning id into p;
  insert into categories(owner_id, kind, name, icon, color, parent_id, sort_order) values
    (uid,'expense','Listrik','zap','#8B5CF6',p,1),
    (uid,'expense','Air','droplet','#8B5CF6',p,2),
    (uid,'expense','Internet & pulsa','wifi','#8B5CF6',p,3);

  insert into categories(owner_id, kind, name, icon, color, sort_order)
    values (uid,'expense','Belanja','shopping-bag','#EC4899',4) returning id into p;
  insert into categories(owner_id, kind, name, icon, color, parent_id, sort_order) values
    (uid,'expense','Pakaian','shirt','#EC4899',p,1),
    (uid,'expense','Elektronik','smartphone','#EC4899',p,2);

  insert into categories(owner_id, kind, name, icon, color, sort_order) values
    (uid,'expense','Kesehatan','heart-pulse','#EF4444',5),
    (uid,'expense','Hiburan','clapperboard','#F59E0B',6),
    (uid,'expense','Cicilan & Tagihan','receipt','#64748B',7),
    (uid,'expense','Sedekah & Hadiah','gift','#10B981',8),
    (uid,'expense','Lainnya','circle-ellipsis','#94A3B8',99);

  -- PEMASUKAN
  insert into categories(owner_id, kind, name, icon, color, sort_order)
    values (uid,'income','Gaji','briefcase','#16A34A',1) returning id into p;
  insert into categories(owner_id, kind, name, icon, color, parent_id, sort_order) values
    (uid,'income','Gaji pokok','briefcase','#16A34A',p,1),
    (uid,'income','Bonus & THR','sparkles','#16A34A',p,2);
  insert into categories(owner_id, kind, name, icon, color, sort_order) values
    (uid,'income','Usaha / Freelance','laptop','#0D9488',2),
    (uid,'income','Investasi','trending-up','#2563EB',3),
    (uid,'income','Lainnya','circle-ellipsis','#94A3B8',99);
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Snapshot nama akun pada transaksi + validasi transfer
create or replace function public.tx_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select name into new.account_name from accounts where id = new.account_id;
  if new.to_account_id is not null then
    select name into new.to_account_name from accounts where id = new.to_account_id;
  else
    new.to_account_name := null;
  end if;
  if new.type = 'transfer' then new.category_id := null; end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tx_before_write on public.transactions;
create trigger tx_before_write
  before insert or update on public.transactions
  for each row execute function public.tx_before_write();

-- Snapshot nama akun & pengundang pada invite
create or replace function public.invite_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.email := lower(trim(new.email));
  select name into new.account_name from accounts where id = new.account_id;
  select coalesce(full_name, email) into new.inviter_name from profiles where id = new.invited_by;
  return new;
end $$;

drop trigger if exists invite_before_insert on public.account_invites;
create trigger invite_before_insert
  before insert on public.account_invites
  for each row execute function public.invite_before_insert();

-- Terima / tolak undangan
create or replace function public.respond_invite(invite_id uuid, accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  inv account_invites;
  my_email text := lower(auth.jwt()->>'email');
begin
  select * into inv from account_invites where id = invite_id and status = 'pending';
  if not found then raise exception 'Undangan tidak ditemukan'; end if;
  if inv.email <> my_email then raise exception 'Undangan ini bukan untuk akun kamu'; end if;

  if accept then
    if exists (select 1 from accounts where id = inv.account_id and owner_id = auth.uid()) then
      raise exception 'Kamu adalah pemilik akun ini';
    end if;
    insert into account_members(account_id, user_id, role)
      values (inv.account_id, auth.uid(), inv.role)
      on conflict (account_id, user_id) do update set role = excluded.role;
    update account_invites set status = 'accepted' where id = invite_id;
  else
    update account_invites set status = 'declined' where id = invite_id;
  end if;
end $$;

-- =====================================================================
-- VIEW: saldo per akun (security_invoker → mengikuti RLS user)
-- =====================================================================
create or replace view public.account_balances
with (security_invoker = true) as
select
  a.*,
  a.initial_balance
    + coalesce((select sum(case
                  when t.type = 'income' then t.amount
                  else -t.amount end)
                from transactions t where t.account_id = a.id), 0)
    + coalesce((select sum(t.amount) from transactions t
                where t.to_account_id = a.id and t.type = 'transfer'), 0)
    as balance,
  case when a.owner_id = auth.uid() then 'owner'
       else (select m.role from account_members m
             where m.account_id = a.id and m.user_id = auth.uid())
  end as my_role,
  (select count(*) from account_members m where m.account_id = a.id) as member_count
from accounts a;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.accounts         enable row level security;
alter table public.account_members  enable row level security;
alter table public.account_invites  enable row level security;
alter table public.categories       enable row level security;
alter table public.transactions     enable row level security;
alter table public.budgets          enable row level security;

-- PROFILES
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_connected(id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ACCOUNTS
drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts for select to authenticated
  using (public.can_read_account(id));
drop policy if exists accounts_insert on public.accounts;
create policy accounts_insert on public.accounts for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists accounts_update on public.accounts;
create policy accounts_update on public.accounts for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists accounts_delete on public.accounts;
create policy accounts_delete on public.accounts for delete to authenticated
  using (owner_id = auth.uid());

-- ACCOUNT MEMBERS (insert hanya lewat respond_invite)
drop policy if exists members_select on public.account_members;
create policy members_select on public.account_members for select to authenticated
  using (user_id = auth.uid() or public.can_read_account(account_id));
drop policy if exists members_update on public.account_members;
create policy members_update on public.account_members for update to authenticated
  using (public.is_account_owner(account_id)) with check (public.is_account_owner(account_id));
drop policy if exists members_delete on public.account_members;
create policy members_delete on public.account_members for delete to authenticated
  using (public.is_account_owner(account_id) or user_id = auth.uid());

-- INVITES
drop policy if exists invites_select on public.account_invites;
create policy invites_select on public.account_invites for select to authenticated
  using (public.is_account_owner(account_id) or email = lower(auth.jwt()->>'email'));
drop policy if exists invites_insert on public.account_invites;
create policy invites_insert on public.account_invites for insert to authenticated
  with check (public.is_account_owner(account_id) and invited_by = auth.uid());
drop policy if exists invites_delete on public.account_invites;
create policy invites_delete on public.account_invites for delete to authenticated
  using (public.is_account_owner(account_id));

-- CATEGORIES (terlihat juga oleh user yang terhubung lewat akun bersama)
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select to authenticated
  using (owner_id = auth.uid() or public.is_connected(owner_id));
drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- TRANSACTIONS
drop policy if exists tx_select on public.transactions;
create policy tx_select on public.transactions for select to authenticated
  using (public.can_read_account(account_id)
         or (to_account_id is not null and public.can_read_account(to_account_id)));
drop policy if exists tx_insert on public.transactions;
create policy tx_insert on public.transactions for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_write_account(account_id)
    and (to_account_id is null or public.can_read_account(to_account_id))
  );
drop policy if exists tx_update on public.transactions;
create policy tx_update on public.transactions for update to authenticated
  using (public.can_write_account(account_id))
  with check (public.can_write_account(account_id)
              and (to_account_id is null or public.can_read_account(to_account_id)));
drop policy if exists tx_delete on public.transactions;
create policy tx_delete on public.transactions for delete to authenticated
  using (public.can_write_account(account_id));

-- BUDGETS
drop policy if exists budgets_all on public.budgets;
create policy budgets_all on public.budgets for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- =====================================================================
-- GRANTS
-- =====================================================================
grant select on public.account_balances to authenticated;
grant execute on function public.respond_invite(uuid, boolean) to authenticated;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;
-- Fungsi trigger tidak perlu dipanggil langsung lewat API
revoke execute on function public.handle_new_user()      from public, anon, authenticated;
revoke execute on function public.tx_before_write()      from public, anon, authenticated;
revoke execute on function public.invite_before_insert() from public, anon, authenticated;
-- Helper RLS & RPC hanya untuk user yang login
revoke execute on function public.is_account_owner(uuid)        from public, anon;
revoke execute on function public.can_read_account(uuid)        from public, anon;
revoke execute on function public.can_write_account(uuid)       from public, anon;
revoke execute on function public.is_connected(uuid)            from public, anon;
revoke execute on function public.respond_invite(uuid, boolean) from public, anon;
grant  execute on function public.is_account_owner(uuid), public.can_read_account(uuid),
                           public.can_write_account(uuid), public.is_connected(uuid) to authenticated;

-- =====================================================================
-- REALTIME — perubahan langsung terlihat di HP pasangan
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['transactions','accounts','account_members','account_invites','categories'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Backfill: profil & kategori untuk user yang sudah terdaftar sebelum skema ini
insert into public.profiles (id, email, full_name)
select u.id, lower(u.email), coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1))
from auth.users u
on conflict (id) do nothing;

do $$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.seed_default_categories(r.id);
  end loop;
end $$;


-- =====================================================================
-- Sertakan migrasi 002 (isi sama dengan supabase/migrations/002_household.sql)
-- =====================================================================
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


-- =====================================================================
-- Sertakan migrasi 003 (isi sama dengan supabase/migrations/003_fee_recurring.sql)
-- =====================================================================
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
