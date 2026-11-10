-- ============================================================================
-- EMERGENCY DESTRUCTIVE ROLLBACK: V3.15 OTT ENTITLEMENT ENGINE
-- Phase 6: Web & Independent OTT Publishing Studio (Milestone 2.9.1)
--
-- ⚠️ CRITICAL OPERATIONAL SAFETY WARNING:
-- 1. DO NOT EXECUTE THIS SCRIPT AS A ROUTINE PROCEDURE.
-- 2. THIS SCRIPT IS DESTRUCTIVE TO VIEWER DATA: Dropping ott_access_passes and 
--    ott_viewer_subscriptions will PERMANENTLY ERASE all active viewer tickets,
--    rental windows, purchase histories, and subscription records.
-- 3. CASCADE IMPACT INVENTORY:
--    - Dependent objects automatically dropped:
--      * Triggers: trg_ott_access_pass_integrity, trg_ott_access_passes_updated_at,
--                  trg_ott_viewer_subs_updated_at
--      * Functions: public.check_ott_access_pass_channel_integrity()
--      * RLS Policies: All 4 viewer and channel owner SELECT policies
--      * Indexes: idx_ott_access_passes_user_content, idx_ott_access_passes_channel,
--                 idx_ott_access_passes_validity, idx_ott_viewer_subs_user_channel,
--                 idx_ott_viewer_subs_channel, idx_ott_viewer_subs_period
--      * Any future foreign keys or analytical views referencing these tables.
-- 4. PRE-CONDITION MANDATE:
--    - A complete physical/logical database backup (pg_dump -t public.ott_access_passes
--      -t public.ott_viewer_subscriptions) MUST be verified before execution.
--    - For non-destructive emergency deactivation, PREFER corrective_v3_15_disable_entitlements.sql.
-- ============================================================================

BEGIN;

-- 1. Drop audit and integrity triggers explicitly
DROP TRIGGER IF EXISTS trg_ott_access_pass_integrity ON public.ott_access_passes;
DROP TRIGGER IF EXISTS trg_ott_access_passes_updated_at ON public.ott_access_passes;
DROP TRIGGER IF EXISTS trg_ott_viewer_subs_updated_at ON public.ott_viewer_subscriptions;

-- 2. Drop integrity validation function
DROP FUNCTION IF EXISTS public.check_ott_access_pass_channel_integrity();

-- 3. Destructive drop of entitlement tables
-- CAUTION: Irrevocably destroys viewer purchase history and active tickets
DROP TABLE IF EXISTS public.ott_access_passes CASCADE;
DROP TABLE IF EXISTS public.ott_viewer_subscriptions CASCADE;

COMMIT;
