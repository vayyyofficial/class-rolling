-- ====================================================================
-- CLASS ROLLING: COMPLETE UNIFIED PRODUCTION DATABASE SCHEMA
--
-- FEATURES SUPPORTED:
--   1. 26 Students Management (students)
--   2. Classroom Layouts & Seats (classroom_layouts, seats)
--   3. Seating Periods & Seat Assignments (seating_periods, seating_assignments)
--   4. Reroll History (reroll_history)
--   5. Group Randomizer Saved History (saved_class_groups)
--   6. Automatic Weekly Seating Rotation (pg_cron at Sunday 06:00 WIB)
--   7. Realtime Synchronization
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- 2. CORE TABLES
-- A. Students
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

-- C. Seats
CREATE TABLE IF NOT EXISTS public.seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_id UUID NOT NULL REFERENCES public.classroom_layouts(id) ON DELETE CASCADE,
    block_id TEXT NOT NULL,
    block_name TEXT NOT NULL,
    seat_code TEXT NOT NULL,
    row_index INT NOT NULL,
    col_index INT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    default_empty BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(layout_id, seat_code)
);

-- D. Seating Periods (Weekly cycle records)
CREATE TABLE IF NOT EXISTS public.seating_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id TEXT NOT NULL UNIQUE,
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
    performed_by UUID,
    cycle_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- G. Saved Class Groups (Group Randomizer utility)
CREATE TABLE IF NOT EXISTS public.saved_class_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL DEFAULT 'Tugas Kelompok',
    subject TEXT NOT NULL,
    submitted_by_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    submitted_by_name TEXT NOT NULL,
    num_groups INT NOT NULL,
    student_count INT NOT NULL DEFAULT 26,
    groups_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_students_active ON public.students(is_active);
CREATE INDEX IF NOT EXISTS idx_seats_layout ON public.seats(layout_id);
CREATE INDEX IF NOT EXISTS idx_seating_periods_status ON public.seating_periods(status);
CREATE INDEX IF NOT EXISTS idx_seating_assignments_period ON public.seating_assignments(period_id);
CREATE INDEX IF NOT EXISTS idx_reroll_history_created ON public.reroll_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_class_groups_created ON public.saved_class_groups(created_at DESC);

