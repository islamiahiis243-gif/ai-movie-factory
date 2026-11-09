/**
 * Vercel Serverless Function: POST /api/analytics/sync
 * AI Movie Factory — Live Analytics Sync Endpoint (T9.5)
 * Authenticates creator, validates job ownership, pulls real-time metrics, and records snapshot.
 */

import { authenticateServerlessRequest } from '../supabaseAdmin';
import { AnalyticsService } from './analyticsService';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const { user } = await authenticateServerlessRequest(req);
    const { publishingJobId } = req.body || {};

    if (!publishingJobId || typeof publishingJobId !== 'string') {
      return res.status(400).json({ error: 'Parameter "publishingJobId" diperlukan.' });
    }

    const snapshot = await AnalyticsService.syncJobAnalytics({
      publishingJobId,
      userId: user.id,
      syncSource: 'manual_refresh',
    });

    return res.status(200).json({
      success: true,
      snapshot,
    });
  } catch (err: any) {
    const status = err.message?.includes('autentikasi')
      ? 401
      : err.message?.includes('Akses ditolak')
      ? 403
      : 500;

    return res.status(status).json({
      error: err.message || 'Gagal menyinkronkan analitik platform.',
    });
  }
}
