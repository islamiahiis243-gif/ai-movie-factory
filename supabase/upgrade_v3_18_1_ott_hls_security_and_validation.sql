-- ==============================================================================
-- Migration: upgrade_v3_18_1_ott_hls_security_and_validation.sql
-- Milestone: 2.9.2D — HLS Security Hardening & Strict Pipeline Validation
-- Resolves ChatGPT Review Findings: RPC Privilege Lockdown & Job Validation
-- ==============================================================================

-- 1. Recreate complete_ott_transcoding_job with strict validation guards
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
    v_content_found BOOLEAN := false;
BEGIN
    -- Input sanitization
    IF p_master_playlist_path IS NULL OR trim(p_master_playlist_path) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_PLAYLIST_PATH',
            'message', 'Master playlist path cannot be empty.'
        );
    END IF;

    IF NOT (p_master_playlist_path LIKE '%.m3u8') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_PLAYLIST_EXTENSION',
            'message', 'Master playlist path must terminate with .m3u8'
        );
    END IF;

    -- Lock and retrieve the job
    SELECT * INTO v_job
    FROM public.ott_transcoding_jobs
    WHERE id = p_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'JOB_NOT_FOUND',
            'message', 'Transcoding job with specified ID does not exist.'
        );
    END IF;

    -- Job state guard: Only allow transition from queued or processing
    IF v_job.status NOT IN ('queued', 'processing') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ILLEGAL_JOB_TRANSITION',
            'message', 'Job is already in final state: ' || v_job.status
        );
    END IF;

    -- Verify target catalog item exists
    IF v_job.content_type = 'film' THEN
        SELECT EXISTS(SELECT 1 FROM public.ott_films WHERE id = v_job.content_id) INTO v_content_found;
        IF NOT v_content_found THEN
            RETURN jsonb_build_object('success', false, 'error', 'CATALOG_ITEM_NOT_FOUND');
        END IF;

        UPDATE public.ott_films
        SET hls_master_playlist_url = p_master_playlist_path,
            transcoding_status = 'ready',
            available_resolutions = p_available_resolutions,
            transcoded_at = now(),
            updated_at = now()
        WHERE id = v_job.content_id;

    ELSIF v_job.content_type = 'episode' THEN
        SELECT EXISTS(SELECT 1 FROM public.ott_episodes WHERE id = v_job.content_id) INTO v_content_found;
        IF NOT v_content_found THEN
            RETURN jsonb_build_object('success', false, 'error', 'CATALOG_ITEM_NOT_FOUND');
        END IF;

        UPDATE public.ott_episodes
        SET hls_master_playlist_url = p_master_playlist_path,
            transcoding_status = 'ready',
            available_resolutions = p_available_resolutions,
            transcoded_at = now(),
            updated_at = now()
        WHERE id = v_job.content_id;
    END IF;

    -- Update job to completed status
    UPDATE public.ott_transcoding_jobs
    SET status = 'completed',
        progress_percent = 100,
        master_playlist_path = p_master_playlist_path,
        completed_at = now(),
        updated_at = now()
    WHERE id = p_job_id;

    RETURN jsonb_build_object(
        'success', true,
        'job_id', p_job_id,
        'content_id', v_job.content_id,
        'content_type', v_job.content_type,
        'master_playlist_url', p_master_playlist_path,
        'status', 'ready'
    );
END;
$$;

-- Strict Privilege Lockdown: Revoke from authenticated and anon, grant ONLY to service_role
REVOKE ALL ON FUNCTION public.complete_ott_transcoding_job(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ott_transcoding_job(UUID, TEXT, JSONB) TO service_role;
