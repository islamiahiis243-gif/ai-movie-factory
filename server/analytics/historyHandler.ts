/**
 * Vercel Serverless Function: GET /api/analytics/history
 * AI Movie Factory — Analytics Historical Snapshots Endpoint (T9.5)
 * Returns authenticated user's time-series analytics snapshots.
 */

import { authenticateServerlessRequest } from '../supabaseAdmin';
import { AnalyticsService } from './analyticsService';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed. Use GET.' });
  }

  try {
    const { user } = await authenticateServerlessRequest(req);
    const jobId = req.query?.jobId ? String(req.query.jobId) : null;

    let snapshots = [];
    if (jobId) {
      snapshots = await AnalyticsService.getJobSnapshots({
        publishingJobId: jobId,
        userId: user.id,
      });
    } else {
      snapshots = await AnalyticsService.getUserAggregateSnapshots(user.id);
    }

    return res.status(200).json({
      success: true,
      snapshots,
    });
  } catch (err: any) {
    const status = err.message?.includes('autentikasi') ? 401 : 500;
    return res.status(status).json({
      error: err.message || 'Gagal memuat riwayat analitik.',
    });
  }
}
