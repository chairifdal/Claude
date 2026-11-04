-- Skenario uji RLS. Dijalankan terhadap database lokal dengan mock auth.
\set ON_ERROR_STOP 1
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','a@x.com','{"full_name":"Andi"}'),
 ('00000000-0000-0000-0000-00000000000b','b@x.com','{"full_name":"Bunga"}'),
 ('00000000-0000-0000-0000-00000000000c','c@x.com','{"full_name":"Citra"}');

create or replace function pg_temp.as_user(c text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-00000000000'||c), 'email', c||'@x.com')::text, false);
end $$;

set role authenticated;

-- A membuat 2 akun
select pg_temp.as_user('a');
insert into accounts(id,name,kind,initial_balance) values
 ('aaaaaaaa-0000-0000-0000-000000000001','BCA Andi','bank',1000000),
 ('aaaaaaaa-0000-0000-0000-000000000002','Dompet Andi','cash',50000);
-- B membuat 1 akun
select pg_temp.as_user('b');
insert into accounts(id,name,kind,initial_balance) values ('bbbbbbbb-0000-0000-0000-000000000001','Gopay Bunga','ewallet',0);

-- A undang B ke BCA sebagai editor, ke Dompet sebagai viewer
select pg_temp.as_user('a');
insert into account_invites(account_id,email,role) values
 ('aaaaaaaa-0000-0000-0000-000000000001','B@x.com','editor'),
 ('aaaaaaaa-0000-0000-0000-000000000002','b@x.com','viewer');
-- C tidak boleh lihat undangan B
select pg_temp.as_user('c');
do $$ begin assert (select count(*) from account_invites)=0, 'C sees invites'; end $$;
-- C tidak boleh menerima undangan B
do $$ begin
  perform respond_invite((select id from account_invites limit 1), true);
  raise exception 'should not reach';
exception when others then if sqlerrm='should not reach' then raise; end if; end $$;

select pg_temp.as_user('b');
do $$ begin assert (select count(*) from account_invites where status='pending')=2, 'B invites'; end $$;
select respond_invite(id, true) from account_invites where status='pending';
do $$ begin assert (select count(*) from accounts)=3, 'B should see 3 accounts'; end $$;

-- B (editor) mencatat pengeluaran di BCA Andi dengan kategori milik A
insert into transactions(account_id,type,amount,category_id)
 select 'aaaaaaaa-0000-0000-0000-000000000001','expense',200000,id
 from categories where owner_id='00000000-0000-0000-0000-00000000000a' and name='Listrik';
-- B (viewer) TIDAK boleh mencatat di Dompet Andi
do $$ begin
  insert into transactions(account_id,type,amount) values ('aaaaaaaa-0000-0000-0000-000000000002','expense',1000);
  raise exception 'should not reach';
exception when insufficient_privilege then null; end $$;
-- B (viewer = Lihat & transfer) BOLEH transfer keluar dari Dompet Andi ke Gopay miliknya
insert into transactions(id,account_id,to_account_id,type,amount) values
 ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001','transfer',10000);
-- ...dan boleh menghapus transfer buatannya sendiri
delete from transactions where id='cccccccc-0000-0000-0000-000000000001';
do $$ begin assert (select count(*) from transactions where id='cccccccc-0000-0000-0000-000000000001')=0, 'viewer delete own transfer'; end $$;
-- viewer tidak boleh membuat tagihan di akun Andi
do $$ begin
  insert into bills(account_id,name,amount,due_day) values ('aaaaaaaa-0000-0000-0000-000000000002','x',1,1);
  raise exception 'should not reach';
exception when insufficient_privilege then null; end $$;
-- editor boleh membuat tagihan di BCA Andi
insert into bills(account_id,name,amount,due_day) values ('aaaaaaaa-0000-0000-0000-000000000001','Listrik',450000,20);

-- B transfer dari Gopay Bunga ke BCA Andi (shared)
insert into transactions(account_id,to_account_id,type,amount) values
 ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','transfer',300000);

-- A transfer dari BCA ke Gopay Bunga (tidak di-share ke A) -> ditolak
select pg_temp.as_user('a');
do $$ begin
  insert into transactions(account_id,to_account_id,type,amount) values
   ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','transfer',1);
  raise exception 'should not reach';
exception when insufficient_privilege then null; end $$;

-- A melihat saldo BCA = 1.000.000 - 200.000 + 300.000
do $$ begin
  assert (select balance from account_balances where id='aaaaaaaa-0000-0000-0000-000000000001')=1100000, 'A balance';
  assert (select count(*) from transactions)=2, 'A sees 2 tx';
  assert (select account_name from transactions where type='transfer')='Gopay Bunga', 'snapshot';
end $$;

-- B melihat saldo Gopay = -300.000, role & kategori A terlihat
select pg_temp.as_user('b');
do $$ begin
  assert (select balance from account_balances where id='bbbbbbbb-0000-0000-0000-000000000001')=-300000, 'B gopay';
  assert (select my_role from account_balances where id='aaaaaaaa-0000-0000-0000-000000000001')='editor', 'role';
  assert (select count(*) from profiles)=2, 'B sees A profile';
  assert (select count(*) from categories where owner_id='00000000-0000-0000-0000-00000000000a')>0, 'B sees A cats';
end $$;
-- B tidak bisa mengubah akun milik A / role dirinya
update accounts set name='hack' where id='aaaaaaaa-0000-0000-0000-000000000001';
update account_members set role='editor' where account_id='aaaaaaaa-0000-0000-0000-000000000002';
do $$ begin
  assert (select name from accounts where id='aaaaaaaa-0000-0000-0000-000000000001')='BCA Andi', 'rename blocked';
  assert (select role from account_members where account_id='aaaaaaaa-0000-0000-0000-000000000002')='viewer', 'role blocked';
end $$;

-- A tidak bisa menghapus transfer B secara diam-diam? A pemilik → boleh (editor/owner). Cek include_in_totals ada.
select pg_temp.as_user('a');
do $$ begin
  assert (select include_in_totals from account_balances where id='aaaaaaaa-0000-0000-0000-000000000001'), 'include default';
  assert (select count(*) from bills)=1, 'A sees bill';
end $$;
-- C tidak melihat apa pun milik A/B
select pg_temp.as_user('c');
do $$ begin
  assert (select count(*) from bills)=0, 'C bills';
  assert (select count(*) from accounts)=0, 'C accounts';
  assert (select count(*) from transactions)=0, 'C tx';
  assert (select count(*) from profiles)=1, 'C profiles';
  assert (select count(*) from categories where owner_id<>'00000000-0000-0000-0000-00000000000c')=0, 'C cats';
end $$;

-- A mencabut akses B ke BCA
select pg_temp.as_user('a');
delete from account_members where account_id='aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.as_user('b');
do $$ begin assert (select count(*) from accounts)=2, 'B after revoke'; end $$;

-- ===== 003: biaya transfer & transaksi berulang =====
select pg_temp.as_user('a');
do $$ declare before numeric; begin
  select balance into before from account_balances where id='aaaaaaaa-0000-0000-0000-000000000002';
  insert into transactions(account_id,to_account_id,type,amount,fee) values
   ('aaaaaaaa-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','transfer',10000,2500);
  assert (select balance from account_balances where id='aaaaaaaa-0000-0000-0000-000000000002') = before - 12500, 'fee reduces source';
end $$;
-- biaya hanya untuk transfer
do $$ begin
  insert into transactions(account_id,type,amount,fee) values ('aaaaaaaa-0000-0000-0000-000000000002','expense',1,1);
  raise exception 'should not reach';
exception when check_violation then null; end $$;

-- jadwal pengeluaran tgl 1, mulai 2 bulan lalu → 3 catatan (bulan-2, bulan-1, bulan ini)
insert into recurring(id,account_id,type,amount,day_of_month,start_date,note) values
 ('dddddddd-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002','expense',100000,1,
  (date_trunc('month', now() at time zone 'Asia/Jakarta') - interval '2 month')::date,'Iuran RT');
do $$ declare n int; begin
  n := run_my_recurring();
  assert n = 3, format('expected 3 runs, got %s', n);
  assert run_my_recurring() = 0, 'idempotent';
  assert (select count(*) from transactions where recurring_id='dddddddd-0000-0000-0000-000000000001') = 3, 'three rows';
end $$;

-- B (Lihat & transfer di Dompet Andi): boleh jadwal transfer, tidak boleh jadwal pengeluaran
select pg_temp.as_user('b');
insert into recurring(account_id,to_account_id,type,amount,fee,day_of_month) values
 ('aaaaaaaa-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001','transfer',50000,2500,28);
do $$ begin
  insert into recurring(account_id,type,amount,day_of_month) values ('aaaaaaaa-0000-0000-0000-000000000002','expense',1,1);
  raise exception 'should not reach';
exception when insufficient_privilege then null; end $$;
-- run_recurring langsung tidak boleh dipanggil user
do $$ begin
  perform run_recurring(null);
  raise exception 'should not reach';
exception when insufficient_privilege then null; end $$;

-- ===== 004: penyesuaian saldo & pengaman hapus akun =====
select pg_temp.as_user('a');
do $$ declare before numeric; begin
  select balance into before from account_balances where id='aaaaaaaa-0000-0000-0000-000000000001';
  insert into transactions(account_id,type,amount,is_adjustment,note) values ('aaaaaaaa-0000-0000-0000-000000000001','expense',45000,true,'Penyesuaian saldo');
  assert (select balance from account_balances where id='aaaaaaaa-0000-0000-0000-000000000001') = before - 45000, 'adjustment changes balance';
end $$;
-- penyesuaian tidak boleh berupa transfer
do $$ begin
  insert into transactions(account_id,to_account_id,type,amount,is_adjustment) values
   ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002','transfer',1,true);
  raise exception 'should not reach';
exception when check_violation then null; end $$;
-- BCA Andi menerima transfer dari Gopay Bunga → tidak boleh dihapus
do $$ begin
  delete from accounts where id='aaaaaaaa-0000-0000-0000-000000000001';
  raise exception 'should not reach';
exception when raise_exception then
  if sqlerrm <> 'ACCOUNT_HAS_SHARED_TRANSFERS' then raise; end if;
end $$;
do $$ begin assert (select count(*) from accounts where id='aaaaaaaa-0000-0000-0000-000000000001')=1, 'BCA still exists'; end $$;
-- akun tanpa transfer lintas pemilik boleh dihapus
insert into accounts(id,name,kind) values ('aaaaaaaa-0000-0000-0000-000000000009','Coba','cash');
delete from accounts where id='aaaaaaaa-0000-0000-0000-000000000009';
do $$ begin assert (select count(*) from accounts where id='aaaaaaaa-0000-0000-0000-000000000009')=0, 'plain delete ok'; end $$;
-- pengaturan periode
update profiles set period_mode='salary', period_day=25 where id=auth.uid();
do $$ begin
  update profiles set period_mode='weekly' where id=auth.uid();
  raise exception 'should not reach';
exception when check_violation then null; end $$;

reset role;
\echo ALL RLS TESTS PASSED
