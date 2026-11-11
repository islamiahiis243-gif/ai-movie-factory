-- ==============================================================================
-- Migration: upgrade_v3_18_ott_hls_adaptive_streaming.sql
-- Milestone: 2.9.2D — HLS Adaptive Bitrate Streaming & Transcoding Pipeline
-- Master Blueprint Gelombang II: Bagian IV.4 (Arsitektur Video Streaming & Keamanan Konten)
-- ==============================================================================

-- 1. Extend ott_films with HLS Adaptive Bitrate columns
ALTER TABLE public.ott_films
    ADD COLUMN IF NOT EXISTS hls_master_playlist_url TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS transcoding_status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (transcoding_status IN ('not_started', 'queued', 'processing', 'ready', 'failed')),
    ADD COLUMN IF NOT EXISTS available_resolutions JSONB NOT NULL DEFAULT '["1080p"]'::jsonb,
    ADD COLUMN IF NOT EXISTS transcoded_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Extend ott_episodes with HLS Adaptive Bitrate columns
ALTER TABLE public.ott_episodes
    ADD COLUMN IF NOT EXISTS hls_master_playlist_url TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS transcoding_status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (transcoding_status IN ('not_started', 'queued', 'processing', 'ready', 'failed')),
    ADD COLUMN IF NOT EXISTS available_resolutions JSONB NOT NULL DEFAULT '["1080p"]'::jsonb,
    ADD COLUMN IF NOT EXISTS transcoded_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Create table for tracking HLS transcoding pipeline jobs
CREATE TABLE IF NOT EXISTS public.ott_transcoding_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.ott_channels(id) ON DELETE CASCADE,
    content_id UUID NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('film', 'episode')),
    source_video_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    target_resolutions JSONB NOT NULL DEFAULT '["1080p", "720p", "480p", "360p"]'::jsonb,
    hls_output_prefix TEXT NOT NULL,
    master_playlist_path TEXT DEFAULT NULL,
    progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    error_message TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ DEFAULT NULL,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create indexes for efficient queue management & content lookups
CREATE INDEX IF NOT EXISTS idx_ott_transcoding_jobs_content 
    ON public.ott_transcoding_jobs(content_type, content_id);

CREATE INDEX IF NOT EXISTS idx_ott_transcoding_jobs_status 
    ON public.ott_transcoding_jobs(status, created_at);

-- 5. Row-Level Security on ott_transcoding_jobs
ALTER TABLE public.ott_transcoding_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transcoding jobs" ON public.ott_transcoding_jobs;
CREATE POLICY "Users can view own transcoding jobs"
    ON public.ott_transcoding_jobs
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transcoding jobs" ON public.ott_transcoding_jobs;
CREATE POLICY "Users can insert own transcoding jobs"
    ON public.ott_transcoding_jobs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manage transcoding jobs" ON public.ott_transcoding_jobs;
CREATE POLICY "Service role manage transcoding jobs"
    ON public.ott_transcoding_jobs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. Atomic Stored Procedure: Complete Transcoding Job & Publish HLS Ladder
CREATE OR REPLACE FUNCTION public.complete_ott_transcoding_job(
    p_job_id UUID,
    p_master_playlist_path TEXT,
    p_available_resolutions JSONB DEFAULT '["1080p", "720p", "480p", "360p"]'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job public.ott_transcoding_jobs%ROWTYPE;
BEGIN
    SELECT * INTO v_job
    FROM public.ott_transcoding_jobs
    WHERE id = p_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'JOB_NOT_FOUND');
    END IF;

    -- Update job to completed status
    UPDATE public.ott_transcoding_jobs
    SET status = 'completed',
        progress_percent = 100,
        master_playlist_path = p_master_playlist_path,
        completed_at = now(),
        updated_at = now()
    WHERE id = p_job_id;

    -- Update parent catalog item
    IF v_job.content_type = 'film' THEN
        UPDATE public.ott_films
        SET hls_master_playlist_url = p_master_playlist_path,
            transcoding_status = 'ready',
            available_resolutions = p_available_resolutions,
            transcoded_at = now(),
            updated_at = now()
        WHERE id = v_job.content_id;
    ELSIF v_job.content_type = 'episode' THEN
        UPDATE public.ott_episodes
        SET hls_master_playlist_url = p_master_playlist_path,
            transcoding_status = 'ready',
            available_resolutions = p_available_resolutions,
            transcoded_at = now(),
            updated_at = now()
        WHERE id = v_job.content_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'job_id', p_job_id,
        'content_id', v_job.content_id,
        'content_type', v_job.content_type,
        'master_playlist_url', p_master_playlist_path
    );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_ott_transcoding_job(UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_ott_transcoding_job(UUID, TEXT, JSONB) TO authenticated, service_role;
