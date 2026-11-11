-- ==============================================================================
-- Migration: upgrade_v3_17_5_ott_refund_identity_and_safe_cast.sql
-- Milestone: 2.9.3 — B2C Payment / OTT Commerce & Access Fulfillment
-- Hardening: Safe JSON Numeric Cast, Gateway Refund Event Identity, Zero-Drift Ledger
-- ==============================================================================

-- Drop previous function overloads
DROP FUNCTION IF EXISTS public.fulfill_ott_payment_order(TEXT, TEXT, TEXT, JSONB, NUMERIC);
DROP FUNCTION IF EXISTS public.fulfill_ott_payment_order(TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.fulfill_ott_payment_order(
    p_order_number TEXT,
    p_gateway_transaction_id TEXT,
    p_status TEXT,
    p_gateway_payload JSONB DEFAULT '{}'::jsonb,
    p_gateway_fee NUMERIC DEFAULT 0,
    p_refund_amount NUMERIC DEFAULT NULL,
    p_refund_key TEXT DEFAULT NULL
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
    v_refund_chunk NUMERIC(12,2) := 0.00;
    v_effective_refund_key TEXT := NULL;
    v_new_refunded_total NUMERIC(12,2) := 0.00;
    v_effective_gross NUMERIC(12,2) := 0.00;
    v_remaining_refundable NUMERIC(12,2) := 0.00;
    v_existing_refund_id UUID := NULL;
    v_payload_amount NUMERIC(12,2) := NULL;
    v_event_ts TEXT := NULL;
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
    IF v_order.status IN ('settlement', 'capture', 'partial_refund', 'refund') AND p_status = 'pending' THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', v_order.status,
            'ignored', true,
            'message', 'Order is already settled/processed; pending callback ignored'
        );
    END IF;

    -- State Transition Guard: Do not allow finalized non-settleable orders to become settled
    IF v_order.status IN ('refund', 'cancel', 'expire') AND p_status IN ('settlement', 'capture') THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', v_order.status,
            'error', 'ILLEGAL_STATE_TRANSITION',
            'message', 'Order is in final non-settleable status (' || v_order.status || ')'
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
                    false
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
            refunded_amount = 0.00,
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

    -- Handle Refund (both Full and Partial)
    ELSIF p_status IN ('refund', 'partial_refund') THEN
        -- State guard: Order must be settled or in partial_refund before it can receive refund events
        IF v_order.status NOT IN ('settlement', 'capture', 'partial_refund', 'refund') THEN
            RETURN jsonb_build_object(
                'success', false,
                'status', v_order.status,
                'error', 'ILLEGAL_STATE_TRANSITION',
                'message', 'Cannot process refund on order with status "' || v_order.status || '"'
            );
        END IF;

        -- Safe numeric extraction from payload using strict regex (Prevents PostgreSQL cast crashes)
        IF (p_gateway_payload->>'refund_amount') IS NOT NULL
           AND (p_gateway_payload->>'refund_amount') ~ '^[0-9]+(\.[0-9]+)?$' THEN
            v_payload_amount := (p_gateway_payload->>'refund_amount')::numeric;
        ELSIF (p_gateway_payload ? 'refunds') AND jsonb_typeof(p_gateway_payload->'refunds') = 'array' THEN
            SELECT COALESCE(SUM(
                CASE 
                    WHEN (elem->>'refund_amount') ~ '^[0-9]+(\.[0-9]+)?$' 
                    THEN (elem->>'refund_amount')::numeric 
                    ELSE 0.00 
                END
            ), 0.00)
            INTO v_payload_amount
            FROM jsonb_array_elements(p_gateway_payload->'refunds') AS elem;
        END IF;

        -- Calculate remaining refundable balance
        v_remaining_refundable := GREATEST(0.00, v_order.gross_amount - COALESCE(v_order.refunded_amount, 0.00));

        -- Determine the nominal refund chunk for this event
        IF p_refund_amount IS NOT NULL AND p_refund_amount > 0 THEN
            v_refund_chunk := p_refund_amount;
        ELSIF v_payload_amount IS NOT NULL AND v_payload_amount > 0 THEN
            v_refund_chunk := v_payload_amount;
        ELSIF p_status = 'refund' THEN
            -- Full refund without explicit chunk defaults strictly to remaining refundable balance
            v_refund_chunk := v_remaining_refundable;
        ELSE
            v_refund_chunk := 0.00;
        END IF;

        -- Extract stable refund event identity from gateway
        v_effective_refund_key := COALESCE(
            NULLIF(p_refund_key, ''),
            NULLIF(p_gateway_payload->>'refund_id', ''),
            NULLIF(p_gateway_payload->>'refund_key', ''),
            NULLIF(p_gateway_payload->>'refund_chargeback_id', ''),
            NULLIF(p_gateway_payload->>'id', '')
        );

        -- If gateway did not supply a direct ID, construct a deterministic event identity
        IF v_effective_refund_key IS NULL THEN
            v_event_ts := COALESCE(
                NULLIF(p_gateway_payload->>'transaction_time', ''),
                NULLIF(p_gateway_payload->>'settlement_time', ''),
                NULLIF(p_gateway_payload->>'refund_time', ''),
                'event_ts'
            );
            v_effective_refund_key := 'rf_evt_' || encode(
                sha256(
                    (v_order.order_number || ':' ||
                     COALESCE(NULLIF(p_gateway_payload->>'transaction_id', ''), v_order.gateway_transaction_id, 'tx') || ':' ||
                     v_refund_chunk::text || ':' ||
                     p_status || ':' ||
                     v_event_ts)::bytea
                ),
                'hex'
            );
        END IF;

        -- IDEMPOTENCY CHECK: Check if this specific refund event was already recorded in ledger
        SELECT id INTO v_existing_refund_id
        FROM public.ott_payment_order_refunds
        WHERE order_id = v_order.id AND refund_key = v_effective_refund_key;

        IF v_existing_refund_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'status', v_order.status,
                'order_number', v_order.order_number,
                'already_processed', true,
                'refunded_amount', v_order.refunded_amount,
                'net_creator_amount', v_order.net_creator_amount,
                'message', 'Duplicate refund event ignored idempotently'
            );
        END IF;

        -- If order is ALREADY fully refunded (status='refund' and balance=0), reject new distinct refund events
        IF v_order.status = 'refund' AND v_remaining_refundable <= 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'status', v_order.status,
                'error', 'ILLEGAL_STATE_TRANSITION',
                'message', 'Order is already fully refunded; cannot process additional refund event'
            );
        END IF;

        -- Strict positive validation: Refund chunk must be greater than zero
        IF v_refund_chunk <= 0.00 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'INVALID_REFUND_AMOUNT',
                'message', 'Refund rejected: positive refund amount is required'
            );
        END IF;

        -- Strict ceiling guard: Chunk cannot exceed remaining refundable balance
        IF v_refund_chunk > v_remaining_refundable THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'REFUND_EXCEEDS_REMAINING_BALANCE',
                'message', 'Requested refund chunk (' || v_refund_chunk || ') exceeds remaining balance (' || v_remaining_refundable || ')'
            );
        END IF;

        -- 1. Insert verified event into ledger FIRST
        INSERT INTO public.ott_payment_order_refunds (
            order_id,
            order_number,
            refund_key,
            refund_amount,
            reason,
            gateway_payload
        ) VALUES (
            v_order.id,
            v_order.order_number,
            v_effective_refund_key,
            v_refund_chunk,
            CASE WHEN p_status = 'refund' THEN 'Full refund event from gateway callback' ELSE 'Partial refund event from gateway callback' END,
            p_gateway_payload
        );

        -- 2. Recalculate exact cumulative refund from ledger (ZERO-DRIFT GUARANTEE)
        SELECT COALESCE(SUM(refund_amount), 0.00) INTO v_new_refunded_total
        FROM public.ott_payment_order_refunds
        WHERE order_id = v_order.id;

        v_effective_gross := GREATEST(0.00, v_order.gross_amount - v_new_refunded_total);
        v_platform_fee := ROUND(v_effective_gross * 0.10, 2);
        v_net_creator := GREATEST(0.00, v_effective_gross - COALESCE(v_order.gateway_fee, 0.00) - v_platform_fee);

        -- If cumulative refund reaches 100% of gross, or gateway sent full 'refund'
        IF p_status = 'refund' OR v_new_refunded_total >= v_order.gross_amount THEN
            -- Revoke access passes and subscriptions
            IF v_order.pass_id IS NOT NULL THEN
                UPDATE public.ott_access_passes SET status = 'revoked', updated_at = NOW() WHERE id = v_order.pass_id;
            END IF;
            IF v_order.subscription_id IS NOT NULL THEN
                UPDATE public.ott_viewer_subscriptions SET status = 'cancelled', updated_at = NOW() WHERE id = v_order.subscription_id;
            END IF;

            UPDATE public.ott_payment_orders
            SET status = 'refund',
                refunded_amount = v_new_refunded_total,
                platform_fee = 0.00,
                net_creator_amount = 0.00,
                refunded_at = NOW(),
                updated_at = NOW(),
                gateway_payload = p_gateway_payload
            WHERE id = v_order.id;

            RETURN jsonb_build_object(
                'success', true,
                'status', 'refund',
                'order_number', v_order.order_number,
                'refunded_amount', v_new_refunded_total,
                'net_creator_amount', 0.00,
                'revoked', true
            );
        ELSE
            UPDATE public.ott_payment_orders
            SET status = 'partial_refund',
                refunded_amount = v_new_refunded_total,
                platform_fee = v_platform_fee,
                net_creator_amount = v_net_creator,
                refunded_at = NOW(),
                updated_at = NOW(),
                gateway_payload = p_gateway_payload
            WHERE id = v_order.id;

            RETURN jsonb_build_object(
                'success', true,
                'status', 'partial_refund',
                'order_number', v_order.order_number,
                'refunded_amount', v_new_refunded_total,
                'net_creator_amount', v_net_creator,
                'revoked', false
            );
        END IF;

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

-- Restrict fulfill_ott_payment_order strictly to service_role
REVOKE ALL ON FUNCTION public.fulfill_ott_payment_order(TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_ott_payment_order(TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, TEXT) TO service_role;

-- Security Advisor Linter Remediation: Revoke public execute on internal trigger functions
REVOKE ALL ON FUNCTION public.check_ott_access_pass_channel_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_ott_master_approval_before_publishing() FROM PUBLIC, anon, authenticated;
