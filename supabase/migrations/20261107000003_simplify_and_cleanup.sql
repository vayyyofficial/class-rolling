-- ====================================================================
-- CLASS ROLLING: DATABASE SECURITY HARDENING & SIMPLIFIED CLEANUP
-- Migration: 20261107000003_simplify_and_cleanup.sql
--
-- SECURITY ARCHITECTURE:
--   1. Public Read-Only Access: Anonymous visitors only receive SELECT access
--      to students, layouts, seats, seating_periods, seating_assignments,
--      reroll_history, and saved_class_groups.
--   2. Administrative Table Lockdown: Anonymous visitors CANNOT insert, update,
--      or delete records in students, classroom_layouts, seats, seating_periods,
--      seating_assignments, or reroll_history.
--   3. Group Randomizer Integrity: Public visitors can view (SELECT) and save
--      (INSERT) group results, but CANNOT update or delete existing saved groups.
--   4. Seating Reroll Protection: execute_seating_reroll() is strictly restricted
--      to postgres and service_role. It is NOT granted to anon.
--   5. Server-Side Admin RPCs: Admin actions (reroll, manage student, save layout,
--      delete saved group) require the fixed password 'kajenter35_2026' checked
--      server-side before executing mutations.
--   6. Rotation Schedule Protection: Manual rerolls use timestamped cycle IDs and
--      roll_type = 'manual', ensuring they NEVER interfere with or block the
--      scheduled Sunday 06:00 WIB automatic rotation.
--   7. Safe Dependency Removal: Drops obsolete authentication objects without
--      blind CASCADE, preserving all active tables, indexes, and pg_cron jobs.
-- ====================================================================

-- ====================================================================
-- 1. SAFE CLEANUP OF OBSOLETE AUTHENTICATION OBJECTS (NO CASCADE)
-- ====================================================================

