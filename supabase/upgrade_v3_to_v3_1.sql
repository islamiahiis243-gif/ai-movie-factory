-- ==============================================================================
-- AI MOVIE FACTORY - V3.0 TO V3.1 ENTERPRISE UPGRADE MIGRATION
-- Non-Destructive In-Place Upgrade Script (Preserves 100% of Existing Data)
-- Target: PostgreSQL 15+ / Supabase Live Project
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SOFT-DELETE & FINANCIAL LEDGER RETENTION HARMONIZATION
-- Resolve conflict between immutable credit_transactions and profiles deletion.
-- ------------------------------------------------------------------------------

-- Add soft-delete fields to profiles if not present
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Harmonize foreign key on credit_transactions to ON DELETE RESTRICT
-- to prevent cascade attempts against immutable ledger
DO $$
BEGIN
  -- Drop existing cascade constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'credit_transactions_user_id_fkey' 
      AND table_name = 'credit_transactions'
  ) THEN
    ALTER TABLE public.credit_transactions 
      DROP CONSTRAINT credit_transactions_user_id_fkey;
  END IF;

  -- Add RESTRICT constraint
  ALTER TABLE public.credit_transactions 
    ADD CONSTRAINT credit_transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
    ON DELETE RESTRICT;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. HARDEN WORKSPACE MEMBERSHIP EVALUATION (STATUS = 'active' ENFORCEMENT)
