# Kantong Kita 💙

Aplikasi pencatatan keuangan untuk berdua (suami & istri), mobile-first.
Stack: **GitHub → Vercel (Next.js 14) + Supabase (Postgres, Auth, Realtime, RLS)**.

## Fitur
- **Akun / pocket**: Tunai, Bank, E-Wallet, Kartu Kredit/Paylater (dengan limit), dan Investasi. Tampil sebagai tumpukan kartu seperti di aplikasi dompet.
- **Berbagi akun (invite)**: pemilik mengundang lewat email dan memilih akses:
  - **Bisa catat** (editor): lihat dan tambah/ubah/hapus transaksi
  - **Hanya lihat** (viewer): lihat saldo dan riwayat saja
  Pemilik bisa mengubah akses kapan saja atau mencabutnya. Anggota bisa keluar sendiri.
- **Realtime**: transaksi yang dicatat user A langsung muncul di HP user B (Supabase Realtime).
- **Transfer antar user**: kirim dari akunmu ke akun pasangan yang dibagikan ke kamu, termasuk yang aksesnya *hanya lihat*.
- **Kategori + sub-kategori** untuk pemasukan dan pengeluaran (ikon & warna bisa diatur). Kategori default otomatis dibuat saat daftar.
- **Analisis**: donut per kategori (bisa dibuka per sub-kategori), "dicatat oleh" siapa, dan tren 6 bulan.
- **Anggaran** bulanan per kategori.
- Tombol untuk menyembunyikan saldo, dan bisa dipasang di layar utama (PWA, dengan ikon aplikasi).

Semua aturan akses ditegakkan di database lewat **Row Level Security**, tidak hanya di UI.
Lihat `supabase/schema.sql` dan tesnya di `supabase/tests/rls_test.sql`.

## Deploy (±15 menit)

### 1. Supabase
1. https://supabase.com → **New project** (region Singapore).
2. **SQL Editor → New query** → paste seluruh isi `supabase/schema.sql` → **Run**. File ini aman dijalankan ulang.
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
