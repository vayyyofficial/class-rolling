# SeatFlow — Class Seating Management & Group Randomizer

A modern, streamlined classroom utility designed specifically for a class of **26 students**. Built with React, Tailwind CSS, Vite, Supabase, and Vercel.

---

## 🌟 Main Features

1. **Denah Tempat Duduk Kelas (Visual Seating Chart)**
   - 3 separate seating blocks: Left (10 seats), Middle (10 seats), Right (8 seats) = 28 total positions.
   - Exactly 26 active students seated, leaving 2 designated empty seats at the back of the right block.
   - Clear distinction between occupied, empty, and disabled seats.
   - Interactive seat cards with student nicknames, full names, and search highlight.

2. **Group Randomizer (Pembagi Kelompok Acak)**
   - Distributes all 26 students into balanced groups (2 to 26 groups).
   - Balanced group breakdown (e.g. 4 groups = 7, 7, 6, 6 students).
   - Fast & exciting randomization animation with confetti celebration.
   - One-click **Salin Hasil (WhatsApp)** formatted cleanly for instant sharing.
   - Permanent group history saved in the database.

3. **Rotasi Otomatis Mingguan (Sunday 06:00 WIB)**
   - Automatically randomizes seating every **Sunday at 06:00 WIB** (Saturday 23:00 UTC).
   - Uses unbiased Fisher-Yates shuffle algorithm.
   - Idempotent cycle ID (`CYCLE-YYYY-MM-DD`) prevents duplicate rolls.
   - Stable seating throughout the week (no reshuffling on page refresh).

4. **Acak Ulang Manual (Admin Reroll)**
   - Allows administrators to manually trigger a seat reroll when requested by teachers or classroom needs.
   - **Important Rule**: Manual rerolls never cancel or postpone the next scheduled Sunday 06:00 WIB roll.
   - Smooth card shuffling animation and instant database persistence.

5. **Multi-Role Administrator System (OWNER & ADMIN)**
   - Powered by Supabase Auth with Row Level Security (RLS).
   - Initial OWNER: `fairuzziachmad@gmail.com`.
   - Subtle, discreet gear icon entry point in the header/footer (no loud "LOGIN ADMIN" banners).

---

## 🚀 Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Canvas Confetti
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security, Realtime, Auth, RPCs)
- **Deployment**: Vercel (Edge Hosting & Serverless Cron)
- **Timezone**: `Asia/Jakarta` (WIB / UTC+7)

---

## 🛠️ Getting Started Locally

### 1. Clone the repository
```bash
git clone https://github.com/vayyyofficial/class-rolling.git
cd class-rolling
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase project URL and publishable key:
```env
VITE_SUPABASE_URL=https://mhsxrfuyizcmdcfhmruu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_VsdBt4QmNKtPteLAhjXTlQ_YT7hov_z
```

### 4. Run development server
```bash
npm run dev
```

---

## 🗄️ Supabase Database Setup

To provision all tables, Row Level Security policies, RPC functions, and the 26 student seed data:

1. Open your [Supabase Dashboard](https://supabase.com/dashboard/project/mhsxrfuyizcmdcfhmruu).
2. Go to the **SQL Editor**.
3. Copy the contents of `supabase/schema_complete.sql` and run it.
4. The database is now fully provisioned with:
   - `students` (seeded with all 26 classmates)
   - `classroom_layouts` & `seats` (28 positions across 3 blocks)
   - `seating_periods` & `seating_assignments`
   - `reroll_history` & `audit_logs`
   - `group_generations` & `group_generation_members`
   - `admin_profiles` & Initial OWNER auto-trigger (`fairuzziachmad@gmail.com`)

---

## ⏱️ Automatic Weekly Cron Schedule

- **Schedule**: Every Sunday at 06:00 WIB
- **UTC Schedule**: `0 23 * * 6` (Saturday 23:00 UTC)
- Handled via:
  1. **PostgreSQL `pg_cron`**: Scheduled job calling `execute_seating_reroll('automatic', ...)`
  2. **Vercel Serverless Cron**: Triggering `/api/cron/weekly-reroll` according to `vercel.json`

---

## 👥 Class Roster (26 Siswa)

| No | Nama Lengkap | Nama Panggilan |
|---|---|---|
| 1 | ABIMANYU PUTRA PRIANDANA | Bimbim |
| 2 | ACHMAD YANUAR FAIRUZZI | Yova |
| 3 | AHMAD YUSUF MAULANA | Yusuf Maulana |
| 4 | AISYAHRAINA ZALUF FIRDAUSY | Syahrai |
| 5 | ALANA MAHIRA HADI | Alana |
| 6 | BALAKOSHA WAHYA PIRATHA | Ako / Balakosha |
| 7 | CHRISTOPHER ADRIAN | Christo |
| 8 | DYKSA ARTHA DEVASYA | Dyksa |
| 9 | EL JALALUDDIN RUMI | El / Alul |
| 10 | FAHMI MAULANA FIRDAUS | Fahmi |
| 11 | JAVIER RADITHYA ALVRIYANTO | Javier |
| 12 | JYO GHADI SUTALAKSONO | Jyo |
| 13 | KEANU AZKA EVANO | Keanu |
| 14 | MOHAMMAD AZZAM ABYNOVIC HIDAYAT | Azzam |
| 15 | MOHAMMAD BARRA REFFAYA SUSANTO | Barra |
| 16 | MUCHAMMAD YUSUF IBRAHIM FIRDAUS | Yusuf Ibrahim |
| 17 | MUHAMMAD DIAZ AL-HAIDAR | Diaz |
| 18 | MUHAMMAD GHATHFAN RAVIANSYAH | Affan |
| 19 | MUHAMMAD SALMAN AL FARIZI | Faris |
| 20 | NADA ARRAZZAQU PUTRI PUSPITA DARMAWAN | Nada |
| 21 | RASHDAN GHIFFARY ALTAIR | Fary |
| 22 | RIZAL JIDAN AL HAFIDZ | Rizal |
| 23 | SITI AMALIYAH HASANAH | Amel |
| 24 | STEFANIA ANDREA SINGGIH | Fania |
| 25 | WILLIE SETIA BHAGASKARA | Willie |
| 26 | XAVIER VERRILL ABDILLAH HERMAWANSYAH | Xavier |

---

## 🔒 Security & Privacy

- **Row Level Security (RLS)** is enabled on all tables.
- Public visitors have read-only access to active seating and group results.
- Sensitive administrative operations require authenticated `OWNER` or `ADMIN` roles.
- No service role keys or secret credentials are ever committed to the repository or bundled into the client build.
