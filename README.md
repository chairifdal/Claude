# Finance Tracker 💙

Aplikasi pencatatan keuangan untuk berdua (suami & istri), mobile-first.
Stack: **GitHub → Vercel (Next.js 14) + Supabase (Postgres, Auth, Realtime, RLS)**.

## Fitur
- **Akun / pocket**: Tunai, Bank, E-Wallet, Kartu Kredit/Paylater (dengan limit), Investasi, ditampilkan sebagai tumpukan kartu.
  - **Masuk hitungan** (include in totals): kalau dimatikan, transaksinya tidak dihitung di grafik dan anggaran, tetapi saldonya tetap masuk total aset.
  - **Target tabungan**: nominal + tanggal target, dengan hitungan "perlu Rp X per bulan".
- **Berbagi akun** lewat email, dengan dua jenis akses:
  - **Lihat, catat & ubah**: melihat, mencatat pemasukan/pengeluaran, mengubah dan menghapus catatan.
  - **Lihat & transfer**: melihat dan memindahkan uang dari atau ke akun itu, tanpa mencatat pemasukan/pengeluaran.
- **Realtime**: catatan pasangan langsung muncul di HP kamu.
- **Catat cepat di Beranda**: nominal, lalu kategori yang paling sering dipakai, lalu simpan; ada juga tombol "Ulangi" untuk catatan yang berulang. Form lengkap tampil layar penuh.
- **Nominal dengan koma** (Rp 1.250.000,50).
- **Biaya transfer** (Gratis / BI-FAST Rp 2.500 / online Rp 6.500 / lainnya): saldo akun asal berkurang sebesar jumlah + biaya, dan biayanya muncul sebagai pengeluaran "Biaya transfer" di analisis.
- **Transaksi berulang otomatis** (gaji, uang belanja ke pasangan, iuran) dengan tanggal 1–31, tanggal mulai dan selesai, serta bisa dijeda. Dijalankan setiap hari pukul 00.05 WIB oleh `pg_cron`, dan juga saat aplikasi dibuka. Bulan yang terlewat ikut dicatat, dan tidak akan tercatat dua kali.
- **Tagihan rutin** (listrik, internet, SPP, cicilan) lengkap dengan tanggal jatuh tempo, tombol Bayar, dan status Lunas/Telat. Beranda menampilkan saldo setelah tagihan.
- **Kategori + sub-kategori** dengan ±100 ikon rumah tangga yang dikelompokkan dan bisa dicari.
- **Analisis**:
  - Filter utama per orang (Semua / Saya / pasangan); periode Minggu / Bulan atau Periode gajian / Tahun / Rentang tanggal.
  - Pie chart per kategori atau sub-kategori; arus kas dengan rasio menabung; tren dengan garis rata-rata; pengeluaran terbesar.
  - Ketuk kategori untuk melihat detailnya: tren 6 periode, rata-rata, anggaran, rincian, dan catatannya.
- **Periode keuangan per orang** (Pengaturan → Periode mengikuti gajian):
  - **Dari transaksi Gaji:** periode dimulai di tanggal gaji tercatat. Gaji kedua yang masuk < 20 hari setelah awal periode diabaikan; gajian berikutnya diperkirakan dari pola sebelumnya, dan ada pengingat kalau gaji telat dicatat.
  - **Tanggal tetap:** misalnya setiap tanggal 25.
  - Kalau dimatikan, periode memakai bulan kalender. Beranda, Analisis, dan Anggaran mengikuti periode ini; tagihan tetap memakai tanggal kalender.
- **Anggaran** per periode per kategori, termasuk "aman dipakai per hari".
- **Sesuaikan saldo**: ketik saldo sesuai m-banking, lalu selisihnya dicatat sebagai penyesuaian (tidak masuk grafik maupun anggaran).
- **Ekspor CSV** dari halaman Aktivitas.
- **Bahasa Indonesia / English** (Pengaturan → Bahasa). Cek kelengkapan terjemahan: `node scripts/check-i18n.js`.
- Sembunyikan saldo, dan bisa dipasang di layar utama (PWA).

Semua aturan akses ditegakkan di database lewat **Row Level Security**.
Lihat `supabase/schema.sql` dan `supabase/tests/rls_test.sql`.

## Desain

Gaya **iOS** yang colorful:
- **Huruf:** font sistem (SF Pro di iPhone, Inter di perangkat lain), dengan judul besar 34px.
- **Latar & daftar:** latar grouped `#F2F2F7` dengan kartu putih membulat.
- **Warna:** warna sistem Apple (biru `#007AFF`, hijau, merah, oranye, ungu).
- **Ikon:** ikon kategori dan akun berupa tile kotak membulat berwarna, seperti di app Settings.
- **Kartu:** kartu saldo dan kartu bank bergradien ala Apple Wallet.
- **Navigasi & kontrol:** tab bar dan navigation bar tembus pandang (blur), context menu untuk tombol +, sheet dengan "Batal", segmented control, dan switch hijau.

- **Dark Mode**: otomatis mengikuti HP, atau dipilih manual di Pengaturan → Tampilan (Otomatis / Terang / Gelap), dengan palet gelap iOS.
- **Dompet**: grid kartu bergradien per kelompok (tanpa animasi geser), plus bar alokasi kekayaan; kartu kredit menampilkan pemakaian limit, pocket menampilkan progres target.

Warna dasar berupa CSS variable di `app/globals.css` (`:root` untuk terang, `.dark` untuk gelap). Token warna ada di `tailwind.config.js`, kelas dasar di `app/globals.css`, dan komponen dasar di `components/ui.jsx`.

## Deploy (±15 menit)

### 1. Supabase
1. https://supabase.com → **New project** (region Singapore).
2. **SQL Editor → New query** → paste seluruh isi `supabase/schema.sql` → **Run**. File ini aman dijalankan ulang.
   Database yang sudah memakai versi awal cukup menjalankan `supabase/migrations/002_household.sql` lalu `003_fee_recurring.sql`, `004_periods_adjustments.sql` dan `005_card_due_home_widgets.sql` dan `006_avatar_photo.sql` `007_account_icon.sql`, `008_invitable_users.sql` dan `009_budget_period.sql` (berurutan; foto profil, ikon akun, dropdown pasangan).
3. **Authentication → URL Configuration**: isi *Site URL* dengan URL Vercel kamu (mis. `https://kantong-kita.vercel.app`) dan tambahkan `https://kantong-kita.vercel.app/auth/callback` ke *Redirect URLs*.
4. (Opsional) Kalau tidak ingin konfirmasi email: **Authentication → Providers → Email → matikan "Confirm email"**.
5. **Project Settings → API**: salin *Project URL* dan *anon / publishable key*.

### 2. Vercel
1. https://vercel.com → **Add New → Project** → import repo GitHub ini.
2. Tambahkan Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Deploy**. Setiap push ke GitHub akan otomatis di-deploy ulang.

### 3. Pakai berdua
1. Kamu dan pasangan masing-masing **daftar** dengan email sendiri.
2. Buka akun (mis. BCA) → **Bagikan akun** → masukkan email pasangan → pilih *Bisa catat* atau *Hanya lihat*.
3. Pasangan membuka aplikasi → muncul banner undangan → **Terima**.

## Development lokal
```bash
cp .env.example .env.local   # isi URL & key Supabase
npm install
npm run dev
```
Ikon aplikasi dibuat dari `public/icons/icon.svg` → `npm run icons` (butuh Playwright).
