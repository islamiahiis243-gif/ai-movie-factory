/**
 * Vercel Serverless Function: POST /api/publishing/dispatch
 * AI Movie Factory — Publishing Job Dispatcher Endpoint (T9.4)
 * Authenticates creator, validates job ownership, enforces idempotency, and executes publishing.
 */

import { authenticateServerlessRequest } from '../supabaseAdmin';
import { PublishingDispatcher } from './dispatcher';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const { user } = await authenticateServerlessRequest(req);
    const { jobId, idempotencyKey } = req.body || {};

    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({ error: 'Parameter "jobId" diperlukan.' });
    }

    const job = await PublishingDispatcher.dispatchJob({
      jobId,
      userId: user.id,
      idempotencyKey,
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
      error: err.message || 'Gagal memproses dispatch publikasi.',
    });
  }
}
