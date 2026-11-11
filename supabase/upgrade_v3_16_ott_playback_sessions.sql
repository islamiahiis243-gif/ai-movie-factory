-- ============================================================================
-- UPGRADE V3.16: OTT PLAYBACK SESSION & CONCURRENCY CONTROLLER
-- Phase 6: Web & Independent OTT Publishing Studio (Milestone 2.9.2A)
--
-- Strict Architectural Invariants:
-- 1. Control Plane Isolation: Tracks playback sessions, heartbeat leases & concurrent streams.
-- 2. Concurrency Atomicity: Prevents race conditions when multiple player instances launch.
-- 3. Row Level Security: Viewers can only view their own sessions; mutations happen via secure RPC or service_role.
-- 4. 100% Additive & Backward-Compatible: Zero impact on existing tables or Creator SaaS.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. PLAYBACK SESSIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ott_playback_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.ott_channels(id) ON DELETE CASCADE,
    content_id UUID NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('film', 'episode')),
    grant_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'expired', 'revoked')),
    device_fingerprint TEXT,
    ip_hash TEXT,
    user_agent TEXT,
    current_position_seconds NUMERIC(10, 2) DEFAULT 0,
    duration_seconds NUMERIC(10, 2),
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    signed_url_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. PERFORMANCE & CONCURRENCY INDICES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ott_playback_sessions_user_status 
    ON public.ott_playback_sessions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_ott_playback_sessions_grant 
    ON public.ott_playback_sessions(grant_id);

CREATE INDEX IF NOT EXISTS idx_ott_playback_sessions_heartbeat 
    ON public.ott_playback_sessions(last_heartbeat_at);

CREATE INDEX IF NOT EXISTS idx_ott_playback_sessions_content 
    ON public.ott_playback_sessions(content_id, channel_id);

-- ----------------------------------------------------------------------------
-- 3. ATOMIC SESSION ACQUISITION FUNCTION (CONCURRENCY GUARD)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acquire_ott_playback_session(
    p_session_id TEXT,
    p_user_id UUID,
    p_channel_id UUID,
    p_content_id UUID,
    p_content_type TEXT,
    p_grant_id TEXT,
    p_duration_seconds NUMERIC DEFAULT 0,
    p_session_ttl_seconds INT DEFAULT 3600,
    p_max_concurrent_streams INT DEFAULT 1,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_ip_hash TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    active_count INT;
    new_session RECORD;
BEGIN
    -- 1. Row lock on user's active sessions to eliminate concurrent race conditions
    PERFORM 1 FROM public.ott_playback_sessions 
    WHERE user_id = p_user_id 
    FOR UPDATE;

    -- 2. Clean up stale active sessions: mark as expired if no heartbeat for 3 minutes or past expires_at
    UPDATE public.ott_playback_sessions
    SET status = 'expired', updated_at = now()
    WHERE user_id = p_user_id 
      AND status = 'active'
      AND (last_heartbeat_at < (now() - INTERVAL '3 minutes') OR expires_at < now());

    -- 3. Count currently active sessions
    SELECT COUNT(*) INTO active_count
    FROM public.ott_playback_sessions
    WHERE user_id = p_user_id AND status = 'active';

    -- 4. Atomic Concurrency Enforcement:
    -- If active streams >= limit, atomically revoke the oldest active session (FIFO device takeover)
    IF active_count >= p_max_concurrent_streams THEN
        UPDATE public.ott_playback_sessions
        SET status = 'revoked', updated_at = now()
        WHERE id IN (
            SELECT id FROM public.ott_playback_sessions
            WHERE user_id = p_user_id AND status = 'active'
            ORDER BY created_at ASC
            LIMIT (active_count - p_max_concurrent_streams + 1)
        );
    END IF;

    -- 5. Insert new active session
    INSERT INTO public.ott_playback_sessions (
        session_id,
        user_id,
        channel_id,
        content_id,
        content_type,
        grant_id,
        duration_seconds,
        expires_at,
        device_fingerprint,
        ip_hash,
        user_agent,
        last_heartbeat_at,
        status
    ) VALUES (
        p_session_id,
        p_user_id,
        p_channel_id,
        p_content_id,
        p_content_type,
        p_grant_id,
        COALESCE(p_duration_seconds, 0),
        now() + (p_session_ttl_seconds || ' seconds')::INTERVAL,
        p_device_fingerprint,
        p_ip_hash,
        p_user_agent,
        now(),
        'active'
    )
    RETURNING * INTO new_session;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', new_session.session_id,
        'expires_at', new_session.expires_at,
        'status', new_session.status
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. ATOMIC HEARTBEAT & LEASE RENEWAL FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.heartbeat_ott_playback_session(
    p_session_id TEXT,
    p_user_id UUID,
    p_current_position_seconds NUMERIC DEFAULT NULL,
    p_extend_seconds INT DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sess RECORD;
BEGIN
    SELECT * INTO sess FROM public.ott_playback_sessions
    WHERE session_id = p_session_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'SESSION_NOT_FOUND', 'reason', 'Sesi pemutaran tidak ditemukan.');
    END IF;

    IF sess.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'code', 'SESSION_NOT_ACTIVE', 'reason', 'Sesi tidak lagi aktif (status: ' || sess.status || ').');
    END IF;

    IF sess.expires_at < now() THEN
        UPDATE public.ott_playback_sessions SET status = 'expired', updated_at = now() WHERE id = sess.id;
        RETURN jsonb_build_object('success', false, 'code', 'SESSION_EXPIRED', 'reason', 'Sesi pemutaran telah kedaluwarsa.');
    END IF;

    UPDATE public.ott_playback_sessions
    SET last_heartbeat_at = now(),
        current_position_seconds = COALESCE(p_current_position_seconds, current_position_seconds),
        expires_at = GREATEST(expires_at, now() + (p_extend_seconds || ' seconds')::INTERVAL),
        updated_at = now()
    WHERE id = sess.id
    RETURNING * INTO sess;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', sess.session_id,
        'current_position_seconds', sess.current_position_seconds,
        'last_heartbeat_at', sess.last_heartbeat_at,
        'expires_at', sess.expires_at,
        'status', sess.status
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. ATOMIC SESSION TERMINATION FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.terminate_ott_playback_session(
    p_session_id TEXT,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sess RECORD;
BEGIN
    UPDATE public.ott_playback_sessions
    SET status = 'completed', updated_at = now()
    WHERE session_id = p_session_id AND user_id = p_user_id
    RETURNING * INTO sess;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'SESSION_NOT_FOUND', 'reason', 'Sesi tidak ditemukan.');
    END IF;

    RETURN jsonb_build_object('success', true, 'session_id', sess.session_id, 'status', sess.status);
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.ott_playback_sessions ENABLE ROW LEVEL SECURITY;

-- Revoke direct table mutations from untrusted clients
REVOKE ALL ON public.ott_playback_sessions FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.ott_playback_sessions TO authenticated;
GRANT ALL ON public.ott_playback_sessions TO service_role;

DROP POLICY IF EXISTS "Viewers can view own playback sessions" ON public.ott_playback_sessions;
CREATE POLICY "Viewers can view own playback sessions"
    ON public.ott_playback_sessions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

-- Grant execute on security definer RPC functions
GRANT EXECUTE ON FUNCTION public.acquire_ott_playback_session TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_ott_playback_session TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.terminate_ott_playback_session TO authenticated, service_role;

COMMIT;
