-- =====================================================================
-- 004 — periode gajian, penyesuaian saldo, pengaman hapus akun
-- Aman dijalankan ulang.
-- =====================================================================

-- 1. Periode keuangan per orang
--    calendar = tanggal 1 s/d akhir bulan
--    salary   = mulai di setiap transaksi pemasukan kategori gaji (salary_category_id + sub-kategorinya)
--    fixed    = mulai di tanggal tetap (period_day)
alter table public.profiles add column if not exists period_mode text not null default 'calendar';
alter table public.profiles add column if not exists period_day int not null default 25;
alter table public.profiles add column if not exists salary_category_id uuid references public.categories(id) on delete set null;
do $$ begin
  alter table public.profiles add constraint profiles_period_mode_chk check (period_mode in ('calendar','salary','fixed'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_period_day_chk check (period_day between 1 and 28);
exception when duplicate_object then null; end $$;

-- 2. Penyesuaian saldo ("Sesuaikan saldo"): transaksi biasa yang ditandai,
--    tidak ikut statistik pemasukan/pengeluaran.
alter table public.transactions add column if not exists is_adjustment boolean not null default false;
do $$ begin
  alter table public.transactions add constraint tx_adjustment_chk check (not is_adjustment or type <> 'transfer');
exception when duplicate_object then null; end $$;

-- 3. Pengaman: akun yang punya transfer dengan akun milik orang lain tidak boleh dihapus,
--    karena penghapusan berantai akan ikut menghapus transfer itu dan mengubah saldo pasangan.
create or replace function public.guard_account_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Hanya untuk penghapusan oleh pengguna; penghapusan akun login oleh admin (auth.uid() kosong) tetap jalan
  if auth.uid() is not null and exists (
    select 1 from transactions t
    join accounts other on other.id = case when t.account_id = old.id then t.to_account_id else t.account_id end
    where t.type = 'transfer'
      and (t.account_id = old.id or t.to_account_id = old.id)
      and other.owner_id <> old.owner_id
  ) then
    raise exception 'ACCOUNT_HAS_SHARED_TRANSFERS'
      using hint = 'Akun ini punya transfer dengan akun pasangan. Arsipkan saja supaya saldo pasangan tidak berubah.';
  end if;
  return old;
end $$;
revoke execute on function public.guard_account_delete() from public, anon, authenticated;

drop trigger if exists guard_account_delete on public.accounts;
create trigger guard_account_delete
  before delete on public.accounts
  for each row execute function public.guard_account_delete();
