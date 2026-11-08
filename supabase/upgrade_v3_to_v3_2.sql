-- ==============================================================================
-- AI MOVIE FACTORY - MASTER V3.2 ENTERPRISE UPGRADE MIGRATION
-- Production Hardening, Comprehensive RLS Purge, Operational Field Defense,
-- Strict Server-Side Payment & Soft-Delete Enforcement
-- Preserves 100% of Existing Data (Non-Destructive In-Place Upgrade)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SCHEMA ALIGNMENT: WORKSPACE_ID ON PROJECTS & FINANCIAL RETENTION
-- ------------------------------------------------------------------------------

-- Ensure workspace_id column exists on projects and links to workspaces
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON public.projects(workspace_id);

-- Ensure soft-delete columns exist on profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Profile Protection Trigger: Prevent clients from un-deleting themselves or modifying role/email/status
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

-- Restrict invitation roles: cannot invite someone as 'owner' to prevent takeover
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' 
      AND table_name = 'workspace_invites' 
      AND constraint_name = 'chk_workspace_invites_role_not_owner'
  ) THEN
    ALTER TABLE public.workspace_invites 
      ADD CONSTRAINT chk_workspace_invites_role_not_owner 
      CHECK (role IN ('director', 'writer', 'reviewer'));
  END IF;
END;
$$;

-- Re-align credit_transactions foreign key to ON DELETE RESTRICT
DO $$
DECLARE
  v_con_name TEXT;
BEGIN
  SELECT constraint_name INTO v_con_name
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' 
    AND table_name = 'credit_transactions' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%user_id%';

  IF v_con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.credit_transactions DROP CONSTRAINT %I;', v_con_name);
  END IF;

  ALTER TABLE public.credit_transactions 
    ADD CONSTRAINT fk_credit_transactions_user_id 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
    ON DELETE RESTRICT;
END;
$$;

-- Align payment_orders foreign key to ON DELETE RESTRICT
DO $$
DECLARE
  v_con_name TEXT;
BEGIN
  SELECT constraint_name INTO v_con_name
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' 
    AND table_name = 'payment_orders' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%user_id%';

  IF v_con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.payment_orders DROP CONSTRAINT %I;', v_con_name);
  END IF;

  ALTER TABLE public.payment_orders 
    ADD CONSTRAINT fk_payment_orders_user_id 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
    ON DELETE RESTRICT;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. HARDENED SECURITY DEFINER HELPERS (ACTIVE PROFILE & ACTIVE STATUS CHECKS)
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

  -- Verify user is active and not soft-deleted
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

  -- Verify user is active and not soft-deleted
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

REVOKE ALL ON FUNCTION public.is_workspace_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(UUID) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_workspace_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. TENANT PROJECT IMMUTABILITY ON ALL CREATIVE CHILD ENTITIES
-- ------------------------------------------------------------------------------

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

-- Attach project immutability trigger across all relevant tables
DO $$
DECLARE
  t TEXT;
  tables_to_protect TEXT[] := ARRAY[
    'project_settings', 'story_bibles', 'characters', 'story_concepts', 
    'seasons', 'episodes', 'scenes', 'assets', 'pipeline_jobs', 
    'agent_project_configs', 'production_tasks', 'export_packages'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_protect LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_prevent_%I_project_reassignment ON public.%I;', t, t);
      EXECUTE format('CREATE TRIGGER trg_prevent_%I_project_reassignment BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_project_id_reassignment();', t, t);
    END IF;
  END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. STRICT PAYMENT ORDER PROTECTION (NULL-SAFE & SERVER-CONTROLLED)
-- ------------------------------------------------------------------------------

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
    -- Cannot change user_id, order_number, amount, currency, or package attributes
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

-- ------------------------------------------------------------------------------
-- 5. OPERATIONAL FIELD DEFENSE (PIPELINE JOBS, TASKS, LOGS, EXPORTS)
-- ------------------------------------------------------------------------------

-- Pipeline Jobs Operational Defense
CREATE OR REPLACE FUNCTION public.protect_pipeline_job_operational_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.credit_cost IS DISTINCT FROM OLD.credit_cost 
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.current_stage IS DISTINCT FROM OLD.current_stage
       OR NEW.progress IS DISTINCT FROM OLD.progress
       OR NEW.stages_completed IS DISTINCT FROM OLD.stages_completed
       OR NEW.qc_report IS DISTINCT FROM OLD.qc_report
       OR NEW.generated_asset_ids IS DISTINCT FROM OLD.generated_asset_ids
       OR NEW.error_message IS DISTINCT FROM OLD.error_message
       OR NEW.started_at IS DISTINCT FROM OLD.started_at
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
      RAISE EXCEPTION 'Security Violation: Pipeline job operational fields (status, progress, stages, qc, cost, timing) are managed exclusively by backend execution agents.';
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

-- Production Tasks Operational Defense
CREATE OR REPLACE FUNCTION public.protect_production_task_operational_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completed' AND OLD.status != 'completed')
       OR NEW.task_output IS DISTINCT FROM OLD.task_output
       OR NEW.credits_consumed IS DISTINCT FROM OLD.credits_consumed THEN
      RAISE EXCEPTION 'Security Violation: Production task completion and credit consumption are managed exclusively by agent workers.';
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

-- Export Packages Operational Defense
CREATE OR REPLACE FUNCTION public.protect_export_package_operational_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completed' AND OLD.status != 'completed')
       OR (NEW.download_url IS DISTINCT FROM OLD.download_url AND OLD.download_url IS NULL)
       OR NEW.file_size_bytes IS DISTINCT FROM OLD.file_size_bytes THEN
      RAISE EXCEPTION 'Security Violation: Export package compilation, artifact URLs, and file sizes are generated exclusively by master packaging workers.';
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

-- Logs Immutability: Prevent client mutation of execution logs
REVOKE UPDATE, DELETE, TRUNCATE ON public.pipeline_job_logs FROM anon, authenticated, public;
REVOKE UPDATE, DELETE, TRUNCATE ON public.agent_execution_logs FROM anon, authenticated, public;

-- ------------------------------------------------------------------------------
-- 6. DYNAMIC RLS PURGE & CANONICAL POLICY RE-INSTALLATION (ALL 24 TABLES)
-- Drops every existing policy on all 24 tables to eliminate legacy permissive rules,
-- then installs the strict, canonical V3.2 policies.
-- ------------------------------------------------------------------------------

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

-- Ensure RLS is active on all 24 tables
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

COMMIT;
-- ==============================================================================
-- END OF V3.2 ENTERPRISE UPGRADE MIGRATION
-- ==============================================================================
