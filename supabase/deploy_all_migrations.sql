-- ==============================================================================
-- AI MOVIE FACTORY - MASTER DATABASE MIGRATION SCRIPT (3.2 ENTERPRISE HARDENED)
-- Peer-Audited, Strict Role-Based Defense & Upgrade-Safe
-- Target: PostgreSQL 15+ / Supabase PostgREST 12+
-- Atomicity: Wrapped in Transaction (BEGIN / COMMIT)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- EXTENSIONS: Cryptographic and UUID utilities
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. GLOBAL UTILITY FUNCTIONS: Standardized Timestamp Handler
-- Using now() directly to preserve true UTC TIMESTAMPTZ semantics
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Backward-compatible alias
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Immutability of Tenant Project Identifier on Creative Entities
CREATE OR REPLACE FUNCTION public.prevent_project_id_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'Integrity Violation: Changing project_id on entity % (ID %) is strictly prohibited.', TG_TABLE_NAME, OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Pre-migration compatibility: Ensure profile soft-delete columns exist before function compilation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. HARDENED SECURITY DEFINER HELPERS: Anti-Recursion Workspace Evaluators
-- CRITICAL FIX: Identity derived strictly from auth.uid() + active profile check.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_workspace_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Ensure owner profile is active and not soft-deleted
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = v_uid AND is_active = true AND deleted_at IS NULL
  ) THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id AND owner_id = v_uid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_workspace_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Ensure member profile is active and not soft-deleted
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = v_uid AND is_active = true AND deleted_at IS NULL
  ) THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id 
      AND user_id = v_uid 
      AND status = 'active'
  );
END;
$$;

-- Grant execution to anon, authenticated, and service_role.
-- Both functions derive identity strictly from auth.uid() and immediately return FALSE if auth.uid() is null.
-- Granting to anon is necessary so PostgREST RLS policy evaluation returns empty results (false) instead of throwing error 42501 on unauthenticated requests.
REVOKE ALL ON FUNCTION public.is_workspace_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(UUID) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_workspace_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO anon, authenticated, service_role;

-- ==============================================================================
-- PHASE 1: SAAS FOUNDATION & CORE IDENTITY SCHEMA
-- ==============================================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'id' CHECK (preferred_language IN ('id', 'en', 'zh', 'ja', 'es')),
  email TEXT,
  role TEXT NOT NULL DEFAULT 'creator',
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_preferred_language ON public.profiles(preferred_language);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Profile Field Protection Trigger: Prevents self-promotion of role, un-deleting, or tampering with ID/email
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    NEW.role := OLD.role;
    NEW.is_active := OLD.is_active;
    NEW.deleted_at := OLD.deleted_at;
    NEW.email := OLD.email;
  END IF;
  NEW.id := OLD.id;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  genre TEXT NOT NULL,
  custom_genre TEXT,
  production_format TEXT NOT NULL DEFAULT 'Feature film',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_development', 'in_production', 'post_production', 'completed', 'archived')),
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_projects_id_user_id UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_genre ON public.projects(genre);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. PROJECT_SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.project_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_settings_project_id ON public.project_settings(project_id);
CREATE INDEX IF NOT EXISTS idx_project_settings_gin ON public.project_settings USING gin(settings);

DROP TRIGGER IF EXISTS set_project_settings_updated_at ON public.project_settings;
CREATE TRIGGER set_project_settings_updated_at
  BEFORE UPDATE ON public.project_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- AUTH TRIGGER: Robust Profile + Free Tier + Workspace Provisioning on User Registration (Email & Google OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_display_name TEXT;
  v_avatar_url TEXT;
  v_workspace_id UUID;
BEGIN
  v_display_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(split_part(NEW.email, '@', 1), ''),
    'Creator_' || substr(NEW.id::text, 1, 8)
  );

  v_avatar_url := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data->>'picture', '')
  );

  INSERT INTO public.profiles (id, display_name, avatar_url, email, preferred_language, role, is_active)
  VALUES (
    NEW.id,
    v_display_name,
    v_avatar_url,
    NEW.email,
    'id',
    'creator',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = now();

  -- Provision Initial Free Creator Subscription (150 Credits) if none exists
  IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = NEW.id) THEN
    INSERT INTO public.subscriptions (
      user_id, tier, status, billing_cycle, price_paid, currency, credits_allotted,
      current_period_start, current_period_end, cancel_at_period_end, payment_provider, payment_method
    ) VALUES (
      NEW.id, 'free', 'active', 'monthly', 0, 'IDR', 150,
      now(), now() + INTERVAL '30 days', false, 'midtrans', 'qris'
    );
  END IF;

  -- Provision Welcome Credit Ledger Entry (+150 Credits) if none exists
  IF NOT EXISTS (SELECT 1 FROM public.credit_transactions WHERE user_id = NEW.id) THEN
    INSERT INTO public.credit_transactions (
      user_id, transaction_type, amount, balance_after, provider, model, operation,
      estimated_cost_usd, actual_cost_usd, description, status, idempotency_key
    ) VALUES (
      NEW.id, 'monthly_allotment', 150, 150, 'system', 'free_welcome_quota', 'initial_account_allotment',
      0, 0, 'Alokasi Kredit Awal Paket Free Creator (150 Kredit)', 'completed', 'welcome_' || NEW.id::text
    );
  END IF;

  -- Provision Personal Studio Workspace + Owner Seat if none exists
  SELECT id INTO v_workspace_id FROM public.workspaces WHERE owner_id = NEW.id LIMIT 1;
  IF v_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (
      name, owner_id, tier, max_seats, seat_limit, active_seats_count, settings
    ) VALUES (
      v_display_name || ' Studio Workspace', NEW.id, 'free', 1, 1, 1,
      '{"allow_member_exports": true, "require_director_approval_for_override": true, "shared_credit_pool": true, "default_language": "id", "watermark_previews": false}'::jsonb
    ) RETURNING id INTO v_workspace_id;

    INSERT INTO public.workspace_members (
      workspace_id, user_id, role, invited_email, display_name, status
    ) VALUES (
      v_workspace_id, NEW.id, 'owner', NEW.email, v_display_name, 'active'
    ) ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- PHASE 2 (PART A): WORLD BUILDER & CHARACTER STUDIO
