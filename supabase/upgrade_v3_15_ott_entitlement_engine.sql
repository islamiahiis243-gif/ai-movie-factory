-- ============================================================================
-- UPGRADE V3.15 — OTT CONTENT ACCESS CONTROL & ENTITLEMENT ENGINE (HARDENED)
-- Phase 6: Web & Independent OTT Publishing Studio (Milestone 2.9.1)
--
-- Architectural Guarantees:
-- 1. Strictly isolated from AMF Creator SaaS Billing (subscriptions, payment_orders).
-- 2. Multi-tenant viewer entitlement model (TVOD/PPV tickets & SVOD channel passes).
-- 3. Fail-closed security architecture: Zero video access without verified entitlement.
-- 4. True UTC TIMESTAMPTZ semantics: Uses now() directly (PMK & PostgreSQL standard).
-- 5. Granular Season Pass Support: content_type 'season' locks to specific season_id.
-- 6. Row Level Security (RLS) policies protecting viewer privacy and creator ledger.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. TABLE: public.ott_access_passes (TVOD / PPV Single-Item or Season Passes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ott_access_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.ott_channels(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('episode', 'film', 'season', 'series_season_pass')),
    content_id UUID NOT NULL,
    order_ref_id TEXT,
    price_paid_idr NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'IDR',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lightning-fast entitlement checks
CREATE INDEX IF NOT EXISTS idx_ott_access_passes_user_content 
    ON public.ott_access_passes(user_id, content_id, status);

CREATE INDEX IF NOT EXISTS idx_ott_access_passes_channel 
    ON public.ott_access_passes(channel_id, status);

CREATE INDEX IF NOT EXISTS idx_ott_access_passes_validity 
    ON public.ott_access_passes(user_id, status, valid_until);

-- ----------------------------------------------------------------------------
-- 2. TABLE: public.ott_viewer_subscriptions (SVOD Channel Passes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ott_viewer_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.ott_channels(id) ON DELETE CASCADE,
    tier_name TEXT NOT NULL DEFAULT 'standard_pass',
    billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('weekly', 'monthly', 'annual')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due', 'revoked')),
    price_paid_idr NUMERIC(12,2) NOT NULL DEFAULT 0,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_end TIMESTAMPTZ NOT NULL,
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for subscription lookup
CREATE INDEX IF NOT EXISTS idx_ott_viewer_subs_user_channel 
    ON public.ott_viewer_subscriptions(user_id, channel_id, status);

CREATE INDEX IF NOT EXISTS idx_ott_viewer_subs_channel 
    ON public.ott_viewer_subscriptions(channel_id, status);

CREATE INDEX IF NOT EXISTS idx_ott_viewer_subs_period 
    ON public.ott_viewer_subscriptions(user_id, status, current_period_end);

-- ----------------------------------------------------------------------------
-- 3. AUDIT TRIGGERS: Automatic updated_at timestamp maintenance
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_ott_access_passes_updated_at ON public.ott_access_passes;
CREATE TRIGGER trg_ott_access_passes_updated_at
    BEFORE UPDATE ON public.ott_access_passes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_ott_viewer_subs_updated_at ON public.ott_viewer_subscriptions;
CREATE TRIGGER trg_ott_viewer_subs_updated_at
    BEFORE UPDATE ON public.ott_viewer_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 4. INTEGRITY CHECK TRIGGER: Polymorphic content & channel cross-verification
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_ott_access_pass_channel_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    matched_channel_id UUID;
BEGIN
    IF NEW.content_type = 'film' THEN
        SELECT channel_id INTO matched_channel_id FROM public.ott_films WHERE id = NEW.content_id;
    ELSIF NEW.content_type = 'episode' THEN
        SELECT s.channel_id INTO matched_channel_id 
        FROM public.ott_episodes e
        JOIN public.ott_series s ON s.id = e.series_id
        WHERE e.id = NEW.content_id;
    ELSIF NEW.content_type IN ('season', 'series_season_pass') THEN
        SELECT s.channel_id INTO matched_channel_id 
        FROM public.ott_seasons sea
        JOIN public.ott_series s ON s.id = sea.series_id
        WHERE sea.id = NEW.content_id;
    END IF;

    IF matched_channel_id IS NOT NULL AND matched_channel_id != NEW.channel_id THEN
        RAISE EXCEPTION 'Integritas gagal: Konten (%) tidak dimiliki oleh kanal yang ditargetkan (%).', NEW.content_id, NEW.channel_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ott_access_pass_integrity ON public.ott_access_passes;
CREATE TRIGGER trg_ott_access_pass_integrity
    BEFORE INSERT OR UPDATE ON public.ott_access_passes
    FOR EACH ROW EXECUTE FUNCTION public.check_ott_access_pass_channel_integrity();

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.ott_access_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ott_viewer_subscriptions ENABLE ROW LEVEL SECURITY;

-- Deny direct public write access (must go through serverless fulfillment or service role)
REVOKE INSERT, UPDATE, DELETE ON public.ott_access_passes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ott_viewer_subscriptions FROM anon, authenticated;
GRANT SELECT ON public.ott_access_passes TO authenticated;
GRANT SELECT ON public.ott_viewer_subscriptions TO authenticated;
GRANT ALL ON public.ott_access_passes TO service_role;
GRANT ALL ON public.ott_viewer_subscriptions TO service_role;

-- RLS: Viewers can view their own passes
DROP POLICY IF EXISTS "Viewers can view own access passes" ON public.ott_access_passes;
CREATE POLICY "Viewers can view own access passes"
    ON public.ott_access_passes
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

-- RLS: Channel owners can view passes for their channel
DROP POLICY IF EXISTS "Channel owners can view channel access passes" ON public.ott_access_passes;
CREATE POLICY "Channel owners can view channel access passes"
    ON public.ott_access_passes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.ott_channels c 
            WHERE c.id = channel_id AND c.user_id = auth.uid()
        )
    );

-- RLS: Viewers can view their own subscriptions
DROP POLICY IF EXISTS "Viewers can view own subscriptions" ON public.ott_viewer_subscriptions;
CREATE POLICY "Viewers can view own subscriptions"
    ON public.ott_viewer_subscriptions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

-- RLS: Channel owners can view subscriptions for their channel
DROP POLICY IF EXISTS "Channel owners can view channel subscriptions" ON public.ott_viewer_subscriptions;
CREATE POLICY "Channel owners can view channel subscriptions"
    ON public.ott_viewer_subscriptions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.ott_channels c 
            WHERE c.id = channel_id AND c.user_id = auth.uid()
        )
    );

COMMIT;
