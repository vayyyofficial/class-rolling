-- ====================================================================
-- CLASS ROLLING: COMPLETE DATABASE SECURITY HARDENING & CRON INTEGRATION
-- Migration: 20261107000002_security_hardening.sql
--
-- This migration hardens the database for production:
--   1. Ensures required PostgreSQL extensions (pgcrypto, uuid-ossp, pg_cron).
--   2. Drops obsolete overloads and insecure functions (including 3-arg execute_seating_reroll).
--   3. Tightens helper functions (is_valid_admin_session, is_admin) without Supabase Auth bypass.
--   4. Creates private cron_execute_weekly_reroll() strictly for trusted pg_cron worker.
--   5. Creates public execute_seating_reroll() requiring valid admin session token.
--   6. Creates public get_active_seating() returning assignments shape { [seat_id]: student_id }.
--   7. Hardens privileged student and layout management RPCs.
--   8. Drops all obsolete permissive write policies to prevent OR-bypass.
--   9. Establishes clean table-level RLS and explicit GRANT/REVOKE permissions.
--  10. Protects security tables (admin_security, admin_sessions, admin_audit_logs).
--
-- SAFE FOR EXISTING DATABASE:
--   - Does NOT drop or truncate any tables.
--   - Does NOT reset or overwrite admin password.
--   - Preserves all students, layouts, seats, seating periods, and history.
-- ====================================================================

