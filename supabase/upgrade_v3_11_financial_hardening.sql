-- ============================================================================
-- UPGRADE V3.11 — FINANCIAL INFRASTRUCTURE & ATOMIC CREDIT ECONOMY HARDENING
-- AI Movie Factory (AMF) — Production Stage 2
-- Guarantees ACID atomic balance verification, 2-phase reserve->settle/release,
-- zero-balance overdraft defense, and real usage metering.
-- ============================================================================

-- 1. Create credit_reservations table
CREATE TABLE IF NOT EXISTS public.credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  operation TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google_gemini',
  model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'settled', 'released', 'expired')),
  idempotency_key TEXT UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  settled_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_user_status 
  ON public.credit_reservations(user_id, status);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_expires_at 
  ON public.credit_reservations(expires_at) 
  WHERE status = 'reserved';

-- 2. Create ai_usage_records table (Usage Metering SSOT)
CREATE TABLE IF NOT EXISTS public.ai_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  agent_id TEXT,
  operation TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google_gemini',
  model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  request_id TEXT,
  prompt_tokens INTEGER DEFAULT 0,
  candidates_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  duration_seconds NUMERIC(8,2) DEFAULT NULL,
  resolution TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'timeout')),
  credits_reserved INTEGER NOT NULL DEFAULT 0,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  provider_cost_usd NUMERIC(10,6) DEFAULT 0,
  cost_status TEXT NOT NULL DEFAULT 'free_tier' CHECK (cost_status IN ('free_tier', 'metered_real', 'estimated', 'unknown')),
  raw_usage_metadata JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_records_user 
  ON public.ai_usage_records(user_id, created_at DESC);

