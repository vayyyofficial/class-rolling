-- ====================================================================
-- CLASS ROLLING: WEEKLY AUTOMATIC REROLL SCHEDULER (pg_cron)
-- Timezone: Asia/Jakarta (WIB / UTC+7)
-- Schedule: Every Sunday at 06:00 WIB = 23:00 UTC Saturday (0 23 * * 6)
--
-- IMPORTANT: The 4-argument execute_seating_reroll signature is used here.
-- The 3-argument overload (legacy) has REVOKED public/anon access.
-- Automatic rerolls do not require a session token (p_session_token = NULL)
-- because the authorization check only applies to p_roll_type = 'manual'.
-- This cron job runs with trusted database role privileges.
-- ====================================================================

-- 1. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Remove any previous job with the same name to avoid duplicates
DO $$
BEGIN
    PERFORM cron.unschedule('classrolling-weekly-reroll');
EXCEPTION WHEN OTHERS THEN
    -- Ignore: job may not exist on first run
END $$;

-- Also remove legacy name from previous migrations
DO $$
BEGIN
    PERFORM cron.unschedule('seatflow-weekly-reroll');
EXCEPTION WHEN OTHERS THEN
    -- Ignore: job may not exist
END $$;

-- 3. Schedule the weekly automatic seating reroll
--    Uses the 4-argument signature: (p_roll_type, p_description, p_admin_id, p_session_token)
--    p_admin_id = NULL: performed by the cron scheduler (not a human admin)
--    p_session_token = NULL: automatic rerolls bypass the admin session check
SELECT cron.schedule(
    'classrolling-weekly-reroll',
    '0 23 * * 6', -- 23:00 UTC Saturday = 06:00 WIB Sunday
    $$
    SELECT public.execute_seating_reroll(
        'automatic',
        'Rotasi Otomatis Mingguan (Minggu 06:00 WIB)',
        NULL::UUID,
        NULL::TEXT
    );
    $$
);
