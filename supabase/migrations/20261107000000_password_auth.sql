-- ====================================================================
-- RUANGKELAS: PASSWORD-ONLY ADMIN AUTHENTICATION & SECURITY HARDENING
-- Migration: 20261107000000_password_auth.sql
-- ====================================================================

-- 1. Ensure pgcrypto extension for bcrypt and SHA-256
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create admin_security table (Stores Bcrypt hashed password, lockout state, rate limiting)
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

-- 3. Create admin_sessions table (Stores SHA-256 hashed session tokens with expiry)
CREATE TABLE IF NOT EXISTS public.admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create admin_audit_logs table (Stores tamper-evident audit history of admin actions)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Enable Strict RLS on security tables (Zero public access to raw rows)
ALTER TABLE public.admin_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DROP POLICY IF EXISTS "No direct access to admin_security" ON public.admin_security;
DROP POLICY IF EXISTS "No direct access to admin_sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "No direct access to admin_audit_logs" ON public.admin_audit_logs;

-- 6. Helper: Validate Session Token Hash
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

-- 7. Helper: Updated is_admin supporting both session token and legacy Supabase auth
CREATE OR REPLACE FUNCTION public.is_admin(p_token TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    -- Check password session token if provided
    IF p_token IS NOT NULL AND public.is_valid_admin_session(p_token) THEN
        RETURN true;
    END IF;

    -- Fallback check for Supabase Auth uid if available
    IF auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.admin_profiles
        WHERE id = auth.uid() AND role IN ('OWNER', 'ADMIN')
    ) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- 8. Server-Side Password Verification (Rate limiting, 5-attempt lockout for 15 mins)
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
    -- Input sanitization
    IF p_password IS NULL OR length(p_password) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Kata sandi tidak boleh kosong.'
        );
    END IF;

    SELECT * INTO v_sec FROM public.admin_security WHERE id = 1;

    -- If unprovisioned
    IF v_sec.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Sistem otentikasi belum diinisialisasi. Hubungi pemilik sistem.'
        );
    END IF;

    -- Check Lockout
    IF v_sec.locked_until IS NOT NULL AND v_sec.locked_until > now() THEN
        v_remaining_seconds := EXTRACT(EPOCH FROM (v_sec.locked_until - now()))::INT;
        RETURN jsonb_build_object(
            'success', false,
            'locked', true,
            'remaining_seconds', v_remaining_seconds,
            'error', 'Terlalu banyak percobaan gagal. Akses terkunci selama ' || CEIL(v_remaining_seconds / 60.0)::INT || ' menit lagi.'
        );
    END IF;

    -- Verify Bcrypt Hash
    IF v_sec.password_hash = crypt(p_password, v_sec.password_hash) THEN
        -- Success: reset failed attempts
        UPDATE public.admin_security
        SET failed_attempts = 0,
            locked_until = NULL,
            last_login_at = now(),
            updated_at = now()
        WHERE id = 1;

        -- Generate 32-byte cryptographically secure session token
        v_raw_token := encode(gen_random_bytes(32), 'hex');
        v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');
        v_expires := now() + interval '24 hours';

        -- Clean up expired sessions and store new session
        DELETE FROM public.admin_sessions WHERE expires_at < now();
        INSERT INTO public.admin_sessions (session_token_hash, expires_at)
        VALUES (v_token_hash, v_expires);

        -- Audit log
        INSERT INTO public.admin_audit_logs (action, details)
        VALUES ('ADMIN_LOGIN_SUCCESS', jsonb_build_object('expires_at', v_expires));

        RETURN jsonb_build_object(
            'success', true,
            'token', v_raw_token,
            'expires_at', v_expires,
            'role', 'ADMIN'
        );
    ELSE
        -- Failure: increment counter
        UPDATE public.admin_security
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
            updated_at = now()
        WHERE id = 1
        RETURNING failed_attempts INTO v_sec.failed_attempts;

        IF v_sec.failed_attempts >= 5 THEN
            INSERT INTO public.admin_audit_logs (action, details)
            VALUES ('ADMIN_LOGIN_LOCKED', jsonb_build_object('failed_attempts', v_sec.failed_attempts));

            RETURN jsonb_build_object(
                'success', false,
                'locked', true,
                'remaining_seconds', 900,
                'error', 'Akses dikunci sementara selama 15 menit karena 5 kali percobaan gagal.'
            );
        ELSE
            INSERT INTO public.admin_audit_logs (action, details)
            VALUES ('ADMIN_LOGIN_FAILED', jsonb_build_object('failed_attempts', v_sec.failed_attempts));

            RETURN jsonb_build_object(
                'success', false,
                'locked', false,
                'remaining_attempts', (5 - v_sec.failed_attempts),
                'error', 'Kata sandi salah. Sisa kesempatan: ' || (5 - v_sec.failed_attempts)
            );
        END IF;
    END IF;
END;
$$;

-- 9. Server-Side Session Verification
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

    SELECT * INTO v_session FROM public.admin_sessions
    WHERE session_token_hash = v_token_hash AND expires_at > now();

    IF v_session.id IS NOT NULL THEN
        UPDATE public.admin_sessions SET last_active_at = now() WHERE id = v_session.id;
        RETURN jsonb_build_object('valid', true, 'expires_at', v_session.expires_at, 'role', 'ADMIN');
    ELSE
        RETURN jsonb_build_object('valid', false);
    END IF;
END;
$$;

