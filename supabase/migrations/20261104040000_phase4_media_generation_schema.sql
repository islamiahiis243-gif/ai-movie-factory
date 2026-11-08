-- ============================================================================
-- AI MOVIE FACTORY - PHASE 4: MEDIA GENERATION & ASSET LIBRARY SCHEMA
-- Reference: SSOT Part 5 (Section 13) & Part 14 (Section 39)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
    scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
    character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
    asset_name TEXT NOT NULL,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'video', 'voice', 'audio')),
    subtype TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt TEXT NOT NULL,
    generation_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('queued', 'generating', 'completed', 'failed')),
    credit_cost INTEGER NOT NULL DEFAULT 10,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'in_review', 'approved', 'rejected')),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indices for rapid querying by project, type, and relationships
CREATE INDEX IF NOT EXISTS idx_assets_project_id ON public.assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON public.assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_episode_id ON public.assets(episode_id);
CREATE INDEX IF NOT EXISTS idx_assets_scene_id ON public.assets(scene_id);
CREATE INDEX IF NOT EXISTS idx_assets_character_id ON public.assets(character_id);

-- Updated at Trigger
CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON public.assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Project Ownership Enforcement RLS Policies
CREATE POLICY "Users can view assets belonging to their projects"
    ON public.assets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE public.projects.id = public.assets.project_id
            AND public.projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert assets into their projects"
    ON public.assets FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE public.projects.id = public.assets.project_id
            AND public.projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update assets in their projects"
    ON public.assets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE public.projects.id = public.assets.project_id
            AND public.projects.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE public.projects.id = public.assets.project_id
            AND public.projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete assets in their projects"
    ON public.assets FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE public.projects.id = public.assets.project_id
            AND public.projects.user_id = auth.uid()
        )
    );
