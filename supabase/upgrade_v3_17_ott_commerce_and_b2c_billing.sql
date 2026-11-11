-- ==============================================================================
-- Migration: upgrade_v3_17_ott_commerce_and_b2c_billing.sql
-- Milestone: 2.9.3 — B2C Payment / OTT Commerce (Storefront Monetization & Access Fulfillment)
-- 
-- Strictly isolates B2C viewer movie ticket purchases (TVOD/PPV & SVOD) from
-- creator SaaS credit billing (payment_orders).
-- ==============================================================================

-- 0. Channel SVOD Subscription Pricing Fields
ALTER TABLE public.ott_channels 
ADD COLUMN IF NOT EXISTS subscription_price_idr NUMERIC(12,2) DEFAULT 39000.00,
ADD COLUMN IF NOT EXISTS is_subscription_enabled BOOLEAN DEFAULT true;

-- 1. Create table public.ott_payment_orders
CREATE TABLE IF NOT EXISTS public.ott_payment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.ott_channels(id) ON DELETE CASCADE,
    order_type TEXT NOT NULL CHECK (order_type IN ('ppv_single', 'season_pass', 'svod_channel')),
    content_id UUID NULL,
    content_type TEXT NULL CHECK (content_type IN ('film', 'episode', 'series', 'season', 'channel')),
    title TEXT NOT NULL,
    gross_amount NUMERIC(12,2) NOT NULL CHECK (gross_amount >= 0),
    gateway_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (gateway_fee >= 0),
    platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (platform_fee >= 0),
    net_creator_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (net_creator_amount >= 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settlement', 'capture', 'deny', 'cancel', 'expire', 'refund')),
    payment_gateway TEXT NOT NULL DEFAULT 'midtrans',
    payment_method TEXT NOT NULL DEFAULT 'qris',
    gateway_transaction_id TEXT NULL,
    gateway_payload JSONB NULL DEFAULT '{}'::jsonb,
    entitlement_fulfilled BOOLEAN NOT NULL DEFAULT false,
    pass_id UUID NULL REFERENCES public.ott_access_passes(id) ON DELETE SET NULL,
    subscription_id UUID NULL REFERENCES public.ott_viewer_subscriptions(id) ON DELETE SET NULL,
    settled_at TIMESTAMPTZ NULL,
    refunded_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & lookups
CREATE INDEX IF NOT EXISTS idx_ott_payment_orders_user ON public.ott_payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_ott_payment_orders_channel ON public.ott_payment_orders(channel_id);
CREATE INDEX IF NOT EXISTS idx_ott_payment_orders_order_number ON public.ott_payment_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_ott_payment_orders_status ON public.ott_payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_ott_payment_orders_content ON public.ott_payment_orders(content_type, content_id);

-- 2. Row Level Security
ALTER TABLE public.ott_payment_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS ott_orders_viewer_select ON public.ott_payment_orders;
DROP POLICY IF EXISTS ott_orders_creator_select ON public.ott_payment_orders;
DROP POLICY IF EXISTS ott_orders_service_all ON public.ott_payment_orders;

-- Viewers can inspect only their own orders
CREATE POLICY ott_orders_viewer_select ON public.ott_payment_orders
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Creators can inspect all orders issued for channels they own
CREATE POLICY ott_orders_creator_select ON public.ott_payment_orders
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.ott_channels c
        WHERE c.id = ott_payment_orders.channel_id
        AND c.user_id = auth.uid()
    ));

