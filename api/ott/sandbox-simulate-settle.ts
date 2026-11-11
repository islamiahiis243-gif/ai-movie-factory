/**
 * Vercel Serverless Function: /api/ott/sandbox-simulate-settle
 * Secure backend simulation endpoint for automated testing in non-production environments.
 * Strictly blocked and forbidden in production.
 */

import { authenticateServerlessRequest } from '../../server/supabaseAdmin.ts';

export default async function handler(req: any, res: any) {
  // 1. Strict Environment Barrier: Prohibit execution in ANY production deployment
  const isProduction = 
    process.env.NODE_ENV === 'production' || 
    process.env.VERCEL_ENV === 'production' || 
    process.env.ENVIRONMENT === 'production';

  if (isProduction) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Sandbox simulation endpoint is permanently disabled in production environments.',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Strict Authentication & Role Guard: Caller must be authenticated
  let adminClient: any;
  try {
    const authContext = await authenticateServerlessRequest(req);
    adminClient = authContext.adminSupabase;
  } catch (authErr: any) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: `Authentication required for sandbox simulator: ${authErr.message}`,
    });
  }

  const { orderNumber } = req.body || {};
  if (!orderNumber || typeof orderNumber !== 'string') {
    return res.status(400).json({ error: 'orderNumber is required and must be a string' });
  }

  // 3. Strict Isolated Fixture Guard: Simulation is restricted ONLY to explicit test fixture orders
  const isFixtureOrder = orderNumber.startsWith('FIXTURE-') || orderNumber.startsWith('TEST-');
  if (!isFixtureOrder) {
    return res.status(403).json({
      error: 'FORBIDDEN_TARGET_ORDER',
      message: 'Simulation is strictly restricted to isolated test fixture orders (must begin with FIXTURE- or TEST-).',
    });
  }

  try {
    const { data: order, error: fetchErr } = await adminClient
      .from('ott_payment_orders')
      .select('id, gross_amount, channel_id, status')
      .eq('order_number', orderNumber)
      .single();

    if (fetchErr || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'pending') {
      return res.status(409).json({
        error: 'INVALID_ORDER_STATE',
        message: `Order is already in state: ${order.status}`,
      });
    }

    const { data: rpcRes, error: rpcErr } = await adminClient.rpc('fulfill_ott_payment_order', {
      p_order_number: orderNumber,
      p_gateway_transaction_id: `sandbox-settle-${Date.now()}`,
      p_status: 'settlement',
      p_gateway_payload: { method: 'sandbox_simulator', simulated_at: new Date().toISOString() },
      p_gateway_fee: Math.round(Number(order.gross_amount) * 0.007),
      p_refund_amount: 0.00,
    });

    if (rpcErr) {
      return res.status(500).json({ error: rpcErr.message });
    }

    return res.status(200).json({ success: true, result: rpcRes });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
