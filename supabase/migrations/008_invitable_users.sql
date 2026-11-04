-- =====================================================================
-- 008 — daftar pengguna yang bisa diundang (untuk dropdown Bagikan akun).
-- Hanya pemilik akun yang bisa memanggil. Pengguna sendiri, anggota yang sudah
-- ada, dan undangan yang masih menunggu tidak ikut. Aman dijalankan ulang.
-- =====================================================================
create or replace function public.list_invitable_users(p_account_id uuid)
returns table (id uuid, email text, full_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.email, p.full_name, p.avatar_url
  from public.profiles p
  where exists (select 1 from public.accounts a where a.id = p_account_id and a.owner_id = auth.uid())
    and p.id <> auth.uid()
    and not exists (select 1 from public.account_members m where m.account_id = p_account_id and m.user_id = p.id)
    and not exists (select 1 from public.account_invites i where i.account_id = p_account_id and i.status = 'pending' and i.email = lower(p.email))
  order by lower(coalesce(p.full_name, p.email));
$$;
revoke all on function public.list_invitable_users(uuid) from public, anon;
grant execute on function public.list_invitable_users(uuid) to authenticated;
