-- ====================================================================
-- SEATFLOW DATABASE SCHEMA & INITIAL MIGRATION
-- Project: SeatFlow (Class Seating Management & Group Randomizer)
-- Class Size: 26 Students, 28 Total Seats (3 Blocks)
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 2. CORE TABLES
-- ====================================================================

-- A. Students Table (Exact 26 Students)
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number INT NOT NULL UNIQUE CHECK (number > 0),
    full_name TEXT NOT NULL,
    nickname TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B. Classroom Layouts
CREATE TABLE IF NOT EXISTS public.classroom_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Denah Standar (3 Blok)',
    teacher_desk_position TEXT NOT NULL DEFAULT 'center' CHECK (teacher_desk_position IN ('left', 'center', 'right')),
    teacher_desk_label TEXT NOT NULL DEFAULT 'Meja Guru',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C. Seats Table (28 Seats: Left 10, Middle 10, Right 8)
CREATE TABLE IF NOT EXISTS public.seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_id UUID NOT NULL REFERENCES public.classroom_layouts(id) ON DELETE CASCADE,
    block_id TEXT NOT NULL, -- 'block-left', 'block-middle', 'block-right'
    block_name TEXT NOT NULL,
    seat_code TEXT NOT NULL, -- '01', '02', ..., '28'
    row_index INT NOT NULL,
    col_index INT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    default_empty BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(layout_id, seat_code)
);

-- D. Seating Periods (Active Weekly Cycle)
CREATE TABLE IF NOT EXISTS public.seating_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id TEXT NOT NULL UNIQUE, -- e.g. 'CYCLE-2026-11-08'
    layout_id UUID NOT NULL REFERENCES public.classroom_layouts(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    roll_type TEXT NOT NULL DEFAULT 'automatic' CHECK (roll_type IN ('automatic', 'manual', 'initial')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- E. Seating Assignments (Mapping Seat -> Student)
CREATE TABLE IF NOT EXISTS public.seating_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES public.seating_periods(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(period_id, seat_id),
    UNIQUE(period_id, student_id)
);

-- F. Reroll History
CREATE TABLE IF NOT EXISTS public.reroll_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID REFERENCES public.seating_periods(id) ON DELETE SET NULL,
    roll_type TEXT NOT NULL CHECK (roll_type IN ('automatic', 'manual', 'initial')),
    description TEXT NOT NULL,
    active_student_count INT NOT NULL DEFAULT 26,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cycle_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- G. Administrator Profiles (Role-Based Access: OWNER, ADMIN)
CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('OWNER', 'ADMIN')),
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- H. Administrator Invitations
CREATE TABLE IF NOT EXISTS public.admin_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('OWNER', 'ADMIN')),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

-- I. Group Generations (Group Randomizer)
CREATE TABLE IF NOT EXISTS public.group_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    num_groups INT NOT NULL CHECK (num_groups >= 2 AND num_groups <= 26),
    student_count INT NOT NULL DEFAULT 26,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_public_generation BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- J. Group Generation Members
CREATE TABLE IF NOT EXISTS public.group_generation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_generation_id UUID NOT NULL REFERENCES public.group_generations(id) ON DELETE CASCADE,
    group_number INT NOT NULL CHECK (group_number >= 1),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(group_generation_id, student_id)
);

-- K. Application Settings
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- L. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- 3. INDEXES FOR HIGH QUERY PERFORMANCE
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_students_active ON public.students(is_active);
CREATE INDEX IF NOT EXISTS idx_seats_layout ON public.seats(layout_id);
CREATE INDEX IF NOT EXISTS idx_seating_periods_status ON public.seating_periods(status);
CREATE INDEX IF NOT EXISTS idx_seating_assignments_period ON public.seating_assignments(period_id);
CREATE INDEX IF NOT EXISTS idx_group_gen_members_gen ON public.group_generation_members(group_generation_id);
CREATE INDEX IF NOT EXISTS idx_reroll_history_created ON public.reroll_history(created_at DESC);

-- ====================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reroll_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_generation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper security functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_profiles
        WHERE id = auth.uid() AND role IN ('OWNER', 'ADMIN')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_profiles
        WHERE id = auth.uid() AND role = 'OWNER'
    );
