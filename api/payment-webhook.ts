/**
 * Vercel Serverless Function: /api/payment-webhook
 * Verified Server-Side Payment Webhook Receiver for Midtrans & Stripe
 * Reference: SSOT Part 8 (Sec 20), Part 9 (Sec 21, 22), Part 14 (Sec 41)
 *
 * Security Invariant:
 * In V3.2 Enterprise Master SQL, `public.payment_orders` revokes UPDATE from client roles (`authenticated`, `anon`).
 * Only the server-side `service_role` (using `SUPABASE_SECRET_KEY`) after cryptographic webhook signature
 * verification can transition an order from `pending` to `settlement` and credit `public.credit_transactions`.
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export function verifyMidtransSignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
  signatureKey: string;
}): boolean {
  const { orderId, statusCode, grossAmount, serverKey, signatureKey } = params;
  if (!orderId || !statusCode || !grossAmount || !serverKey || !signatureKey) {
    return false;
  }
  const payload = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const expectedHash = crypto.createHash('sha512').update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'utf8'),
      Buffer.from(signatureKey, 'utf8')
    );
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const body = req.body || {};
  const provider = (req.headers?.['x-payment-provider'] || body.provider || 'midtrans').toLowerCase();

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (provider === 'midtrans') {
    const midtransServerKey = process.env.MIDTRANS_SERVER_KEY || '';
    if (!midtransServerKey) {
      return res.status(503).json({
        error: 'MIDTRANS_SERVER_KEY belum dikonfigurasi pada environment variables server.',
      });
    }

    const isValid = verifyMidtransSignature({
      orderId: String(body.order_id || ''),
      statusCode: String(body.status_code || ''),
      grossAmount: String(body.gross_amount || ''),
      serverKey: midtransServerKey,
      signatureKey: String(body.signature_key || ''),
    });

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid Midtrans SHA-512 webhook signature.',
      });
    }

    const transactionStatus = String(body.transaction_status || '');
    const isSettled = transactionStatus === 'settlement' || transactionStatus === 'capture';

    if (isSettled && supabaseUrl && supabaseServiceKey) {
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: order } = await adminSupabase
        .from('payment_orders')
        .update({
          status: 'settlement',
          paid_at: new Date().toISOString(),
          external_reference: String(body.transaction_id || body.order_id),
        })
        .eq('order_number', String(body.order_id))
        .eq('status', 'pending')
        .select()
        .single();

      if (order) {
        await adminSupabase.from('credit_transactions').insert({
          user_id: order.user_id,
          transaction_type: order.package_type === 'subscription' ? 'monthly_allotment' : 'purchase',
          amount: order.credits_granted,
          balance_after: order.credits_granted,
          provider: 'midtrans',
          model: order.payment_method,
          operation: 'verified_webhook_settlement',
          estimated_cost_usd: 0,
          actual_cost_usd: 0,
          description: `Verified Webhook Settlement: ${order.package_name} (${order.order_number})`,
          status: 'completed',
          idempotency_key: `webhook_midtrans_${order.order_number}`,
        });
      }
    }

    return res.status(200).json({
      status: 'verified',
      provider: 'midtrans',
      order_id: body.order_id,
      settled: isSettled,
    });
  }

  return res.status(400).json({
    error: `Unsupported payment webhook provider: ${provider}`,
  });
}