-- ==============================================================================

-- 4. STORY_BIBLES TABLE
CREATE TABLE IF NOT EXISTS public.story_bibles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_story_bibles_project_id ON public.story_bibles(project_id);
CREATE INDEX IF NOT EXISTS idx_story_bibles_realms_gin ON public.story_bibles USING gin(cultivation_realms);
CREATE INDEX IF NOT EXISTS idx_story_bibles_locations_gin ON public.story_bibles USING gin(locations);

DROP TRIGGER IF EXISTS set_story_bibles_updated_at ON public.story_bibles;
CREATE TRIGGER set_story_bibles_updated_at
  BEFORE UPDATE ON public.story_bibles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. CHARACTERS TABLE
CREATE TABLE IF NOT EXISTS public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_characters_id_project_id UNIQUE (id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_characters_project_id ON public.characters(project_id);
CREATE INDEX IF NOT EXISTS idx_characters_role ON public.characters(role);
CREATE INDEX IF NOT EXISTS idx_characters_name ON public.characters(name);

DROP TRIGGER IF EXISTS set_characters_updated_at ON public.characters;
CREATE TRIGGER set_characters_updated_at
  BEFORE UPDATE ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_prevent_character_project_reassignment ON public.characters;
CREATE TRIGGER trg_prevent_character_project_reassignment
  BEFORE UPDATE ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_project_id_reassignment();

-- ==============================================================================
-- PHASE 2 (PART B): STORY CONCEPTS, SEASONS, EPISODES, SCENES & SCRIPTS
-- ==============================================================================

-- 6. STORY_CONCEPTS TABLE
CREATE TABLE IF NOT EXISTS public.story_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  logline TEXT NOT NULL DEFAULT '',
  synopsis TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT '',
  narrative_structure TEXT NOT NULL DEFAULT 'three_act',
  narrative_structure_custom TEXT,
  tone_style TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_story_concepts_project_id ON public.story_concepts(project_id);

DROP TRIGGER IF EXISTS set_timestamp_story_concepts ON public.story_concepts;
CREATE TRIGGER set_timestamp_story_concepts
  BEFORE UPDATE ON public.story_concepts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 7. SEASONS TABLE (With Composite Unique for Cross-Project Isolation)
CREATE TABLE IF NOT EXISTS public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  synopsis TEXT NOT NULL DEFAULT '',
  target_episodes INTEGER NOT NULL DEFAULT 12,
  status TEXT NOT NULL DEFAULT 'in_development' CHECK (status IN ('planned', 'in_development', 'in_production', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, season_number),
  CONSTRAINT uq_seasons_id_project_id UNIQUE (id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_seasons_project_id ON public.seasons(project_id);

DROP TRIGGER IF EXISTS set_timestamp_seasons ON public.seasons;
CREATE TRIGGER set_timestamp_seasons
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 8. EPISODES TABLE (Enforces Project Parity with Season via Composite FK)
CREATE TABLE IF NOT EXISTS public.episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  season_id UUID NOT NULL,
  episode_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  logline TEXT NOT NULL DEFAULT '',
  synopsis TEXT NOT NULL DEFAULT '',
  target_runtime_minutes INTEGER NOT NULL DEFAULT 15,
  scene_count_target INTEGER NOT NULL DEFAULT 8,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'outline', 'scripted', 'approved', 'in_production')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(season_id, episode_number),
  CONSTRAINT uq_episodes_id_project_id UNIQUE (id, project_id),
  CONSTRAINT fk_episodes_season_composite FOREIGN KEY (season_id, project_id)
    REFERENCES public.seasons (id, project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_episodes_project_id ON public.episodes(project_id);
CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON public.episodes(season_id);

DROP TRIGGER IF EXISTS set_timestamp_episodes ON public.episodes;
CREATE TRIGGER set_timestamp_episodes
  BEFORE UPDATE ON public.episodes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_prevent_episode_project_reassignment ON public.episodes;
CREATE TRIGGER trg_prevent_episode_project_reassignment
  BEFORE UPDATE ON public.episodes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_project_id_reassignment();

-- 9. SCENES TABLE (Enforces Project Parity with Episode via Composite FK)
CREATE TABLE IF NOT EXISTS public.scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(episode_id, scene_number),
  CONSTRAINT uq_scenes_id_project_id UNIQUE (id, project_id),
  CONSTRAINT fk_scenes_episode_composite FOREIGN KEY (episode_id, project_id)
    REFERENCES public.episodes (id, project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON public.scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_episode_id ON public.scenes(episode_id);

DROP TRIGGER IF EXISTS set_timestamp_scenes ON public.scenes;
CREATE TRIGGER set_timestamp_scenes
  BEFORE UPDATE ON public.scenes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_prevent_scene_project_reassignment ON public.scenes;
CREATE TRIGGER trg_prevent_scene_project_reassignment
  BEFORE UPDATE ON public.scenes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_project_id_reassignment();

-- 10. SCRIPT_VERSIONS TABLE
CREATE TABLE IF NOT EXISTS public.script_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  changelog_note TEXT NOT NULL DEFAULT '',
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  UNIQUE(scene_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_script_versions_scene_id ON public.script_versions(scene_id);

-- ==============================================================================
-- PHASE 3: AI AGENT SYSTEM (14 AGENTS REGISTRY & ORCHESTRATION)
-- ==============================================================================

-- 11. AGENT_PROJECT_CONFIGS TABLE
CREATE TABLE IF NOT EXISTS public.agent_project_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_role TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  selected_model TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
  custom_instructions TEXT NOT NULL DEFAULT '',
  credit_limit_per_run INTEGER NOT NULL DEFAULT 50 CHECK (credit_limit_per_run >= 0),
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  execution_priority INTEGER NOT NULL DEFAULT 1,
  total_runs INTEGER NOT NULL DEFAULT 0,
  total_credits_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, agent_role)
);

CREATE INDEX IF NOT EXISTS idx_agent_configs_project_id ON public.agent_project_configs(project_id);

DROP TRIGGER IF EXISTS set_timestamp_agent_project_configs ON public.agent_project_configs;
CREATE TRIGGER set_timestamp_agent_project_configs
  BEFORE UPDATE ON public.agent_project_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 12. PRODUCTION_TASKS TABLE
CREATE TABLE IF NOT EXISTS public.production_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workflow_type TEXT NOT NULL DEFAULT 'manual',
  task_name TEXT NOT NULL,
  agent_role TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  input_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_result JSONB,
  error_message TEXT,
  requires_human_approval BOOLEAN NOT NULL DEFAULT true,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  execution_time_seconds INTEGER NOT NULL DEFAULT 0,
  credits_consumed INTEGER NOT NULL DEFAULT 0 CHECK (credits_consumed >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_production_tasks_id_project_id UNIQUE (id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_production_tasks_project_id ON public.production_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_production_tasks_status ON public.production_tasks(status);

CREATE OR REPLACE FUNCTION public.protect_production_task_operational_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completed' AND OLD.status != 'completed')
       OR NEW.output_result IS DISTINCT FROM OLD.output_result
       OR NEW.credits_consumed IS DISTINCT FROM OLD.credits_consumed THEN
      RAISE EXCEPTION 'Security Violation: Task completion and credit consumption can only be recorded by agent execution workers.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_production_task_operational_fields ON public.production_tasks;
CREATE TRIGGER trg_protect_production_task_operational_fields
  BEFORE UPDATE ON public.production_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_production_task_operational_fields();

-- 13. AGENT_EXECUTION_LOGS TABLE (Cross-Project Composite Integrity Enforced)
CREATE TABLE IF NOT EXISTS public.agent_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  project_id UUID NOT NULL,
  agent_role TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'reasoning', 'action', 'approval_required', 'success', 'error')),
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_agent_logs_task_project FOREIGN KEY (task_id, project_id)
    REFERENCES public.production_tasks (id, project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_task_id ON public.agent_execution_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_project_id ON public.agent_execution_logs(project_id);

REVOKE UPDATE, DELETE, TRUNCATE ON public.agent_execution_logs FROM anon, authenticated, public;

-- ==============================================================================
-- PHASE 4: MEDIA GENERATION & CENTRAL ASSET LIBRARY
-- CRITICAL FIX: Safe Single-Column ON DELETE SET NULL + Cross-Project Trigger
-- ==============================================================================

-- 14. ASSETS TABLE
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  credit_cost INTEGER NOT NULL DEFAULT 10 CHECK (credit_cost >= 0),
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'in_review', 'approved', 'rejected')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_project_id ON public.assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON public.assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_episode_id ON public.assets(episode_id);
CREATE INDEX IF NOT EXISTS idx_assets_scene_id ON public.assets(scene_id);
CREATE INDEX IF NOT EXISTS idx_assets_character_id ON public.assets(character_id);

-- Cross-Project Consistency Trigger for Assets
CREATE OR REPLACE FUNCTION public.check_asset_project_integrity()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.character_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.characters WHERE id = NEW.character_id AND project_id = NEW.project_id) THEN
      RAISE EXCEPTION 'Cross-Project Integrity Error: Character % does not belong to Project %', NEW.character_id, NEW.project_id;
    END IF;
  END IF;
  IF NEW.scene_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.scenes WHERE id = NEW.scene_id AND project_id = NEW.project_id) THEN
      RAISE EXCEPTION 'Cross-Project Integrity Error: Scene % does not belong to Project %', NEW.scene_id, NEW.project_id;
    END IF;
  END IF;
  IF NEW.episode_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.episodes WHERE id = NEW.episode_id AND project_id = NEW.project_id) THEN
      RAISE EXCEPTION 'Cross-Project Integrity Error: Episode % does not belong to Project %', NEW.episode_id, NEW.project_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_asset_project_integrity ON public.assets;