$$;

-- RLS: Public Read Access
CREATE POLICY "Public can read active students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Public can read layouts" ON public.classroom_layouts FOR SELECT USING (true);
CREATE POLICY "Public can read seats" ON public.seats FOR SELECT USING (true);
CREATE POLICY "Public can read seating periods" ON public.seating_periods FOR SELECT USING (true);
CREATE POLICY "Public can read seating assignments" ON public.seating_assignments FOR SELECT USING (true);
CREATE POLICY "Public can read reroll history" ON public.reroll_history FOR SELECT USING (true);
CREATE POLICY "Public can read group generations" ON public.group_generations FOR SELECT USING (true);
CREATE POLICY "Public can read group members" ON public.group_generation_members FOR SELECT USING (true);
CREATE POLICY "Public can read app settings" ON public.app_settings FOR SELECT USING (true);

-- RLS: Admins have full write privileges
CREATE POLICY "Admins can insert students" ON public.students FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update students" ON public.students FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete students" ON public.students FOR DELETE USING (public.is_admin());

CREATE POLICY "Admins can manage layouts" ON public.classroom_layouts FOR ALL USING (public.is_admin());
CREATE POLICY "Admins can manage seats" ON public.seats FOR ALL USING (public.is_admin());
CREATE POLICY "Admins can manage seating periods" ON public.seating_periods FOR ALL USING (public.is_admin());
CREATE POLICY "Admins can manage seating assignments" ON public.seating_assignments FOR ALL USING (public.is_admin());
CREATE POLICY "Admins can insert reroll history" ON public.reroll_history FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL USING (public.is_admin());

-- RLS: Admin profiles
CREATE POLICY "Admins can view admin profiles" ON public.admin_profiles FOR SELECT USING (public.is_admin() OR id = auth.uid());
CREATE POLICY "Owners can manage admin profiles" ON public.admin_profiles FOR ALL USING (public.is_owner());

-- RLS: Group generations (Public can generate groups through safe RPC)
CREATE POLICY "Admins can delete group generations" ON public.group_generations FOR DELETE USING (public.is_admin());

-- ====================================================================
-- 5. INITIAL OWNER AUTO-PROVISIONING TRIGGER
-- Initial OWNER Email: fairuzziachmad@gmail.com
-- Automatically assigns OWNER role upon registration
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF LOWER(NEW.email) = 'fairuzziachmad@gmail.com' THEN
        INSERT INTO public.admin_profiles (id, email, role, full_name)
        VALUES (NEW.id, NEW.email, 'OWNER', 'Achmad Yanuar Fairuzzi (Owner)')
        ON CONFLICT (id) DO UPDATE SET role = 'OWNER';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_signup();