-- Prevents 'pending' or 'suspended' members from accessing workspace resources.
-- ------------------------------------------------------------------------------
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

  RETURN EXISTS (
    SELECT 1 
    FROM public.workspace_members 
    WHERE workspace_id = p_workspace_id 
      AND user_id = v_uid
      AND status = 'active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_workspace_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. STRICT PAYMENT CATALOG VALIDATION & UNKNOWN PACKAGE REJECTION
-- Validates both topup and subscription packages against SSOT Sections 21 & 22.
-- Rejects unknown package_ids and prevents client self-promotion to paid/settlement.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_payment_order_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Topup Credits Catalog Validation
  IF NEW.package_type = 'topup_credits' THEN
    IF NEW.package_id = 'starter_boost' THEN
      IF NEW.amount != 49000 OR NEW.credits_granted != 500 OR NEW.currency != 'IDR' THEN
        RAISE EXCEPTION 'Catalog Tamper Error: starter_boost must be exactly Rp 49.000 IDR for 500 credits';
      END IF;
      NEW.package_name := 'Starter Boost Pack';
    ELSIF NEW.package_id = 'producer_pack' THEN
      IF NEW.amount != 149000 OR NEW.credits_granted != 1650 OR NEW.currency != 'IDR' THEN
        RAISE EXCEPTION 'Catalog Tamper Error: producer_pack must be exactly Rp 149.000 IDR for 1650 credits';
      END IF;
      NEW.package_name := 'Producer Pack';
    ELSIF NEW.package_id = 'studio_block' THEN
      IF NEW.amount != 449000 OR NEW.credits_granted != 5750 OR NEW.currency != 'IDR' THEN
        RAISE EXCEPTION 'Catalog Tamper Error: studio_block must be exactly Rp 449.000 IDR for 5750 credits';
      END IF;
      NEW.package_name := 'Studio Block Pack';
    ELSIF NEW.package_id = 'cinema_bulk' THEN
      IF NEW.amount != 1499000 OR NEW.credits_granted != 24000 OR NEW.currency != 'IDR' THEN
        RAISE EXCEPTION 'Catalog Tamper Error: cinema_bulk must be exactly Rp 1.499.000 IDR for 24000 credits';
      END IF;
      NEW.package_name := 'Cinema Bulk Pack';
    ELSE
      RAISE EXCEPTION 'Catalog Tamper Error: Unknown or unauthorized topup package_id %', NEW.package_id;
    END IF;

  -- Subscription Catalog Validation
  ELSIF NEW.package_type = 'subscription' THEN
    IF NEW.package_id = 'creator_indie' THEN
      IF NEW.amount != 149000 OR NEW.credits_granted != 1500 OR NEW.currency != 'IDR' THEN
        RAISE EXCEPTION 'Catalog Tamper Error: creator_indie subscription must be exactly Rp 149.000 IDR for 1500 monthly credits';
      END IF;
      NEW.package_name := 'Creator Indie Monthly';
    ELSIF NEW.package_id = 'pro_studio' THEN
      IF NEW.amount != 499000 OR NEW.credits_granted != 6000 OR NEW.currency != 'IDR' THEN
        RAISE EXCEPTION 'Catalog Tamper Error: pro_studio subscription must be exactly Rp 499.000 IDR for 6000 monthly credits';
      END IF;
      NEW.package_name := 'Pro Studio Monthly';
    ELSIF NEW.package_id = 'production_house' THEN
      IF NEW.amount != 1499000 OR NEW.credits_granted != 20000 OR NEW.currency != 'IDR' THEN
        RAISE EXCEPTION 'Catalog Tamper Error: production_house subscription must be exactly Rp 1.499.000 IDR for 20000 monthly credits';
      END IF;
      NEW.package_name := 'Production House Monthly';
    ELSE
      RAISE EXCEPTION 'Catalog Tamper Error: Unknown or unauthorized subscription package_id %', NEW.package_id;
    END IF;

  ELSE
    RAISE EXCEPTION 'Catalog Tamper Error: Invalid package_type %', NEW.package_type;
  END IF;

  -- Forbid client self-marking as completed, settlement, or paid
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('pending', 'processing') THEN
      NEW.status := 'pending';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF auth.role() = 'authenticated' AND NEW.status IN ('completed', 'settlement', 'paid') AND OLD.status NOT IN ('completed', 'settlement', 'paid') THEN
      RAISE EXCEPTION 'Security Violation: Payment status transitions to paid/settlement can only be executed by webhook service role';
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

-- ------------------------------------------------------------------------------
-- 4. PARENT ENTITY PROJECT_ID IMMUTABILITY
-- Prevents reassigning project_id on characters, scenes, and episodes,
-- ensuring assets and pipeline_jobs never point to cross-project entities.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_project_id_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id <> OLD.project_id THEN
    RAISE EXCEPTION 'Integrity Violation: Moving % records across projects is strictly prohibited.', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_character_project_reassignment ON public.characters;
CREATE TRIGGER trg_prevent_character_project_reassignment
  BEFORE UPDATE ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_project_id_reassignment();

DROP TRIGGER IF EXISTS trg_prevent_scene_project_reassignment ON public.scenes;
CREATE TRIGGER trg_prevent_scene_project_reassignment
  BEFORE UPDATE ON public.scenes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_project_id_reassignment();

DROP TRIGGER IF EXISTS trg_prevent_episode_project_reassignment ON public.episodes;
CREATE TRIGGER trg_prevent_episode_project_reassignment
  BEFORE UPDATE ON public.episodes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_project_id_reassignment();

-- ------------------------------------------------------------------------------
-- 5. OPERATIONAL FIELD PROTECTION FOR PIPELINE JOBS
-- Prevents ordinary authenticated clients from tampering with credit costs.
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 6. WORKSPACE MEMBERS RLS REFINEMENT (STATUS-AWARE)
-- Pending and suspended members cannot read other members of the workspace.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Workspace members can view members" ON public.workspace_members;
CREATE POLICY "Workspace members can view members"
  ON public.workspace_members FOR SELECT
  USING (
    user_id = auth.uid() 
    OR public.is_workspace_owner(workspace_id)
    OR public.is_workspace_member(workspace_id)
  );

COMMIT;
-- ==============================================================================
-- END OF V3.1 UPGRADE MIGRATION
-- ==============================================================================