CREATE TRIGGER trg_check_asset_project_integrity
  BEFORE INSERT OR UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.check_asset_project_integrity();

DROP TRIGGER IF EXISTS update_assets_updated_at ON public.assets;
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- PHASE 5: PRODUCTION PIPELINE, AUTOMATED QC & MASTER EXPORTS
-- ==============================================================================

-- 15. PIPELINE_JOBS TABLE
CREATE TABLE IF NOT EXISTS public.pipeline_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
  job_title TEXT NOT NULL,
  current_stage TEXT NOT NULL DEFAULT 'script_prep',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'in_qc', 'completed', 'failed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  stages_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  qc_report JSONB,
  generated_asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  credit_cost INTEGER NOT NULL DEFAULT 15 CHECK (credit_cost >= 0),
  error_message TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pipeline_jobs_id_project_id UNIQUE (id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_project_id ON public.pipeline_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_status ON public.pipeline_jobs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_scene_id ON public.pipeline_jobs(scene_id);

-- Cross-Project Consistency Trigger for Pipeline Jobs
CREATE OR REPLACE FUNCTION public.check_pipeline_job_project_integrity()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.scene_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.scenes WHERE id = NEW.scene_id AND project_id = NEW.project_id) THEN
      RAISE EXCEPTION 'Cross-Project Integrity Error: Scene % does not belong to Project %', NEW.scene_id, NEW.project_id;
    END IF;
  END IF;
  IF NEW.episode_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.episodes WHERE id = NEW.episode_id AND project_id = NEW.project_id) THEN
      RAISE EXCEPTION 'Cross-Project Integrity Error: Episode % does not belong to Project %', NEW.episode_id, NEW.project_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_pipeline_job_project_integrity ON public.pipeline_jobs;
