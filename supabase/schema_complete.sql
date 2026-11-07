-- ====================================================================
-- CLASS ROLLING COMPLETE DATABASE SETUP (RUN IN SUPABASE SQL EDITOR)
-- Project: Class Rolling (Production Ready)
-- Class Size: 26 Students, 28 Total Seats (3 Blocks)
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

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

-- D. Seating Periods (Active Weekly Cycle)
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
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cycle_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- G. Administrator Profiles (Legacy)
CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('OWNER', 'ADMIN')),
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- H. Administrator Invitations (Legacy)
CREATE TABLE IF NOT EXISTS public.admin_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('OWNER', 'ADMIN')),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

-- I. Group Generations (Legacy Group Utility)
CREATE TABLE IF NOT EXISTS public.group_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    num_groups INT NOT NULL CHECK (num_groups >= 2 AND num_groups <= 26),
    student_count INT NOT NULL DEFAULT 26,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_public_generation BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_generation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_generation_id UUID NOT NULL REFERENCES public.group_generations(id) ON DELETE CASCADE,
    group_number INT NOT NULL CHECK (group_number >= 1),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(group_generation_id, student_id)
);

-- J. Application Settings
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- K. Password-Only Admin Security Tables
CREATE TABLE IF NOT EXISTS public.admin_security (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    password_hash TEXT NOT NULL,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    last_password_change TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- L. Saved Class Groups (Class Group Randomizer Results)
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

-- ====================================================================
-- 3. INDEXES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_students_active ON public.students(is_active);
CREATE INDEX IF NOT EXISTS idx_seats_layout ON public.seats(layout_id);
CREATE INDEX IF NOT EXISTS idx_seating_periods_status ON public.seating_periods(status);
CREATE INDEX IF NOT EXISTS idx_seating_assignments_period ON public.seating_assignments(period_id);
CREATE INDEX IF NOT EXISTS idx_reroll_history_created ON public.reroll_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_class_groups_created ON public.saved_class_groups(created_at DESC);

-- ====================================================================
-- 4. CLEAN OBSOLETE OVERLOADS
-- ====================================================================
DROP FUNCTION IF EXISTS public.execute_seating_reroll(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.is_admin();

-- ====================================================================
-- 5. INTERNAL HELPER FUNCTIONS
-- ====================================================================
CREATE OR REPLACE FUNCTION public.is_valid_admin_session(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    IF p_token IS NULL OR length(p_token) < 32 THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.admin_sessions
        WHERE session_token_hash = encode(digest(p_token, 'sha256'), 'hex')
          AND expires_at > now()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_admin_session(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_admin_session(TEXT) TO postgres, service_role;

CREATE OR REPLACE FUNCTION public.is_admin(p_token TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    IF p_token IS NOT NULL THEN
        RETURN public.is_valid_admin_session(p_token);
    END IF;
    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(TEXT) TO postgres, service_role;

-- ====================================================================
-- 6. PRIVATE CRON ROTATION FUNCTION (DATABASE SCHEDULER ONLY)
-- ====================================================================
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
BEGIN
    v_wib_now := v_now AT TIME ZONE 'Asia/Jakarta';
    v_wib_dow := EXTRACT(DOW FROM v_wib_now)::INT;

    IF v_wib_dow = 0 AND EXTRACT(HOUR FROM v_wib_now) < 6 THEN
        v_days_back := 7;
    ELSE
        v_days_back := v_wib_dow;
    END IF;

    v_cycle_start := v_wib_now::DATE - v_days_back;
    v_cycle_id := 'CYCLE-' || to_char(v_cycle_start, 'YYYY-MM-DD');

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
    ON CONFLICT (cycle_id) DO UPDATE SET
        status = 'active',
        layout_id = EXCLUDED.layout_id,
        roll_type = 'automatic'
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
        'period_id', v_period_id,
        'cycle_id', v_cycle_id,
        'student_count', v_student_count,
        'roll_type', 'automatic',
        'created_at', v_now
    );
END;
$$;

REVOKE ALL ON FUNCTION public.cron_execute_weekly_reroll() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_execute_weekly_reroll() TO postgres, service_role;

-- ====================================================================
-- 7. PUBLIC RPC: EXECUTE SEATING REROLL (REQUIRES ADMIN SESSION TOKEN)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.execute_seating_reroll(
    p_roll_type TEXT DEFAULT 'manual',
    p_description TEXT DEFAULT 'Pengacakan Tempat Duduk',
    p_admin_id UUID DEFAULT NULL,
    p_session_token TEXT DEFAULT NULL
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
    IF NOT public.is_valid_admin_session(p_session_token) THEN
        RAISE EXCEPTION 'Akses ditolak: Sesi administrator tidak valid atau telah kedaluwarsa.';
    END IF;

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

GRANT EXECUTE ON FUNCTION public.execute_seating_reroll(TEXT, TEXT, UUID, TEXT) TO anon, authenticated;

-- ====================================================================
-- 8. PUBLIC RPC: GET ACTIVE SEATING
-- ====================================================================
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
        'cycle_id', v_period.cycle_id,
        'roll_type', v_period.roll_type,
        'created_at', v_period.created_at,
        'assignments', v_assignments,
        'empty_seat_ids', v_empty_seats
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_seating() TO anon, authenticated;

-- ====================================================================
-- 9. PRIVILEGED STUDENT MANAGEMENT RPC
-- ====================================================================
CREATE OR REPLACE FUNCTION public.admin_manage_student(
    p_session_token TEXT,
    p_action TEXT,
    p_student_id UUID DEFAULT NULL,
    p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_student RECORD;
    v_next_number INT;
    v_full_name TEXT;
    v_nickname TEXT;
    v_is_active BOOLEAN;
BEGIN
    IF NOT public.is_valid_admin_session(p_session_token) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sesi admin tidak valid atau telah kedaluwarsa.');
    END IF;

    IF p_action = 'add' THEN
        v_full_name := trim(p_payload->>'fullName');
        v_nickname := trim(p_payload->>'nickname');
        v_is_active := COALESCE((p_payload->>'isActive')::BOOLEAN, true);

        IF v_full_name IS NULL OR length(v_full_name) = 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Nama lengkap wajib diisi.');
        END IF;
        IF v_nickname IS NULL OR length(v_nickname) = 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Nama panggilan wajib diisi.');
        END IF;

        SELECT COALESCE(MAX(number), 0) + 1 INTO v_next_number FROM public.students;

        INSERT INTO public.students (number, full_name, nickname, is_active)
        VALUES (v_next_number, v_full_name, v_nickname, v_is_active)
        RETURNING * INTO v_new_student;

        INSERT INTO public.admin_audit_logs (action, details)
        VALUES ('ADD_STUDENT', jsonb_build_object('student_id', v_new_student.id, 'name', v_full_name));

        RETURN jsonb_build_object(
            'success', true,
            'student', jsonb_build_object(
                'id', v_new_student.id,
                'number', v_new_student.number,
                'fullName', v_new_student.full_name,
                'nickname', v_new_student.nickname,
                'isActive', v_new_student.is_active,
                'createdAt', v_new_student.created_at
            )
        );

    ELSIF p_action = 'update' THEN
        IF p_student_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'ID siswa wajib disertakan.');
        END IF;

        UPDATE public.students
        SET full_name = COALESCE(trim(p_payload->>'fullName'), full_name),
            nickname = COALESCE(trim(p_payload->>'nickname'), nickname),
            is_active = COALESCE((p_payload->>'isActive')::BOOLEAN, is_active),
            updated_at = now()
        WHERE id = p_student_id
        RETURNING * INTO v_new_student;

        INSERT INTO public.admin_audit_logs (action, details)
        VALUES ('UPDATE_STUDENT', jsonb_build_object('student_id', p_student_id));

        RETURN jsonb_build_object(
            'success', true,
            'student', jsonb_build_object(
                'id', v_new_student.id,
                'number', v_new_student.number,
                'fullName', v_new_student.full_name,
                'nickname', v_new_student.nickname,
                'isActive', v_new_student.is_active,
                'createdAt', v_new_student.created_at
            )
        );

    ELSIF p_action = 'toggle_active' THEN
        IF p_student_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'ID siswa wajib disertakan.');
        END IF;

        UPDATE public.students
        SET is_active = NOT is_active,
            updated_at = now()
        WHERE id = p_student_id
        RETURNING * INTO v_new_student;

        INSERT INTO public.admin_audit_logs (action, details)
        VALUES ('TOGGLE_STUDENT_ACTIVE', jsonb_build_object('student_id', p_student_id, 'is_active', v_new_student.is_active));

        RETURN jsonb_build_object('success', true, 'isActive', v_new_student.is_active);

    ELSIF p_action = 'delete' THEN
        IF p_student_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'ID siswa wajib disertakan.');
        END IF;

        UPDATE public.students
        SET is_active = false,
            updated_at = now()
        WHERE id = p_student_id;

        INSERT INTO public.admin_audit_logs (action, details)
        VALUES ('DEACTIVATE_STUDENT', jsonb_build_object('student_id', p_student_id));

        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Aksi tidak dikenali.');
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_manage_student(TEXT, TEXT, UUID, JSONB) TO anon, authenticated;

-- ====================================================================
-- 10. PRIVILEGED LAYOUT MANAGEMENT RPC
-- ====================================================================
CREATE OR REPLACE FUNCTION public.admin_save_layout(
    p_session_token TEXT,
    p_layout_id UUID,
    p_name TEXT,
    p_desk_position TEXT,
    p_desk_label TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_valid_admin_session(p_session_token) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sesi admin tidak valid atau telah kedaluwarsa.');
    END IF;

    UPDATE public.classroom_layouts
    SET name = COALESCE(p_name, name),
        teacher_desk_position = COALESCE(p_desk_position, teacher_desk_position),
        teacher_desk_label = COALESCE(p_desk_label, teacher_desk_label),
        updated_at = now()
    WHERE id = p_layout_id;

    INSERT INTO public.admin_audit_logs (action, details)
    VALUES ('UPDATE_LAYOUT', jsonb_build_object('layout_id', p_layout_id));

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_save_layout(TEXT, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ====================================================================
-- 11. PASSWORD-ONLY AUTHENTICATION RPCs
-- ====================================================================
CREATE OR REPLACE FUNCTION public.admin_verify_password(p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sec RECORD;
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_expires TIMESTAMPTZ;
    v_remaining_seconds INT;
BEGIN
    IF p_password IS NULL OR length(p_password) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Kata sandi tidak boleh kosong.');
    END IF;

    SELECT * INTO v_sec FROM public.admin_security WHERE id = 1;

    IF v_sec.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sistem otentikasi belum diinisialisasi. Hubungi pengelola kelas.');
    END IF;

    IF v_sec.locked_until IS NOT NULL AND v_sec.locked_until > now() THEN
        v_remaining_seconds := EXTRACT(EPOCH FROM (v_sec.locked_until - now()))::INT;
        RETURN jsonb_build_object(
            'success', false,
            'locked', true,
            'remaining_seconds', v_remaining_seconds,
            'error', 'Akses terkunci selama ' || CEIL(v_remaining_seconds / 60.0)::INT || ' menit lagi karena percobaan gagal berulang.'
        );
    END IF;

    IF v_sec.password_hash = crypt(p_password, v_sec.password_hash) THEN
        UPDATE public.admin_security
        SET failed_attempts = 0, locked_until = NULL, last_login_at = now(), updated_at = now()
        WHERE id = 1;

        v_raw_token := encode(gen_random_bytes(32), 'hex');
        v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');
        v_expires := now() + interval '24 hours';

        DELETE FROM public.admin_sessions WHERE expires_at < now();
        INSERT INTO public.admin_sessions (session_token_hash, expires_at) VALUES (v_token_hash, v_expires);
        INSERT INTO public.admin_audit_logs (action, details) VALUES ('ADMIN_LOGIN_SUCCESS', jsonb_build_object('expires_at', v_expires));

        RETURN jsonb_build_object('success', true, 'token', v_raw_token, 'expires_at', v_expires, 'role', 'ADMIN');
    ELSE
        UPDATE public.admin_security
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
            updated_at = now()
        WHERE id = 1
        RETURNING failed_attempts INTO v_sec.failed_attempts;

        IF v_sec.failed_attempts >= 5 THEN
            INSERT INTO public.admin_audit_logs (action, details) VALUES ('ADMIN_LOGIN_LOCKED', jsonb_build_object('failed_attempts', v_sec.failed_attempts));
            RETURN jsonb_build_object('success', false, 'locked', true, 'remaining_seconds', 900, 'error', 'Akses dikunci sementara selama 15 menit karena 5 kali percobaan gagal.');
        ELSE
            INSERT INTO public.admin_audit_logs (action, details) VALUES ('ADMIN_LOGIN_FAILED', jsonb_build_object('failed_attempts', v_sec.failed_attempts));
            RETURN jsonb_build_object('success', false, 'locked', false, 'remaining_attempts', (5 - v_sec.failed_attempts), 'error', 'Kata sandi salah. Sisa kesempatan: ' || (5 - v_sec.failed_attempts));
        END IF;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_verify_session(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_hash TEXT;
    v_session RECORD;
BEGIN
    IF p_token IS NULL OR length(p_token) < 32 THEN
        RETURN jsonb_build_object('valid', false);
    END IF;

    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');
    SELECT * INTO v_session FROM public.admin_sessions WHERE session_token_hash = v_token_hash AND expires_at > now();

    IF v_session.id IS NOT NULL THEN
        UPDATE public.admin_sessions SET last_active_at = now() WHERE id = v_session.id;
        RETURN jsonb_build_object('valid', true, 'expires_at', v_session.expires_at, 'role', 'ADMIN');
    ELSE
        RETURN jsonb_build_object('valid', false);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_change_password(
    p_token TEXT,
    p_current_password TEXT,
    p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sec RECORD;
    v_new_hash TEXT;
    v_new_raw_token TEXT;
    v_new_token_hash TEXT;
    v_expires TIMESTAMPTZ;
BEGIN
    IF NOT public.is_valid_admin_session(p_token) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.');
    END IF;

    IF p_new_password IS NULL OR length(trim(p_new_password)) < 8 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Kata sandi baru minimal harus 8 karakter.');
    END IF;

    IF p_current_password = p_new_password THEN
        RETURN jsonb_build_object('success', false, 'error', 'Kata sandi baru tidak boleh sama dengan kata sandi saat ini.');
    END IF;

    SELECT * INTO v_sec FROM public.admin_security WHERE id = 1;

    IF v_sec.password_hash != crypt(p_current_password, v_sec.password_hash) THEN
        INSERT INTO public.admin_audit_logs (action, details) VALUES ('PASSWORD_CHANGE_FAILED', jsonb_build_object('reason', 'current_password_mismatch'));
        RETURN jsonb_build_object('success', false, 'error', 'Kata sandi saat ini tidak cocok.');
    END IF;

    v_new_hash := crypt(trim(p_new_password), gen_salt('bf', 12));
    UPDATE public.admin_security
    SET password_hash = v_new_hash, last_password_change = now(), failed_attempts = 0, locked_until = NULL, updated_at = now()
    WHERE id = 1;

    DELETE FROM public.admin_sessions;

    v_new_raw_token := encode(gen_random_bytes(32), 'hex');
    v_new_token_hash := encode(digest(v_new_raw_token, 'sha256'), 'hex');
    v_expires := now() + interval '24 hours';

    INSERT INTO public.admin_sessions (session_token_hash, expires_at) VALUES (v_new_token_hash, v_expires);
    INSERT INTO public.admin_audit_logs (action, details) VALUES ('ADMIN_PASSWORD_CHANGED', jsonb_build_object('timestamp', now()));

    RETURN jsonb_build_object('success', true, 'token', v_new_raw_token, 'expires_at', v_expires, 'message', 'Kata sandi administrator berhasil diubah secara aman.');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_logout(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_token IS NOT NULL THEN
        DELETE FROM public.admin_sessions WHERE session_token_hash = encode(digest(p_token, 'sha256'), 'hex');
    END IF;
    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.server_provision_admin_password(p_new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hash TEXT;
BEGIN
    IF p_new_password IS NULL OR length(trim(p_new_password)) < 8 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Kata sandi baru minimal 8 karakter.');
    END IF;

    v_hash := crypt(trim(p_new_password), gen_salt('bf', 12));

    INSERT INTO public.admin_security (id, password_hash, failed_attempts, locked_until, last_password_change, updated_at)
    VALUES (1, v_hash, 0, NULL, now(), now())
    ON CONFLICT (id) DO UPDATE SET
        password_hash = v_hash,
        failed_attempts = 0,
        locked_until = NULL,
        last_password_change = now(),
        updated_at = now();

    DELETE FROM public.admin_sessions;
    INSERT INTO public.admin_audit_logs (action, details) VALUES ('SERVER_PROVISION_PASSWORD', jsonb_build_object('timestamp', now()));
    RETURN jsonb_build_object('success', true, 'message', 'Kata sandi admin berhasil disetel melalui server-side provisioning.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_verify_password(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_password(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_logout(TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.server_provision_admin_password(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.server_provision_admin_password(TEXT) TO postgres, service_role;

-- ====================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "Public can read active students" ON public.students;
DROP POLICY IF EXISTS "Public can read students" ON public.students;
DROP POLICY IF EXISTS "Admins can insert students" ON public.students;
DROP POLICY IF EXISTS "Admins can update students" ON public.students;
DROP POLICY IF EXISTS "Admins can delete students" ON public.students;
DROP POLICY IF EXISTS "Block direct student writes" ON public.students;

DROP POLICY IF EXISTS "Public can read layouts" ON public.classroom_layouts;
DROP POLICY IF EXISTS "Admins can manage layouts" ON public.classroom_layouts;
DROP POLICY IF EXISTS "Block direct layout writes" ON public.classroom_layouts;

DROP POLICY IF EXISTS "Public can read seats" ON public.seats;
DROP POLICY IF EXISTS "Admins can manage seats" ON public.seats;
DROP POLICY IF EXISTS "Block direct seat writes" ON public.seats;

DROP POLICY IF EXISTS "Public can read seating periods" ON public.seating_periods;
DROP POLICY IF EXISTS "Admins can manage seating periods" ON public.seating_periods;
DROP POLICY IF EXISTS "Block direct period writes" ON public.seating_periods;

DROP POLICY IF EXISTS "Public can read seating assignments" ON public.seating_assignments;
DROP POLICY IF EXISTS "Admins can manage seating assignments" ON public.seating_assignments;
DROP POLICY IF EXISTS "Block direct assignment writes" ON public.seating_assignments;

DROP POLICY IF EXISTS "Public can read reroll history" ON public.reroll_history;
DROP POLICY IF EXISTS "Admins can insert reroll history" ON public.reroll_history;
DROP POLICY IF EXISTS "Block direct history writes" ON public.reroll_history;

DROP POLICY IF EXISTS "Public can read app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;

DROP POLICY IF EXISTS "Admins can view admin profiles" ON public.admin_profiles;
DROP POLICY IF EXISTS "Owners can manage admin profiles" ON public.admin_profiles;
DROP POLICY IF EXISTS "No direct access to admin_profiles" ON public.admin_profiles;

DROP POLICY IF EXISTS "No direct access to admin_invitations" ON public.admin_invitations;
DROP POLICY IF EXISTS "No direct access to admin_security" ON public.admin_security;
DROP POLICY IF EXISTS "No direct access to admin_sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "No direct access to admin_audit_logs" ON public.admin_audit_logs;

DROP POLICY IF EXISTS "Public can read group generations" ON public.group_generations;
DROP POLICY IF EXISTS "Public can read group members" ON public.group_generation_members;
DROP POLICY IF EXISTS "Admins can delete group generations" ON public.group_generations;

DROP POLICY IF EXISTS "Public can view saved class groups" ON public.saved_class_groups;
DROP POLICY IF EXISTS "Public can insert saved class groups" ON public.saved_class_groups;
DROP POLICY IF EXISTS "Public can delete saved class groups" ON public.saved_class_groups;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reroll_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_generation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_class_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Public can read layouts" ON public.classroom_layouts FOR SELECT USING (true);
CREATE POLICY "Public can read seats" ON public.seats FOR SELECT USING (true);
CREATE POLICY "Public can read seating periods" ON public.seating_periods FOR SELECT USING (true);
CREATE POLICY "Public can read seating assignments" ON public.seating_assignments FOR SELECT USING (true);
CREATE POLICY "Public can read reroll history" ON public.reroll_history FOR SELECT USING (true);
CREATE POLICY "Public can read app settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Public can read group generations" ON public.group_generations FOR SELECT USING (true);
CREATE POLICY "Public can read group members" ON public.group_generation_members FOR SELECT USING (true);

CREATE POLICY "Public can view saved class groups" ON public.saved_class_groups FOR SELECT USING (true);
CREATE POLICY "Public can insert saved class groups" ON public.saved_class_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can delete saved class groups" ON public.saved_class_groups FOR DELETE USING (true);

-- ====================================================================
-- 13. TABLE PRIVILEGE HARDENING
-- ====================================================================
REVOKE INSERT, UPDATE, DELETE ON public.students FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.classroom_layouts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.seats FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.seating_periods FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.seating_assignments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.reroll_history FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.app_settings FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.group_generations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.group_generation_members FROM anon, authenticated;

GRANT SELECT ON public.students TO anon, authenticated;
GRANT SELECT ON public.classroom_layouts TO anon, authenticated;
GRANT SELECT ON public.seats TO anon, authenticated;
GRANT SELECT ON public.seating_periods TO anon, authenticated;
GRANT SELECT ON public.seating_assignments TO anon, authenticated;
GRANT SELECT ON public.reroll_history TO anon, authenticated;
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT SELECT ON public.group_generations TO anon, authenticated;
GRANT SELECT ON public.group_generation_members TO anon, authenticated;

GRANT SELECT, INSERT, DELETE ON public.saved_class_groups TO anon, authenticated;

REVOKE ALL ON public.admin_security FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.admin_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.admin_audit_logs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.admin_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.admin_invitations FROM PUBLIC, anon, authenticated;

-- ====================================================================
-- 14. REALTIME PUBLICATION
-- ====================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.seating_periods;
EXCEPTION WHEN OTHERS THEN END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_class_groups;
EXCEPTION WHEN OTHERS THEN END $$;

-- ====================================================================
-- 15. SEED DATA (IF NOT ALREADY SEEDED)
-- ====================================================================
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

-- Trigger initial seating layout via trusted engine if no active period exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.seating_periods WHERE status = 'active') THEN
        PERFORM public.cron_execute_weekly_reroll();
    END IF;
END $$;

-- ====================================================================
-- 16. CRON SCHEDULER REGISTRATION
-- ====================================================================
DO $$
BEGIN
    PERFORM cron.unschedule('classrolling-weekly-reroll');
EXCEPTION WHEN OTHERS THEN END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('seatflow-weekly-reroll');
EXCEPTION WHEN OTHERS THEN END $$;

SELECT cron.schedule(
    'classrolling-weekly-reroll',
    '0 23 * * 6', -- 23:00 UTC Saturday = 06:00 WIB Sunday
    $$SELECT public.cron_execute_weekly_reroll();$$
);
