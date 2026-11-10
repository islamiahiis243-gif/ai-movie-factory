-- ============================================================================
-- UPGRADE V3.14 — OTT CATALOG HIERARCHY & MULTI-EPISODE RELATIONAL ARCHITECTURE
-- Phase 6: Web & Independent OTT Publishing Studio (Milestone 2.9)
-- 
-- Architectural Guarantees:
-- 1. Strictly isolated from AMF Creator SaaS Billing (subscriptions, payment_orders).
-- 2. Multi-tenant isolation: Studio owns their channel, series, seasons, episodes, films.
-- 3. Production Master Integration: Connects Gate 5 approved renders without file duplication.
-- 4. Access Policy Ready: Free, PPV/TVOD, SVOD Subscriber Only, Scheduled Release.
-- 5. Strict RLS: Public queries can ONLY see published catalog items.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. TABLE: public.ott_channels (Studio / Creator Channel Root)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ott_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    website_url TEXT,
    social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 2. TABLE: public.ott_series (Web Drama Series & Episodic Shows)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ott_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES public.ott_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    synopsis TEXT,
    content_format TEXT NOT NULL DEFAULT 'micro_drama' 
        CHECK (content_format IN ('short_form_vertical_9_16', 'cinematic_horizontal_16_9', 'micro_drama', 'commercial_anthology')),
    genres JSONB NOT NULL DEFAULT '[]'::jsonb,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    poster_url TEXT,
    backdrop_url TEXT,
    total_seasons_count INTEGER NOT NULL DEFAULT 1,
    total_episodes_count INTEGER NOT NULL DEFAULT 0,
    maturity_rating TEXT NOT NULL DEFAULT '13+' 
        CHECK (maturity_rating IN ('ALL', '13+', '17+', '21+')),
    default_access_policy TEXT NOT NULL DEFAULT 'free'
        CHECK (default_access_policy IN ('free', 'ppv_tvod', 'svod_subscriber', 'hybrid_early_access')),
    publication_status TEXT NOT NULL DEFAULT 'draft_catalog'
        CHECK (publication_status IN ('draft_catalog', 'ready_for_catalog', 'published', 'archived')),
    featured BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(channel_id, slug)
);

