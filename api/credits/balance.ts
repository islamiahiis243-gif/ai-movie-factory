/**
 * Vercel Serverless Function: GET /api/credits/balance
 * AI Movie Factory — Protected User Credit Balance Query
 * Reads settled balance, active holds (reservations), and computed available balance.
 */

import { authenticateServerlessRequest } from '../lib/supabaseAdmin';
import { getUserCreditBalance } from '../lib/credits/creditEngine';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use GET or POST.' });
  }

  let adminSupabase: any = null;
  let user: any = null;

  try {
    const authResult = await authenticateServerlessRequest(req);
    adminSupabase = authResult.adminSupabase;
    user = authResult.user;
  } catch (err: any) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: err.message || 'Sesi autentikasi diperlukan.',
    });
  }

  try {
    const balance = await getUserCreditBalance(adminSupabase, user.id);
    return res.status(200).json({
      success: true,
      userId: user.id,
      ...balance,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'BALANCE_FETCH_FAILED',
      message: err.message || 'Gagal memuat saldo kredit pengguna.',
    });
  }
}
