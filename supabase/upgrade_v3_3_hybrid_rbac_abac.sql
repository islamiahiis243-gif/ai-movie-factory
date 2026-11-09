-- ==============================================================================
-- AI MOVIE FACTORY - MASTER V3.3 HYBRID RBAC + ABAC ARCHITECTURE MIGRATION
-- Standardizes 3-Tier Enterprise Security:
-- Level 1: Platform Level (Pure RBAC)
-- Level 2: Workspace & Studio Team (Workspace RBAC)
-- Level 3: Contextual Quota, Financial, & Render (Contextual ABAC)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. LEVEL 1: PLATFORM RBAC HELPER FUNCTIONS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id 
      AND is_active = true 
      AND deleted_at IS NULL
      AND (role = 'admin' OR LOWER(email) = 'islamiahiis243@gmail.com')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. LEVEL 2: WORKSPACE RBAC EXTENDED FUNCTIONS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_workspace_user_role(p_workspace_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF p_user_id IS NULL OR p_workspace_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = p_workspace_id AND owner_id = p_user_id) THEN
    RETURN 'owner';
  END IF;

  SELECT role INTO v_role
  FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND status = 'active'
  LIMIT 1;

  RETURN v_role;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_workspace_user_role(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. LEVEL 3: CONTEXTUAL ABAC (RESOLUTION, SEATS, & LEDGER DEFENSE)
-- ------------------------------------------------------------------------------

-- Allow administrative rollback of payment orders in validate_payment_order_catalog
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
    -- Authenticated clients cannot modify payment_orders directly
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

    -- Cannot downgrade a settled/paid order to pending or processing.
    -- (Allows cancellation/refund: status 'cancelled', 'cancel', or 'refunded')
    IF OLD.status IN ('completed', 'settlement', 'paid') AND NEW.status IN ('pending', 'processing') THEN
      RAISE EXCEPTION 'Integrity Error: Cannot downgrade completed/settled payment order % to pending/processing status.', OLD.order_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_payment_order_catalog() FROM PUBLIC, anon, authenticated;

COMMIT;
