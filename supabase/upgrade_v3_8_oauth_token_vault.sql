-- ============================================================================
-- UPGRADE V3.8 — ENCRYPTED PLATFORM OAUTH TOKEN VAULT (T9.3)
-- Authenticated Symmetric Encryption Architecture & Zero Client Exposure
-- ============================================================================

-- 1. Create the platform_oauth_tokens vault table
CREATE TABLE IF NOT EXISTS public.platform_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN (
    'youtube', 'tiktok', 'instagram', 'facebook',
    'x_twitter', 'linkedin', 'pinterest', 'snapchat',
    'threads', 'telegram', 'vimeo', 'dailymotion', 'reddit'
  )),
  provider_account_id TEXT NOT NULL,
  provider_account_name TEXT NOT NULL DEFAULT '',
  provider_avatar_url TEXT,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  granted_scopes TEXT[] NOT NULL DEFAULT '{}',
  connection_status TEXT NOT NULL DEFAULT 'connected' CHECK (
    connection_status IN ('connected', 'needs_reauth', 'revoked', 'expired')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_oauth_tokens_unique_account UNIQUE (user_id, platform, provider_account_id)
);

-- 2. Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_platform_oauth_tokens_user_platform
  ON public.platform_oauth_tokens(user_id, platform);

CREATE INDEX IF NOT EXISTS idx_platform_oauth_tokens_status
  ON public.platform_oauth_tokens(connection_status);

-- 3. Trigger for automatic timestamp update
CREATE OR REPLACE FUNCTION public.set_platform_oauth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_platform_oauth_tokens_updated_at ON public.platform_oauth_tokens;
CREATE TRIGGER trg_platform_oauth_tokens_updated_at
  BEFORE UPDATE ON public.platform_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_platform_oauth_tokens_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.platform_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- 5. ZERO CLIENT EXPOSURE: Revoke direct client access to base vault
REVOKE ALL ON TABLE public.platform_oauth_tokens FROM anon, authenticated;
GRANT ALL ON TABLE public.platform_oauth_tokens TO service_role;

-- 6. Strict RLS Policies for base table
DROP POLICY IF EXISTS "Deny all direct anon access to oauth vault" ON public.platform_oauth_tokens;
CREATE POLICY "Deny all direct anon access to oauth vault"
  ON public.platform_oauth_tokens
  FOR ALL
  TO anon
  USING (false);

DROP POLICY IF EXISTS "Platform admin audit view on oauth vault" ON public.platform_oauth_tokens;
CREATE POLICY "Platform admin audit view on oauth vault"
  ON public.platform_oauth_tokens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.role = 'admin' OR LOWER(profiles.email) = 'islamiahiis243@gmail.com')
    )
  );

-- 7. Sanitized View for authenticated users (Never exposes ciphertext or refresh tokens)
CREATE OR REPLACE VIEW public.creator_connected_platforms AS
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
  WHERE connection_status != 'revoked';

GRANT SELECT ON public.creator_connected_platforms TO authenticated;

COMMENT ON TABLE public.platform_oauth_tokens IS 'SSOT T9.3: Server-side encrypted OAuth tokens vault for creator social platforms.';
COMMENT ON VIEW public.creator_connected_platforms IS 'SSOT T9.3: Sanitized connection metadata projection for creator UI (zero secret exposure).';