-- 3. Stored Procedure: get_user_credit_balance
CREATE OR REPLACE FUNCTION public.get_user_credit_balance(p_user_id UUID)
RETURNS TABLE (
  settled_balance INTEGER,
  reserved_balance INTEGER,
  available_balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_settled INTEGER := 150;
  v_reserved INTEGER := 0;
  v_sub_credits INTEGER;
BEGIN
  -- 1. Read latest settled balance from immutable credit_transactions
  SELECT balance_after INTO v_settled
  FROM public.credit_transactions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Fallback to subscription credits if no transactions exist yet
  IF v_settled IS NULL THEN
    SELECT credits_allotted INTO v_sub_credits
    FROM public.subscriptions
    WHERE user_id = p_user_id
    LIMIT 1;

    v_settled := COALESCE(v_sub_credits, 150);
  END IF;

  -- 2. Read active reserved credits (not expired)
  SELECT COALESCE(SUM(amount), 0)::INTEGER INTO v_reserved
  FROM public.credit_reservations
  WHERE user_id = p_user_id
    AND status = 'reserved'
    AND expires_at > now();

  RETURN QUERY SELECT 
    v_settled,
    v_reserved,
    GREATEST(0, v_settled - v_reserved);
END;
$$;

-- 4. Stored Procedure: reserve_credits (Atomic with Row-Locking)
CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_operation TEXT,
  p_provider TEXT DEFAULT 'google_gemini',
  p_model TEXT DEFAULT 'gemini-2.5-flash',
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  reservation_id UUID,
  status TEXT,
  available_balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_res_id UUID;
  v_existing_status TEXT;
  v_settled INTEGER;
  v_reserved INTEGER;
  v_available INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Jumlah kredit reservasi harus lebih besar dari 0.';
  END IF;

  -- 1. Row-lock user profile to guarantee serialized balance computation
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  -- 2. Check idempotency if key provided
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT id, credit_reservations.status INTO v_res_id, v_existing_status
    FROM public.credit_reservations
    WHERE idempotency_key = p_idempotency_key;

    IF v_res_id IS NOT NULL THEN
      SELECT b.available_balance INTO v_available FROM public.get_user_credit_balance(p_user_id) b;
      RETURN QUERY SELECT v_res_id, v_existing_status, v_available;
      RETURN;
    END IF;
  END IF;

  -- 3. Calculate current available balance with row locked
  SELECT b.settled_balance, b.reserved_balance, b.available_balance 
  INTO v_settled, v_reserved, v_available
  FROM public.get_user_credit_balance(p_user_id) b;

  -- 4. Reject if insufficient
  IF v_available < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS: Saldo kredit tidak mencukupi (Tersedia: %, Diperlukan: %)', v_available, p_amount;
  END IF;

  -- 5. Insert new reservation
  INSERT INTO public.credit_reservations (
    user_id,
    amount,
    operation,
    provider,
    model,
    status,
    idempotency_key,
    expires_at
  ) VALUES (
    p_user_id,
    p_amount,
    p_operation,
    p_provider,
    p_model,
    'reserved',
    p_idempotency_key,
    now() + interval '5 minutes'
  ) RETURNING id INTO v_res_id;

  RETURN QUERY SELECT v_res_id, 'reserved'::TEXT, (v_available - p_amount);
END;
$$;

-- 5. Stored Procedure: settle_credits (Atomic with Ledger Append)
CREATE OR REPLACE FUNCTION public.settle_credits(
  p_reservation_id UUID,
  p_actual_amount INTEGER,
  p_provider_cost_usd NUMERIC DEFAULT 0,
  p_usage_metadata JSONB DEFAULT NULL,
  p_description TEXT DEFAULT 'Eksekusi AI Studio'
)
RETURNS TABLE (
  transaction_id UUID,
  new_balance INTEGER,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_res RECORD;
  v_settled INTEGER;
  v_new_bal INTEGER;
  v_tx_id UUID;
BEGIN
  -- 1. Lock reservation row
  SELECT * INTO v_res
  FROM public.credit_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND: Reservasi kredit tidak ditemukan.';
  END IF;

  IF v_res.status = 'settled' THEN
    -- Idempotent return if already settled
    SELECT b.settled_balance INTO v_settled FROM public.get_user_credit_balance(v_res.user_id) b;
    RETURN QUERY SELECT NULL::UUID, v_settled, 'already_settled'::TEXT;
    RETURN;
  END IF;

  IF v_res.status <> 'reserved' THEN
    RAISE EXCEPTION 'INVALID_RESERVATION_STATUS: Reservasi kredit berstatus %, tidak dapat diselesaikan.', v_res.status;
  END IF;

  -- 2. Lock user profile to serialize ledger update
  PERFORM 1 FROM public.profiles WHERE id = v_res.user_id FOR UPDATE;

  -- 3. Read current settled balance
  SELECT b.settled_balance INTO v_settled
  FROM public.get_user_credit_balance(v_res.user_id) b;

  v_new_bal := v_settled - p_actual_amount;

  IF v_new_bal < 0 THEN
    RAISE EXCEPTION 'NEGATIVE_BALANCE_VIOLATION: Penyelesaian kredit akan menyebabkan saldo negatif (%). Transaksi dibatalkan.', v_new_bal;
  END IF;

  -- 4. Mark reservation settled
  UPDATE public.credit_reservations
  SET status = 'settled',
      settled_at = now()
  WHERE id = p_reservation_id;

  -- 5. Append immutable record to credit_transactions
  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    provider,
    model,
    operation,
    estimated_cost_usd,
    actual_cost_usd,
    description,
    status,
    idempotency_key
  ) VALUES (
    v_res.user_id,
    'usage',
    -p_actual_amount,
    v_new_bal,
    v_res.provider,
    v_res.model,
    v_res.operation,
    p_provider_cost_usd,
    p_provider_cost_usd,
    p_description,
    'completed',
    'settle_' || p_reservation_id::TEXT
  ) RETURNING id INTO v_tx_id;

  RETURN QUERY SELECT v_tx_id, v_new_bal, 'settled'::TEXT;
END;
$$;

-- 6. Stored Procedure: release_credits (Failure / Timeout Rollback)
CREATE OR REPLACE FUNCTION public.release_credits(
  p_reservation_id UUID,
  p_reason TEXT DEFAULT 'Proses dibatalkan atau terjadi kegagalan provider'
)
RETURNS TABLE (
  status TEXT,
  available_balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_res RECORD;
  v_avail INTEGER;
BEGIN
  -- 1. Lock reservation row
  SELECT * INTO v_res
  FROM public.credit_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND: Reservasi kredit tidak ditemukan.';
  END IF;

  IF v_res.status = 'released' THEN
    SELECT b.available_balance INTO v_avail FROM public.get_user_credit_balance(v_res.user_id) b;
    RETURN QUERY SELECT 'already_released'::TEXT, v_avail;
    RETURN;
  END IF;

  IF v_res.status = 'settled' THEN
    RAISE EXCEPTION 'CANNOT_RELEASE_SETTLED: Reservasi kredit telah diselesaikan, gunakan refund_tx untuk pengembalian.';
  END IF;

  -- 2. Mark reservation released
  UPDATE public.credit_reservations
  SET status = 'released',
      released_at = now()
  WHERE id = p_reservation_id;

  -- 3. Return updated available balance
  SELECT b.available_balance INTO v_avail FROM public.get_user_credit_balance(v_res.user_id) b;
  RETURN QUERY SELECT 'released'::TEXT, v_avail;
END;
$$;

-- 7. Permissions and RLS
ALTER TABLE public.credit_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_records ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.credit_reservations FROM anon, authenticated;
REVOKE ALL ON TABLE public.ai_usage_records FROM anon, authenticated;

GRANT ALL ON TABLE public.credit_reservations TO service_role, postgres;
GRANT ALL ON TABLE public.ai_usage_records TO service_role, postgres;

GRANT SELECT ON TABLE public.credit_reservations TO authenticated;
GRANT SELECT ON TABLE public.ai_usage_records TO authenticated;

DROP POLICY IF EXISTS "Users can view own reservations" ON public.credit_reservations;
CREATE POLICY "Users can view own reservations"
  ON public.credit_reservations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view own ai usage records" ON public.ai_usage_records;
CREATE POLICY "Users can view own ai usage records"
  ON public.ai_usage_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

-- Grants on Stored Procedures
REVOKE EXECUTE ON FUNCTION public.reserve_credits(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_credits(UUID, INTEGER, NUMERIC, JSONB, TEXT) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_credits(UUID, TEXT) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_credit_balance(UUID) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.reserve_credits(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.settle_credits(UUID, INTEGER, NUMERIC, JSONB, TEXT) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.release_credits(UUID, TEXT) TO service_role, postgres;