-- ----------------------------------------------------------------------------
-- 3. TABLE: public.ott_seasons (Seasons within Series)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ott_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES public.ott_series(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    synopsis TEXT,
    poster_url TEXT,
    episodes_count INTEGER NOT NULL DEFAULT 0,
    publication_status TEXT NOT NULL DEFAULT 'draft_catalog'
        CHECK (publication_status IN ('draft_catalog', 'published', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(series_id, season_number)
);

-- ----------------------------------------------------------------------------
-- 4. TABLE: public.ott_episodes (Individual Episodes & Master Asset Links)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ott_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES public.ott_series(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES public.ott_seasons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    episode_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    synopsis TEXT,
    runtime_seconds INTEGER NOT NULL DEFAULT 0,
    thumbnail_url TEXT,
    access_policy TEXT NOT NULL DEFAULT 'free'
        CHECK (access_policy IN ('free', 'ppv_tvod', 'svod_subscriber', 'trailer_preview')),
    ppv_price_idr NUMERIC(12,2) NOT NULL DEFAULT 0,
    publication_status TEXT NOT NULL DEFAULT 'draft_catalog'
        CHECK (publication_status IN ('production_completed', 'ready_for_catalog', 'draft_catalog', 'published', 'archived')),
    published_at TIMESTAMPTZ,
    scheduled_release_at TIMESTAMPTZ,
    
    -- Gate 5 Master Asset Integration
    source_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    master_export_id TEXT,
    master_video_url TEXT,
    master_video_fingerprint TEXT,
    master_approval_status TEXT NOT NULL DEFAULT 'UNAPPROVED'
        CHECK (master_approval_status IN ('GATE_5_APPROVED', 'PENDING_APPROVAL', 'UNAPPROVED')),
    subtitle_vtt_url TEXT,
    chapters_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(season_id, episode_number)
);

-- ----------------------------------------------------------------------------
-- 5. TABLE: public.ott_films (Standalone Feature/Short Films)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ott_films (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES public.ott_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    logline TEXT,
    synopsis TEXT,
    runtime_seconds INTEGER NOT NULL DEFAULT 0,
    aspect_ratio TEXT NOT NULL DEFAULT '16:9'
        CHECK (aspect_ratio IN ('16:9', '9:16', '2.39:1', '4:3')),
    genres JSONB NOT NULL DEFAULT '[]'::jsonb,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    poster_url TEXT,
    backdrop_url TEXT,
    trailer_video_url TEXT,
    access_policy TEXT NOT NULL DEFAULT 'ppv_tvod'
        CHECK (access_policy IN ('free', 'ppv_tvod', 'svod_subscriber')),
    ppv_price_idr NUMERIC(12,2) NOT NULL DEFAULT 0,
    publication_status TEXT NOT NULL DEFAULT 'draft_catalog'
        CHECK (publication_status IN ('production_completed', 'ready_for_catalog', 'draft_catalog', 'published', 'archived')),
    published_at TIMESTAMPTZ,
    scheduled_release_at TIMESTAMPTZ,
    
    -- Gate 5 Master Asset Integration
    source_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    master_export_id TEXT,
    master_video_url TEXT,
    master_video_fingerprint TEXT,
    master_approval_status TEXT NOT NULL DEFAULT 'UNAPPROVED'
        CHECK (master_approval_status IN ('GATE_5_APPROVED', 'PENDING_APPROVAL', 'UNAPPROVED')),
    subtitle_vtt_url TEXT,
    chapters_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(channel_id, slug)
);

-- ----------------------------------------------------------------------------
-- 6. TABLE: public.ott_cast_members (Cast & Crew Credits linked to Character DNA)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ott_cast_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('series', 'episode', 'film')),
    content_id UUID NOT NULL,
    person_or_char_name TEXT NOT NULL,
    role_type TEXT NOT NULL DEFAULT 'lead_actor'
        CHECK (role_type IN ('lead_actor', 'supporting_actor', 'voice_actor', 'director', 'writer', 'ai_cinematographer')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 7. PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ott_channels_user_id ON public.ott_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_ott_channels_slug ON public.ott_channels(slug);

CREATE INDEX IF NOT EXISTS idx_ott_series_channel_id ON public.ott_series(channel_id);
CREATE INDEX IF NOT EXISTS idx_ott_series_user_id ON public.ott_series(user_id);
CREATE INDEX IF NOT EXISTS idx_ott_series_status ON public.ott_series(publication_status);

CREATE INDEX IF NOT EXISTS idx_ott_seasons_series_id ON public.ott_seasons(series_id);

CREATE INDEX IF NOT EXISTS idx_ott_episodes_series_id ON public.ott_episodes(series_id);
CREATE INDEX IF NOT EXISTS idx_ott_episodes_season_id ON public.ott_episodes(season_id);
CREATE INDEX IF NOT EXISTS idx_ott_episodes_user_id ON public.ott_episodes(user_id);
CREATE INDEX IF NOT EXISTS idx_ott_episodes_source_project ON public.ott_episodes(source_project_id);
CREATE INDEX IF NOT EXISTS idx_ott_episodes_status ON public.ott_episodes(publication_status);

CREATE INDEX IF NOT EXISTS idx_ott_films_channel_id ON public.ott_films(channel_id);
CREATE INDEX IF NOT EXISTS idx_ott_films_user_id ON public.ott_films(user_id);
CREATE INDEX IF NOT EXISTS idx_ott_films_source_project ON public.ott_films(source_project_id);
CREATE INDEX IF NOT EXISTS idx_ott_films_status ON public.ott_films(publication_status);

CREATE INDEX IF NOT EXISTS idx_ott_cast_content ON public.ott_cast_members(content_type, content_id);

-- ----------------------------------------------------------------------------
-- 8. TRIGGER FOR TIMESTAMP UPDATES
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_ott_channels_updated_at ON public.ott_channels;
CREATE TRIGGER trg_ott_channels_updated_at
    BEFORE UPDATE ON public.ott_channels
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_ott_series_updated_at ON public.ott_series;
CREATE TRIGGER trg_ott_series_updated_at
    BEFORE UPDATE ON public.ott_series
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_ott_seasons_updated_at ON public.ott_seasons;
CREATE TRIGGER trg_ott_seasons_updated_at
    BEFORE UPDATE ON public.ott_seasons
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_ott_episodes_updated_at ON public.ott_episodes;
CREATE TRIGGER trg_ott_episodes_updated_at
    BEFORE UPDATE ON public.ott_episodes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_ott_films_updated_at ON public.ott_films;
CREATE TRIGGER trg_ott_films_updated_at
    BEFORE UPDATE ON public.ott_films
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 9. SECURITY GUARD: ENFORCE GATE 5 APPROVAL BEFORE CATALOG PUBLISHING
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_ott_master_approval_before_publishing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If setting publication_status to 'published', require Gate 5 approval
    IF NEW.publication_status = 'published' THEN
        IF NEW.master_approval_status != 'GATE_5_APPROVED' THEN
            RAISE EXCEPTION 'Item katalog tidak dapat dipublikasikan tanpa persetujuan final Gate 5 (master_approval_status = GATE_5_APPROVED). Status saat ini: %', NEW.master_approval_status;
        END IF;
        IF NEW.master_video_url IS NULL OR NEW.master_video_url = '' THEN
            RAISE EXCEPTION 'Item katalog tidak dapat dipublikasikan tanpa referensi file master video yang valid.';
        END IF;
        IF NEW.published_at IS NULL THEN
            NEW.published_at = now();
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ott_episodes_publication_guard ON public.ott_episodes;
CREATE TRIGGER trg_ott_episodes_publication_guard
    BEFORE INSERT OR UPDATE ON public.ott_episodes
    FOR EACH ROW EXECUTE FUNCTION public.check_ott_master_approval_before_publishing();

DROP TRIGGER IF EXISTS trg_ott_films_publication_guard ON public.ott_films;
CREATE TRIGGER trg_ott_films_publication_guard
    BEFORE INSERT OR UPDATE ON public.ott_films
    FOR EACH ROW EXECUTE FUNCTION public.check_ott_master_approval_before_publishing();

-- ----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.ott_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ott_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ott_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ott_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ott_films ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ott_cast_members ENABLE ROW LEVEL SECURITY;

-- Channels Policies
CREATE POLICY "Channel owner full access"
    ON public.ott_channels
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read active channels"
    ON public.ott_channels
    FOR SELECT
    USING (status = 'active');

-- Series Policies
CREATE POLICY "Series owner full access"
    ON public.ott_series
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read published series"
    ON public.ott_series
    FOR SELECT
    USING (publication_status = 'published');

-- Seasons Policies
CREATE POLICY "Seasons owner full access"
    ON public.ott_seasons
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.ott_series
            WHERE ott_series.id = ott_seasons.series_id
            AND ott_series.user_id = auth.uid()
        )
    );

CREATE POLICY "Public read published seasons"
    ON public.ott_seasons
    FOR SELECT
    USING (publication_status = 'published');

-- Episodes Policies
CREATE POLICY "Episodes owner full access"
    ON public.ott_episodes
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read published episodes"
    ON public.ott_episodes
    FOR SELECT
    USING (publication_status = 'published');

-- Films Policies
CREATE POLICY "Films owner full access"
    ON public.ott_films
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read published films"
    ON public.ott_films
    FOR SELECT
    USING (publication_status = 'published');

-- Cast Members Policies
CREATE POLICY "Cast owner full access"
    ON public.ott_cast_members
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read cast members"
    ON public.ott_cast_members
    FOR SELECT
    USING (true);

COMMIT;
