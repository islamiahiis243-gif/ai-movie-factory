-- ============================================================================
-- AI MOVIE FACTORY - PHASE 2 (PART B) DATABASE MIGRATION
-- STORY CONCEPTS, SEASONS, EPISODES, SCENES, SCRIPT VERSIONS
-- Reference: SSOT Sections 10, 11, 37, 38
-- ============================================================================

-- 1. STORY CONCEPTS TABLE
CREATE TABLE IF NOT EXISTS public.story_concepts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
    logline TEXT NOT NULL DEFAULT '',
    synopsis TEXT NOT NULL DEFAULT '',
    theme TEXT NOT NULL DEFAULT '',
    narrative_structure TEXT NOT NULL DEFAULT 'three_act',
    narrative_structure_custom TEXT,
    tone_style TEXT NOT NULL DEFAULT '',
    target_audience TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. SEASONS TABLE
CREATE TABLE IF NOT EXISTS public.seasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    synopsis TEXT NOT NULL DEFAULT '',
    target_episodes INTEGER NOT NULL DEFAULT 12,
    status TEXT NOT NULL DEFAULT 'in_development' CHECK (status IN ('planned', 'in_development', 'in_production', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(project_id, season_number)
);

-- 3. EPISODES TABLE
CREATE TABLE IF NOT EXISTS public.episodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
    episode_number INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    logline TEXT NOT NULL DEFAULT '',
    synopsis TEXT NOT NULL DEFAULT '',
    target_runtime_minutes INTEGER NOT NULL DEFAULT 15,
    scene_count_target INTEGER NOT NULL DEFAULT 8,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'outline', 'scripted', 'approved', 'in_production')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(season_id, episode_number)
);

-- 4. SCENES TABLE
CREATE TABLE IF NOT EXISTS public.scenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
    scene_number INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    slugline TEXT NOT NULL,
    int_ext TEXT NOT NULL DEFAULT 'INT' CHECK (int_ext IN ('INT', 'EXT', 'INT/EXT')),
    location_name TEXT NOT NULL DEFAULT '',
    time_of_day TEXT NOT NULL DEFAULT 'DAY' CHECK (time_of_day IN ('DAY', 'NIGHT', 'DUSK', 'DAWN', 'CONTINUOUS')),
    synopsis TEXT NOT NULL DEFAULT '',
    emotional_beat TEXT NOT NULL DEFAULT '',
    character_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    characters_present JSONB NOT NULL DEFAULT '[]'::jsonb,
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    visual_continuity_seed TEXT,
    camera_notes TEXT,
    audio_sound_notes TEXT,
    approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'in_review', 'approved', 'revision_requested')),
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    estimated_duration_seconds INTEGER NOT NULL DEFAULT 90,
    versions_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(episode_id, scene_number)
);

-- 5. SCRIPT VERSIONS TABLE
CREATE TABLE IF NOT EXISTS public.script_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    changelog_note TEXT NOT NULL DEFAULT '',
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_by TEXT
);

-- Enable RLS
ALTER TABLE public.story_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage story concepts for their projects"
    ON public.story_concepts FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = story_concepts.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can manage seasons for their projects"
    ON public.seasons FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = seasons.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can manage episodes for their projects"
    ON public.episodes FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = episodes.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can manage scenes for their projects"
    ON public.scenes FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = scenes.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can manage script versions for their scenes"
    ON public.script_versions FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.scenes
        JOIN public.projects ON projects.id = scenes.project_id
        WHERE scenes.id = script_versions.scene_id AND projects.user_id = auth.uid()
    ));

-- Auto-update timestamps triggers
CREATE TRIGGER set_timestamp_story_concepts
    BEFORE UPDATE ON public.story_concepts
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_seasons
    BEFORE UPDATE ON public.seasons
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_episodes
    BEFORE UPDATE ON public.episodes
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_scenes
    BEFORE UPDATE ON public.scenes
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
