-- ====================================================================
-- CLASS ROLLING: DATABASE SECURITY HARDENING
-- Migration: 20261107000002_security_hardening.sql
-- Purpose:
--   1. Apply RLS policies to all application tables.
--   2. Harden security table permissions (admin_security, admin_sessions, admin_audit_logs).
--   3. Remove unnecessary public execute privileges.
--   4. Remove legacy Supabase Auth fallback from is_admin() function.
--   5. Fix execute_seating_reroll to prevent seating_periods unique constraint
--      collision on automatic weekly rerolls.
--   6. Add get_active_seating RPC used by the frontend seatingService.
--
-- SAFE TO RUN on existing production database.
-- Does NOT drop any table, truncate any data, or change passwords.
-- ====================================================================

-- ====================================================================
-- SECTION 1: RLS ON APPLICATION TABLES
-- Students, layouts, seats, and seating data are publicly readable.
-- Writes are blocked from direct table access; must go via RPC.
-- ====================================================================

-- students: public read (seating map is publicly visible), write via RPC only
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read students" ON public.students;
DROP POLICY IF EXISTS "Block direct student writes" ON public.students;

CREATE POLICY "Public can read students"
    ON public.students FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE are only allowed via SECURITY DEFINER RPCs (which run as postgres).
-- Deny all direct writes from anon/authenticated.
CREATE POLICY "Block direct student writes"
    ON public.students FOR ALL
    USING (false)
    WITH CHECK (false);

-- classroom_layouts: public read; write via RPC only
ALTER TABLE public.classroom_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read layouts" ON public.classroom_layouts;
DROP POLICY IF EXISTS "Block direct layout writes" ON public.classroom_layouts;

CREATE POLICY "Public can read layouts"
    ON public.classroom_layouts FOR SELECT USING (true);

CREATE POLICY "Block direct layout writes"
    ON public.classroom_layouts FOR ALL
    USING (false)
    WITH CHECK (false);

-- seats: public read; write via RPC only
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read seats" ON public.seats;
DROP POLICY IF EXISTS "Block direct seat writes" ON public.seats;

CREATE POLICY "Public can read seats"
    ON public.seats FOR SELECT USING (true);

CREATE POLICY "Block direct seat writes"
    ON public.seats FOR ALL
    USING (false)
    WITH CHECK (false);

-- seating_periods: public read; write via RPC only
ALTER TABLE public.seating_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read seating periods" ON public.seating_periods;
DROP POLICY IF EXISTS "Block direct period writes" ON public.seating_periods;

CREATE POLICY "Public can read seating periods"
    ON public.seating_periods FOR SELECT USING (true);

CREATE POLICY "Block direct period writes"
    ON public.seating_periods FOR ALL
    USING (false)
    WITH CHECK (false);

-- seating_assignments: public read; write via RPC only
ALTER TABLE public.seating_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read seating assignments" ON public.seating_assignments;
DROP POLICY IF EXISTS "Block direct assignment writes" ON public.seating_assignments;

CREATE POLICY "Public can read seating assignments"
    ON public.seating_assignments FOR SELECT USING (true);

CREATE POLICY "Block direct assignment writes"
    ON public.seating_assignments FOR ALL
    USING (false)
    WITH CHECK (false);

-- reroll_history: public read; write via RPC only
ALTER TABLE public.reroll_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read reroll history" ON public.reroll_history;
DROP POLICY IF EXISTS "Block direct history writes" ON public.reroll_history;

CREATE POLICY "Public can read reroll history"
    ON public.reroll_history FOR SELECT USING (true);

CREATE POLICY "Block direct history writes"
    ON public.reroll_history FOR ALL
    USING (false)
    WITH CHECK (false);

-- admin_profiles: restricted to service_role only (legacy table, not actively used)
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to admin_profiles" ON public.admin_profiles;
-- No SELECT policy = complete lockout for anon/authenticated

-- admin_invitations: restricted (legacy table, not actively used)
ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to admin_invitations" ON public.admin_invitations;

-- saved_class_groups: public read/insert/delete (already set, re-enforced here)
ALTER TABLE public.saved_class_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view saved class groups" ON public.saved_class_groups;
DROP POLICY IF EXISTS "Public can insert saved class groups" ON public.saved_class_groups;
DROP POLICY IF EXISTS "Public can delete saved class groups" ON public.saved_class_groups;

CREATE POLICY "Public can view saved class groups"
    ON public.saved_class_groups FOR SELECT USING (true);
CREATE POLICY "Public can insert saved class groups"
    ON public.saved_class_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can delete saved class groups"
    ON public.saved_class_groups FOR DELETE USING (true);