CREATE TRIGGER trg_check_pipeline_job_project_integrity
  BEFORE INSERT OR UPDATE ON public.pipeline_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_pipeline_job_project_integrity();

DROP TRIGGER IF EXISTS set_pipeline_jobs_updated_at ON public.pipeline_jobs;
CREATE TRIGGER set_pipeline_jobs_updated_at
  BEFORE UPDATE ON public.pipeline_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.protect_pipeline_job_operational_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.credit_cost <> OLD.credit_cost THEN
      RAISE EXCEPTION 'Security Violation: credit_cost on pipeline_jobs cannot be altered by client.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_pipeline_job_operational_fields ON public.pipeline_jobs;
CREATE TRIGGER trg_protect_pipeline_job_operational_fields
  BEFORE UPDATE ON public.pipeline_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_pipeline_job_operational_fields();

-- 16. PIPELINE_JOB_LOGS TABLE (Cross-Project Composite Integrity Enforced)
CREATE TABLE IF NOT EXISTS public.pipeline_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  project_id UUID NOT NULL,
  stage TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT fk_pipeline_logs_job_project FOREIGN KEY (job_id, project_id)
    REFERENCES public.pipeline_jobs (id, project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pipeline_job_logs_job_id ON public.pipeline_job_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_job_logs_project_id ON public.pipeline_job_logs(project_id);

REVOKE UPDATE, DELETE, TRUNCATE ON public.pipeline_job_logs FROM anon, authenticated, public;

-- 17. EXPORT_PACKAGES TABLE
CREATE TABLE IF NOT EXISTS public.export_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
  package_title TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'mp4',
  resolution TEXT NOT NULL DEFAULT '1080p',
  framerate TEXT NOT NULL DEFAULT '24fps',
  audio_channels TEXT NOT NULL DEFAULT 'Stereo 2.0',
  include_subtitles BOOLEAN NOT NULL DEFAULT true,
  subtitle_format TEXT NOT NULL DEFAULT 'srt',
  subtitles_content TEXT,
  file_url TEXT NOT NULL,
  file_size_mb NUMERIC(8,2) NOT NULL DEFAULT 42.50,
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_export_packages_project_id ON public.export_packages(project_id);

CREATE OR REPLACE FUNCTION public.protect_export_package_operational_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'ready' AND OLD.status != 'ready')
       OR (NEW.file_url IS DISTINCT FROM OLD.file_url AND OLD.file_url IS NULL)
       OR NEW.file_size_mb IS DISTINCT FROM OLD.file_size_mb THEN
      RAISE EXCEPTION 'Security Violation: Export package compilation, file URLs, and size metrics are managed exclusively by the master export packaging agent.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_export_package_operational_fields ON public.export_packages;
CREATE TRIGGER trg_protect_export_package_operational_fields
  BEFORE UPDATE ON public.export_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_export_package_operational_fields();

-- ==============================================================================
-- PHASE 6: COMMERCIAL SAAS & IMMUTABLE CREDIT LEDGER
-- ==============================================================================

-- 18. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'creator', 'pro_studio', 'production_house')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  price_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  credits_allotted INTEGER NOT NULL DEFAULT 150,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  payment_provider TEXT NOT NULL DEFAULT 'midtrans',
  payment_method TEXT NOT NULL DEFAULT 'qris',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);

DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 19. CREDIT_TRANSACTIONS TABLE (Engine-Level Immutability Enforcement)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  job_id TEXT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'monthly_allotment', 'admin_adjustment')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  provider TEXT,
  model TEXT,
  operation TEXT NOT NULL,
  estimated_cost_usd NUMERIC(8,4) NOT NULL DEFAULT 0,
  actual_cost_usd NUMERIC(8,4) NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_idempotency ON public.credit_transactions(idempotency_key);

-- IMMUTABLE TRIGGER: Rejects UPDATE, DELETE, and TRUNCATE for application roles
CREATE OR REPLACE FUNCTION public.enforce_immutable_credit_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Ledger Security Violation: credit_transactions records are strictly immutable and cannot be modified or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_immutable_credit_transactions ON public.credit_transactions;
CREATE TRIGGER trg_enforce_immutable_credit_transactions
  BEFORE UPDATE OR DELETE ON public.credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_immutable_credit_ledger();

DROP TRIGGER IF EXISTS trg_enforce_immutable_credit_transactions_truncate ON public.credit_transactions;
CREATE TRIGGER trg_enforce_immutable_credit_transactions_truncate
  BEFORE TRUNCATE ON public.credit_transactions
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.enforce_immutable_credit_ledger();

-- Explicitly revoke mutation privileges from application roles
REVOKE UPDATE, DELETE, TRUNCATE ON public.credit_transactions FROM authenticated, anon, public;

