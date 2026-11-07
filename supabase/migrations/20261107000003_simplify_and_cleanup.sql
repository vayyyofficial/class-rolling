-- ====================================================================
-- CLASS ROLLING: SIMPLIFICATION & CLEANUP MIGRATION
-- Migration: 20261107000003_simplify_and_cleanup.sql
--
-- PURPOSE:
--   1. Removes obsolete database-based authentication tables and functions
--      (admin_security, admin_sessions, admin_audit_logs, admin_profiles, etc.)
--      since admin authentication now uses a fixed password directly on the website.
--   2. Simplifies execute_seating_reroll() so it no longer requires session tokens.
--   3. Keeps all active features intact:
--      - 26 Students management (students)
--      - Layout & Seats (classroom_layouts, seats)
--      - Weekly Seating Periods & Assignments (seating_periods, seating_assignments)
--      - Reroll History (reroll_history)
--      - Group Randomizer saved groups (saved_class_groups)
--      - Automatic Weekly Rotation (pg_cron + cron_execute_weekly_reroll)
-- ====================================================================

-- 1. DROP OBSOLETE AUTHENTICATION FUNCTIONS
DROP FUNCTION IF EXISTS public.admin_verify_password(TEXT);
DROP FUNCTION IF EXISTS public.admin_verify_session(TEXT);
DROP FUNCTION IF EXISTS public.admin_change_password(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_logout(TEXT);
DROP FUNCTION IF EXISTS public.server_provision_admin_password(TEXT);
DROP FUNCTION IF EXISTS public.is_valid_admin_session(TEXT);
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_admin(TEXT);
DROP FUNCTION IF EXISTS public.is_owner();
DROP FUNCTION IF EXISTS public.admin_manage_student(TEXT, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS public.admin_save_layout(TEXT, UUID, TEXT, TEXT, TEXT);

-- Drop previous overloads of execute_seating_reroll
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT p.oid::regprocedure AS func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'execute_seating_reroll'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ';';
    END LOOP;
END $$;

-- 2. DROP OBSOLETE TABLES
DROP TABLE IF EXISTS public.admin_security CASCADE;
DROP TABLE IF EXISTS public.admin_sessions CASCADE;
DROP TABLE IF EXISTS public.admin_audit_logs CASCADE;
DROP TABLE IF EXISTS public.admin_profiles CASCADE;
DROP TABLE IF EXISTS public.admin_invitations CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.group_generation_members CASCADE;
DROP TABLE IF EXISTS public.group_generations CASCADE;
DROP TABLE IF EXISTS public.app_settings CASCADE;

-- 3. SIMPLIFIED execute_seating_reroll (NO SESSION TOKEN REQUIRED)
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

GRANT EXECUTE ON FUNCTION public.execute_seating_reroll(TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. PERMISSIONS & RLS FOR ACTIVE TABLES
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'students', 'classroom_layouts', 'seats',
              'seating_periods', 'seating_assignments', 'reroll_history',
              'saved_class_groups'
          )
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Enable RLS on active tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reroll_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_class_groups ENABLE ROW LEVEL SECURITY;

-- Clean, simple policies for active features
CREATE POLICY "Public students access" ON public.students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public layouts access" ON public.classroom_layouts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public seats access" ON public.seats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public seating_periods access" ON public.seating_periods FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public seating_assignments access" ON public.seating_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public reroll_history access" ON public.reroll_history FOR ALL USING (true) WITH CHECK (true);

-- saved_class_groups: SELECT, INSERT, DELETE (prohibits UPDATE)
CREATE POLICY "Public saved_class_groups select" ON public.saved_class_groups FOR SELECT USING (true);
CREATE POLICY "Public saved_class_groups insert" ON public.saved_class_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Public saved_class_groups delete" ON public.saved_class_groups FOR DELETE USING (true);

-- Table grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO anon, authenticated, postgres, service_role;
GRANT SELECT, UPDATE ON public.classroom_layouts TO anon, authenticated, postgres, service_role;
GRANT SELECT, UPDATE ON public.seats TO anon, authenticated, postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seating_periods TO anon, authenticated, postgres, service_role;
GRANT SELECT, INSERT, DELETE ON public.seating_assignments TO anon, authenticated, postgres, service_role;
GRANT SELECT, INSERT, DELETE ON public.reroll_history TO anon, authenticated, postgres, service_role;
GRANT SELECT, INSERT, DELETE ON public.saved_class_groups TO anon, authenticated, postgres, service_role;
REVOKE UPDATE ON public.saved_class_groups FROM PUBLIC, anon, authenticated;