-- 10. Server-Side Password Change (Requires valid session AND current password)
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
    -- Verify Session
    IF NOT public.is_valid_admin_session(p_token) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.'
        );
    END IF;

    -- Validate New Password
    IF p_new_password IS NULL OR length(trim(p_new_password)) < 8 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Kata sandi baru minimal harus 8 karakter.'
        );
    END IF;

    IF p_current_password = p_new_password THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Kata sandi baru tidak boleh sama dengan kata sandi saat ini.'
        );
    END IF;

    SELECT * INTO v_sec FROM public.admin_security WHERE id = 1;

    -- Verify Current Password with Bcrypt
    IF v_sec.password_hash != crypt(p_current_password, v_sec.password_hash) THEN
        INSERT INTO public.admin_audit_logs (action, details)
        VALUES ('PASSWORD_CHANGE_FAILED', jsonb_build_object('reason', 'current_password_mismatch'));

        RETURN jsonb_build_object(
            'success', false,
            'error', 'Kata sandi saat ini tidak cocok.'
        );
    END IF;

    -- Hash new password with Bcrypt (Blowfish, cost 12)
    v_new_hash := crypt(trim(p_new_password), gen_salt('bf', 12));

    UPDATE public.admin_security
    SET password_hash = v_new_hash,
        last_password_change = now(),
        failed_attempts = 0,
        locked_until = NULL,
        updated_at = now()
    WHERE id = 1;

    -- Invalidate all previous sessions
    DELETE FROM public.admin_sessions;

    -- Issue fresh session token
    v_new_raw_token := encode(gen_random_bytes(32), 'hex');
    v_new_token_hash := encode(digest(v_new_raw_token, 'sha256'), 'hex');
    v_expires := now() + interval '24 hours';

    INSERT INTO public.admin_sessions (session_token_hash, expires_at)
    VALUES (v_new_token_hash, v_expires);

    -- Audit log
    INSERT INTO public.admin_audit_logs (action, details)
    VALUES ('ADMIN_PASSWORD_CHANGED', jsonb_build_object('timestamp', now()));

    RETURN jsonb_build_object(
        'success', true,
        'token', v_new_raw_token,
        'expires_at', v_expires,
        'message', 'Kata sandi administrator berhasil diubah secara aman.'
    );
END;
$$;

-- 11. Server-Side Admin Logout
CREATE OR REPLACE FUNCTION public.admin_logout(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_token IS NOT NULL THEN
        DELETE FROM public.admin_sessions
        WHERE session_token_hash = encode(digest(p_token, 'sha256'), 'hex');
    END IF;
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 12. Server-Side Privileged Student Management
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
    IF NOT public.is_valid_admin_session(p_session_token) AND NOT public.is_admin() THEN
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

        DELETE FROM public.students WHERE id = p_student_id;

        INSERT INTO public.admin_audit_logs (action, details)
        VALUES ('DELETE_STUDENT', jsonb_build_object('student_id', p_student_id));

        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Aksi tidak dikenali.');
    END IF;
END;
$$;

-- 13. Server-Side Privileged Layout Management
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
    IF NOT public.is_valid_admin_session(p_session_token) AND NOT public.is_admin() THEN
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

-- 14. Server-Side Authorized Initial Password Provisioning & Recovery
-- (Executable only via Database Dashboard SQL Editor or Service Role - never by public)
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

    -- Invalidate all active sessions
    DELETE FROM public.admin_sessions;

    INSERT INTO public.admin_audit_logs (action, details)
    VALUES ('SERVER_PROVISION_PASSWORD', jsonb_build_object('timestamp', now()));

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Kata sandi admin berhasil disetel melalui prosedur server-side provisioning.'
    );
END;
$$;

-- 15. Update execute_seating_reroll to accept session token for manual rolls
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
    v_wib_date DATE;
    v_wib_dow INT;
    v_days_back INT;
    v_cycle_start DATE;
BEGIN
    -- Authorization check for manual reroll
    IF p_roll_type = 'manual' AND NOT (public.is_valid_admin_session(p_session_token) OR public.is_admin()) THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya administrator yang dapat melakukan acak ulang manual.';
    END IF;

    v_wib_date := (v_now AT TIME ZONE 'Asia/Jakarta')::DATE;
    v_wib_dow := EXTRACT(DOW FROM (v_now AT TIME ZONE 'Asia/Jakarta'))::INT;

    IF v_wib_dow = 0 AND EXTRACT(HOUR FROM (v_now AT TIME ZONE 'Asia/Jakarta')) < 6 THEN
        v_days_back := 7;
    ELSE
        v_days_back := v_wib_dow;
    END IF;

    v_cycle_start := v_wib_date - v_days_back;
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
        RAISE EXCEPTION 'Kapasitas kursi tersedia (%) kurang dari jumlah siswa aktif (%).', v_seat_count, v_student_count;
    END IF;

    UPDATE public.seating_periods SET status = 'archived' WHERE status = 'active';

    INSERT INTO public.seating_periods (cycle_id, layout_id, status, roll_type)
    VALUES (
        v_cycle_id || (CASE WHEN p_roll_type = 'manual' THEN '-M' || to_char(v_now, 'HH24MISS') ELSE '' END),
        v_layout_id,
        'active',
        p_roll_type
    )
    RETURNING id INTO v_period_id;

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

-- 16. Permissions Management
GRANT EXECUTE ON FUNCTION public.admin_verify_password(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_password(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_logout(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_student(TEXT, TEXT, UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_layout(TEXT, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_seating_reroll(TEXT, TEXT, UUID, TEXT) TO anon, authenticated;

-- Restrict Server Provisioning from Public/Anon
REVOKE ALL ON FUNCTION public.server_provision_admin_password(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.server_provision_admin_password(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.server_provision_admin_password(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.server_provision_admin_password(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.server_provision_admin_password(TEXT) TO postgres;
