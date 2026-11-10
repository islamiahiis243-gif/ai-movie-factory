-- ============================================================================
-- ROLLBACK V3.15 — OTT CONTENT ACCESS CONTROL & ENTITLEMENT ENGINE
-- Phase 6: Web & Independent OTT Publishing Studio (Milestone 2.9.1 Rollback)
--
-- Safely reverts the entitlement tables, triggers, and RLS policies.
-- Does not touch existing Creator SaaS billing (subscriptions, payment_orders).
-- ============================================================================

BEGIN;

-- 1. Drop audit and integrity triggers
DROP TRIGGER IF EXISTS trg_ott_access_pass_integrity ON public.ott_access_passes;
DROP TRIGGER IF EXISTS trg_ott_access_passes_updated_at ON public.ott_access_passes;
DROP TRIGGER IF EXISTS trg_ott_viewer_subs_updated_at ON public.ott_viewer_subscriptions;

-- 2. Drop functions
DROP FUNCTION IF EXISTS public.check_ott_access_pass_channel_integrity();

-- 3. Drop tables (Cascade handles policies and indexes automatically)
DROP TABLE IF EXISTS public.ott_access_passes CASCADE;
DROP TABLE IF EXISTS public.ott_viewer_subscriptions CASCADE;

COMMIT;