-- 4. DATABASE FUNCTIONS
-- A. cron_execute_weekly_reroll (Used exclusively by pg_cron Sunday 06:00 WIB)
CREATE OR REPLACE FUNCTION public.cron_execute_weekly_reroll()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_layout_id UUID;
    v_cycle_id TEXT;
    v_period_id UUID;
    v_student_count INT;
    v_seat_count INT;
    v_now TIMESTAMPTZ := now();
    v_wib_now TIMESTAMPTZ;
    v_wib_dow INT;
    v_days_back INT;
    v_cycle_start DATE;
    v_existing_period_id UUID;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('cron_execute_weekly_reroll'));

    v_wib_now := v_now AT TIME ZONE 'Asia/Jakarta';
    v_wib_dow := EXTRACT(DOW FROM v_wib_now)::INT;

    IF v_wib_dow = 0 AND EXTRACT(HOUR FROM v_wib_now) < 6 THEN
        v_days_back := 7;
    ELSE
        v_days_back := v_wib_dow;
    END IF;

    v_cycle_start := v_wib_now::DATE - v_days_back;
    v_cycle_id := 'CYCLE-' || to_char(v_cycle_start, 'YYYY-MM-DD');

    SELECT id INTO v_existing_period_id
    FROM public.seating_periods
    WHERE cycle_id = v_cycle_id;

    IF v_existing_period_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'skipped', true,
            'reason', 'Rotasi untuk siklus ini sudah ada.',
            'cycle_id', v_cycle_id,
            'existing_period_id', v_existing_period_id
        );
    END IF;

    SELECT id INTO v_layout_id FROM public.classroom_layouts WHERE is_active = true LIMIT 1;
    IF v_layout_id IS NULL THEN
        RAISE EXCEPTION 'Tata letak kelas aktif tidak ditemukan.';
    END IF;

    SELECT COUNT(*) INTO v_student_count FROM public.students WHERE is_active = true;
    IF v_student_count = 0 THEN
        RAISE EXCEPTION 'Tidak ada siswa aktif untuk diacak.';
    END IF;

    SELECT COUNT(*) INTO v_seat_count FROM public.seats
    WHERE layout_id = v_layout_id AND is_available = true;

    IF v_seat_count < v_student_count THEN
        RAISE EXCEPTION 'Kapasitas kursi tersedia (%) kurang dari jumlah siswa aktif (%).',
            v_seat_count, v_student_count;
    END IF;

    UPDATE public.seating_periods SET status = 'archived' WHERE status = 'active';

    INSERT INTO public.seating_periods (cycle_id, layout_id, status, roll_type)
    VALUES (v_cycle_id, v_layout_id, 'active', 'automatic')
    RETURNING id INTO v_period_id;

    DELETE FROM public.seating_assignments WHERE period_id = v_period_id;

    WITH shuffled_students AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY gen_random_uuid()) AS rn
        FROM public.students
        WHERE is_active = true
    ),
    prioritized_seats AS (
        SELECT id,
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

    INSERT INTO public.reroll_history (
        period_id, roll_type, description, active_student_count, performed_by, cycle_id
    ) VALUES (
        v_period_id,
        'automatic',
        'Rotasi Otomatis Mingguan (Minggu 06:00 WIB)',
        v_student_count,
        NULL,
        v_cycle_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'skipped', false,
        'period_id', v_period_id,
        'cycle_id', v_cycle_id,
        'student_count', v_student_count,
        'roll_type', 'automatic',
        'created_at', v_now
    );
END;
$$;

-- B. execute_seating_reroll (Called from Admin Dashboard for manual or simulated rerolls)
CREATE OR REPLACE FUNCTION public.execute_seating_reroll(
    p_roll_type TEXT DEFAULT 'manual',
    p_description TEXT DEFAULT 'Pengacakan Tempat Duduk'
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
    v_student_count INT;
    v_seat_count INT;
    v_now TIMESTAMPTZ := now();
    v_wib_now TIMESTAMPTZ;
    v_wib_dow INT;
    v_days_back INT;
    v_cycle_start DATE;
    v_roll_type TEXT;
BEGIN
    v_roll_type := LOWER(COALESCE(p_roll_type, 'manual'));
    IF v_roll_type NOT IN ('manual', 'automatic', 'initial') THEN
        v_roll_type := 'manual';
    END IF;

    v_wib_now := v_now AT TIME ZONE 'Asia/Jakarta';
    v_wib_dow := EXTRACT(DOW FROM v_wib_now)::INT;

    IF v_wib_dow = 0 AND EXTRACT(HOUR FROM v_wib_now) < 6 THEN
        v_days_back := 7;
    ELSE
        v_days_back := v_wib_dow;
    END IF;

    v_cycle_start := v_wib_now::DATE - v_days_back;
    v_cycle_id := 'CYCLE-' || to_char(v_cycle_start, 'YYYY-MM-DD');

    IF v_roll_type = 'manual' THEN
        v_cycle_id := v_cycle_id || '-M' || to_char(v_now, 'HH24MISS') || '-' || floor(random() * 1000)::TEXT;
    ELSIF v_roll_type = 'automatic' THEN
        v_cycle_id := v_cycle_id || '-SIM' || to_char(v_now, 'HH24MISS') || '-' || floor(random() * 1000)::TEXT;
    END IF;

    SELECT id INTO v_layout_id FROM public.classroom_layouts WHERE is_active = true LIMIT 1;
    IF v_layout_id IS NULL THEN
        RAISE EXCEPTION 'Tata letak kelas aktif tidak ditemukan.';
    END IF;

    SELECT COUNT(*) INTO v_student_count FROM public.students WHERE is_active = true;
    IF v_student_count = 0 THEN
        RAISE EXCEPTION 'Tidak ada siswa aktif untuk diacak.';
    END IF;

    SELECT COUNT(*) INTO v_seat_count FROM public.seats
    WHERE layout_id = v_layout_id AND is_available = true;

    IF v_seat_count < v_student_count THEN
        RAISE EXCEPTION 'Kapasitas kursi tersedia (%) kurang dari jumlah siswa aktif (%).',
            v_seat_count, v_student_count;
    END IF;

    UPDATE public.seating_periods SET status = 'archived' WHERE status = 'active';

    INSERT INTO public.seating_periods (cycle_id, layout_id, status, roll_type)
    VALUES (v_cycle_id, v_layout_id, 'active', v_roll_type)
    ON CONFLICT (cycle_id) DO UPDATE SET
        status = 'active',
        layout_id = EXCLUDED.layout_id,
        roll_type = EXCLUDED.roll_type
    RETURNING id INTO v_period_id;

    DELETE FROM public.seating_assignments WHERE period_id = v_period_id;

    WITH shuffled_students AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY gen_random_uuid()) AS rn
        FROM public.students
        WHERE is_active = true
    ),
    prioritized_seats AS (
        SELECT id,
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

    INSERT INTO public.reroll_history (
        period_id, roll_type, description, active_student_count, performed_by, cycle_id
    ) VALUES (
        v_period_id,
        v_roll_type,
        COALESCE(p_description, 'Pengacakan Tempat Duduk'),
        v_student_count,
        NULL,
        v_cycle_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'period_id', v_period_id,
        'cycle_id', v_cycle_id,
        'student_count', v_student_count,
        'roll_type', v_roll_type,
        'created_at', v_now
    );
END;
$$;

-- C. get_active_seating (Public read for active seating map)
CREATE OR REPLACE FUNCTION public.get_active_seating()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_period RECORD;
    v_assignments JSONB;
    v_empty_seats JSONB;
BEGIN
    SELECT id, cycle_id, roll_type, created_at, layout_id
    INTO v_period
    FROM public.seating_periods
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_period.id IS NULL THEN
        RETURN jsonb_build_object('active', false);
    END IF;

    SELECT COALESCE(jsonb_object_agg(sa.seat_id::TEXT, sa.student_id::TEXT), '{}'::jsonb)
    INTO v_assignments
    FROM public.seating_assignments sa
    WHERE sa.period_id = v_period.id;

    SELECT COALESCE(jsonb_agg(s.id::TEXT), '[]'::jsonb)
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
        'cycle_id', v_cycle_id,
        'roll_type', v_period.roll_type,
        'created_at', v_period.created_at,
        'assignments', v_assignments,
        'empty_seat_ids', v_empty_seats
    );