-- ====================================================================
-- 6. RPC: ATOMIC SEATING RANDOMIZER (Fisher-Yates via SQL)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.execute_seating_reroll(
    p_roll_type TEXT DEFAULT 'manual',
    p_description TEXT DEFAULT 'Pengacakan Tempat Duduk',
    p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_layout_id UUID;
    v_cycle_id TEXT;
    v_period_id UUID;
    v_active_students RECORD;
    v_available_seats RECORD;
    v_student_count INT;
    v_seat_count INT;
    v_now TIMESTAMPTZ := now();
    v_wib_date DATE;
    v_wib_dow INT;
    v_days_back INT;
    v_cycle_start DATE;
BEGIN
    -- 1. Ensure caller is authorized (if manual roll)
    IF p_roll_type = 'manual' AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya administrator yang dapat melakukan acak ulang manual.';
    END IF;

    -- 2. Calculate WIB weekly cycle ID
    -- Asia/Jakarta is UTC+7
    v_wib_date := (v_now AT TIME ZONE 'Asia/Jakarta')::DATE;
    v_wib_dow := EXTRACT(DOW FROM (v_now AT TIME ZONE 'Asia/Jakarta'))::INT; -- 0 = Sunday
    
    -- If Sunday before 06:00 WIB, belongs to previous Sunday
    IF v_wib_dow = 0 AND EXTRACT(HOUR FROM (v_now AT TIME ZONE 'Asia/Jakarta')) < 6 THEN
        v_days_back := 7;
    ELSE
        v_days_back := v_wib_dow;
    END IF;
    
    v_cycle_start := v_wib_date - v_days_back;
    v_cycle_id := 'CYCLE-' || to_char(v_cycle_start, 'YYYY-MM-DD');

    -- 3. Get active layout
    SELECT id INTO v_layout_id FROM public.classroom_layouts WHERE is_active = true LIMIT 1;
    IF v_layout_id IS NULL THEN
        RAISE EXCEPTION 'Tata letak kelas aktif tidak ditemukan.';
    END IF;

    -- 4. Count active students
    SELECT COUNT(*) INTO v_student_count FROM public.students WHERE is_active = true;
    IF v_student_count = 0 THEN
        RAISE EXCEPTION 'Tidak ada siswa aktif untuk diacak.';
    END IF;

    -- 5. Count available seats
    SELECT COUNT(*) INTO v_seat_count FROM public.seats 
    WHERE layout_id = v_layout_id AND is_available = true;
    
    IF v_seat_count < v_student_count THEN
        RAISE EXCEPTION 'Kapasitas kursi tersedia (%) kurang dari jumlah siswa aktif (%).', v_seat_count, v_student_count;
    END IF;

    -- 6. Archive previous active period
    UPDATE public.seating_periods SET status = 'archived' WHERE status = 'active';

    -- 7. Create new active seating period
    INSERT INTO public.seating_periods (cycle_id, layout_id, status, roll_type)
    VALUES (
        v_cycle_id || (CASE WHEN p_roll_type = 'manual' THEN '-M' || to_char(v_now, 'HH24MISS') ELSE '' END),
        v_layout_id,
        'active',
        p_roll_type
    )
    RETURNING id INTO v_period_id;

    -- 8. Assign students to seats using cryptographically unbiased shuffle
    -- Prioritize non-defaultEmpty seats first
    WITH shuffled_students AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY gen_random_uuid()) AS rn
        FROM public.students
        WHERE is_active = true
    ),
    prioritized_seats AS (
        SELECT id, default_empty,
               ROW_NUMBER() OVER (
                   ORDER BY (CASE WHEN default_empty THEN 1 ELSE 0 END), gen_random_uuid()
               ) AS rn
        FROM public.seats
        WHERE layout_id = v_layout_id AND is_available = true
    )
    INSERT INTO public.seating_assignments (period_id, seat_id, student_id)
    SELECT v_period_id, s.id, stu.id
    FROM shuffled_students stu
    JOIN prioritized_seats s ON stu.rn = s.rn;

    -- 9. Insert Reroll History
    INSERT INTO public.reroll_history (
        period_id, roll_type, description, active_student_count, performed_by, cycle_id
    ) VALUES (
        v_period_id,
        p_roll_type,
        p_description,
        v_student_count,
        COALESCE(p_admin_id, auth.uid()),
        v_cycle_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'period_id', v_period_id,
        'cycle_id', v_cycle_id,
        'student_count', v_student_count,
        'roll_type', p_roll_type,
        'created_at', v_now
    );
END;
$$;

-- ====================================================================
-- 7. RPC: GROUP RANDOMIZER ENGINE
-- Generates balanced groups for all 26 active students
-- ====================================================================
CREATE OR REPLACE FUNCTION public.generate_groups(
    p_num_groups INT,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_gen_id UUID;
    v_student_count INT;
    v_now TIMESTAMPTZ := now();
BEGIN
    IF p_num_groups < 2 OR p_num_groups > 26 THEN
        RAISE EXCEPTION 'Jumlah kelompok harus antara 2 dan 26 kelompok.';
    END IF;

    SELECT COUNT(*) INTO v_student_count FROM public.students WHERE is_active = true;
    IF v_student_count < p_num_groups THEN
        RAISE EXCEPTION 'Jumlah siswa aktif (%) tidak mencukupi untuk % kelompok.', v_student_count, p_num_groups;
    END IF;

    -- Create group generation record
    INSERT INTO public.group_generations (num_groups, student_count, created_by, is_public_generation)
    VALUES (p_num_groups, v_student_count, COALESCE(p_user_id, auth.uid()), true)
    RETURNING id INTO v_gen_id;

    -- Assign students evenly into groups using balanced round-robin
    WITH shuffled_students AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY gen_random_uuid()) AS rn
        FROM public.students
        WHERE is_active = true
    )
    INSERT INTO public.group_generation_members (group_generation_id, group_number, student_id)
    SELECT 
        v_gen_id,
        ((rn - 1) % p_num_groups) + 1 AS group_number,
        id AS student_id
    FROM shuffled_students;

    RETURN jsonb_build_object(
        'success', true,
        'generation_id', v_gen_id,
        'num_groups', p_num_groups,
        'student_count', v_student_count,
        'created_at', v_now
    );