-- 20. PAYMENT_ORDERS TABLE (With Server-Side Package & Pricing Validation)
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL UNIQUE,
  package_type TEXT NOT NULL CHECK (package_type IN ('subscription', 'topup_credits')),
  package_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'IDR',
  payment_gateway TEXT NOT NULL DEFAULT 'midtrans',
  payment_method TEXT NOT NULL DEFAULT 'qris',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'settlement', 'paid', 'expire', 'failed', 'cancel', 'cancelled')),
  credits_granted INTEGER NOT NULL DEFAULT 0 CHECK (credits_granted >= 0),
  external_reference TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON public.payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order_number ON public.payment_orders(order_number);

-- Integrity Trigger: Validates that client-submitted payment orders match official pricing
CREATE OR REPLACE FUNCTION public.validate_payment_order_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strict Catalog Validation on INSERT
  IF TG_OP = 'INSERT' THEN
    -- Enforce order must start as pending
    NEW.status := 'pending';
    NEW.paid_at := NULL;

    -- Topup Credits Catalog Validation
    IF NEW.package_type = 'topup_credits' THEN
      IF NEW.package_id = 'starter_boost' THEN
        IF NEW.amount IS DISTINCT FROM 49000 OR NEW.credits_granted IS DISTINCT FROM 500 OR NEW.currency IS DISTINCT FROM 'IDR' THEN
          RAISE EXCEPTION 'Catalog Tamper Error: starter_boost must be exactly Rp 49.000 IDR for 500 credits';
        END IF;
        NEW.package_name := 'Starter Boost Pack';
      ELSIF NEW.package_id = 'producer_pack' THEN
        IF NEW.amount IS DISTINCT FROM 149000 OR NEW.credits_granted IS DISTINCT FROM 1650 OR NEW.currency IS DISTINCT FROM 'IDR' THEN
          RAISE EXCEPTION 'Catalog Tamper Error: producer_pack must be exactly Rp 149.000 IDR for 1650 credits';
        END IF;
        NEW.package_name := 'Producer Pack';
      ELSIF NEW.package_id = 'studio_block' THEN
        IF NEW.amount IS DISTINCT FROM 449000 OR NEW.credits_granted IS DISTINCT FROM 5750 OR NEW.currency IS DISTINCT FROM 'IDR' THEN
          RAISE EXCEPTION 'Catalog Tamper Error: studio_block must be exactly Rp 449.000 IDR for 5750 credits';
        END IF;
        NEW.package_name := 'Studio Block Pack';
      ELSIF NEW.package_id = 'cinema_bulk' THEN
        IF NEW.amount IS DISTINCT FROM 1499000 OR NEW.credits_granted IS DISTINCT FROM 24000 OR NEW.currency IS DISTINCT FROM 'IDR' THEN
          RAISE EXCEPTION 'Catalog Tamper Error: cinema_bulk must be exactly Rp 1.499.000 IDR for 24000 credits';
        END IF;
        NEW.package_name := 'Cinema Bulk Pack';
      ELSE
        RAISE EXCEPTION 'Catalog Tamper Error: Unknown or unauthorized topup package_id %', NEW.package_id;
      END IF;

    -- Subscription Catalog Validation
    ELSIF NEW.package_type = 'subscription' THEN
      IF NEW.package_id = 'creator_indie' THEN
        IF NEW.amount = 149000 AND NEW.credits_granted = 1500 AND NEW.currency = 'IDR' THEN
          NEW.package_name := 'Creator Indie Monthly';
        ELSIF NEW.amount = 1430000 AND NEW.credits_granted = 18000 AND NEW.currency = 'IDR' THEN
          NEW.package_name := 'Creator Indie Yearly';
        ELSE
          RAISE EXCEPTION 'Catalog Tamper Error: creator_indie subscription must be Rp 149.000 (1500 cr) monthly or Rp 1.430.000 (18000 cr) yearly';
        END IF;
      ELSIF NEW.package_id = 'pro_studio' THEN
        IF NEW.amount = 499000 AND NEW.credits_granted = 6000 AND NEW.currency = 'IDR' THEN
          NEW.package_name := 'Pro Studio Monthly';
        ELSIF NEW.amount = 4790000 AND NEW.credits_granted = 72000 AND NEW.currency = 'IDR' THEN
          NEW.package_name := 'Pro Studio Yearly';
        ELSE
          RAISE EXCEPTION 'Catalog Tamper Error: pro_studio subscription must be Rp 499.000 (6000 cr) monthly or Rp 4.790.000 (72000 cr) yearly';
        END IF;
      ELSIF NEW.package_id = 'production_house' THEN
        IF NEW.amount = 1499000 AND NEW.credits_granted = 20000 AND NEW.currency = 'IDR' THEN
          NEW.package_name := 'Production House Monthly';
        ELSIF NEW.amount = 14390000 AND NEW.credits_granted = 240000 AND NEW.currency = 'IDR' THEN
          NEW.package_name := 'Production House Yearly';
        ELSE
          RAISE EXCEPTION 'Catalog Tamper Error: production_house subscription must be Rp 1.499.000 (20000 cr) monthly or Rp 14.390.000 (240000 cr) yearly';
        END IF;
      ELSE
        RAISE EXCEPTION 'Catalog Tamper Error: Unknown or unauthorized subscription package_id %', NEW.package_id;
      END IF;

    ELSE
      RAISE EXCEPTION 'Catalog Tamper Error: Invalid package_type %', NEW.package_type;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Authenticated clients cannot modify payment_orders at all
    IF auth.role() = 'authenticated' THEN
      RAISE EXCEPTION 'Security Violation: payment_orders records cannot be modified by authenticated clients. Only webhook service_role can update payment status.';
    END IF;

    -- Service role integrity rules:
    IF NEW.user_id IS DISTINCT FROM OLD.user_id 
       OR NEW.order_number IS DISTINCT FROM OLD.order_number
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.package_id IS DISTINCT FROM OLD.package_id
       OR NEW.package_type IS DISTINCT FROM OLD.package_type
       OR NEW.credits_granted IS DISTINCT FROM OLD.credits_granted THEN
      RAISE EXCEPTION 'Integrity Error: Monetary, user, and package attributes on existing payment orders are strictly immutable.';
    END IF;

    -- Cannot downgrade a settled/paid order
    IF OLD.status IN ('completed', 'settlement', 'paid') AND NEW.status NOT IN ('completed', 'settlement', 'paid') THEN
      RAISE EXCEPTION 'Integrity Error: Cannot downgrade completed/settled payment order % to %', OLD.order_number, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment_order_catalog ON public.payment_orders;
