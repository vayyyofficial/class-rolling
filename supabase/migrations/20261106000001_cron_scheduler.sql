-- ====================================================================
-- SEATFLOW WEEKLY AUTOMATIC REROLL SCHEDULER (pg_cron)
-- Timezone: Asia/Jakarta (WIB / UTC+7)
-- Schedule: Every Sunday at 06:00 WIB
-- Equivalent UTC Cron: 23:00 UTC every Saturday (0 23 * * 6)
-- ====================================================================

-- 1. Enable pg_cron extension if supported
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Unscheduling any previous job with the same name if exists
DO $$
BEGIN
    PERFORM cron.unschedule('seatflow-weekly-reroll');
EXCEPTION WHEN OTHERS THEN
    -- Ignore if job doesn't exist
END $$;

-- 3. Schedule the idempotent weekly seating reroll
SELECT cron.schedule(
    'seatflow-weekly-reroll',
    '0 23 * * 6', -- 23:00 UTC on Saturday = 06:00 WIB on Sunday
    $$SELECT public.execute_seating_reroll('automatic', 'Rotasi Otomatis Mingguan (Minggu 06:00 WIB)', NULL);$$
);

