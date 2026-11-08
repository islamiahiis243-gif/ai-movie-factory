-- ==============================================================================
-- AI MOVIE FACTORY - PHASE 2 MIGRATION: WORLD BUILDER & CHARACTER STUDIO
-- SSOT Part 4 (Section 8, 9), Part 8 (Section 19), and Part 14 (Section 37)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. STORY_BIBLES TABLE (World Builder Universe Lore)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.story_bibles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  world_name TEXT NOT NULL,
  synopsis TEXT NOT NULL DEFAULT '',
  historical_background TEXT NOT NULL DEFAULT '',
  rules_of_the_world TEXT NOT NULL DEFAULT '',
  magic_or_tech_system TEXT NOT NULL DEFAULT '',
  spiritual_energy_rules TEXT,
  cultivation_realms JSONB NOT NULL DEFAULT '[]'::jsonb,
  factions JSONB NOT NULL DEFAULT '[]'::jsonb,
  locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  reference_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_story_bibles_project_id ON public.story_bibles(project_id);
CREATE INDEX IF NOT EXISTS idx_story_bibles_realms_gin ON public.story_bibles USING gin(cultivation_realms);
CREATE INDEX IF NOT EXISTS idx_story_bibles_locations_gin ON public.story_bibles USING gin(locations);

DROP TRIGGER IF EXISTS set_story_bibles_updated_at ON public.story_bibles;
CREATE TRIGGER set_story_bibles_updated_at
  BEFORE UPDATE ON public.story_bibles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2. CHARACTERS TABLE (Character Studio Master Roster & Visual Continuity)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  native_name TEXT,
  role TEXT NOT NULL DEFAULT 'supporting' CHECK (role IN ('protagonist', 'antagonist', 'supporting', 'mentor', 'recurring')),
  age TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT '',
  occupation_cultivation_level TEXT,
  sect_or_faction TEXT,
  personality TEXT NOT NULL DEFAULT '',
  motivation TEXT NOT NULL DEFAULT '',
  background TEXT NOT NULL DEFAULT '',
  physical_appearance JSONB NOT NULL DEFAULT '{}'::jsonb,
  costume JSONB NOT NULL DEFAULT '{}'::jsonb,
  voice_characteristics JSONB NOT NULL DEFAULT '{}'::jsonb,
  visual_consistency_prompt TEXT NOT NULL DEFAULT '',
  relationships JSONB NOT NULL DEFAULT '[]'::jsonb,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_characters_project_id ON public.characters(project_id);
CREATE INDEX IF NOT EXISTS idx_characters_role ON public.characters(role);
CREATE INDEX IF NOT EXISTS idx_characters_name ON public.characters(name);

DROP TRIGGER IF EXISTS set_characters_updated_at ON public.characters;
CREATE TRIGGER set_characters_updated_at
  BEFORE UPDATE ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES FOR WORLD BIBLES & CHARACTERS
-- ------------------------------------------------------------------------------
ALTER TABLE public.story_bibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

-- Story Bibles Policies (Inherited ownership via projects)
CREATE POLICY "Users can view story bibles of their own projects"
  ON public.story_bibles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = story_bibles.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert story bibles for their own projects"
  ON public.story_bibles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = story_bibles.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update story bibles of their own projects"
  ON public.story_bibles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = story_bibles.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete story bibles of their own projects"
  ON public.story_bibles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = story_bibles.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Characters Policies (Inherited ownership via projects)
CREATE POLICY "Users can view characters of their own projects"
  ON public.characters
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = characters.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert characters for their own projects"
  ON public.characters
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = characters.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update characters of their own projects"
  ON public.characters
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = characters.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete characters of their own projects"
  ON public.characters
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = characters.project_id
      AND projects.user_id = auth.uid()
    )
  );