CREATE TRIGGER trg_validate_payment_order_catalog
  BEFORE INSERT OR UPDATE ON public.payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payment_order_catalog();

-- Explicitly revoke UPDATE and DELETE on payment_orders from public clients
REVOKE UPDATE, DELETE ON public.payment_orders FROM anon, authenticated, public;

-- ==============================================================================
-- PHASE 7: GLOBAL WORKSPACES & MARKETPLACE TEMPLATES
-- ==============================================================================

-- 21. WORKSPACES TABLE
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'pro_studio',
  max_seats INTEGER NOT NULL DEFAULT 5,
  seat_limit INTEGER NOT NULL DEFAULT 5,
  active_seats_count INTEGER NOT NULL DEFAULT 1,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);

DROP TRIGGER IF EXISTS set_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER set_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Schema Alignment: Link projects to workspaces
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON public.projects(workspace_id);

-- 22. WORKSPACE_MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'writer' CHECK (role IN ('owner', 'director', 'writer', 'reviewer')),
  invited_email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_members_pair UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);

-- 23. WORKSPACE_INVITES TABLE
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'writer' CHECK (role IN ('director', 'writer', 'reviewer')),
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_id ON public.workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON public.workspace_invites(email);

-- 24. MARKETPLACE_TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS public.marketplace_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  genre TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'AI Movie Factory Curators',
  author_avatar TEXT,
  downloads_count INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  credit_cost INTEGER NOT NULL DEFAULT 0,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  thumbnail_url TEXT NOT NULL,
  preview_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_templates_category ON public.marketplace_templates(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_templates_genre ON public.marketplace_templates(genre);

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES AUDIT & ENFORCEMENT
-- Least Privilege, Non-Recursive Architecture & Dynamic Purge Engine
-- ==============================================================================

-- Dynamically drop any pre-existing policies on all 24 tables to guarantee clean state
DO $$
DECLARE
  r RECORD;
  v_tables TEXT[] := ARRAY[
    'profiles', 'projects', 'project_settings', 'story_bibles', 'characters',
    'story_concepts', 'seasons', 'episodes', 'scenes', 'script_versions',
    'agent_project_configs', 'production_tasks', 'agent_execution_logs',
    'assets', 'pipeline_jobs', 'pipeline_job_logs', 'export_packages',
    'subscriptions', 'credit_transactions', 'payment_orders', 'workspaces',
    'workspace_members', 'workspace_invites', 'marketplace_templates'
  ];
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = ANY(v_tables)
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END;
$$;

-- Enable RLS on all 24 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_bibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_project_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_templates ENABLE ROW LEVEL SECURITY;

-- 1. Profiles
CREATE POLICY "Public profiles are readable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile upon signup"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own active profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id AND is_active = true)
  WITH CHECK (auth.uid() = id AND is_active = true);

-- 2. Projects (Active Users Only)
CREATE POLICY "Users can view owned or member workspace projects"
  ON public.projects FOR SELECT
  USING (
    user_id = auth.uid() 
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  );

CREATE POLICY "Active users can insert projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true AND deleted_at IS NULL)
  );

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (user_id = auth.uid());

-- Helper Macro Generator for standard project-owned child tables
DO $$
DECLARE
  t TEXT;
  child_tables TEXT[] := ARRAY[
    'project_settings', 'story_bibles', 'characters', 'story_concepts', 
    'seasons', 'episodes', 'scenes', 'assets', 'pipeline_jobs', 
    'agent_project_configs', 'production_tasks', 'export_packages'
  ];
BEGIN
  FOREACH t IN ARRAY child_tables LOOP
    EXECUTE format('
      CREATE POLICY "Users can view %1$s in accessible projects"
        ON public.%1$I FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM public.projects p 
          WHERE p.id = %1$I.project_id 
            AND (p.user_id = auth.uid() OR (p.workspace_id IS NOT NULL AND public.is_workspace_member(p.workspace_id)))
        ));

      CREATE POLICY "Users can insert %1$s in owned projects"
        ON public.%1$I FOR INSERT
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.projects p 
          WHERE p.id = %1$I.project_id AND p.user_id = auth.uid()
        ));

      CREATE POLICY "Users can update %1$s in owned projects"
        ON public.%1$I FOR UPDATE
        USING (EXISTS (
          SELECT 1 FROM public.projects p 
          WHERE p.id = %1$I.project_id AND p.user_id = auth.uid()
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.projects p 
          WHERE p.id = %1$I.project_id AND p.user_id = auth.uid()
        ));

      CREATE POLICY "Users can delete %1$s in owned projects"
        ON public.%1$I FOR DELETE
        USING (EXISTS (
          SELECT 1 FROM public.projects p 
          WHERE p.id = %1$I.project_id AND p.user_id = auth.uid()
        ));
    ', t);
  END LOOP;
END;
$$;