-- Backend service role has full access
CREATE POLICY ott_orders_service_all ON public.ott_payment_orders
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. Atomic Fulfillment Function with Advisory Lock & Idempotency
CREATE OR REPLACE FUNCTION public.fulfill_ott_payment_order(
    p_order_number TEXT,
    p_gateway_transaction_id TEXT,
    p_status TEXT,
    p_gateway_payload JSONB DEFAULT '{}'::jsonb,
    p_gateway_fee NUMERIC DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order public.ott_payment_orders%ROWTYPE;
    v_pass_id UUID := NULL;
    v_sub_id UUID := NULL;
    v_platform_fee NUMERIC(12,2) := 0;
    v_net_creator NUMERIC(12,2) := 0;
    v_existing_sub_id UUID := NULL;
BEGIN
    -- Acquire transaction-level advisory lock based on order_number to prevent race conditions
    PERFORM pg_advisory_xact_lock(hashtext(p_order_number));

    -- Lock and retrieve the order row
    SELECT * INTO v_order
    FROM public.ott_payment_orders
    WHERE order_number = p_order_number
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ORDER_NOT_FOUND',
            'order_number', p_order_number
        );
    END IF;

    -- Handle Settlement / Capture (Success)
    IF p_status IN ('settlement', 'capture') THEN
        -- Idempotency check: if already fulfilled, return existing details without duplicating passes
        IF v_order.entitlement_fulfilled = true THEN
            RETURN jsonb_build_object(
                'success', true,
                'status', v_order.status,
                'already_fulfilled', true,
                'order_number', v_order.order_number,
                'pass_id', v_order.pass_id,
                'subscription_id', v_order.subscription_id
            );
        END IF;

        -- Fee calculation (Standard: 10% platform fee, rest to creator minus gateway fee)
        v_platform_fee := ROUND(v_order.gross_amount * 0.10, 2);
        v_net_creator := GREATEST(0.00, v_order.gross_amount - COALESCE(p_gateway_fee, 0.00) - v_platform_fee);

        -- Fulfill based on order_type
        IF v_order.order_type IN ('ppv_single', 'season_pass') THEN
            -- Issue 48-hour access pass (or 30 days for season pass)
            INSERT INTO public.ott_access_passes (
                user_id,
                channel_id,
                content_type,
                content_id,
                order_ref_id,
                price_paid_idr,
                currency,
                status,
                valid_from,
                valid_until
            ) VALUES (
                v_order.user_id,
                v_order.channel_id,
                COALESCE(v_order.content_type, 'film'),
                COALESCE(v_order.content_id, v_order.channel_id),
                v_order.order_number,
                v_order.gross_amount,
                v_order.currency,
                'active',
                NOW(),
                CASE 
                    WHEN v_order.order_type = 'season_pass' THEN NOW() + INTERVAL '30 days'
                    ELSE NOW() + INTERVAL '48 hours'
                END
            )
            RETURNING id INTO v_pass_id;

        ELSIF v_order.order_type = 'svod_channel' THEN
            -- Check if user already has an active subscription for this channel
            SELECT id INTO v_existing_sub_id
            FROM public.ott_viewer_subscriptions
            WHERE user_id = v_order.user_id AND channel_id = v_order.channel_id;

            IF v_existing_sub_id IS NOT NULL THEN
                UPDATE public.ott_viewer_subscriptions
                SET status = 'active',
                    current_period_end = GREATEST(current_period_end, NOW()) + INTERVAL '30 days',
                    price_paid_idr = v_order.gross_amount,
                    updated_at = NOW()
                WHERE id = v_existing_sub_id
                RETURNING id INTO v_sub_id;
            ELSE
                INSERT INTO public.ott_viewer_subscriptions (
                    user_id,
                    channel_id,
                    tier_name,
                    billing_cycle,
                    status,
                    price_paid_idr,
                    current_period_start,
                    current_period_end,
                    auto_renew
                ) VALUES (
                    v_order.user_id,
                    v_order.channel_id,
                    'Channel Subscriber',
                    'monthly',
                    'active',
                    v_order.gross_amount,
                    NOW(),
                    NOW() + INTERVAL '30 days',
                    true
                )
                RETURNING id INTO v_sub_id;
            END IF;
        END IF;

        -- Update order as settled and fulfilled
        UPDATE public.ott_payment_orders
        SET status = p_status,
            gateway_transaction_id = COALESCE(p_gateway_transaction_id, gateway_transaction_id),
            gateway_payload = p_gateway_payload,
            gateway_fee = COALESCE(p_gateway_fee, 0.00),
            platform_fee = v_platform_fee,
            net_creator_amount = v_net_creator,
            entitlement_fulfilled = true,
            pass_id = v_pass_id,
            subscription_id = v_sub_id,
            settled_at = NOW(),
            updated_at = NOW()
        WHERE id = v_order.id;

        RETURN jsonb_build_object(
            'success', true,
            'status', p_status,
            'order_number', v_order.order_number,
            'pass_id', v_pass_id,
            'subscription_id', v_sub_id,
            'gross_amount', v_order.gross_amount,
            'net_creator_amount', v_net_creator
        );

    -- Handle Refund
    ELSIF p_status = 'refund' THEN
        -- Revoke issued entitlements
        IF v_order.pass_id IS NOT NULL THEN
            UPDATE public.ott_access_passes
            SET status = 'revoked', updated_at = NOW()
            WHERE id = v_order.pass_id;
        END IF;

        IF v_order.subscription_id IS NOT NULL THEN
            UPDATE public.ott_viewer_subscriptions
            SET status = 'canceled', updated_at = NOW()
            WHERE id = v_order.subscription_id;
        END IF;

        UPDATE public.ott_payment_orders
        SET status = 'refund',
            refunded_at = NOW(),
            updated_at = NOW(),
            gateway_payload = p_gateway_payload
        WHERE id = v_order.id;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'refund',
            'order_number', v_order.order_number,
            'revoked', true
        );

    -- Handle Pending, Deny, Cancel, Expire
    ELSE
        UPDATE public.ott_payment_orders
        SET status = p_status,
            gateway_transaction_id = COALESCE(p_gateway_transaction_id, gateway_transaction_id),
            gateway_payload = p_gateway_payload,
            updated_at = NOW()
        WHERE id = v_order.id;

        RETURN jsonb_build_object(
            'success', true,
            'status', p_status,
            'order_number', v_order.order_number
        );
    END IF;
