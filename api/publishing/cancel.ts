/**
 * Vercel Serverless Function: POST /api/publishing/cancel
 * AI Movie Factory — Publishing Job Cancellation Endpoint (T9.4)
 */

import { authenticateServerlessRequest } from '../lib/supabaseAdmin';
import { PublishingDispatcher } from '../lib/publishing/dispatcher';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const { user } = await authenticateServerlessRequest(req);
    const { jobId } = req.body || {};

    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({ error: 'Parameter "jobId" diperlukan.' });
    }

    const job = await PublishingDispatcher.cancelJob({
      jobId,
      userId: user.id,
    });

    return res.status(200).json({
      success: true,
      job,
    });
  } catch (err: any) {
    const status = err.message?.includes('autentikasi')
      ? 401
      : err.message?.includes('Akses ditolak')
      ? 403
      : 500;

    return res.status(status).json({
      error: err.message || 'Gagal membatalkan job publikasi.',
    });
  }
}