-- Script Versions
CREATE POLICY "Users can view script versions in accessible scenes"
  ON public.script_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.scenes s 
    JOIN public.projects p ON s.project_id = p.id
    WHERE s.id = script_versions.scene_id 
      AND (p.user_id = auth.uid() OR (p.workspace_id IS NOT NULL AND public.is_workspace_member(p.workspace_id)))
  ));

CREATE POLICY "Users can manage script versions in owned scenes"
  ON public.script_versions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.scenes s 
    JOIN public.projects p ON s.project_id = p.id
    WHERE s.id = script_versions.scene_id AND p.user_id = auth.uid()
  ));

-- Execution Logs (Read-only for users)
CREATE POLICY "Users can view agent logs in accessible projects"
  ON public.agent_execution_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = agent_execution_logs.project_id 
      AND (p.user_id = auth.uid() OR (p.workspace_id IS NOT NULL AND public.is_workspace_member(p.workspace_id)))
  ));

CREATE POLICY "Users can view pipeline logs in accessible projects"
  ON public.pipeline_job_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = pipeline_job_logs.project_id 
      AND (p.user_id = auth.uid() OR (p.workspace_id IS NOT NULL AND public.is_workspace_member(p.workspace_id)))
  ));

-- Subscriptions & Credit Ledger
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their own credit transactions"
  ON public.credit_transactions FOR SELECT
  USING (user_id = auth.uid());

-- Payment Orders
CREATE POLICY "Users can view their own payment orders"
  ON public.payment_orders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Active users can insert pending payment orders"
  ON public.payment_orders FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true AND deleted_at IS NULL)
  );

-- Workspaces
CREATE POLICY "Users can view workspaces they own or belong to as active member"
  ON public.workspaces FOR SELECT
  USING (
    owner_id = auth.uid() 
    OR public.is_workspace_member(id)
  );

CREATE POLICY "Active users can create workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true AND deleted_at IS NULL)
  );

CREATE POLICY "Workspace owners can update workspaces"
  ON public.workspaces FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Workspace owners can delete workspaces"
  ON public.workspaces FOR DELETE
  USING (owner_id = auth.uid());

-- Workspace Members
CREATE POLICY "Users can view their own membership or members of their workspace"
  ON public.workspace_members FOR SELECT
  USING (
    user_id = auth.uid() 
    OR public.is_workspace_owner(workspace_id) 
    OR public.is_workspace_member(workspace_id)
  );

CREATE POLICY "Workspace owners can manage members"
  ON public.workspace_members FOR ALL
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

-- Workspace Invites
CREATE POLICY "Users can view invites sent to their email or for owned workspaces"
  ON public.workspace_invites FOR SELECT
  USING (
    public.is_workspace_owner(workspace_id)
    OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Workspace owners can manage invites"
  ON public.workspace_invites FOR ALL
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

-- Marketplace Templates
CREATE POLICY "Public read for marketplace templates"
  ON public.marketplace_templates FOR SELECT
  TO public
  USING (true);

-- ==============================================================================
-- PHASE 12: SUPABASE STORAGE BUCKETS (character-avatars & project-assets)
-- ==============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES
      ('character-avatars', 'character-avatars', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
      ('project-assets', 'project-assets', true, 52428800, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav'])
    ON CONFLICT (id) DO UPDATE SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

    DROP POLICY IF EXISTS "Public read for character-avatars and project-assets" ON storage.objects;
    CREATE POLICY "Public read for character-avatars and project-assets"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id IN ('character-avatars', 'project-assets'));

    DROP POLICY IF EXISTS "Authenticated users can upload to studio buckets" ON storage.objects;
    CREATE POLICY "Authenticated users can upload to studio buckets"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id IN ('character-avatars', 'project-assets'));

    DROP POLICY IF EXISTS "Authenticated users can update their studio bucket objects" ON storage.objects;
    CREATE POLICY "Authenticated users can update their studio bucket objects"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id IN ('character-avatars', 'project-assets'));

    DROP POLICY IF EXISTS "Authenticated users can delete their studio bucket objects" ON storage.objects;
    CREATE POLICY "Authenticated users can delete their studio bucket objects"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id IN ('character-avatars', 'project-assets'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Storage bucket provisioning skipped or handled externally: %', SQLERRM;
END;
$$;

-- ==============================================================================
-- PHASE 15: CREATOR MILESTONES & GROWTH INTELLIGENCE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.creator_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    project_name TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'reels', 'x_twitter', 'web_drama')),
    video_url TEXT,
    views_count BIGINT DEFAULT 0,
    likes_count BIGINT DEFAULT 0,
    comments_count BIGINT DEFAULT 0,
    revenue_earned NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'IDR',
    release_date TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_milestones_user_id ON public.creator_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_milestones_project_id ON public.creator_milestones(project_id);

ALTER TABLE public.creator_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own creator milestones" ON public.creator_milestones;
CREATE POLICY "Users can view own creator milestones"
    ON public.creator_milestones FOR SELECT
    USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can create own creator milestones" ON public.creator_milestones;
CREATE POLICY "Users can create own creator milestones"
    ON public.creator_milestones FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own creator milestones" ON public.creator_milestones;
CREATE POLICY "Users can update own creator milestones"
    ON public.creator_milestones FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own creator milestones" ON public.creator_milestones;
CREATE POLICY "Users can delete own creator milestones"
    ON public.creator_milestones FOR DELETE
    USING (auth.uid() = user_id);