-- ====================================================================
-- 1. EXTENSIONS
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ====================================================================
-- 2. DROP OBSOLETE & CONFLICTING FUNCTION OVERLOADS
-- ====================================================================
DROP FUNCTION IF EXISTS public.execute_seating_reroll(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.is_admin();

-- ====================================================================
-- 3. INTERNAL SESSION VALIDATION HELPER
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

-- Revoke execution from web callers; internal use only
REVOKE ALL ON FUNCTION public.is_valid_admin_session(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_valid_admin_session(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.is_valid_admin_session(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_admin_session(TEXT) TO postgres, service_role;

-- Clean, single-signature is_admin helper
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

REVOKE ALL ON FUNCTION public.is_admin(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.is_admin(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(TEXT) TO postgres, service_role;

-- ====================================================================
-- 4. PRIVATE CRON ROTATION FUNCTION (TRUSTED DATABASE ENGINE ONLY)
--    Used exclusively by pg_cron every Sunday at 06:00 WIB (23:00 UTC Sat).
--    Cannot be called by anon or authenticated web roles.
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
    -- Calculate weekly cycle start date based on Asia/Jakarta (WIB)
    v_wib_now := v_now AT TIME ZONE 'Asia/Jakarta';
    v_wib_dow := EXTRACT(DOW FROM v_wib_now)::INT; -- 0 = Sunday

    -- If Sunday before 06:00 WIB, belongs to previous Sunday
    IF v_wib_dow = 0 AND EXTRACT(HOUR FROM v_wib_now) < 6 THEN
        v_days_back := 7;
    ELSE
        v_days_back := v_wib_dow;
    END IF;

    v_cycle_start := v_wib_now::DATE - v_days_back;
    v_cycle_id := 'CYCLE-' || to_char(v_cycle_start, 'YYYY-MM-DD');

    -- Get active classroom layout
    SELECT id INTO v_layout_id FROM public.classroom_layouts WHERE is_active = true LIMIT 1;
    IF v_layout_id IS NULL THEN
        RAISE EXCEPTION 'Tata letak kelas aktif tidak ditemukan.';
    END IF;

    -- Count active students
    SELECT COUNT(*) INTO v_student_count FROM public.students WHERE is_active = true;
    IF v_student_count = 0 THEN
        RAISE EXCEPTION 'Tidak ada siswa aktif untuk diacak.';
    END IF;

    -- Count available seats
    SELECT COUNT(*) INTO v_seat_count FROM public.seats
    WHERE layout_id = v_layout_id AND is_available = true;

    IF v_seat_count < v_student_count THEN
        RAISE EXCEPTION 'Kapasitas kursi tersedia (%) kurang dari jumlah siswa aktif (%).',
            v_seat_count, v_student_count;
    END IF;

    -- Archive previous active periods
    UPDATE public.seating_periods SET status = 'archived' WHERE status = 'active';

    -- Insert or reuse weekly period record (idempotent upsert)
    INSERT INTO public.seating_periods (cycle_id, layout_id, status, roll_type)
    VALUES (v_cycle_id, v_layout_id, 'active', 'automatic')
    ON CONFLICT (cycle_id) DO UPDATE SET
        status = 'active',
        layout_id = EXCLUDED.layout_id,
        roll_type = 'automatic'
    RETURNING id INTO v_period_id;

    -- Delete old assignments for this period before inserting replacements
    DELETE FROM public.seating_assignments WHERE period_id = v_period_id;

    -- Unbiased Fisher-Yates seat assignment via gen_random_uuid()
    -- Normal seats are prioritized over designated default_empty seats
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

    -- Record in reroll history
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

-- Restrict cron function strictly to database engine
REVOKE ALL ON FUNCTION public.cron_execute_weekly_reroll() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_execute_weekly_reroll() FROM anon;
REVOKE ALL ON FUNCTION public.cron_execute_weekly_reroll() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cron_execute_weekly_reroll() TO postgres, service_role;

-- ====================================================================
-- 5. PUBLIC RPC: EXECUTE SEATING REROLL (REQUIRES VALID ADMIN SESSION)
--    Public web callers MUST provide a valid admin session token.
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
    -- Strict session verification: Any call via public RPC requires an active session token
    IF NOT public.is_valid_admin_session(p_session_token) THEN
        RAISE EXCEPTION 'Akses ditolak: Sesi administrator tidak valid atau telah kedaluwarsa.';
    END IF;

    -- Sanitize roll type
    v_roll_type := LOWER(COALESCE(p_roll_type, 'manual'));
    IF v_roll_type NOT IN ('manual', 'automatic', 'initial') THEN
        v_roll_type := 'manual';
    END IF;

    -- Calculate weekly cycle ID
    v_wib_now := v_now AT TIME ZONE 'Asia/Jakarta';
    v_wib_dow := EXTRACT(DOW FROM v_wib_now)::INT;

    IF v_wib_dow = 0 AND EXTRACT(HOUR FROM v_wib_now) < 6 THEN
        v_days_back := 7;
    ELSE
        v_days_back := v_wib_dow;
    END IF;

    v_cycle_start := v_wib_now::DATE - v_days_back;
    v_cycle_id := 'CYCLE-' || to_char(v_cycle_start, 'YYYY-MM-DD');

    -- Manual rerolls and admin simulations receive unique cycle ID suffix to prevent collision
    IF v_roll_type = 'manual' THEN
        v_cycle_id := v_cycle_id || '-M' || to_char(v_now, 'HH24MISS') || '-' || floor(random() * 1000)::TEXT;
    ELSIF v_roll_type = 'automatic' THEN
        v_cycle_id := v_cycle_id || '-SIM' || to_char(v_now, 'HH24MISS') || '-' || floor(random() * 1000)::TEXT;
    END IF;

    -- Get active layout
    SELECT id INTO v_layout_id FROM public.classroom_layouts WHERE is_active = true LIMIT 1;
    IF v_layout_id IS NULL THEN
        RAISE EXCEPTION 'Tata letak kelas aktif tidak ditemukan.';
    END IF;

    -- Count active students
    SELECT COUNT(*) INTO v_student_count FROM public.students WHERE is_active = true;
    IF v_student_count = 0 THEN
        RAISE EXCEPTION 'Tidak ada siswa aktif untuk diacak.';
    END IF;

    -- Count available seats
    SELECT COUNT(*) INTO v_seat_count FROM public.seats
    WHERE layout_id = v_layout_id AND is_available = true;

    IF v_seat_count < v_student_count THEN
        RAISE EXCEPTION 'Kapasitas kursi tersedia (%) kurang dari jumlah siswa aktif (%).',
            v_seat_count, v_student_count;
    END IF;

    -- Archive previous active periods
    UPDATE public.seating_periods SET status = 'archived' WHERE status = 'active';

    -- Insert new period record
    INSERT INTO public.seating_periods (cycle_id, layout_id, status, roll_type)
    VALUES (v_cycle_id, v_layout_id, 'active', v_roll_type)
    ON CONFLICT (cycle_id) DO UPDATE SET
        status = 'active',
        layout_id = EXCLUDED.layout_id,
        roll_type = EXCLUDED.roll_type
    RETURNING id INTO v_period_id;

    -- Clear old assignments if reusing period
    DELETE FROM public.seating_assignments WHERE period_id = v_period_id;

    -- Shuffled assignment
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

    -- Insert into reroll history (performed_by is NULL: no browser UUID trusted)
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
-- 6. PUBLIC RPC: GET ACTIVE SEATING
--    Returns current active seating layout with assignments map:
--    assignments shape: { [seat_id]: student_id }
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

    -- Build assignments map: { seat_id: student_id } matching frontend expectations
    SELECT COALESCE(jsonb_object_agg(sa.seat_id::TEXT, sa.student_id::TEXT), '{}'::jsonb)
    INTO v_assignments
    FROM public.seating_assignments sa
    WHERE sa.period_id = v_period.id;

    -- Get empty available seats in active layout
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
-- 7. PRIVILEGED STUDENT MANAGEMENT RPC
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

        -- Soft delete / deactivate to preserve historical seating references
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
-- 8. PRIVILEGED LAYOUT MANAGEMENT RPC
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
-- 9. AUTHENTICATION RPCs
-- ====================================================================
GRANT EXECUTE ON FUNCTION public.admin_verify_password(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_password(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_logout(TEXT) TO anon, authenticated;

-- Strict protection of password provisioning: postgres & service_role only
REVOKE ALL ON FUNCTION public.server_provision_admin_password(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.server_provision_admin_password(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.server_provision_admin_password(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.server_provision_admin_password(TEXT) TO postgres, service_role;

-- ====================================================================
-- 10. DROP OBSOLETE PERMISSIVE POLICIES TO PREVENT OR-BYPASS
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
DROP POLICY IF EXISTS "No direct access to audit_logs" ON public.audit_logs;

DROP POLICY IF EXISTS "Public can read group generations" ON public.group_generations;
DROP POLICY IF EXISTS "Public can read group members" ON public.group_generation_members;
DROP POLICY IF EXISTS "Admins can delete group generations" ON public.group_generations;

DROP POLICY IF EXISTS "Public can view saved class groups" ON public.saved_class_groups;
DROP POLICY IF EXISTS "Public can insert saved class groups" ON public.saved_class_groups;
DROP POLICY IF EXISTS "Public can delete saved class groups" ON public.saved_class_groups;

-- ====================================================================
-- 11. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ====================================================================
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

-- ====================================================================
-- 12. CREATE CLEAN READ-ONLY POLICIES FOR PUBLIC TABLES
-- ====================================================================
CREATE POLICY "Public can read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Public can read layouts" ON public.classroom_layouts FOR SELECT USING (true);
CREATE POLICY "Public can read seats" ON public.seats FOR SELECT USING (true);
CREATE POLICY "Public can read seating periods" ON public.seating_periods FOR SELECT USING (true);
CREATE POLICY "Public can read seating assignments" ON public.seating_assignments FOR SELECT USING (true);
CREATE POLICY "Public can read reroll history" ON public.reroll_history FOR SELECT USING (true);
CREATE POLICY "Public can read app settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Public can read group generations" ON public.group_generations FOR SELECT USING (true);
CREATE POLICY "Public can read group members" ON public.group_generation_members FOR SELECT USING (true);

-- saved_class_groups allows public read, insert, and delete (Group Randomizer utility)
CREATE POLICY "Public can view saved class groups" ON public.saved_class_groups FOR SELECT USING (true);
CREATE POLICY "Public can insert saved class groups" ON public.saved_class_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can delete saved class groups" ON public.saved_class_groups FOR DELETE USING (true);

-- Security tables: NO policies created for anon/authenticated = complete lockout

-- ====================================================================
-- 13. TABLE-LEVEL PRIVILEGE HARDENING (GRANT / REVOKE)
--     Direct INSERT, UPDATE, DELETE are revoked from public roles.
--     All administrative mutations MUST execute via SECURITY DEFINER RPCs.
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

-- saved_class_groups has public SELECT, INSERT, DELETE
GRANT SELECT, INSERT, DELETE ON public.saved_class_groups TO anon, authenticated;

-- Complete lockdown on security & internal tables
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