-- ====================================================================
-- SECTION 2: TIGHTEN is_admin() — REMOVE LEGACY SUPABASE AUTH FALLBACK
--
-- The app uses password-only authentication via admin_sessions table.
-- The Supabase Auth email/password system is NOT used.
-- Removing the auth.uid() check eliminates an attack vector where
-- a Supabase Auth user could potentially impersonate an admin.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.is_admin(p_token TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    -- Token-based session check only. No fallback to Supabase email auth.
    IF p_token IS NOT NULL THEN
        RETURN public.is_valid_admin_session(p_token);
    END IF;
    RETURN false;
END;
$$;


-- ====================================================================
-- SECTION 3: FIX execute_seating_reroll CYCLE_ID COLLISION
--
-- Current issue: Automatic weekly rerolls use CYCLE-YYYY-MM-DD as cycle_id.
-- If two automatic rerolls happen in the same week (e.g., cron fires twice),
-- the INSERT fails with a unique constraint violation on seating_periods.cycle_id.
--
-- Fix: Use ON CONFLICT DO NOTHING or update strategy, and delete old assignments
-- before inserting new ones when reusing an existing period.
--
-- Also fixes: The manual reroll appends a timestamp suffix (-MHHMMSS) which means
-- a manual reroll within the same second could also cause a collision.
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
BEGIN
    -- Authorization check: manual reroll requires a valid admin session token.
    -- Automatic rerolls (from pg_cron) do not require a token.
    IF p_roll_type = 'manual' AND NOT public.is_valid_admin_session(p_session_token) THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya administrator yang dapat melakukan acak ulang manual.';
    END IF;

    -- Validate roll type
    IF p_roll_type NOT IN ('manual', 'automatic', 'initial') THEN
        RAISE EXCEPTION 'Jenis pengacakan tidak valid: %', p_roll_type;
    END IF;

    -- Compute WIB-based weekly cycle start (last Sunday 06:00 WIB or earlier)
    v_wib_now := v_now AT TIME ZONE 'Asia/Jakarta';
    v_wib_dow := EXTRACT(DOW FROM v_wib_now)::INT; -- 0=Sunday

    -- If it's Sunday before 06:00 WIB, treat as still belonging to the previous week
    IF v_wib_dow = 0 AND EXTRACT(HOUR FROM v_wib_now) < 6 THEN
        v_days_back := 7;
    ELSE
        v_days_back := v_wib_dow;
    END IF;

    v_cycle_start := v_wib_now::DATE - v_days_back;
    v_cycle_id := 'CYCLE-' || to_char(v_cycle_start, 'YYYY-MM-DD');

    -- Manual rerolls use a unique timestamp suffix to avoid conflicts with the weekly auto cycle
    IF p_roll_type = 'manual' THEN
        v_cycle_id := v_cycle_id || '-M' || to_char(v_now, 'HH24MISS') || '-' || floor(random() * 1000)::TEXT;
    END IF;

    -- Get active layout
    SELECT id INTO v_layout_id FROM public.classroom_layouts WHERE is_active = true LIMIT 1;
    IF v_layout_id IS NULL THEN
        RAISE EXCEPTION 'Tata letak kelas aktif tidak ditemukan. Aktifkan tata letak terlebih dahulu.';
    END IF;

    -- Check active students
    SELECT COUNT(*) INTO v_student_count FROM public.students WHERE is_active = true;
    IF v_student_count = 0 THEN
        RAISE EXCEPTION 'Tidak ada siswa aktif untuk diacak.';
    END IF;

    -- Check seat capacity
    SELECT COUNT(*) INTO v_seat_count
    FROM public.seats
    WHERE layout_id = v_layout_id AND is_available = true;

    IF v_seat_count < v_student_count THEN
        RAISE EXCEPTION 'Kapasitas kursi tersedia (%) kurang dari jumlah siswa aktif (%).',
            v_seat_count, v_student_count;
    END IF;

    -- Archive all currently active periods
    UPDATE public.seating_periods SET status = 'archived' WHERE status = 'active';

    -- Insert new period (with conflict handling for automatic rerolls)
    INSERT INTO public.seating_periods (cycle_id, layout_id, status, roll_type)
    VALUES (v_cycle_id, v_layout_id, 'active', p_roll_type)
    ON CONFLICT (cycle_id) DO UPDATE
        SET status = 'active',
            roll_type = EXCLUDED.roll_type
    RETURNING id INTO v_period_id;

    -- Remove old assignments for this period before reinserting (idempotent reroll)
    DELETE FROM public.seating_assignments WHERE period_id = v_period_id;

    -- Randomly assign students to seats using Fisher-Yates via gen_random_uuid()
    -- Students assigned to non-default-empty seats first, then overflow to default-empty seats
    WITH shuffled_students AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY gen_random_uuid()) AS rn
        FROM public.students
        WHERE is_active = true
    ),
    prioritized_seats AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   ORDER BY
                       -- Non-default-empty seats are assigned first (priority 0)
                       CASE WHEN default_empty THEN 1 ELSE 0 END,
                       gen_random_uuid()
               ) AS rn
        FROM public.seats
        WHERE layout_id = v_layout_id AND is_available = true
    )
    INSERT INTO public.seating_assignments (period_id, seat_id, student_id)
    SELECT v_period_id, s.id, stu.id
    FROM shuffled_students stu
    JOIN prioritized_seats s ON stu.rn = s.rn;

    -- Write reroll history
    INSERT INTO public.reroll_history (
        period_id, roll_type, description, active_student_count, performed_by, cycle_id
    ) VALUES (
        v_period_id,
        p_roll_type,
        COALESCE(p_description, 'Pengacakan Tempat Duduk'),
        v_student_count,
        p_admin_id,  -- NULL for automatic/cron rerolls
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

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '%', SQLERRM;
END;
$$;


-- ====================================================================
-- SECTION 4: get_active_seating RPC
--
-- Called by the frontend seatingService.fetchActiveArrangement().
-- Returns the current active seating period with all assignments.
-- Public read — no authentication required (data is public-facing).
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
    v_empty_seat_ids UUID[];
BEGIN
    -- Get the active seating period
    SELECT sp.id, sp.cycle_id, sp.roll_type, sp.created_at, sp.layout_id
    INTO v_period
    FROM public.seating_periods sp
    WHERE sp.status = 'active'
    ORDER BY sp.created_at DESC
    LIMIT 1;

    IF v_period.id IS NULL THEN
        RETURN jsonb_build_object('active', false);
    END IF;

    -- Build assignments map: { seat_id: { student_id, seat_code, ... } }
    SELECT jsonb_object_agg(
        sa.seat_id::TEXT,
        jsonb_build_object(
            'studentId', sa.student_id,
            'seatId', sa.seat_id,
            'seatCode', s.seat_code,
            'blockId', s.block_id,
            'row', s.row_index,
            'col', s.col_index,
            'studentName', st.nickname,
            'studentFullName', st.full_name,
            'studentNumber', st.number
        )
    )
    INTO v_assignments
    FROM public.seating_assignments sa
    JOIN public.seats s ON sa.seat_id = s.id
    JOIN public.students st ON sa.student_id = st.id
    WHERE sa.period_id = v_period.id;

    -- Find empty seats in the layout (available but unassigned)
    SELECT ARRAY_AGG(s.id)
    INTO v_empty_seat_ids
    FROM public.seats s
    WHERE s.layout_id = v_period.layout_id
      AND s.is_available = true
      AND NOT EXISTS (
          SELECT 1 FROM public.seating_assignments sa
          WHERE sa.seat_id = s.id AND sa.period_id = v_period.id
      );

    RETURN jsonb_build_object(
        'active', true,
        'period_id', v_period.id,
        'cycle_id', v_period.cycle_id,
        'roll_type', v_period.roll_type,
        'created_at', v_period.created_at,
        'assignments', COALESCE(v_assignments, '{}'::JSONB),
        'empty_seat_ids', COALESCE(to_jsonb(v_empty_seat_ids), '[]'::JSONB)
    );
END;
$$;


-- ====================================================================
-- SECTION 5: FUNCTION PERMISSIONS
-- Revoke unnecessary PUBLIC defaults; grant only what is needed.
-- ====================================================================

-- Public RPCs (callable by anon and authenticated users)
GRANT EXECUTE ON FUNCTION public.admin_verify_password(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_password(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_logout(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_student(TEXT, TEXT, UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_layout(TEXT, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_seating_reroll(TEXT, TEXT, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_seating() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_admin_session(TEXT) TO anon, authenticated;

-- Revoke public access from admin-only or internal helpers
REVOKE ALL ON FUNCTION public.is_admin(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.server_provision_admin_password(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.server_provision_admin_password(TEXT) TO service_role, postgres;

-- Ensure the realtime publication includes seating_periods for live updates
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.seating_periods;
EXCEPTION WHEN OTHERS THEN
    -- Already included or realtime not enabled
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_class_groups;
EXCEPTION WHEN OTHERS THEN
    -- Already included
END $$;
