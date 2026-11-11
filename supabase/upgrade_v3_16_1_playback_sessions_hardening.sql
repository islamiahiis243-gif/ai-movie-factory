-- ============================================================================
-- UPGRADE V3.16.1: OTT PLAYBACK SESSIONS SECURITY & CONCURRENCY HARDENING
-- Phase 6: Web & Independent OTT Publishing Studio (Milestone 2.9.2A Hardening)
--
-- Security Enhancements:
-- 1. Atomic Advisory Locking: Uses pg_advisory_xact_lock(hashtext(user_id)) to guarantee
--    transaction serialization even when a viewer has 0 existing session rows.
-- 2. Principle of Least Privilege: REVOKES direct execute from anon, authenticated, and PUBLIC.
--    Execution is granted strictly to service_role (Control Plane Serverless API only).
-- 3. Ownership Defense-in-Depth: Asserts auth.uid() = p_user_id if invoked under authenticated context.
-- 4. Session Retention: Adds purge_stale_playback_sessions() for maintenance.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. HARDENED ATOMIC SESSION ACQUISITION (WITH TRANSACTIONAL ADVISORY LOCK)
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
    -- 1. Defense-in-depth ownership check: if authenticated caller, must match p_user_id
    IF auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Akses ditolak: Anda tidak memiliki wewenang untuk sesi penonton lain (Identity Spoofing Blocked).';
    END IF;

    -- 2. Transactional Advisory Lock on hashed user_id:
    -- Guarantees strict serialization across concurrent requests EVEN WHEN 0 rows exist!
    PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

    -- 3. Also lock any existing rows for this user
    PERFORM 1 FROM public.ott_playback_sessions 
    WHERE user_id = p_user_id 
    FOR UPDATE;

    -- 4. Clean up stale active sessions: mark as expired if no heartbeat for 3 minutes or past expires_at
    UPDATE public.ott_playback_sessions
    SET status = 'expired', updated_at = now()
    WHERE user_id = p_user_id 
      AND status = 'active'
      AND (last_heartbeat_at < (now() - INTERVAL '3 minutes') OR expires_at < now());

    -- 5. Count currently active sessions
    SELECT COUNT(*) INTO active_count
    FROM public.ott_playback_sessions
    WHERE user_id = p_user_id AND status = 'active';

    -- 6. Atomic Concurrency Enforcement:
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

    -- 7. Insert new active session
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
-- 2. HARDENED ATOMIC HEARTBEAT & LEASE RENEWAL
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
    -- Defense-in-depth: caller check
    IF auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Akses ditolak: Anda tidak memiliki wewenang untuk sesi penonton lain.';
    END IF;

    -- Transactional Advisory Lock on hashed session_id
    PERFORM pg_advisory_xact_lock(hashtext(p_session_id));

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
-- 3. HARDENED ATOMIC SESSION TERMINATION
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
    -- Defense-in-depth: caller check
    IF auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Akses ditolak: Anda tidak memiliki wewenang untuk sesi penonton lain.';
    END IF;

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
-- 4. STALE SESSION RETENTION PURGE FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_stale_playback_sessions(
    p_days_to_keep INT DEFAULT 30
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM public.ott_playback_sessions
    WHERE status IN ('completed', 'expired', 'revoked')
      AND updated_at < (now() - (p_days_to_keep || ' days')::INTERVAL);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. LEAST PRIVILEGE REVOCATIONS & SERVICE_ROLE GRANTS
-- ----------------------------------------------------------------------------
-- Strictly revoke direct execution from anon, authenticated, and PUBLIC.
-- Only serverless backend control plane (service_role) can execute these RPC functions.
REVOKE EXECUTE ON FUNCTION public.acquire_ott_playback_session FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.heartbeat_ott_playback_session FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.terminate_ott_playback_session FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_stale_playback_sessions FROM anon, authenticated, PUBLIC;

GRANT EXECUTE ON FUNCTION public.acquire_ott_playback_session TO service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_ott_playback_session TO service_role;
GRANT EXECUTE ON FUNCTION public.terminate_ott_playback_session TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_stale_playback_sessions TO service_role;

COMMIT;
