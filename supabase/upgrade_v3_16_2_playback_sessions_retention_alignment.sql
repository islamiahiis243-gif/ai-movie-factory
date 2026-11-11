-- ============================================================================
-- UPGRADE V3.16.2: OTT PLAYBACK SESSIONS RETENTION & STATUS ALIGNMENT
-- Phase 6: Web & Independent OTT Publishing Studio (Milestone 2.9.2B Hardening)
--
-- Enhancements:
-- 1. Status Constraint Expansion: Adds 'terminated' alongside 'completed', 'expired',
--    and 'revoked' to ott_playback_sessions_status_check so all terminal states are recognized.
-- 2. Unified Stale Retention Purge: Ensures purge_stale_playback_sessions() covers
--    ALL terminal statuses ('completed', 'terminated', 'expired', 'revoked')
--    while strictly protecting 'active' and 'paused' sessions.
-- 3. Flexible Termination Procedure: Updates terminate_ott_playback_session()
--    to support both 'completed' and 'terminated' cleanly.
-- 4. Principle of Least Privilege: Re-verifies EXECUTE grants strictly to service_role.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. EXPAND STATUS CHECK CONSTRAINT
-- ----------------------------------------------------------------------------
ALTER TABLE public.ott_playback_sessions
    DROP CONSTRAINT IF EXISTS ott_playback_sessions_status_check;

ALTER TABLE public.ott_playback_sessions
    ADD CONSTRAINT ott_playback_sessions_status_check
    CHECK (status IN ('active', 'paused', 'completed', 'terminated', 'expired', 'revoked'));

-- ----------------------------------------------------------------------------
-- 2. HARDENED ATOMIC SESSION TERMINATION (SUPPORTS BOTH 'completed' & 'terminated')
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.terminate_ott_playback_session(
    p_session_id TEXT,
    p_user_id UUID,
    p_terminal_status TEXT DEFAULT 'completed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sess RECORD;
    target_status TEXT;
BEGIN
    -- Defense-in-depth: caller check
    IF auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Akses ditolak: Anda tidak memiliki wewenang untuk sesi penonton lain.';
    END IF;

    -- Validate target status
    IF p_terminal_status NOT IN ('completed', 'terminated') THEN
        target_status := 'completed';
    ELSE
        target_status := p_terminal_status;
    END IF;

    -- Advisory lock to serialize termination
    PERFORM pg_advisory_xact_lock(hashtext(p_session_id));

    UPDATE public.ott_playback_sessions
    SET status = target_status, updated_at = now()
    WHERE session_id = p_session_id AND user_id = p_user_id
    RETURNING * INTO sess;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'SESSION_NOT_FOUND', 'reason', 'Sesi tidak ditemukan.');
    END IF;

    RETURN jsonb_build_object('success', true, 'session_id', sess.session_id, 'status', sess.status);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. UNIFIED STALE SESSION RETENTION PURGE FUNCTION (ALL TERMINAL STATUSES)
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
    -- Delete all terminal sessions that exceed the retention period (default 30 days)
    -- Terminal statuses: 'completed', 'terminated', 'expired', 'revoked'
    -- Active & paused sessions are strictly protected and never deleted!
    DELETE FROM public.ott_playback_sessions
    WHERE status IN ('completed', 'terminated', 'expired', 'revoked')
      AND updated_at < (now() - (p_days_to_keep || ' days')::INTERVAL);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. LEAST PRIVILEGE REVOCATIONS & SERVICE_ROLE GRANTS
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.terminate_ott_playback_session(TEXT, UUID, TEXT) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_stale_playback_sessions(INT) FROM anon, authenticated, PUBLIC;

GRANT EXECUTE ON FUNCTION public.terminate_ott_playback_session(TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_stale_playback_sessions(INT) TO service_role;

COMMIT;
