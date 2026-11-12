-- ============================================================================
-- AI MOVIE FACTORY — MILESTONE 3: RELIABILITY, BACKGROUND JOBS & DISTRIBUTION
-- Migration: upgrade_v3_19_pipeline_worker_reliability_and_distribution.sql
-- Description:
-- 1. Adds missing worker reliability columns to public.pipeline_jobs (idempotency, retries, worker fencing, payload)
-- 2. Expands status constraint to support awaiting_approval, paused, and reconciliation_required
-- 3. Implements atomic row-locked worker claiming stored procedure (claim_pipeline_job) with least-privilege security
-- 4. Optimizes performance indexes for background queue polling & dead-letter reconciliation
-- ============================================================================

-- 1. Add Worker Reliability Columns to pipeline_jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pipeline_jobs' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.pipeline_jobs ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pipeline_jobs' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.pipeline_jobs ADD COLUMN idempotency_key TEXT UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pipeline_jobs' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE public.pipeline_jobs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pipeline_jobs' AND column_name = 'max_retries'
  ) THEN
    ALTER TABLE public.pipeline_jobs ADD COLUMN max_retries INTEGER NOT NULL DEFAULT 3;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pipeline_jobs' AND column_name = 'worker_claim_id'
  ) THEN
    ALTER TABLE public.pipeline_jobs ADD COLUMN worker_claim_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pipeline_jobs' AND column_name = 'claimed_at'
  ) THEN
    ALTER TABLE public.pipeline_jobs ADD COLUMN claimed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pipeline_jobs' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.pipeline_jobs ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pipeline_jobs' AND column_name = 'execution_payload'
  ) THEN
    ALTER TABLE public.pipeline_jobs ADD COLUMN execution_payload JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 2. Expand status constraint on public.pipeline_jobs
ALTER TABLE public.pipeline_jobs DROP CONSTRAINT IF EXISTS pipeline_jobs_status_check;
ALTER TABLE public.pipeline_jobs ADD CONSTRAINT pipeline_jobs_status_check CHECK (
  status IN (
    'queued',
    'running',
    'awaiting_approval',
    'in_qc',
    'completed',
    'failed',
    'paused',
    'cancelled',
    'reconciliation_required'
  )
);

-- 3. Optimization Indexes for Queue Polling, Stale Worker Reclaim, and Idempotency
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_status_claimed ON public.pipeline_jobs(status, claimed_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_idempotency ON public.pipeline_jobs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_user_id ON public.pipeline_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_project_status ON public.pipeline_jobs(project_id, status);

-- 4. Atomic Row-Locked Worker Claiming Stored Procedure (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_pipeline_job(
  p_worker_id TEXT,
  p_lease_seconds INT DEFAULT 900
)
RETURNS SETOF public.pipeline_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Lock and claim the oldest queued or expired-lease running job
  SELECT id INTO v_job_id
  FROM public.pipeline_jobs
  WHERE status = 'queued'
     OR (status = 'running' AND (claimed_at IS NULL OR claimed_at < (now() - (p_lease_seconds || ' seconds')::interval)))
  ORDER BY 
    CASE priority 
      WHEN 'urgent' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'normal' THEN 3 
      ELSE 4 
    END ASC,
    created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job_id IS NOT NULL THEN
    RETURN QUERY
    UPDATE public.pipeline_jobs
    SET status = 'running',
        worker_claim_id = p_worker_id,
        claimed_at = now(),
        updated_at = now()
    WHERE id = v_job_id
    RETURNING *;
  END IF;
  RETURN;
END;
$$;

-- 5. Security & Privilege Lockdown: Only service_role can claim background jobs
REVOKE ALL ON FUNCTION public.claim_pipeline_job(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pipeline_job(TEXT, INT) TO service_role;

COMMENT ON FUNCTION public.claim_pipeline_job(TEXT, INT) IS 
  'SSOT Day 3: Atomic row-locked background pipeline job claimant with lease fencing to prevent concurrent double-execution.';
