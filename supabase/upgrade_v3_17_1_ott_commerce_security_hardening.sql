-- ==============================================================================
-- Migration: upgrade_v3_17_1_ott_commerce_security_hardening.sql
-- Milestone: 2.9.3 — Security Hardening & Privilege Restrictions
-- 
-- 1. Restricts fulfill_ott_payment_order strictly to service_role (revokes from PUBLIC/anon/authenticated)
-- 2. Hardens get_ott_creator_revenue_summary with channel ownership authorization guard
-- 3. Corrects SVOD subscription auto_renew flag to false (fixed-term 30 days)
-- 4. Differentiates full refund from partial refund
-- ==============================================================================

-- 0. Update check constraint to allow partial_refund
ALTER TABLE public.ott_payment_orders DROP CONSTRAINT IF EXISTS ott_payment_orders_status_check;
ALTER TABLE public.ott_payment_orders ADD CONSTRAINT ott_payment_orders_status_check 
CHECK (status IN ('pending', 'settlement', 'capture', 'deny', 'cancel', 'expire', 'refund', 'partial_refund'));

-- 1. Hardened fulfill_ott_payment_order
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
    -- Acquire transaction-level advisory lock based on order_number
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

    -- State Transition Guard: Do not allow settled order to regress to pending
    IF v_order.status IN ('settlement', 'capture') AND p_status = 'pending' THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', v_order.status,
            'ignored', true,
            'message', 'Order is already settled; pending callback ignored'
        );
    END IF;

    -- Handle Settlement / Capture (Success)
    IF p_status IN ('settlement', 'capture') THEN
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

        -- Fee calculation: 10% platform fee, net to creator
        v_platform_fee := ROUND(v_order.gross_amount * 0.10, 2);
        v_net_creator := GREATEST(0.00, v_order.gross_amount - COALESCE(p_gateway_fee, 0.00) - v_platform_fee);

        IF v_order.order_type IN ('ppv_single', 'season_pass') THEN
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
            SELECT id INTO v_existing_sub_id
            FROM public.ott_viewer_subscriptions
            WHERE user_id = v_order.user_id AND channel_id = v_order.channel_id;

            IF v_existing_sub_id IS NOT NULL THEN
                UPDATE public.ott_viewer_subscriptions
                SET status = 'active',
                    current_period_end = GREATEST(current_period_end, NOW()) + INTERVAL '30 days',
                    price_paid_idr = v_order.gross_amount,
                    auto_renew = false,
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
                    false -- Fixed term 30 days without automated recurring charges
                )
                RETURNING id INTO v_sub_id;
            END IF;
        END IF;

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

    -- Handle Full Refund
    ELSIF p_status = 'refund' THEN
        IF v_order.pass_id IS NOT NULL THEN
            UPDATE public.ott_access_passes
            SET status = 'revoked', updated_at = NOW()
            WHERE id = v_order.pass_id;
        END IF;

        IF v_order.subscription_id IS NOT NULL THEN
            UPDATE public.ott_viewer_subscriptions
            SET status = 'cancelled', updated_at = NOW()
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

    -- Handle Partial Refund (Audit logged, but does not revoke access pass unless full refund)
    ELSIF p_status = 'partial_refund' THEN
        UPDATE public.ott_payment_orders
        SET status = 'partial_refund',
            updated_at = NOW(),
            gateway_payload = p_gateway_payload
        WHERE id = v_order.id;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'partial_refund',
            'order_number', v_order.order_number,
            'revoked', false
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

-- 2. Restrict Execution Privileges on fulfill_ott_payment_order
REVOKE ALL ON FUNCTION public.fulfill_ott_payment_order(TEXT, TEXT, TEXT, JSONB, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_ott_payment_order(TEXT, TEXT, TEXT, JSONB, NUMERIC) TO service_role;

-- 3. Hardened get_ott_creator_revenue_summary with Ownership Check
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
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();

    -- Authorization Guard: If called by an authenticated user, verify they own the channel
    -- (Bypassed only if called directly by service_role where auth.uid() is null)
    IF v_caller_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.ott_channels
            WHERE id = p_channel_id AND user_id = v_caller_id
        ) THEN
            RAISE EXCEPTION 'FORBIDDEN_CHANNEL_ACCESS: You do not own this channel';
        END IF;
    END IF;

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

-- Restrict revenue summary: accessible only to authenticated users and service_role (denied to anon and public)
REVOKE ALL ON FUNCTION public.get_ott_creator_revenue_summary(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ott_creator_revenue_summary(UUID) TO authenticated, service_role;
