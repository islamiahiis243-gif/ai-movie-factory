/**
 * Vercel Serverless Function: /api/ott/sandbox-simulate-settle
 * Secure backend simulation endpoint for sandbox / offline testing.
 * Strictly blocked in production.
 */

import { getSupabaseAdmin } from '../../server/supabaseAdmin.ts';

export default async function handler(req: any, res: any) {
  if (process.env.NODE_ENV === 'production' && process.env.MIDTRANS_IS_SANDBOX !== 'true') {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Sandbox simulation is disabled in production.',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { orderNumber } = req.body || {};
  if (!orderNumber) {
    return res.status(400).json({ error: 'orderNumber is required' });
  }

  try {
    const adminClient = getSupabaseAdmin();
    const { data: order } = await adminClient
      .from('ott_payment_orders')
      .select('gross_amount')
      .eq('order_number', orderNumber)
      .single();

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const { data: rpcRes, error: rpcErr } = await adminClient.rpc('fulfill_ott_payment_order', {
      p_order_number: orderNumber,
      p_gateway_transaction_id: `sandbox-settle-${Date.now()}`,
      p_status: 'settlement',
      p_gateway_payload: { method: 'sandbox_simulator' },
      p_gateway_fee: Math.round(Number(order.gross_amount) * 0.007),
    });

    if (rpcErr) {
      return res.status(500).json({ error: rpcErr.message });
    }

    return res.status(200).json({ success: true, result: rpcRes });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
