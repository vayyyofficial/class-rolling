-- ====================================================================
-- CLASS ROLLING: SAVED CLASS GROUPS FOR ASSIGNMENTS & ACTIVITIES
-- Migration: 20261107000001_saved_class_groups.sql
-- ====================================================================

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

-- Index for fast sorting by date
CREATE INDEX IF NOT EXISTS idx_saved_class_groups_created ON public.saved_class_groups(created_at DESC);

-- Enable RLS
ALTER TABLE public.saved_class_groups ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DROP POLICY IF EXISTS "Public can view saved class groups" ON public.saved_class_groups;
DROP POLICY IF EXISTS "Public can insert saved class groups" ON public.saved_class_groups;
DROP POLICY IF EXISTS "Public can delete saved class groups" ON public.saved_class_groups;

-- Policies: All students in class can view and save assignment groups
CREATE POLICY "Public can view saved class groups" ON public.saved_class_groups
    FOR SELECT USING (true);

CREATE POLICY "Public can insert saved class groups" ON public.saved_class_groups
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can delete saved class groups" ON public.saved_class_groups
    FOR DELETE USING (true);

-- Enable Realtime for saved groups
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_class_groups;
EXCEPTION WHEN OTHERS THEN
END $$;

