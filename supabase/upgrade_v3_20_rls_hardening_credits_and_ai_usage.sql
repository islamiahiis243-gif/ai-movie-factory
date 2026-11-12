-- ============================================================================
-- AI MOVIE FACTORY — DATABASE SECURITY UPGRADE V3.20
-- RLS Hardening for Credit Reservations & AI Usage Records (SSOT Security Compliance)
-- ============================================================================

-- 1. Enable Row Level Security
ALTER TABLE public.credit_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_records ENABLE ROW LEVEL SECURITY;

-- 2. Revoke all privileges from anon & authenticated to eliminate unauthorized access
REVOKE ALL ON TABLE public.credit_reservations FROM anon, authenticated;
REVOKE ALL ON TABLE public.ai_usage_records FROM anon, authenticated;

-- 3. Grant full administrative privileges strictly to service_role and postgres
GRANT ALL ON TABLE public.credit_reservations TO service_role, postgres;
GRANT ALL ON TABLE public.ai_usage_records TO service_role, postgres;

-- 4. Grant strictly read-only (SELECT) privileges to authenticated users
GRANT SELECT ON TABLE public.credit_reservations TO authenticated;
GRANT SELECT ON TABLE public.ai_usage_records TO authenticated;

-- 5. Ensure fail-closed RLS policies for authenticated users (own records or platform admin)
DROP POLICY IF EXISTS "Users can view own reservations" ON public.credit_reservations;
CREATE POLICY "Users can view own reservations"
  ON public.credit_reservations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view own ai usage records" ON public.ai_usage_records;
CREATE POLICY "Users can view own ai usage records"
  ON public.ai_usage_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_platform_admin(auth.uid()));
