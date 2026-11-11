-- ==============================================================================
-- Migration: upgrade_v3_17_4_ott_strict_refund_ledger_hardening.sql
-- Milestone: 2.9.3 — Strict Financial Integrity, Stable Refund Identity & Zero Speculation
--
-- 1. Corrects parameter default: p_refund_amount NUMERIC DEFAULT NULL (not 0.00)
-- 2. Eliminates silent cap: Rejects refund if chunk > remaining refundable balance
-- 3. Stable refund identity: Deterministic gateway refund IDs or cryptographic payload hash
-- 4. Full refund idempotency: Duplicate full refund callbacks return idempotent success
-- 5. Strict state transition: Rejects partial refund on already fully refunded orders
-- ==============================================================================

-- Drop previous function overload
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

    -- Handle Full Refund
    ELSIF p_status = 'refund' THEN
        -- IDEMPOTENCY GUARD: If order is ALREADY fully refunded, return idempotent success
        IF v_order.status = 'refund' THEN
            RETURN jsonb_build_object(
                'success', true,
                'status', 'refund',
                'order_number', v_order.order_number,
                'already_fully_refunded', true,
                'refunded_amount', v_order.refunded_amount,
                'net_creator_amount', v_order.net_creator_amount,
                'message', 'Order is already fully refunded; duplicate full refund callback processed idempotently'
            );
        END IF;

        -- State guard: Order must be settled before it can be refunded
        IF v_order.status NOT IN ('settlement', 'capture', 'partial_refund') THEN
            RETURN jsonb_build_object(
                'success', false,
                'status', v_order.status,
                'error', 'ILLEGAL_STATE_TRANSITION',
                'message', 'Cannot refund order with status "' || v_order.status || '" (must be settled or partial_refund)'
            );
        END IF;

        -- Revoke access passes and cancel subscriptions
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

        -- Calculate final refund chunk required to close to 100% of gross
        v_refund_chunk := GREATEST(0.00, v_order.gross_amount - COALESCE(v_order.refunded_amount, 0.00));
        
        -- Stable identity for full refund
        v_effective_refund_key := COALESCE(
            NULLIF(p_refund_key, ''),
            NULLIF(p_gateway_payload->>'refund_id', ''),
            NULLIF(p_gateway_payload->>'refund_key', ''),
            'full-refund-' || v_order.order_number
        );

        IF v_refund_chunk > 0 THEN
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
                'Full refund closure',
                p_gateway_payload
            ) ON CONFLICT (order_id, refund_key) DO NOTHING;
        END IF;

        UPDATE public.ott_payment_orders
        SET status = 'refund',
            refunded_amount = v_order.gross_amount,
            net_creator_amount = 0.00,
            platform_fee = 0.00,
            refunded_at = NOW(),
            updated_at = NOW(),
            gateway_payload = p_gateway_payload
        WHERE id = v_order.id;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'refund',
            'order_number', v_order.order_number,
            'refunded_amount', v_order.gross_amount,
            'revoked', true
        );

    -- Handle Partial Refund
    ELSIF p_status = 'partial_refund' THEN
        -- State guard: Rejection of partial refund on already fully refunded orders
        IF v_order.status = 'refund' THEN
            RETURN jsonb_build_object(
                'success', false,
                'status', v_order.status,
                'error', 'ILLEGAL_STATE_TRANSITION',
                'message', 'Cannot process partial refund on order that is already fully refunded'
            );
        END IF;

        IF v_order.status NOT IN ('settlement', 'capture', 'partial_refund') THEN
            RETURN jsonb_build_object(
                'success', false,
                'status', v_order.status,
                'error', 'ILLEGAL_STATE_TRANSITION',
                'message', 'Cannot partial_refund order with status "' || v_order.status || '" (must be settled or partial_refund)'
            );
        END IF;

        -- Extract verified positive refund amount (Strict: No 50% assumption, No refund_key nominal mapping)
        IF p_refund_amount IS NOT NULL AND p_refund_amount > 0 THEN
            v_refund_chunk := p_refund_amount;
        ELSIF (p_gateway_payload->>'refund_amount') IS NOT NULL AND (p_gateway_payload->>'refund_amount')::numeric > 0 THEN
            v_refund_chunk := (p_gateway_payload->>'refund_amount')::numeric;
        ELSIF (p_gateway_payload ? 'refunds') THEN
            SELECT COALESCE(SUM((elem->>'refund_amount')::numeric), 0.00)
            INTO v_refund_chunk
            FROM jsonb_array_elements(p_gateway_payload->'refunds') AS elem;
        ELSE
            v_refund_chunk := 0.00;
        END IF;

        -- Strict financial validation: Positive nominal is mandatory
        IF v_refund_chunk <= 0.00 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'INVALID_REFUND_AMOUNT',
                'message', 'Partial refund rejected: positive refund amount is required from gateway payload'
            );
        END IF;

        -- Stable unique refund key
        v_effective_refund_key := COALESCE(
            NULLIF(p_refund_key, ''),
            NULLIF(p_gateway_payload->>'refund_id', ''),
            NULLIF(p_gateway_payload->>'refund_key', ''),
            NULLIF(p_gateway_payload->>'id', ''),
            'rf_' || encode(sha256((v_order.order_number || ':' || v_refund_chunk::text || ':' || p_gateway_payload::text)::bytea), 'hex')
        );

        -- IDEMPOTENCY CHECK: Reject duplicate deduction
        SELECT id INTO v_existing_refund_id
        FROM public.ott_payment_order_refunds
        WHERE order_id = v_order.id AND refund_key = v_effective_refund_key;

        IF v_existing_refund_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'status', 'partial_refund',
                'order_number', v_order.order_number,
                'already_processed', true,
                'refunded_amount', v_order.refunded_amount,
                'net_creator_amount', v_order.net_creator_amount,
                'message', 'Duplicate refund event ignored idempotently'
            );
        END IF;

        -- STRICT REFUND CEILING GUARD: Do NOT silently cap. If chunk > remaining, reject!
        v_remaining_refundable := GREATEST(0.00, v_order.gross_amount - COALESCE(v_order.refunded_amount, 0.00));
        IF v_refund_chunk > v_remaining_refundable THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'REFUND_EXCEEDS_REMAINING_BALANCE',
                'message', 'Requested refund chunk (' || v_refund_chunk || ') exceeds remaining refundable balance (' || v_remaining_refundable || ')'
            );
        END IF;

        -- Insert verified refund event into ledger
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
            'Partial refund verified from gateway callback',
            p_gateway_payload
        );

        -- Update cumulative refunded total
        v_new_refunded_total := v_order.refunded_amount + v_refund_chunk;
        v_effective_gross := GREATEST(0.00, v_order.gross_amount - v_new_refunded_total);
        v_platform_fee := ROUND(v_effective_gross * 0.10, 2);
        v_net_creator := GREATEST(0.00, v_effective_gross - COALESCE(v_order.gateway_fee, 0.00) - v_platform_fee);

        -- If cumulative refund reaches 100% of gross, revoke access and mark full refund
        IF v_new_refunded_total >= v_order.gross_amount THEN
            IF v_order.pass_id IS NOT NULL THEN
                UPDATE public.ott_access_passes SET status = 'revoked', updated_at = NOW() WHERE id = v_order.pass_id;
            END IF;
            IF v_order.subscription_id IS NOT NULL THEN
                UPDATE public.ott_viewer_subscriptions SET status = 'cancelled', updated_at = NOW() WHERE id = v_order.subscription_id;
            END IF;

            UPDATE public.ott_payment_orders
            SET status = 'refund',
                refunded_amount = v_order.gross_amount,
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
                'refunded_amount', v_order.gross_amount,
                'net_creator_amount', 0.00,
                'revoked', true
            );
        END IF;

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

REVOKE ALL ON FUNCTION public.fulfill_ott_payment_order(TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_ott_payment_order(TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, TEXT) TO service_role;