-- Drop legacy write/auth policies on sensitive tables first to prevent dependency errors
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'admin_security', 'admin_sessions', 'admin_audit_logs',
              'admin_profiles', 'admin_invitations', 'audit_logs',
              'students', 'classroom_layouts', 'seats',
              'seating_periods', 'seating_assignments', 'reroll_history',
              'saved_class_groups'
          )
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Drop obsolete auth functions
DROP FUNCTION IF EXISTS public.admin_verify_password(TEXT);
DROP FUNCTION IF EXISTS public.admin_verify_session(TEXT);
DROP FUNCTION IF EXISTS public.admin_change_password(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_logout(TEXT);
DROP FUNCTION IF EXISTS public.server_provision_admin_password(TEXT);
DROP FUNCTION IF EXISTS public.is_valid_admin_session(TEXT);
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_admin(TEXT);
DROP FUNCTION IF EXISTS public.is_owner();

-- Drop previous function signatures
DROP FUNCTION IF EXISTS public.admin_manage_student(TEXT, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS public.admin_save_layout(TEXT, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.execute_seating_reroll(TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.execute_seating_reroll(TEXT, TEXT, UUID);

-- Drop obsolete tables safely (without CASCADE)
DROP TABLE IF EXISTS public.admin_security;
DROP TABLE IF EXISTS public.admin_sessions;
DROP TABLE IF EXISTS public.admin_audit_logs;
DROP TABLE IF EXISTS public.admin_invitations;
DROP TABLE IF EXISTS public.admin_profiles;
DROP TABLE IF EXISTS public.audit_logs;
DROP TABLE IF EXISTS public.group_generation_members;
DROP TABLE IF EXISTS public.group_generations;
DROP TABLE IF EXISTS public.app_settings;

-- ====================================================================
-- 2. CORE SEATING ENGINE (INTERNAL ONLY - NOT GRANTED TO ANON)
-- ====================================================================

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

    -- Sunday before 06:00 WIB belongs to previous cycle
    IF v_wib_dow = 0 AND EXTRACT(HOUR FROM v_wib_now) < 6 THEN
        v_days_back := 7;
    ELSE
        v_days_back := v_wib_dow;
    END IF;

    v_cycle_start := v_wib_now::DATE - v_days_back;
    v_cycle_id := 'CYCLE-' || to_char(v_cycle_start, 'YYYY-MM-DD');

    -- Manual rerolls use timestamped cycle IDs so they NEVER collide with weekly cycle ID
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

-- STRICT LOCKDOWN: execute_seating_reroll is NOT granted to anon or authenticated
REVOKE ALL ON FUNCTION public.execute_seating_reroll(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_seating_reroll(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.execute_seating_reroll(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.execute_seating_reroll(TEXT, TEXT) TO postgres, service_role;

-- ====================================================================
-- 3. SCHEDULED WEEKLY ROTATION (SUNDAY 06:00 WIB / SATURDAY 23:00 UTC)
--    Guaranteed: Manual rerolls NEVER block or interfere with this rotation.
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
    v_existing_period_id UUID;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('cron_execute_weekly_reroll'));

    v_wib_now := v_now AT TIME ZONE 'Asia/Jakarta';
    v_wib_dow := EXTRACT(DOW FROM v_wib_now)::INT; -- 0 = Sunday

    IF v_wib_dow = 0 AND EXTRACT(HOUR FROM v_wib_now) < 6 THEN
        v_days_back := 7;
    ELSE
        v_days_back := v_wib_dow;
    END IF;

    v_cycle_start := v_wib_now::DATE - v_days_back;
    v_cycle_id := 'CYCLE-' || to_char(v_cycle_start, 'YYYY-MM-DD');

    -- ONLY checks if an AUTOMATIC rotation has already completed for this exact week.
    -- Manual rerolls have roll_type = 'manual' and will NEVER skip this weekly cron.
    SELECT id INTO v_existing_period_id
    FROM public.seating_periods
    WHERE cycle_id = v_cycle_id
      AND roll_type = 'automatic';

    IF v_existing_period_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'skipped', true,
            'reason', 'Rotasi otomatis mingguan untuk siklus ini sudah pernah dijalankan.',
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

REVOKE ALL ON FUNCTION public.cron_execute_weekly_reroll() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_execute_weekly_reroll() TO postgres, service_role;

-- ====================================================================
-- 4. PUBLIC READ-ONLY RPC: GET ACTIVE SEATING
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

GRANT EXECUTE ON FUNCTION public.get_active_seating() TO anon, authenticated, service_role;

-- ====================================================================
-- 5. SECURE SERVER-SIDE ADMIN RPCs (GUARDED BY FIXED PASSWORD)
--    Anonymous visitors cannot execute these without 'kajenter35_2026'.
-- ====================================================================

-- 5a. Manual Seating Reroll
CREATE OR REPLACE FUNCTION public.admin_execute_reroll(
    p_admin_password TEXT,
    p_roll_type TEXT DEFAULT 'manual',
    p_description TEXT DEFAULT 'Pengacakan Tempat Duduk'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_admin_password IS NULL OR p_admin_password != 'kajenter35_2026' THEN
        RAISE EXCEPTION 'Akses ditolak: Kata sandi administrator salah.';
    END IF;

    RETURN public.execute_seating_reroll(p_roll_type, p_description);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_execute_reroll(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 5b. Student Management
CREATE OR REPLACE FUNCTION public.admin_manage_student(
    p_admin_password TEXT,
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
    IF p_admin_password IS NULL OR p_admin_password != 'kajenter35_2026' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Akses ditolak: Kata sandi administrator salah.');
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
        SET full_name = COALESCE(NULLIF(trim(p_payload->>'fullName'), ''), full_name),
            nickname = COALESCE(NULLIF(trim(p_payload->>'nickname'), ''), nickname),
            is_active = COALESCE((p_payload->>'isActive')::BOOLEAN, is_active),
            updated_at = now()
        WHERE id = p_student_id
        RETURNING * INTO v_new_student;

        IF NOT FOUND OR v_new_student.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Data siswa tidak ditemukan.');
        END IF;

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

        IF NOT FOUND OR v_new_student.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Data siswa tidak ditemukan.');
        END IF;

        RETURN jsonb_build_object('success', true, 'isActive', v_new_student.is_active);

    ELSIF p_action = 'delete' THEN
        IF p_student_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'ID siswa wajib disertakan.');
        END IF;

        DELETE FROM public.students WHERE id = p_student_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Data siswa tidak ditemukan.');
        END IF;

        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Aksi tidak dikenali.');
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_manage_student(TEXT, TEXT, UUID, JSONB) TO anon, authenticated, service_role;

-- 5c. Layout Management
CREATE OR REPLACE FUNCTION public.admin_save_layout(
    p_admin_password TEXT,
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
    IF p_admin_password IS NULL OR p_admin_password != 'kajenter35_2026' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Akses ditolak: Kata sandi administrator salah.');
    END IF;

    IF p_layout_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'ID tata letak wajib disertakan.');
    END IF;

    UPDATE public.classroom_layouts
    SET name = COALESCE(NULLIF(trim(p_name), ''), name),
        teacher_desk_position = COALESCE(p_desk_position, teacher_desk_position),
        teacher_desk_label = COALESCE(NULLIF(trim(p_desk_label), ''), teacher_desk_label),
        updated_at = now()
    WHERE id = p_layout_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Data tata letak kelas tidak ditemukan.');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_save_layout(TEXT, UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 5d. Delete Saved Group (Authorized Admin Only)
CREATE OR REPLACE FUNCTION public.admin_delete_saved_group(
    p_admin_password TEXT,
    p_group_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_admin_password IS NULL OR p_admin_password != 'kajenter35_2026' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Akses ditolak: Kata sandi administrator salah.');
    END IF;

    DELETE FROM public.saved_class_groups WHERE id = p_group_id;
    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_saved_group(TEXT, UUID) TO anon, authenticated, service_role;

-- ====================================================================
-- 6. STRICT ROW LEVEL SECURITY & GRANULAR TABLE PRIVILEGES
--    NO 'FOR ALL USING (true)' on administrative tables.
--    Public visitors only have SELECT access.
-- ====================================================================

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reroll_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_class_groups ENABLE ROW LEVEL SECURITY;

-- 6a. Administrative tables: Public SELECT only. No public write policies!
CREATE POLICY "Public students read access" ON public.students FOR SELECT USING (true);
CREATE POLICY "Public layouts read access" ON public.classroom_layouts FOR SELECT USING (true);
CREATE POLICY "Public seats read access" ON public.seats FOR SELECT USING (true);
CREATE POLICY "Public seating_periods read access" ON public.seating_periods FOR SELECT USING (true);
CREATE POLICY "Public seating_assignments read access" ON public.seating_assignments FOR SELECT USING (true);
CREATE POLICY "Public reroll_history read access" ON public.reroll_history FOR SELECT USING (true);

-- 6b. saved_class_groups: Public SELECT & INSERT. UPDATE and DELETE are blocked from anon.
CREATE POLICY "Public saved_class_groups select" ON public.saved_class_groups FOR SELECT USING (true);
CREATE POLICY "Public saved_class_groups insert" ON public.saved_class_groups FOR INSERT WITH CHECK (true);

-- 6c. Table Privileges (Grant / Revoke)
-- Students: read-only for anon/authenticated
REVOKE ALL ON public.students FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.students TO anon, authenticated;
GRANT ALL ON public.students TO postgres, service_role;

-- Classroom Layouts: read-only for anon/authenticated
REVOKE ALL ON public.classroom_layouts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.classroom_layouts TO anon, authenticated;
GRANT ALL ON public.classroom_layouts TO postgres, service_role;

-- Seats: read-only for anon/authenticated
REVOKE ALL ON public.seats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.seats TO anon, authenticated;
GRANT ALL ON public.seats TO postgres, service_role;

-- Seating Periods: read-only for anon/authenticated
REVOKE ALL ON public.seating_periods FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.seating_periods TO anon, authenticated;
GRANT ALL ON public.seating_periods TO postgres, service_role;

-- Seating Assignments: read-only for anon/authenticated
REVOKE ALL ON public.seating_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.seating_assignments TO anon, authenticated;
GRANT ALL ON public.seating_assignments TO postgres, service_role;

-- Reroll History: read-only for anon/authenticated
REVOKE ALL ON public.reroll_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.reroll_history TO anon, authenticated;
GRANT ALL ON public.reroll_history TO postgres, service_role;

-- Saved Class Groups: SELECT and INSERT only for anon/authenticated. UPDATE and DELETE revoked!
REVOKE ALL ON public.saved_class_groups FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.saved_class_groups TO anon, authenticated;
GRANT ALL ON public.saved_class_groups TO postgres, service_role;
REVOKE UPDATE, DELETE ON public.saved_class_groups FROM PUBLIC, anon, authenticated;