-- ==============================================================================
-- PHASE 15 SPRINT 3: CREATOR MEDIA KITS & COMMERCIAL PROPOSAL
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.creator_media_kits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    studio_name TEXT NOT NULL,
    bio TEXT,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    primary_niche TEXT DEFAULT 'Sci-Fi Cyberpunk & Misteri Folklor',
    location TEXT DEFAULT 'Indonesia (Global Remote Production)',
    rate_card_tier1 NUMERIC DEFAULT 2500000,
    rate_card_tier2 NUMERIC DEFAULT 5000000,
    rate_card_tier3 NUMERIC DEFAULT 12500000,
    custom_pitch_hook TEXT,
    is_public BOOLEAN NOT NULL DEFAULT false,
    share_phone BOOLEAN NOT NULL DEFAULT false,
    share_email BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT creator_media_kits_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_media_kits_user_id ON public.creator_media_kits(user_id);

ALTER TABLE public.creator_media_kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own media kit" ON public.creator_media_kits;
CREATE POLICY "Users can view own media kit"
    ON public.creator_media_kits FOR SELECT
    USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can upsert own media kit" ON public.creator_media_kits;
CREATE POLICY "Users can upsert own media kit"
    ON public.creator_media_kits FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Dedicated Sanitized Public View for External Brand Sponsors
CREATE OR REPLACE VIEW public.creator_public_media_kits AS
SELECT 
    id,
    user_id,
    studio_name,
    bio,
    primary_niche,
    location,
    rate_card_tier1,
    rate_card_tier2,
    rate_card_tier3,
    custom_pitch_hook,
    CASE WHEN share_email = true THEN contact_email ELSE NULL END AS contact_email,
    CASE WHEN share_phone = true THEN contact_phone ELSE NULL END AS contact_phone,
    updated_at
FROM public.creator_media_kits
WHERE is_public = true;

GRANT SELECT ON public.creator_public_media_kits TO anon, authenticated;

-- ==============================================================================
-- UNIVERSAL MULTI-PLATFORM PUBLISHING JOBS QUEUE (T9.2)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.publishing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    export_package_id UUID REFERENCES public.export_packages(id) ON DELETE SET NULL,
    platform TEXT NOT NULL,
    provider_account_id TEXT,
    target_format TEXT NOT NULL DEFAULT '16:9',
    title TEXT NOT NULL,
    caption TEXT,
    description TEXT,
    hashtags TEXT[] DEFAULT '{}',
    thumbnail_url TEXT,
    media_url TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft',
    progress_percentage INTEGER NOT NULL DEFAULT 0,
    retry_count INTEGER NOT NULL DEFAULT 0,
    external_publish_id TEXT,
    published_video_url TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT publishing_jobs_status_check CHECK (
        status IN (
            'draft',
            'queued',
            'scheduled',
            'processing',
            'uploading',
            'published',
            'requires_user_action',
            'failed',
            'cancelled'
        )
    ),
    CONSTRAINT publishing_jobs_progress_check CHECK (
        progress_percentage >= 0 AND progress_percentage <= 100
    )
);

CREATE INDEX IF NOT EXISTS idx_publishing_jobs_user_status ON public.publishing_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_project ON public.publishing_jobs(project_id);

ALTER TABLE public.publishing_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own publishing jobs" ON public.publishing_jobs;
CREATE POLICY "Users can view own publishing jobs"
    ON public.publishing_jobs FOR SELECT
    USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own draft publishing jobs" ON public.publishing_jobs;
CREATE POLICY "Users can insert own draft publishing jobs"
    ON public.publishing_jobs FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND status IN ('draft', 'queued')
        AND published_video_url IS NULL
        AND external_publish_id IS NULL
    );

DROP POLICY IF EXISTS "Users can update own draft publishing jobs" ON public.publishing_jobs;
CREATE POLICY "Users can update own draft publishing jobs"
    ON public.publishing_jobs FOR UPDATE
    USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()))
    WITH CHECK (
        (
            auth.uid() = user_id
            AND status IN ('draft', 'queued', 'scheduled', 'cancelled')
            AND (
                status != 'published' 
                OR (OLD.status = 'published' AND published_video_url = OLD.published_video_url)
            )
        )
        OR public.is_platform_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Users can delete own draft or cancelled jobs" ON public.publishing_jobs;
CREATE POLICY "Users can delete own draft or cancelled jobs"
    ON public.publishing_jobs FOR DELETE
    USING (
        auth.uid() = user_id 
        AND status IN ('draft', 'cancelled', 'failed')
    );

CREATE OR REPLACE FUNCTION public.validate_publishing_job_client_update()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NULL OR public.is_platform_admin(auth.uid()) THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'published' AND OLD.status != 'published' THEN
        RAISE EXCEPTION 'Otorisasi ditolak: Status published hanya dapat ditetapkan oleh serverless publishing worker.';
    END IF;

    IF NEW.published_video_url IS DISTINCT FROM OLD.published_video_url AND OLD.published_video_url IS NOT NULL THEN
        RAISE EXCEPTION 'Otorisasi ditolak: Tautan video terpublikasi tidak dapat diubah oleh client.';
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_publishing_job_update ON public.publishing_jobs;
CREATE TRIGGER trg_validate_publishing_job_update
    BEFORE UPDATE ON public.publishing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_publishing_job_client_update();

-- ==============================================================================
-- ENCRYPTED PLATFORM OAUTH TOKEN VAULT (T9.3 - V3.8)
-- ==============================================================================
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

CREATE INDEX IF NOT EXISTS idx_platform_oauth_tokens_user_platform
    ON public.platform_oauth_tokens(user_id, platform);

CREATE INDEX IF NOT EXISTS idx_platform_oauth_tokens_status
    ON public.platform_oauth_tokens(connection_status);

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

ALTER TABLE public.platform_oauth_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_oauth_tokens FROM anon, authenticated;
GRANT ALL ON TABLE public.platform_oauth_tokens TO service_role;

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

COMMIT;
-- ==============================================================================
-- END OF MASTER DATABASE MIGRATION SCRIPT (V3.2 ENTERPRISE MASTER)
-- ==============================================================================