END;
$$;

-- 4. Creator Revenue Analytics Query Function
CREATE OR REPLACE FUNCTION public.get_ott_creator_revenue_summary(
    p_channel_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_gross NUMERIC(12,2) := 0;
    v_gateway_fees NUMERIC(12,2) := 0;
    v_platform_fees NUMERIC(12,2) := 0;
    v_net_earnings NUMERIC(12,2) := 0;
    v_settled_orders BIGINT := 0;
    v_active_subscribers BIGINT := 0;
    v_ppv_tickets_sold BIGINT := 0;
BEGIN
    -- Only calculate from settled orders
    SELECT 
        COALESCE(SUM(gross_amount), 0.00),
        COALESCE(SUM(gateway_fee), 0.00),
        COALESCE(SUM(platform_fee), 0.00),
        COALESCE(SUM(net_creator_amount), 0.00),
        COUNT(*),
        COUNT(*) FILTER (WHERE order_type = 'ppv_single')
    INTO 
        v_gross,
        v_gateway_fees,
        v_platform_fees,
        v_net_earnings,
        v_settled_orders,
        v_ppv_tickets_sold
    FROM public.ott_payment_orders
    WHERE channel_id = p_channel_id
      AND status IN ('settlement', 'capture');

    -- Count active subscribers for this channel
    SELECT COUNT(*) INTO v_active_subscribers
    FROM public.ott_viewer_subscriptions
    WHERE channel_id = p_channel_id
      AND status = 'active'
      AND current_period_end > NOW();

    RETURN jsonb_build_object(
        'channel_id', p_channel_id,
        'gross_revenue_idr', v_gross,
        'gateway_fees_idr', v_gateway_fees,
        'platform_fees_idr', v_platform_fees,
        'net_creator_earnings_idr', v_net_earnings,
        'settled_orders_count', v_settled_orders,
        'active_subscribers_count', v_active_subscribers,
        'ppv_tickets_sold_count', v_ppv_tickets_sold,
        'data_mode', 'VERIFIED_ACTUAL'
    );
END;
$$;
