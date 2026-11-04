# Kantong Kita 💙

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
- **Tagihan rutin** (listrik, internet, SPP, cicilan) lengkap dengan tanggal jatuh tempo, tombol Bayar, dan status Lunas/Telat. Beranda menampilkan saldo setelah tagihan.
- **Kategori + sub-kategori** dengan ±100 ikon rumah tangga yang dikelompokkan dan bisa dicari.
- **Analisis**: per minggu/bulan/tahun; tampilan daftar atau tren; filter per orang; dikelompokkan per kategori atau sub-kategori. Ketuk kategori untuk melihat detailnya: tren 6 periode, rata-rata, anggaran, rincian, dan catatannya.
- **Anggaran** bulanan per kategori, termasuk "aman dipakai per hari".
- **Ekspor CSV** dari halaman Aktivitas.
- **Bahasa Indonesia / English** (Pengaturan → Bahasa). Cek kelengkapan terjemahan: `node scripts/check-i18n.js`.
- Sembunyikan saldo, dan bisa dipasang di layar utama (PWA).

Semua aturan akses ditegakkan di database lewat **Row Level Security**.
Lihat `supabase/schema.sql` dan `supabase/tests/rls_test.sql`.

## Desain

UI mengikuti skill **design-taste-frontend** ([Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill), MIT), yang terpasang di `.claude/skills/design-taste-frontend/`.

- Gaya app: `pastel-consumer` (seed 1947618770), dengan font Manrope dan aksen cobalt `#1d5fd6`. Permukaan flat dengan border 1px; tidak ada gradient, glow, glass, atau shadow pada elemen diam.
- Ciri khas: angka saldo dengan Manrope, plus "kartu" akun dalam warnanya sendiri pada rasio kartu asli.
- Elemen khas produk: **Kita bulan ini**, yaitu jalur pribadi / bersama / pasangan, dengan warna per orang yang berjarak ≥60°.
- Pertanyaan utama Beranda: "Berapa uang kita sekarang, dan bulan ini habis ke mana?" Temuan terpenting (anggaran yang lewat atau hampir habis) tampil di bawah judul.
- Cek ulang: `node .claude/skills/design-taste-frontend/scripts/lint.mjs --app app components` dan `inspect.mjs --app <url>`.

## Deploy (±15 menit)

### 1. Supabase
1. https://supabase.com → **New project** (region Singapore).
2. **SQL Editor → New query** → paste seluruh isi `supabase/schema.sql` → **Run**. File ini aman dijalankan ulang.
   Database yang sudah memakai versi awal cukup menjalankan `supabase/migrations/002_household.sql`.
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
