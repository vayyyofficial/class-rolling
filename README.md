# Class Rolling — Class Seating Management & Group Randomizer

Platform utilitas kelas modern dan profesional yang dirancang khusus untuk kelas berkapasitas **26 siswa**. Menampilkan dua fitur utama: **Denah Tempat Duduk Kelas** dengan rotasi otomatis mingguan dan **Group Randomizer** pembagi kelompok acak untuk tugas dan proyek mata pelajaran.

Dibangun dengan React 19, Tailwind CSS, Vite, dan Supabase PostgreSQL.

---

## 🌟 Fitur Utama

1. **Denah Tempat Duduk Kelas (Visual Seating Chart)**
   - Denah 3 blok ruangan: Blok Kiri (10 kursi), Blok Tengah (10 kursi), Blok Kanan (8 kursi) = Total 28 posisi.
   - Tepat 26 siswa aktif ditempatkan, menyisakan 2 kursi kosong teratur di baris belakang blok kanan.
   - Pembedaan visual yang jelas antara kursi terisi, kursi kosong, dan status sorot siswa terpilih.
   - Pemetaan nomor kursi nyata (`01`–`28`) tanpa mengekspos UUID database.

2. **Group Randomizer (Pembagi Kelompok Acak)**
   - Membagi 26 siswa ke dalam kelompok seimbang (2 hingga 26 kelompok).
   - Algoritma round-robin memastikan distribusi ukuran kelompok merata (contoh: 4 kelompok = 7, 7, 6, 6 siswa).
   - Animasi pengacakan visual cepat dengan selebrasi konfeti.
   - Fitur 1-klik **Salin Hasil (WhatsApp)** dengan format teks rapi siap dibagikan ke grup kelas.

3. **Rotasi Otomatis Mingguan (Minggu 06:00 WIB)**
   - Pengacakan otomatis dieksekusi setiap **Minggu pukul 06:00 WIB** (Sabtu 23:00 UTC) via `pg_cron` dan sinkronisasi siklus.
   - Algoritma Fisher-Yates (Knuth shuffle) adil tanpa bias.
   - Siklus terkunci sepanjang pekan (denah stabil, tidak berubah saat refresh).

4. **Acak Ulang Manual (Admin Reroll)**
   - Memungkinkan pengurus kelas mengacak ulang susunan jika ada instruksi khusus dari wali kelas/guru.
   - Acak ulang manual tidak membatalkan atau menggeser jadwal rotasi otomatis Minggu 06:00 WIB berikutnya.

5. **Otentikasi Sandi Administrator (Password-Only Authentication)**
   - Sistem login admin berbasis kata sandi tanpa input email atau username.
   - Hashing kuat **Bcrypt** (cost 12 via `pgcrypto`) pada tingkat server database.
   - Proteksi brute-force otomatis: maksimal 5 kali percobaan gagal sebelum akun terkunci selama 15 menit.
   - Fitur ganti kata sandi mandiri di Panel Admin (wajib memverifikasi kata sandi saat ini).
   - Prosedur pemulihan (recovery) aman melalui otorisasi server internal (`server_provision_admin_password`).

---

## 🚀 Teknologi

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Canvas Confetti
- **Backend & Database**: Supabase (PostgreSQL 15, Row Level Security, Realtime, RPCs, pgcrypto, pg_cron)
- **Hosting Siap Pakai**: Netlify
- **Zona Waktu**: `Asia/Jakarta` (WIB / UTC+7)

---

## 🛠️ Instalasi & Menjalankan Lokal

### 1. Clone repositori
```bash
git clone https://github.com/vayyyofficial/class-rolling.git
cd class-rolling
```

### 2. Pasang dependensi
```bash
npm install
```

### 3. Konfigurasi Environment Variables
Salin `.env.example` ke `.env`:
```bash
cp .env.example .env
```
Isi konfigurasi Supabase Anda:
```env
VITE_SUPABASE_URL=https://mhsxrfuyizcmdcfhmruu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_VsdBt4QmNKtPteLAhjXTlQ_YT7hov_z
VITE_APP_NAME=Class Rolling
VITE_CLASS_SIZE=26
VITE_TIMEZONE=Asia/Jakarta
```

### 4. Jalankan Server Development
```bash
npm run dev
```

---

## 🗄️ Setup Database Supabase

Jalankan skrip berikut di **Supabase SQL Editor**:
1. `supabase/schema_complete.sql` (Skema lengkap tabel, data awal 26 siswa, tata letak 3 blok, dan RPCs).
2. `supabase/migrations/20261107000000_password_auth.sql` (Sistem keamanan otentikasi sandi & audit logs).
3. `supabase/migrations/20261107000001_saved_class_groups.sql` (Tabel penyimpanan kelompok tugas mata pelajaran).

### Inisialisasi / Reset Kata Sandi Admin (Server-Side Provisioning)
Jalankan query ini di Supabase SQL Editor untuk menyetel kata sandi admin pertama kali atau memulihkannya:
```sql
SELECT public.server_provision_admin_password('KataSandiPilihanAnda2026!');
```

---

## 🌐 Panduan Deployment ke Netlify

Proyek ini telah dikonfigurasi dengan file `netlify.toml` yang berisi:
- Direktori publikasi: `dist`
- Perintah build: `npm run build`
- Aturan redirect SPA: `/* -> /index.html 200`
- Header keamanan HTTP (X-Frame-Options, X-Content-Type-Options, dll.)

Untuk menghubungkan repositori ke Netlify:
1. Hubungkan repositori GitHub `vayyyofficial/class-rolling` di Dashboard Netlify.
2. Tambahkan Environment Variable di Netlify (`Site configuration` -> `Environment variables`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_APP_NAME` (opsional: `Class Rolling`)
3. Jalankan deploy.
