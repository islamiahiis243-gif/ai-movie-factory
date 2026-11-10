-- ============================================================================
-- UPGRADE V3.13 — SUPABASE AUTONOMOUS PIPELINE WORKER CRON SCHEDULER
-- Connects Supabase pg_cron & pg_net to /api/pipeline/worker
-- 
-- Architectural Decision:
-- 1. Vercel Hobby plan rejects sub-daily cron triggers with error 3Fpeeb1.
-- 2. Supabase pg_cron & pg_net provides autonomous database-level scheduling 
--    without any extra infrastructure costs.
-- 3. Securely fetches CRON_SECRET from Supabase Vault (vault.decrypted_secrets)
--    so secrets are never logged in plaintext.
-- ============================================================================

-- 1. Ensure required extensions are active
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- 2. Secure Function: Trigger AMF Pipeline Background Worker
CREATE OR REPLACE FUNCTION public.trigger_pipeline_worker()
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

  -- Fallback notice if secret is not yet set in Vault
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE 'Vault secret [cron_secret] not found. Pipeline worker invocation aborted.';
    RETURN NULL;
  END IF;

  -- Fire asynchronous HTTP request via pg_net
  SELECT net.http_post(
    url := v_base_url || '/api/pipeline/worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret,
      'User-Agent', 'Supabase-pg_cron/AMF-1.15.8-PipelineWorker'
    ),
    body := jsonb_build_object(
      'source', 'supabase_pg_cron',
      'job_type', 'pipeline_worker_reconcile',
      'triggered_at', now()
    ),
    timeout_milliseconds := 9500
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- 3. Access Controls: Revoke from public, grant only to service_role and postgres
REVOKE EXECUTE ON FUNCTION public.trigger_pipeline_worker() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_pipeline_worker() TO service_role, postgres;

-- ============================================================================
-- ACTIVATION COMMAND (Execute in Supabase SQL Editor to schedule every 10 min):
-- SELECT cron.schedule('amf-pipeline-worker', '*/10 * * * *', 'SELECT public.trigger_pipeline_worker();');
--
-- TO UNSCHEDULE:
-- SELECT cron.unschedule('amf-pipeline-worker');
-- ============================================================================
