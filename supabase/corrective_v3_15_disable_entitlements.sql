-- ============================================================================
-- CORRECTIVE NON-DESTRUCTIVE RECOVERY: V3.15 OTT ENTITLEMENT ENGINE
-- Phase 6: Web & Independent OTT Publishing Studio (Milestone 2.9.1 Clearance)
--
-- 🛡️ RECOMMENDED ALTERNATIVE TO DESTRUCTIVE ROLLBACK:
-- This script safely quarantines and suspends all client-side and channel-owner
-- access to entitlement tables while PRESERVING 100% of viewer tickets, purchase
-- records, transactions, foreign keys, and audit history.
--
-- Zero tables are dropped, zero data loss occurs.
-- RLS Policy Analysis:
-- Multiple permissive RLS policies evaluate with OR. To guarantee true fail-closed
-- isolation, ALL existing permissive policies are dropped before installing the
-- quarantine policies, and ALL table privileges are revoked from anon, authenticated,
-- and PUBLIC.
-- ============================================================================

BEGIN;

-- 1. Revoke all permissions on entitlement tables from all non-administrative roles
REVOKE ALL ON public.ott_access_passes FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.ott_viewer_subscriptions FROM anon, authenticated, PUBLIC;

-- 2. Drop ALL existing permissive policies to prevent OR-bypass
DROP POLICY IF EXISTS "Viewers can view own access passes" ON public.ott_access_passes;
DROP POLICY IF EXISTS "Channel owners can view channel access passes" ON public.ott_access_passes;
DROP POLICY IF EXISTS "Viewers can view own access passes (suspended)" ON public.ott_access_passes;
DROP POLICY IF EXISTS "quarantine_deny_all_access_passes" ON public.ott_access_passes;

DROP POLICY IF EXISTS "Viewers can view own subscriptions" ON public.ott_viewer_subscriptions;
DROP POLICY IF EXISTS "Channel owners can view channel subscriptions" ON public.ott_viewer_subscriptions;
DROP POLICY IF EXISTS "Viewers can view own subscriptions (suspended)" ON public.ott_viewer_subscriptions;
DROP POLICY IF EXISTS "quarantine_deny_all_viewer_subscriptions" ON public.ott_viewer_subscriptions;

-- 3. Install explicit fail-closed quarantine policies
CREATE POLICY "quarantine_deny_all_access_passes"
    ON public.ott_access_passes
    AS RESTRICTIVE
    FOR ALL
    TO anon, authenticated, PUBLIC
    USING (false)
    WITH CHECK (false);

CREATE POLICY "quarantine_deny_all_viewer_subscriptions"
    ON public.ott_viewer_subscriptions
    AS RESTRICTIVE
    FOR ALL
    TO anon, authenticated, PUBLIC
    USING (false)
    WITH CHECK (false);

-- 4. Preserve full administrative access for backend serverless service_role
GRANT ALL ON public.ott_access_passes TO service_role;
GRANT ALL ON public.ott_viewer_subscriptions TO service_role;

-- 5. Document quarantine state in metadata comments
COMMENT ON TABLE public.ott_access_passes IS 'CORRECTIVE QUARANTINE: 100% historical purchase records preserved; client and owner access paused fail-closed.';
COMMENT ON TABLE public.ott_viewer_subscriptions IS 'CORRECTIVE QUARANTINE: 100% historical subscription records preserved; client and owner access paused fail-closed.';

COMMIT;
