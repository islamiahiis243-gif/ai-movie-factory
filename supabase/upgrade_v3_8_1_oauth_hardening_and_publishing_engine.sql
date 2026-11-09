-- ============================================================================
-- UPGRADE V3.8.1 — OAUTH SECURITY HARDENING & PUBLISHING ENGINE ENHANCEMENT
-- ============================================================================

-- 1. Create one-time OAuth state transactions table (T9.3.1)
CREATE TABLE IF NOT EXISTS public.oauth_state_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  state_token TEXT NOT NULL UNIQUE,
  redirect_uri TEXT NOT NULL,
  code_verifier TEXT,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_state_tx_token ON public.oauth_state_transactions(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_state_tx_user_platform ON public.oauth_state_transactions(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_oauth_state_tx_consumed_expires ON public.oauth_state_transactions(consumed_at, expires_at);

ALTER TABLE public.oauth_state_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.oauth_state_transactions FROM anon, authenticated;
GRANT ALL ON TABLE public.oauth_state_transactions TO service_role;

DROP POLICY IF EXISTS "Deny all client access to oauth_state_transactions" ON public.oauth_state_transactions;
CREATE POLICY "Deny all client access to oauth_state_transactions"
  ON public.oauth_state_transactions FOR ALL TO anon, authenticated USING (false);

-- 2. Enhance platform_oauth_tokens table for reliable revocation lifecycle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_oauth_tokens' AND column_name = 'revoked_at'
  ) THEN
    ALTER TABLE public.platform_oauth_tokens ADD COLUMN revoked_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_oauth_tokens' AND column_name = 'remote_revocation_status'
  ) THEN
    ALTER TABLE public.platform_oauth_tokens ADD COLUMN remote_revocation_status TEXT DEFAULT 'unsupported';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'platform_oauth_tokens' AND column_name = 'remote_revocation_error'
  ) THEN
    ALTER TABLE public.platform_oauth_tokens ADD COLUMN remote_revocation_error TEXT;
  END IF;
END $$;

-- 3. Harden Sanitized View with Strict User Isolation and Security Barrier
DROP VIEW IF EXISTS public.creator_connected_platforms;
CREATE VIEW public.creator_connected_platforms
WITH (security_barrier = true) AS
  SELECT
    id,
    user_id,
    platform,
    provider_account_id,
    provider_account_name,
    provider_avatar_url,
    connection_status,
    token_expires_at,
    granted_scopes,
    created_at,
    updated_at
  FROM public.platform_oauth_tokens
  WHERE (auth.uid() = user_id OR public.is_platform_admin(auth.uid()))
    AND connection_status NOT IN ('disconnected', 'revoked');

GRANT SELECT ON public.creator_connected_platforms TO authenticated;

-- 4. Enhance publishing_jobs table for idempotent worker processing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'publishing_jobs' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.publishing_jobs ADD COLUMN idempotency_key TEXT UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'publishing_jobs' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE public.publishing_jobs ADD COLUMN started_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'publishing_jobs' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE public.publishing_jobs ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'publishing_jobs' AND column_name = 'provider_response_summary'
  ) THEN
    ALTER TABLE public.publishing_jobs ADD COLUMN provider_response_summary JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'publishing_jobs' AND column_name = 'worker_claim_id'
  ) THEN
    ALTER TABLE public.publishing_jobs ADD COLUMN worker_claim_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'publishing_jobs' AND column_name = 'claimed_at'
  ) THEN
    ALTER TABLE public.publishing_jobs ADD COLUMN claimed_at TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON TABLE public.oauth_state_transactions IS 'SSOT T9.3.1: Server-side one-time OAuth state transactions for replay prevention.';
COMMENT ON VIEW public.creator_connected_platforms IS 'SSOT T9.3.1: Security-barrier protected sanitized connection metadata view with strict user isolation.';