END;
$$;

-- ====================================================================
-- 8. RPC: PUBLIC GET ACTIVE SEATING
-- ====================================================================
CREATE OR REPLACE FUNCTION public.get_active_seating()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_period RECORD;
    v_assignments JSONB;
    v_empty_seats JSONB;
BEGIN
    SELECT * INTO v_period FROM public.seating_periods WHERE status = 'active' ORDER BY created_at DESC LIMIT 1;
    
    IF v_period.id IS NULL THEN
        RETURN jsonb_build_object('active', false);
    END IF;

    -- Get assignments as { [seat_id]: student_id }
    SELECT COALESCE(jsonb_object_agg(sa.seat_id, sa.student_id), '{}'::jsonb)
    INTO v_assignments
    FROM public.seating_assignments sa
    WHERE sa.period_id = v_period.id;

    -- Get empty available seats
    SELECT COALESCE(jsonb_agg(s.id), '[]'::jsonb)
    INTO v_empty_seats
    FROM public.seats s
    WHERE s.layout_id = v_period.layout_id
      AND s.is_available = true
      AND s.id NOT IN (
          SELECT sa.seat_id FROM public.seating_assignments sa WHERE sa.period_id = v_period.id
      );

    RETURN jsonb_build_object(
        'active', true,
        'period_id', v_period.id,
        'cycle_id', v_period.cycle_id,
        'roll_type', v_period.roll_type,
        'created_at', v_period.created_at,
        'assignments', v_assignments,
        'empty_seat_ids', v_empty_seats
    );
END;
$$;

-- ====================================================================
-- 9. INITIAL SEED DATA
-- Exactly 26 Students & 3-Block 28-Seat Layout
-- ====================================================================

-- Insert 26 Students
INSERT INTO public.students (number, full_name, nickname, is_active)
VALUES
(1, 'ABIMANYU PUTRA PRIANDANA', 'Bimbim', true),
(2, 'ACHMAD YANUAR FAIRUZZI', 'Yova', true),
(3, 'AHMAD YUSUF MAULANA', 'Yusuf Maulana', true),
(4, 'AISYAHRAINA ZALUF FIRDAUSY', 'Syahrai', true),
(5, 'ALANA MAHIRA HADI', 'Alana', true),
(6, 'BALAKOSHA WAHYA PIRATHA', 'Ako / Balakosha', true),
(7, 'CHRISTOPHER ADRIAN', 'Christo', true),
(8, 'DYKSA ARTHA DEVASYA', 'Dyksa', true),
(9, 'EL JALALUDDIN RUMI', 'El / Alul', true),
(10, 'FAHMI MAULANA FIRDAUS', 'Fahmi', true),
(11, 'JAVIER RADITHYA ALVRIYANTO', 'Javier', true),
(12, 'JYO GHADI SUTALAKSONO', 'Jyo', true),
(13, 'KEANU AZKA EVANO', 'Keanu', true),
(14, 'MOHAMMAD AZZAM ABYNOVIC HIDAYAT', 'Azzam', true),
(15, 'MOHAMMAD BARRA REFFAYA SUSANTO', 'Barra', true),
(16, 'MUCHAMMAD YUSUF IBRAHIM FIRDAUS', 'Yusuf Ibrahim', true),
(17, 'MUHAMMAD DIAZ AL-HAIDAR', 'Diaz', true),
(18, 'MUHAMMAD GHATHFAN RAVIANSYAH', 'Affan', true),
(19, 'MUHAMMAD SALMAN AL FARIZI', 'Faris', true),
(20, 'NADA ARRAZZAQU PUTRI PUSPITA DARMAWAN', 'Nada', true),
(21, 'RASHDAN GHIFFARY ALTAIR', 'Fary', true),
(22, 'RIZAL JIDAN AL HAFIDZ', 'Rizal', true),
(23, 'SITI AMALIYAH HASANAH', 'Amel', true),
(24, 'STEFANIA ANDREA SINGGIH', 'Fania', true),
(25, 'WILLIE SETIA BHAGASKARA', 'Willie', true),
(26, 'XAVIER VERRILL ABDILLAH HERMAWANSYAH', 'Xavier', true)
ON CONFLICT (number) DO UPDATE 
SET full_name = EXCLUDED.full_name, nickname = EXCLUDED.nickname;

