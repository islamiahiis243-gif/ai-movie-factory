/**
 * Vercel Serverless Function: POST /api/analytics/sync-worker
 * AI Movie Factory — Scheduled Analytics Sync Worker (T9.5)
 * Triggered periodically by Vercel Cron (schedule: every 4 hours).
 * Protected by CRON_SECRET or SUPABASE_SECRET_KEY.
 */

import { getSupabaseAdmin } from '../supabaseAdmin';
import { AnalyticsService } from './analyticsService';

export default async function handler(req: any, res: any) {
  // Support both GET (invoked by Vercel Cron) and POST (manual/webhook runners)
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use GET or POST.' });
  }

  const authHeader = String(req.headers?.authorization || '');
  const workerSecret =
    process.env.CRON_SECRET ||
    process.env.PUBLISHING_WORKER_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    '';

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!workerSecret || token !== workerSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid worker secret.' });
  }

  const results = [];

  try {
    // Query up to 10 published jobs with valid external publish IDs
    let publishedJobs: any[] = [];
    try {
      const adminSupabase = getSupabaseAdmin();
      const { data, error: fetchErr } = await adminSupabase
        .from('publishing_jobs')
        .select('id, user_id, platform, external_publish_id')
        .eq('status', 'published')
        .not('external_publish_id', 'is', null)
        .limit(10);

      if (fetchErr) {
        console.warn('Sync worker DB query returned error:', fetchErr.message);
      } else if (data) {
        publishedJobs = data;
      }
    } catch (err: any) {
      console.warn('Sync worker DB query fallback:', err.message);
    }

    for (const job of publishedJobs) {
      try {
        const snapshot = await AnalyticsService.syncJobAnalytics({
          publishingJobId: job.id,
          userId: job.user_id,
          syncSource: 'cron_sync',
        });
        results.push({ id: job.id, platform: job.platform, views: snapshot.views });
      } catch (err: any) {
        results.push({ id: job.id, platform: job.platform, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      syncedCount: results.length,
      results,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || 'Analytics sync worker encountered an unexpected error.',
    });
  }
}
