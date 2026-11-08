-- ============================================================================
-- Phase 6: Commercial SaaS Schema Migration (SSOT Sections 16, 21, 22, 23, 41)
-- Credit Ledger Auditing, Subscription Tiers, Payment Orders & RLS
-- ============================================================================

-- Table 1: public.subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    price_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'IDR',
    credits_allotted INTEGER NOT NULL DEFAULT 150,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + INTERVAL '30 days'),
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    payment_provider TEXT NOT NULL DEFAULT 'midtrans',
    payment_method TEXT NOT NULL DEFAULT 'qris',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Table 2: public.credit_transactions
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    job_id TEXT,
    transaction_type TEXT NOT NULL,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Table 3: public.payment_orders
CREATE TABLE IF NOT EXISTS public.payment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL UNIQUE,
    package_type TEXT NOT NULL,
    package_id TEXT NOT NULL,
    package_name TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'IDR',
    payment_gateway TEXT NOT NULL DEFAULT 'midtrans',
    payment_method TEXT NOT NULL DEFAULT 'qris',
    status TEXT NOT NULL DEFAULT 'pending',
    credits_granted INTEGER NOT NULL DEFAULT 0,
    external_reference TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON public.payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order_number ON public.payment_orders(order_number);

-- Enable Row Level Security (RLS)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view & manage their own subscriptions and orders
CREATE POLICY "Users can manage own subscriptions"
    ON public.subscriptions
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own credit transactions"
    ON public.credit_transactions
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view and create own payment orders"
    ON public.payment_orders
    FOR ALL
    USING (auth.uid() = user_id);