END;
$$;

-- 5. FUNCTION GRANTS
REVOKE ALL ON FUNCTION public.cron_execute_weekly_reroll() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_execute_weekly_reroll() TO postgres, service_role;

GRANT EXECUTE ON FUNCTION public.execute_seating_reroll(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_active_seating() TO anon, authenticated, service_role;

-- 6. ROW LEVEL SECURITY & POLICIES
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reroll_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_class_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public students access" ON public.students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public layouts access" ON public.classroom_layouts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public seats access" ON public.seats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public seating_periods access" ON public.seating_periods FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public seating_assignments access" ON public.seating_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public reroll_history access" ON public.reroll_history FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public saved_class_groups select" ON public.saved_class_groups FOR SELECT USING (true);
CREATE POLICY "Public saved_class_groups insert" ON public.saved_class_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Public saved_class_groups delete" ON public.saved_class_groups FOR DELETE USING (true);

-- 7. TABLE GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO anon, authenticated, postgres, service_role;
GRANT SELECT, UPDATE ON public.classroom_layouts TO anon, authenticated, postgres, service_role;
GRANT SELECT, UPDATE ON public.seats TO anon, authenticated, postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seating_periods TO anon, authenticated, postgres, service_role;
GRANT SELECT, INSERT, DELETE ON public.seating_assignments TO anon, authenticated, postgres, service_role;
GRANT SELECT, INSERT, DELETE ON public.reroll_history TO anon, authenticated, postgres, service_role;
GRANT SELECT, INSERT, DELETE ON public.saved_class_groups TO anon, authenticated, postgres, service_role;
REVOKE UPDATE ON public.saved_class_groups FROM PUBLIC, anon, authenticated;

-- 8. REALTIME PUBLICATION
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.seating_periods;
EXCEPTION WHEN OTHERS THEN END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_class_groups;
EXCEPTION WHEN OTHERS THEN END $$;

-- 9. SEED DATA (26 STUDENTS & STANDARD 3-BLOCK LAYOUT)
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

INSERT INTO public.classroom_layouts (id, name, teacher_desk_position, teacher_desk_label, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Denah Standar (3 Blok)', 'center', 'Meja Guru', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seats (layout_id, block_id, block_name, seat_code, row_index, col_index, is_available, default_empty)
VALUES
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
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '21', 0, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '22', 0, 1, true, false),
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '23', 1, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '24', 1, 1, true, false),
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '25', 2, 0, true, false),
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '26', 2, 1, true, false),
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '27', 3, 0, true, true),
('00000000-0000-0000-0000-000000000001', 'block-right', 'Blok Kanan', '28', 3, 1, true, true)
ON CONFLICT (layout_id, seat_code) DO NOTHING;

-- Initial seating layout if no active period exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.seating_periods WHERE status = 'active') THEN
        PERFORM public.cron_execute_weekly_reroll();
    END IF;
END $$;

-- 10. CRON SCHEDULER REGISTRATION
DO $$
DECLARE
    v_jobid BIGINT;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        BEGIN
            FOR v_jobid IN (
                SELECT jobid FROM cron.job 
                WHERE jobname IN ('classrolling-weekly-reroll', 'seatflow-weekly-reroll')
            ) LOOP
                PERFORM cron.unschedule(v_jobid);
            END LOOP;
        EXCEPTION WHEN OTHERS THEN END;

        BEGIN
            PERFORM cron.schedule(
                'classrolling-weekly-reroll',
                '0 23 * * 6', -- 23:00 UTC Saturday = 06:00 WIB Sunday
                'SELECT public.cron_execute_weekly_reroll();'
            );
        EXCEPTION WHEN OTHERS THEN END;
    END IF;
END $$;
