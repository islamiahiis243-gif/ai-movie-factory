-- ============================================================================
-- CORRECTIVE NON-DESTRUCTIVE RECOVERY: V3.15 OTT ENTITLEMENT ENGINE
-- Phase 6: Web & Independent OTT Publishing Studio (Milestone 2.9.1)
--
-- 🛡️ RECOMMENDED ALTERNATIVE TO DESTRUCTIVE ROLLBACK:
-- This script safely suspends client-side access to entitlement features
-- while PRESERVING 100% of viewer tickets, purchase records, and audit history.
-- No tables are dropped, zero data loss occurs.
-- ============================================================================

BEGIN;

-- 1. Suspend direct authenticated SELECT access on entitlement tables
-- (Service role retains full access for administrative data inspection)
REVOKE SELECT ON public.ott_access_passes FROM authenticated;
REVOKE SELECT ON public.ott_viewer_subscriptions FROM authenticated;

-- 2. Replace RLS policies with fail-closed denial policies
DROP POLICY IF EXISTS "Viewers can view own access passes" ON public.ott_access_passes;
CREATE POLICY "Viewers can view own access passes (suspended)"
    ON public.ott_access_passes
    FOR SELECT
    TO authenticated
    USING (false);

DROP POLICY IF EXISTS "Viewers can view own subscriptions" ON public.ott_viewer_subscriptions;
CREATE POLICY "Viewers can view own subscriptions (suspended)"
    ON public.ott_viewer_subscriptions
    FOR SELECT
    TO authenticated
    USING (false);

-- 3. Document corrective state in comment
COMMENT ON TABLE public.ott_access_passes IS 'CORRECTIVE SUSPENDED: Tables and historical data intact; client access paused.';
COMMENT ON TABLE public.ott_viewer_subscriptions IS 'CORRECTIVE SUSPENDED: Tables and historical data intact; client access paused.';

COMMIT;
