-- ============================================================================
-- UPGRADE V3.12 — FINANCIAL INFRASTRUCTURE METRICS & ANALYTICS AGGREGATOR
-- Phases 3, 4, 5 & 6 — Usage Metering, Provider Cost, and Financial Analytics
-- ============================================================================

-- 1. Enhance ai_usage_records with granular token & media telemetry
ALTER TABLE public.ai_usage_records 
  ADD COLUMN IF NOT EXISTS cached_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_duration_seconds NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS audio_duration_seconds NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_duration_ms INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paid_equivalent_cost_usd NUMERIC(10,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS exchange_rate_idr NUMERIC(10,2) DEFAULT 16000.00;

CREATE INDEX IF NOT EXISTS idx_ai_usage_records_model 
  ON public.ai_usage_records(model, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_records_operation 
  ON public.ai_usage_records(operation, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_records_cost_status 
  ON public.ai_usage_records(cost_status, created_at DESC);

-- 2. Stored Procedure: Admin Financial Aggregator
CREATE OR REPLACE FUNCTION public.get_financial_summary_metrics(
  p_start_date TIMESTAMPTZ DEFAULT (now() - interval '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  total_billed_provider_cost_usd NUMERIC,
  total_paid_equivalent_cost_usd NUMERIC,
  total_prompt_tokens BIGINT,
  total_candidates_tokens BIGINT,
  total_tokens BIGINT,
  total_credits_reserved BIGINT,
  total_credits_charged BIGINT,
  total_operations_count BIGINT,
  free_tier_operations_count BIGINT,
  failed_operations_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(r.provider_cost_usd), 0)::NUMERIC,
    COALESCE(SUM(r.paid_equivalent_cost_usd), 0)::NUMERIC,
    COALESCE(SUM(r.prompt_tokens), 0)::BIGINT,
    COALESCE(SUM(r.candidates_tokens), 0)::BIGINT,
    COALESCE(SUM(r.total_tokens), 0)::BIGINT,
    COALESCE(SUM(r.credits_reserved), 0)::BIGINT,
    COALESCE(SUM(r.credits_charged), 0)::BIGINT,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE r.cost_status = 'free_tier')::BIGINT,
    COUNT(*) FILTER (WHERE r.status = 'failed')::BIGINT
  FROM public.ai_usage_records r
  WHERE r.created_at >= p_start_date
    AND r.created_at <= p_end_date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_financial_summary_metrics(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role, postgres;
REVOKE EXECUTE ON FUNCTION public.get_financial_summary_metrics(TIMESTAMPTZ, TIMESTAMPTZ) FROM public, anon, authenticated;
