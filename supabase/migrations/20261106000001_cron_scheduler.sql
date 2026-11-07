-- ====================================================================
-- CLASS ROLLING: WEEKLY AUTOMATIC REROLL SCHEDULER (pg_cron)
-- Timezone: Asia/Jakarta (WIB / UTC+7)
-- Schedule: Every Sunday at 06:00 WIB = 23:00 UTC Saturday (0 23 * * 6)
--
-- EXECUTION ARCHITECTURE:
--   Calls the dedicated database-internal function:
--   SELECT public.cron_execute_weekly_reroll();
--
-- SECURITY GUARANTEES:
--   - cron_execute_weekly_reroll() is strictly restricted to postgres & service_role.
--   - PUBLIC, anon, and authenticated roles have ZERO execute privileges on it.
--   - No JWT, API key, or browser authentication token is required or exposed.
--   - Idempotent: Automatically removes prior duplicate schedules.
-- ====================================================================

-- 1. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Remove any previous job with either old or current name
DO $$
BEGIN
    PERFORM cron.unschedule('classrolling-weekly-reroll');
EXCEPTION WHEN OTHERS THEN
    -- Ignore if job does not exist
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('seatflow-weekly-reroll');
EXCEPTION WHEN OTHERS THEN
    -- Ignore if job does not exist
END $$;

-- 3. Schedule the weekly automatic seating rotation
SELECT cron.schedule(
    'classrolling-weekly-reroll',
    '0 23 * * 6', -- 23:00 UTC Saturday = 06:00 WIB Sunday
    $$SELECT public.cron_execute_weekly_reroll();$$
);
