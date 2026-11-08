-- ============================================================================
-- AI MOVIE FACTORY - PHASE 15 SPRINT 2: CREATOR BUSINESS & GROWTH INTELLIGENCE
-- Migration: upgrade_v3_4_creator_intelligence.sql
-- Description: Adds creator_milestones table with strict RLS for tracking
--              published film views, revenue, audience engagement, and ROI.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.creator_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    project_name TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'reels', 'x_twitter', 'web_drama')),
    video_url TEXT,
    views_count BIGINT DEFAULT 0,
    likes_count BIGINT DEFAULT 0,
    comments_count BIGINT DEFAULT 0,
    revenue_earned NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'IDR',
    release_date TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optimize queries by user & project
CREATE INDEX IF NOT EXISTS idx_creator_milestones_user_id ON public.creator_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_milestones_project_id ON public.creator_milestones(project_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.creator_milestones ENABLE ROW LEVEL SECURITY;

-- 1. Read Policy: Creator can view own milestones or platform super admin
DROP POLICY IF EXISTS "Users can view own creator milestones" ON public.creator_milestones;
CREATE POLICY "Users can view own creator milestones"
    ON public.creator_milestones FOR SELECT
    USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

-- 2. Insert Policy: Creator can log own milestones
DROP POLICY IF EXISTS "Users can create own creator milestones" ON public.creator_milestones;
CREATE POLICY "Users can create own creator milestones"
    ON public.creator_milestones FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 3. Update Policy: Creator can update own milestones
DROP POLICY IF EXISTS "Users can update own creator milestones" ON public.creator_milestones;
CREATE POLICY "Users can update own creator milestones"
    ON public.creator_milestones FOR UPDATE
    USING (auth.uid() = user_id);

-- 4. Delete Policy: Creator can delete own milestones
DROP POLICY IF EXISTS "Users can delete own creator milestones" ON public.creator_milestones;
CREATE POLICY "Users can delete own creator milestones"
    ON public.creator_milestones FOR DELETE
    USING (auth.uid() = user_id);
