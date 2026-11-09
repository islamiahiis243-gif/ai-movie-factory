-- ============================================================================
-- AI MOVIE FACTORY - PHASE 15 SPRINT 3 (T9.2): UNIVERSAL PUBLISHING ENGINE
-- Migration: upgrade_v3_7_universal_publishing_engine.sql
-- Description: Creates publishing_jobs table with fine-grained RLS and trigger
--              preventing client-side tampering of server-controlled status & URLs.
-- ============================================================================

-- 1. Create publishing_jobs Table
CREATE TABLE IF NOT EXISTS public.publishing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    export_package_id UUID REFERENCES public.export_packages(id) ON DELETE SET NULL,
    platform TEXT NOT NULL,
    provider_account_id TEXT,
    target_format TEXT NOT NULL DEFAULT '16:9',
    title TEXT NOT NULL,
    caption TEXT,
    description TEXT,
    hashtags TEXT[] DEFAULT '{}',
    thumbnail_url TEXT,
    media_url TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft',
    progress_percentage INTEGER NOT NULL DEFAULT 0,
    retry_count INTEGER NOT NULL DEFAULT 0,
    external_publish_id TEXT,
    published_video_url TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT publishing_jobs_status_check CHECK (
        status IN (
            'draft',
            'queued',
            'scheduled',
            'processing',
            'uploading',
            'published',
            'requires_user_action',
            'failed',
            'cancelled'
        )
    ),
    CONSTRAINT publishing_jobs_progress_check CHECK (
        progress_percentage >= 0 AND progress_percentage <= 100
    )
);

-- Optimize queries by user, project, and status
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_user_status ON public.publishing_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_project ON public.publishing_jobs(project_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.publishing_jobs ENABLE ROW LEVEL SECURITY;

-- 2. SELECT Policy: User can view own publishing jobs, platform super admins can audit all
DROP POLICY IF EXISTS "Users can view own publishing jobs" ON public.publishing_jobs;
CREATE POLICY "Users can view own publishing jobs"
    ON public.publishing_jobs FOR SELECT
    USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

-- 3. INSERT Policy: Users can only insert jobs in 'draft' or 'queued' state
-- Users CANNOT insert jobs directly with status 'published' or fake 'published_video_url'
DROP POLICY IF EXISTS "Users can insert own draft publishing jobs" ON public.publishing_jobs;
CREATE POLICY "Users can insert own draft publishing jobs"
    ON public.publishing_jobs FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND status IN ('draft', 'queued')
        AND published_video_url IS NULL
        AND external_publish_id IS NULL
    );

-- 4. UPDATE Policy: Users can only update their own drafts or cancel jobs
-- Server-controlled fields (published_video_url, external_publish_id, progress) are strictly protected
DROP POLICY IF EXISTS "Users can update own draft publishing jobs" ON public.publishing_jobs;
CREATE POLICY "Users can update own draft publishing jobs"
    ON public.publishing_jobs FOR UPDATE
    USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()))
    WITH CHECK (
        (
            auth.uid() = user_id
            AND status IN ('draft', 'queued', 'scheduled', 'cancelled')
            -- Ordinary users cannot forge published status or publication URL
            AND (
                status != 'published' 
                OR (OLD.status = 'published' AND published_video_url = OLD.published_video_url)
            )
        )
        OR public.is_platform_admin(auth.uid())
    );

-- 5. DELETE Policy: Users can only delete their own draft, cancelled, or failed jobs
DROP POLICY IF EXISTS "Users can delete own draft or cancelled jobs" ON public.publishing_jobs;
CREATE POLICY "Users can delete own draft or cancelled jobs"
    ON public.publishing_jobs FOR DELETE
    USING (
        auth.uid() = user_id 
        AND status IN ('draft', 'cancelled', 'failed')
    );

-- 6. Trigger to prevent client-side elevation to 'published' status
CREATE OR REPLACE FUNCTION public.validate_publishing_job_client_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow super admins or service_role (where auth.uid() is null in trusted backend calls) full access
    IF auth.uid() IS NULL OR public.is_platform_admin(auth.uid()) THEN
        RETURN NEW;
    END IF;

    -- Block client-side users from directly modifying server-controlled fields
    IF NEW.status = 'published' AND OLD.status != 'published' THEN
        RAISE EXCEPTION 'Otorisasi ditolak: Status published hanya dapat ditetapkan oleh serverless publishing worker.';
    END IF;

    IF NEW.published_video_url IS DISTINCT FROM OLD.published_video_url AND OLD.published_video_url IS NOT NULL THEN
        RAISE EXCEPTION 'Otorisasi ditolak: Tautan video terpublikasi tidak dapat diubah oleh client.';
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_publishing_job_update ON public.publishing_jobs;
CREATE TRIGGER trg_validate_publishing_job_update
    BEFORE UPDATE ON public.publishing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_publishing_job_client_update();
