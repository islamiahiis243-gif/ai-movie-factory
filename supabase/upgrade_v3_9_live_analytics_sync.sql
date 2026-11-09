-- ============================================================================
-- UPGRADE V3.9 — LIVE ANALYTICS SYNC & PERFORMANCE AGGREGATOR (T9.5)
-- Historical Time-Series Snapshots & Provider Insights Ledger
-- ============================================================================

-- 1. Create creator_analytics_snapshots table
CREATE TABLE IF NOT EXISTS public.creator_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  publishing_job_id UUID REFERENCES public.publishing_jobs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN (
    'youtube', 'tiktok', 'instagram', 'facebook',
    'x_twitter', 'linkedin', 'pinterest', 'snapchat',
    'threads', 'telegram', 'vimeo', 'dailymotion', 'reddit'
  )),
  external_post_id TEXT NOT NULL,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0,
  shares BIGINT NOT NULL DEFAULT 0,
  watch_time_seconds BIGINT DEFAULT NULL,
  avg_view_duration_seconds INTEGER DEFAULT NULL,
  retention_rate NUMERIC(5,2) DEFAULT NULL,
  subscribers_gained INTEGER DEFAULT NULL,
  raw_provider_metrics JSONB,
  sync_source TEXT NOT NULL DEFAULT 'manual_refresh' CHECK (
    sync_source IN ('cron_sync', 'manual_refresh', 'webhook', 'initial_snapshot')
  ),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_user_synced
  ON public.creator_analytics_snapshots(user_id, synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_job_synced
  ON public.creator_analytics_snapshots(publishing_job_id, synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_platform_post
  ON public.creator_analytics_snapshots(platform, external_post_id);

-- 3. Create sync jobs ledger
CREATE TABLE IF NOT EXISTS public.creator_analytics_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'failed')),
  items_synced INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analytics_sync_jobs_user_started
  ON public.creator_analytics_sync_jobs(user_id, started_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.creator_analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_analytics_sync_jobs ENABLE ROW LEVEL SECURITY;

-- 5. Revoke direct mutation rights from clients (Server-Only Writes)
REVOKE INSERT, UPDATE, DELETE ON public.creator_analytics_snapshots FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.creator_analytics_sync_jobs FROM anon, authenticated;
GRANT SELECT ON public.creator_analytics_snapshots TO authenticated;
GRANT SELECT ON public.creator_analytics_sync_jobs TO authenticated;
GRANT ALL ON public.creator_analytics_snapshots TO service_role;
GRANT ALL ON public.creator_analytics_sync_jobs TO service_role;

-- 6. Strict RLS Policies for authenticated users
DROP POLICY IF EXISTS "Users can view own analytics snapshots" ON public.creator_analytics_snapshots;
CREATE POLICY "Users can view own analytics snapshots"
  ON public.creator_analytics_snapshots
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view own analytics sync jobs" ON public.creator_analytics_sync_jobs;
CREATE POLICY "Users can view own analytics sync jobs"
  ON public.creator_analytics_sync_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

COMMENT ON TABLE public.creator_analytics_snapshots IS 'SSOT T9.5: Provider-verified performance metrics snapshots for creator intelligence.';
COMMENT ON TABLE public.creator_analytics_sync_jobs IS 'SSOT T9.5: Audit trail for live analytics sync jobs.';