-- Insert Default Layout
INSERT INTO public.classroom_layouts (id, name, teacher_desk_position, teacher_desk_label, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Denah Standar (3 Blok)', 'center', 'Meja Guru', true)
ON CONFLICT (id) DO NOTHING;

-- Insert 28 Seats (Left 10, Middle 10, Right 8)
INSERT INTO public.seats (layout_id, block_id, block_name, seat_code, row_index, col_index, is_available, default_empty)
VALUES
-- Blok Kiri: 2 cols x 5 rows = 10 seats
('00000000-0000-0000-0000-000000000001', 'block-left', 'Blok Kiri', '01', 0, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-left', 'Blok Kiri', '02', 0, 1, true, false),
('00000000-0000-0000-0000-000000000001', 'block-left', 'Blok Kiri', '03', 1, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-left', 'Blok Kiri', '04', 1, 1, true, false),
('00000000-0000-0000-0000-000000000001', 'block-left', 'Blok Kiri', '05', 2, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-left', 'Blok Kiri', '06', 2, 1, true, false),
('00000000-0000-0000-0000-000000000001', 'block-left', 'Blok Kiri', '07', 3, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-left', 'Blok Kiri', '08', 3, 1, true, false),
('00000000-0000-0000-0000-000000000001', 'block-left', 'Blok Kiri', '09', 4, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-left', 'Blok Kiri', '10', 4, 1, true, false),

-- Blok Tengah: 2 cols x 5 rows = 10 seats
('00000000-0000-0000-0000-000000000001', 'block-middle', 'Blok Tengah', '11', 0, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-middle', 'Blok Tengah', '12', 0, 1, true, false),
('00000000-0000-0000-0000-000000000001', 'block-middle', 'Blok Tengah', '13', 1, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-middle', 'Blok Tengah', '14', 1, 1, true, false),
('00000000-0000-0000-0000-000000000001', 'block-middle', 'Blok Tengah', '15', 2, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-middle', 'Blok Tengah', '16', 2, 1, true, false),
('00000000-0000-0000-0000-000000000001', 'block-middle', 'Blok Tengah', '17', 3, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-middle', 'Blok Tengah', '18', 3, 1, true, false),
('00000000-0000-0000-0000-000000000001', 'block-middle', 'Blok Tengah', '19', 4, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-middle', 'Blok Tengah', '20', 4, 1, true, false),

-- Blok Kanan: 2 cols x 4 rows = 8 seats (seats 27 & 28 are defaultEmpty at the back)
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '21', 0, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '22', 0, 1, true, false),
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '23', 1, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '24', 1, 1, true, false),
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '25', 2, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '26', 2, 1, true, false),
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '27', 3, 0, true, true),
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '28', 3, 1, true, true)
ON CONFLICT (layout_id, seat_code) DO NOTHING;

-- Perform Initial Seating Reroll
SELECT public.execute_seating_reroll('initial', 'Inisialisasi Denah Awal Kelas (26 Siswa, 28 Kursi)');

-- Enable Realtime for Relevant Tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.seating_periods;
ALTER PUBLICATION supabase_realtime ADD TABLE public.seating_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_generations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_generation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
