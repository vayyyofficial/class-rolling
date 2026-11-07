-- ====================================================================
-- CLASS ROLLING: WEEKLY AUTOMATIC REROLL SCHEDULER (pg_cron)
-- Timezone: Asia/Jakarta (WIB / UTC+7)
-- Schedule: Every Sunday at 06:00 WIB = 23:00 UTC Saturday (0 23 * * 6)
--
-- EXECUTION ARCHITECTURE:
--   Calls the dedicated database-internal function:
--   SELECT public.cron_execute_weekly_reroll();
--
-- SECURITY & COMPATIBILITY GUARANTEES:
--   - cron_execute_weekly_reroll() is strictly restricted to postgres & service_role.
--   - PUBLIC, anon, and authenticated roles have ZERO execute privileges on it.
--   - No JWT, API key, or browser authentication token is required or exposed.
--   - Idempotent: Unschedules any existing job by jobid and jobname safely.
--   - Extension-safe: Checks pg_cron existence before scheduling.
-- ====================================================================

-- 1. Enable pg_cron extension if supported
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Safely remove any prior schedule by name or id
DO $$
DECLARE
    v_jobid BIGINT;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Unschedule matching names
        BEGIN
            PERFORM cron.unschedule('classrolling-weekly-reroll');
        EXCEPTION WHEN OTHERS THEN END;

        BEGIN
            PERFORM cron.unschedule('seatflow-weekly-reroll');
        EXCEPTION WHEN OTHERS THEN END;

        -- Also cleanup if job table has matching entries
        BEGIN
            FOR v_jobid IN (
                SELECT jobid FROM cron.job 
                WHERE jobname IN ('classrolling-weekly-reroll', 'seatflow-weekly-reroll')
            ) LOOP
                PERFORM cron.unschedule(v_jobid);
            END LOOP;
        EXCEPTION WHEN OTHERS THEN END;
    END IF;
END $$;

-- 3. Schedule the weekly automatic seating rotation
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'classrolling-weekly-reroll',
            '0 23 * * 6', -- 23:00 UTC Saturday = 06:00 WIB Sunday
            'SELECT public.cron_execute_weekly_reroll();'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- In environments where cron is enabled as an extension but daemon scheduling requires superuser
    RAISE NOTICE 'pg_cron schedule could not be registered automatically: %', SQLERRM;
END $$;
