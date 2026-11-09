-- ============================================================================
-- UPGRADE V3.10 — SUPABASE ZERO-COST CRON SCHEDULER & SECURE WORKER INVOKER
-- Enables database-level autonomous scheduling via pg_cron & pg_net
-- Integrates with Supabase Vault to protect CRON_SECRET from log exposure.
-- ============================================================================

-- 1. Ensure required extensions are active
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- 2. Secure Function: Trigger AMF Publishing Worker (T9.4)
CREATE OR REPLACE FUNCTION public.trigger_publishing_worker()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_secret TEXT;
  v_base_url TEXT := 'https://ai-movie-factory.vercel.app';
  v_request_id BIGINT;
BEGIN
  -- Retrieve worker secret securely from Supabase Vault
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  -- Fallback to service role if cron_secret is not explicitly set in Vault
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE 'Vault secret [cron_secret] not found. Worker invocation aborted.';
    RETURN NULL;
  END IF;

  -- Fire asynchronous HTTP request via pg_net
  SELECT net.http_post(
    url := v_base_url || '/api/publishing/worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret,
      'User-Agent', 'Supabase-pg_cron/AMF-1.15.7'
    ),
    body := jsonb_build_object(
      'source', 'supabase_pg_cron',
      'triggered_at', now()
    ),
    timeout_milliseconds := 9000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- 3. Secure Function: Trigger AMF Analytics Sync Worker (T9.5)
CREATE OR REPLACE FUNCTION public.trigger_analytics_sync_worker()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_secret TEXT;
  v_base_url TEXT := 'https://ai-movie-factory.vercel.app';
  v_request_id BIGINT;
BEGIN
  -- Retrieve worker secret securely from Supabase Vault
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE 'Vault secret [cron_secret] not found. Analytics sync aborted.';
    RETURN NULL;
  END IF;

  -- Fire asynchronous HTTP request via pg_net
  SELECT net.http_post(
    url := v_base_url || '/api/analytics/sync-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret,
      'User-Agent', 'Supabase-pg_cron/AMF-1.15.7'
    ),
    body := jsonb_build_object(
      'source', 'supabase_pg_cron',
      'triggered_at', now()
    ),
    timeout_milliseconds := 9000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- 4. Access controls: Revoke from public/authenticated, grant only to service_role and postgres
REVOKE EXECUTE ON FUNCTION public.trigger_publishing_worker() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_analytics_sync_worker() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_publishing_worker() TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.trigger_analytics_sync_worker() TO service_role, postgres;

-- ============================================================================
-- ACTIVATION STATEMENTS (DO NOT ACTIVATE AUTOMATICALLY WITHOUT OWNER CONFIRMATION)
-- To activate scheduling in Supabase, first set the secret in Vault:
--   SELECT vault.create_secret('YOUR_CRON_SECRET', 'cron_secret', 'AMF Worker Authorization Secret');
--
-- Then schedule the cron jobs:
--   SELECT cron.schedule('amf-publishing-worker', '*/10 * * * *', 'SELECT public.trigger_publishing_worker();');
--   SELECT cron.schedule('amf-analytics-sync-worker', '0 */4 * * *', 'SELECT public.trigger_analytics_sync_worker();');
--
-- To pause/unschedule:
--   SELECT cron.unschedule('amf-publishing-worker');
--   SELECT cron.unschedule('amf-analytics-sync-worker');
--
-- Diagnostics:
--   SELECT * FROM cron.job;
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--   SELECT * FROM net._http_response ORDER BY id DESC LIMIT 20;
-- ============================================================================
